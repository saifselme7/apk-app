import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Console } from './Console'
import { GRID_ROWS, REVEAL_ROW_DELAY_MS } from '../config/game'
import type { M11SyncEvaluation } from '../utils/m11Snapshot'
import { evaluateM11Snapshot, liveValuesToRows } from '../utils/m11Snapshot'

/**
 * LIVE-MIRROR MODE tests. Firebase is "configured" and the /m11 listener is
 * mocked to deliver snapshots. The local generator is mocked to THROW if
 * ever called — proving the live path never generates random data.
 */

const generateMock = vi.hoisted(() =>
  vi.fn<() => { seed: number; createdAt: number; rows: unknown[] }>(() => {
    throw new Error('local generator must NOT be called while a valid live snapshot exists')
  }),
)

vi.mock('../utils/generator', () => ({
  generateDemoRound: generateMock,
}))

vi.mock('../services/firebase', () => ({
  isFirebaseConfigured: () => true,
  subscribeToConnectionState: () => () => undefined,
}))

const listeners = vi.hoisted(() => ({
  current: null as
    | { onUpdate: (u: { evaluation: M11SyncEvaluation; receivedAt: number }) => void
        onError?: (error: unknown) => void }
    | null,
}))

vi.mock('../services/m11', () => ({
  subscribeToM11Sync: (handlers: {
    onUpdate: (update: { evaluation: M11SyncEvaluation; receivedAt: number }) => void
    onError?: (error: unknown) => void
  }) => {
    listeners.current = handlers
    return () => undefined
  },
}))

/** Builds a raw /m11 node whose SAFE keys are exactly `safeKeys`. */
function snapshotWithSafe(safeKeys: string[], receivedAt: number) {
  const raw: Record<string, unknown> = {}
  for (let n = 1; n <= 50; n += 1) {
    const key = `m${n}`
    raw[key] = { [key]: safeKeys.includes(key) ? '1' : '0' }
  }
  return { evaluation: evaluateM11Snapshot(raw), receivedAt }
}

/** A deterministic local demo round for the generator mock. */
function demoRoundMock(safeKeys: string[], seed: number) {
  const values: Partial<Record<string, '0' | '1'>> = {}
  for (let n = 1; n <= 50; n += 1) values[`m${n}`] = '0'
  for (const key of safeKeys) values[key] = '1'
  return { seed, createdAt: seed * 1000, rows: liveValuesToRows(values) }
}

/** Currently revealed cells as a map key → 'safe' | 'bomb'. */
function revealedCellMap(): Record<string, string> {
  const map: Record<string, string> = {}
  for (const cell of screen.getAllByRole('img')) {
    const label = cell.getAttribute('aria-label') ?? ''
    const match = label.match(/^Position (m\d+) — (safe|bomb)$/)
    if (match) map[match[1]] = match[2]
  }
  return map
}

function revealAll() {
  for (let i = 0; i < GRID_ROWS; i += 1) {
    act(() => {
      vi.advanceTimersByTime(REVEAL_ROW_DELAY_MS)
    })
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  listeners.current = null
  generateMock.mockClear()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('Console — live Firebase mirror mode', () => {
  it('START/SHOW reveal EXACTLY the observed /m11 snapshot cells', () => {
    const SAFE = ['m1', 'm7', 'm13', 'm19', 'm25', 'm26', 'm32', 'm38', 'm39', 'm44', 'm46', 'm47', 'm48', 'm50']
    const delivered = snapshotWithSafe(SAFE, 1_700_000_000_000)
    render(<Console operatorId="op-live" onLogout={vi.fn()} />)

    act(() => {
      listeners.current?.onUpdate(delivered)
    })

    // Live mode announced before any round is loaded.
    expect(screen.getByTestId('data-source-badge')).toHaveTextContent(/Firebase — Read Only/i)

    fireEvent.click(screen.getByRole('button', { name: /load live round/i }))
    expect(screen.getByText(/Live \/m11 round loaded/i)).toBeInTheDocument()
    // Instant load: no generating phase, round ready immediately.
    expect(screen.queryByText(/Generating 50 positions/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /show/i }))
    revealAll()

    const cells = revealedCellMap()
    expect(Object.keys(cells)).toHaveLength(50)
    for (let n = 1; n <= 50; n += 1) {
      const key = `m${n}`
      expect(cells[key], `${key} must match the live snapshot`).toBe(
        SAFE.includes(key) ? 'safe' : 'bomb',
      )
    }
    expect(screen.getByText(/14 safe cells/i)).toBeInTheDocument()
  })

  it('never calls the local random generator while the snapshot is valid', () => {
    render(<Console operatorId="op-live" onLogout={vi.fn()} />)
    expect(listeners.current).not.toBeNull() // subscription effect must be attached
    act(() => {
      listeners.current?.onUpdate(snapshotWithSafe(['m3'], 1))
    })
    fireEvent.click(screen.getByRole('button', { name: /load live round/i }))
    fireEvent.click(screen.getByRole('button', { name: /show/i }))
    revealAll()
    expect(generateMock).not.toHaveBeenCalled()
  })

  it('replaces a held (not yet shown) live round when a newer snapshot arrives', () => {
    render(<Console operatorId="op-live" onLogout={vi.fn()} />)
    act(() => {
      listeners.current?.onUpdate(snapshotWithSafe(['m1'], 1_000))
    })
    fireEvent.click(screen.getByRole('button', { name: /load live round/i }))
    expect(screen.getByText(/Live \/m11 round loaded/i)).toBeInTheDocument()

    // Operator app publishes a new round → new snapshot event.
    act(() => {
      listeners.current?.onUpdate(snapshotWithSafe(['m2', 'm50'], 2_000))
    })

    fireEvent.click(screen.getByRole('button', { name: /show/i }))
    revealAll()
    const cells = revealedCellMap()
    expect(cells.m1).toBe('bomb') // old round gone — wholesale replacement
    expect(cells.m2).toBe('safe')
    expect(cells.m50).toBe('safe')
  })

  it('freezes the round during SHOW even if the snapshot changes mid-reveal', () => {
    render(<Console operatorId="op-live" onLogout={vi.fn()} />)
    act(() => {
      listeners.current?.onUpdate(snapshotWithSafe(['m1'], 1_000))
    })
    fireEvent.click(screen.getByRole('button', { name: /load live round/i }))
    fireEvent.click(screen.getByRole('button', { name: /show/i }))

    // Reveal 3 rows, then the database changes underneath.
    for (let i = 0; i < 3; i += 1) {
      act(() => {
        vi.advanceTimersByTime(REVEAL_ROW_DELAY_MS)
      })
    }
    act(() => {
      listeners.current?.onUpdate(snapshotWithSafe(['m50'], 9_000))
    })
    revealAll()

    const cells = revealedCellMap()
    expect(cells.m1).toBe('safe') // frozen round, not the new snapshot
    expect(cells.m50).toBe('bomb')
    // …and the UI points out that a newer snapshot exists.
    expect(screen.getByText(/Newer \/m11 snapshot received/i)).toBeInTheDocument()
  })

  it('falls back to the local demo generator when the snapshot is NOT valid', () => {
    // A deterministic, generator-shaped round built without the real generator.
    const values: Partial<Record<string, '0' | '1'>> = {}
    for (let n = 1; n <= 50; n += 1) values[`m${n}`] = '0'
    values.m1 = '1'
    generateMock.mockImplementation(() => ({
      seed: 42,
      createdAt: 123,
      rows: liveValuesToRows(values),
    }))

    const invalid: Record<string, unknown> = {}
    for (let n = 1; n <= 50; n += 1) invalid[`m${n}`] = { [`m${n}`]: n === 5 ? 1 : '0' } // m5 numeric → invalid
    render(<Console operatorId="op-live" onLogout={vi.fn()} />)
    act(() => {
      listeners.current?.onUpdate({ evaluation: evaluateM11Snapshot(invalid), receivedAt: 1 })
    })

    expect(screen.getByTestId('data-source-badge')).toHaveTextContent(/Demo \/ Local Simulation/i)

    fireEvent.click(screen.getByRole('button', { name: /new demo round/i }))
    act(() => {
      vi.advanceTimersByTime(2000) // START_SIMULATION_MS
    })
    expect(generateMock).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/Demo round ready/i)).toBeInTheDocument()
    expect(screen.getByTestId('data-source-badge')).toHaveTextContent(/Demo \/ Local Simulation/i)
  })

  it('keeps the read-only claim visible in live mode', () => {
    render(<Console operatorId="op-live" onLogout={vi.fn()} />)
    act(() => {
      listeners.current?.onUpdate(snapshotWithSafe(['m1'], 1))
    })
    expect(screen.getByText(/Disabled \(phase boundary\)/i)).toBeInTheDocument()
    expect(screen.getByTestId('m11-sync-status')).toHaveTextContent(/In sync/i)
  })
  it('NEW DEMO ROUND works while a live snapshot is valid and stays independent from Firebase', () => {
    generateMock.mockImplementationOnce(() => demoRoundMock(['m1'], 42))
    render(<Console operatorId="op-live" onLogout={vi.fn()} />)
    act(() => {
      listeners.current?.onUpdate(snapshotWithSafe(['m2', 'm3'], 1_000))
    })

    fireEvent.click(screen.getByRole('button', { name: /new demo round/i }))
    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(generateMock).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/Demo round ready/i)).toBeInTheDocument()
    expect(screen.getByTestId('data-source-badge')).toHaveTextContent(/Demo \/ Local Simulation/i)

    fireEvent.click(screen.getByRole('button', { name: /show/i }))
    revealAll()
    const cells = revealedCellMap()
    // The revealed round is the MOCKED local round — NOT the live snapshot.
    expect(cells.m1).toBe('safe')
    expect(cells.m2).toBe('bomb')
    expect(cells.m3).toBe('bomb')
    expect(screen.getByText(/1 safe cells/i)).toBeInTheDocument()
  })

  it('a Firebase snapshot arriving during a demo reveal does NOT mutate the demo round', () => {
    generateMock.mockImplementationOnce(() => demoRoundMock(['m1'], 7))
    render(<Console operatorId="op-live" onLogout={vi.fn()} />)
    act(() => {
      listeners.current?.onUpdate(snapshotWithSafe(['m2'], 1_000))
    })

    fireEvent.click(screen.getByRole('button', { name: /new demo round/i }))
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    fireEvent.click(screen.getByRole('button', { name: /show/i }))

    for (let i = 0; i < 3; i += 1) {
      act(() => {
        vi.advanceTimersByTime(REVEAL_ROW_DELAY_MS)
      })
    }
    // New live data arrives mid-reveal.
    act(() => {
      listeners.current?.onUpdate(snapshotWithSafe(['m50'], 9_000))
    })
    revealAll()

    const cells = revealedCellMap()
    expect(cells.m1).toBe('safe') // still the frozen demo round
    expect(cells.m2).toBe('bomb')
    expect(cells.m50).toBe('bomb')
    expect(screen.getByTestId('data-source-badge')).toHaveTextContent(/Demo \/ Local Simulation/i)
  })

  it('a second NEW DEMO ROUND replaces the previous demo round completely', () => {
    generateMock.mockImplementationOnce(() => demoRoundMock(['m1'], 1))
    generateMock.mockImplementationOnce(() => demoRoundMock(['m50'], 2))
    render(<Console operatorId="op-live" onLogout={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /new demo round/i }))
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    // Second demo round replaces the first wholesale.
    fireEvent.click(screen.getByRole('button', { name: /new demo round/i }))
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(generateMock).toHaveBeenCalledTimes(2)

    fireEvent.click(screen.getByRole('button', { name: /show/i }))
    revealAll()
    const cells = revealedCellMap()
    expect(cells.m1).toBe('bomb') // round ONE's safe cell is gone
    expect(cells.m50).toBe('safe') // round TWO's safe cell is present
  })

  it('LOAD LIVE ROUND replaces a held demo round completely', () => {
    generateMock.mockImplementationOnce(() => demoRoundMock(['m1'], 5))
    render(<Console operatorId="op-live" onLogout={vi.fn()} />)
    act(() => {
      listeners.current?.onUpdate(snapshotWithSafe(['m2', 'm3'], 1_000))
    })

    fireEvent.click(screen.getByRole('button', { name: /new demo round/i }))
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByTestId('data-source-badge')).toHaveTextContent(/Demo \/ Local Simulation/i)

    fireEvent.click(screen.getByRole('button', { name: /load live round/i }))
    expect(screen.getByText(/Live \/m11 round loaded/i)).toBeInTheDocument()
    expect(screen.getByTestId('data-source-badge')).toHaveTextContent(/Firebase — Read Only/i)

    fireEvent.click(screen.getByRole('button', { name: /show/i }))
    revealAll()
    const cells = revealedCellMap()
    expect(cells.m1).toBe('bomb') // demo round's safe cell is gone
    expect(cells.m2).toBe('safe') // live snapshot's cells are shown
    expect(cells.m3).toBe('safe')
  })
})
