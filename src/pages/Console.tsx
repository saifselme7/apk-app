import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  GRID_ROWS,
  REVEAL_ROW_DELAY_MS,
  REVEAL_ROW_DELAY_REDUCED_MOTION_MS,
  START_SIMULATION_MS,
} from '../config/game'
import { useFirebaseConnection } from '../hooks/useFirebaseConnection'
import { useM11Mirror } from '../hooks/useM11Mirror'
import { useSimulatedOnlineUsers } from '../hooks/useSimulatedOnlineUsers'
import { Header } from '../components/Header'
import { ActionButtons } from '../components/ActionButtons'
import { GameGrid } from '../components/GameGrid'
import { MirrorPanel } from '../components/MirrorPanel'
import { ConsoleLayout } from '../layouts/ConsoleLayout'
import { generateDemoRound } from '../utils/generator'
import { prefersReducedMotion } from '../utils/random'
import type { DemoRound, RoundPhase } from '../types/game'

export interface ConsoleProps {
  operatorId: string
  onLogout: () => void
}

const START_MESSAGES = [
  'Contacting demo engine…',
  'Generating 50 positions…',
  'Validating round contract…',
] as const

const PHASE_STATUS: Record<RoundPhase, string> = {
  idle: 'No round yet — press START.',
  generating: 'Preparing demo round…',
  ready: 'Round ready — press SHOW to reveal it.',
  revealing: 'Revealing result…',
  revealed: 'Round complete — press START for a new round.',
}

/** SCREEN 2 — the operator console (grid + ladder + START/SHOW). */
export function Console({ operatorId, onLogout }: ConsoleProps) {
  const [phase, setPhase] = useState<RoundPhase>('idle')
  const [round, setRound] = useState<DemoRound | null>(null)
  const [revealedRows, setRevealedRows] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [messageIndex, setMessageIndex] = useState(0)

  const onlineUsers = useSimulatedOnlineUsers()
  const connection = useFirebaseConnection()
  const mirror = useM11Mirror()

  // START — generate a complete demo round locally (never touches Firebase).
  const handleStart = useCallback(() => {
    if (phase === 'generating' || phase === 'revealing') return
    setError(null)
    setRound(null)
    setRevealedRows(0)
    setMessageIndex(0)
    setPhase('generating')

    window.setTimeout(() => {
      try {
        const next = generateDemoRound()
        setRound(next)
        setPhase('ready')
      } catch (cause) {
        // Details stay in the console log; the UI shows a friendly message.
        console.error('[demo] generator failure', cause)
        setPhase('idle')
        setError('The demo generator failed to create a valid round. Please try START again.')
      }
    }, START_SIMULATION_MS)
  }, [phase])

  // Cycle the loading messages while "connecting" (visual parity, clearly a demo).
  useEffect(() => {
    if (phase !== 'generating') return
    const id = window.setInterval(() => {
      setMessageIndex((index) => (index + 1) % START_MESSAGES.length)
    }, START_SIMULATION_MS / (START_MESSAGES.length + 1))
    return () => window.clearInterval(id)
  }, [phase])

  // SHOW — begin the progressive reveal.
  const handleShow = useCallback(() => {
    if (phase !== 'ready' || round === null) return
    setPhase('revealing')
    setRevealedRows(0)
  }, [phase, round])

  // Progressive reveal: one row at a time, bottom (row 1) → top (row 10),
  // exactly like the original app's Show. The round stays stable throughout.
  useEffect(() => {
    if (phase !== 'revealing') return
    if (revealedRows >= GRID_ROWS) {
      setPhase('revealed')
      return
    }
    const delay = prefersReducedMotion()
      ? REVEAL_ROW_DELAY_REDUCED_MOTION_MS
      : REVEAL_ROW_DELAY_MS
    const id = window.setTimeout(() => setRevealedRows((rows) => rows + 1), delay)
    return () => window.clearTimeout(id)
  }, [phase, revealedRows])

  const safeCellCount = useMemo(
    () => round?.rows.flatMap((row) => row.cells).filter((cell) => cell.value === '1').length ?? 0,
    [round],
  )

  return (
    <ConsoleLayout
      header={
        <Header
          operatorId={operatorId}
          onlineUsers={onlineUsers}
          connection={connection}
          onLogout={onLogout}
        />
      }
    >
      <div className="space-y-5">
        {/* Round status line */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p aria-live="polite" className="text-sm font-medium text-slate-300">
            {PHASE_STATUS[phase]}
            {phase === 'revealed' && (
              <span className="ml-2 rounded-full bg-emerald-400/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
                {safeCellCount} safe cells
              </span>
            )}
          </p>
          {round && (
            <p className="text-xs tabular-nums text-slate-600">
              seed {round.seed} · generated{' '}
              {new Date(round.createdAt).toLocaleTimeString()}
            </p>
          )}
        </div>

        <ActionButtons phase={phase} onStart={handleStart} onShow={handleShow} />

        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-300 animate-fade-in"
          >
            <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        {/* Generating overlay message (kept inline above the grid to avoid layout shift) */}
        {phase === 'generating' && (
          <p className="flex items-center justify-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-4 py-3 text-center text-sm font-medium text-cyan-200 animate-pulse-soft">
            {START_MESSAGES[messageIndex]}
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              (demo simulation)
            </span>
          </p>
        )}

        <GameGrid rows={round?.rows ?? null} phase={phase} revealedRows={revealedRows} />

        {/* Reveal progress */}
        {(phase === 'revealing' || phase === 'revealed') && (
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span aria-live="polite">
              Row {Math.min(revealedRows, GRID_ROWS)} of {GRID_ROWS} revealed
            </span>
            <div className="h-1.5 w-40 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-300"
                style={{ width: `${(Math.min(revealedRows, GRID_ROWS) / GRID_ROWS) * 100}%` }}
              />
            </div>
          </div>
        )}

        <MirrorPanel connection={connection} mirror={mirror} />
      </div>
    </ConsoleLayout>
  )
}
