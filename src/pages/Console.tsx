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
import { liveValuesToRows } from '../utils/m11Snapshot'
import { prefersReducedMotion } from '../utils/random'
import type { ConsoleRound, RoundPhase, RoundSource } from '../types/game'

export interface ConsoleProps {
  operatorId: string
  onLogout: () => void
}

const START_MESSAGES = [
  'Contacting demo engine…',
  'Generating 50 positions…',
  'Validating round contract…',
] as const

/** SCREEN 2 — the operator console (grid + ladder + START/SHOW).
 *
 * Two strictly separated data sources:
 * - LIVE mode  — Firebase configured AND /m11 currently valid (50/50):
 *   START freezes the observed snapshot into the round. No local
 *   generation happens, so the grid mirrors exactly what APP 2 reads.
 * - DEMO mode  — otherwise: the local demo generator (clearly labelled).
 */
export function Console({ operatorId, onLogout }: ConsoleProps) {
  const [phase, setPhase] = useState<RoundPhase>('idle')
  const [round, setRound] = useState<ConsoleRound | null>(null)
  const [revealedRows, setRevealedRows] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [messageIndex, setMessageIndex] = useState(0)

  const onlineUsers = useSimulatedOnlineUsers()
  const connection = useFirebaseConnection()
  const mirror = useM11Mirror()

  // LIVE mode is only entered with a complete, contract-valid snapshot.
  const liveReady =
    mirror.active && mirror.status === 'valid' && mirror.evaluation !== null

  // What START will use next / what the badge shows when no round is held.
  const nextSource: RoundSource = liveReady ? 'live' : 'demo'
  // The badge always reflects the round actually on screen, if there is one.
  const badgeSource: RoundSource = round?.source ?? nextSource

  // START — in live mode freeze the observed snapshot; never generate.
  const handleStart = useCallback(() => {
    if (phase === 'generating' || phase === 'revealing') return
    setError(null)
    setRevealedRows(0)

    if (liveReady && mirror.evaluation) {
      // The snapshot is already subscribed locally — load it instantly.
      // No random generation, no Firebase interaction of any kind.
      try {
        setRound({
          source: 'live',
          createdAt: mirror.lastUpdated ?? Date.now(),
          rows: liveValuesToRows(mirror.evaluation.values),
        })
        setPhase('ready')
      } catch (cause) {
        console.error('[demo] live snapshot mapping failed', cause)
        setRound(null)
        setPhase('idle')
        setError('The live /m11 snapshot could not be mapped onto the grid. No data was changed.')
      }
      return
    }

    // DEMO mode — existing local simulation.
    setRound(null)
    setMessageIndex(0)
    setPhase('generating')
    window.setTimeout(() => {
      try {
        const next = generateDemoRound()
        setRound({ source: 'demo', seed: next.seed, createdAt: next.createdAt, rows: next.rows })
        setPhase('ready')
      } catch (cause) {
        // Details stay in the console log; the UI shows a friendly message.
        console.error('[demo] generator failure', cause)
        setPhase('idle')
        setError('The demo generator failed to create a valid round. Please try START again.')
      }
    }, START_SIMULATION_MS)
  }, [phase, liveReady, mirror.evaluation, mirror.lastUpdated])

  // Cycle the loading messages while "connecting" (visual parity, clearly a demo).
  useEffect(() => {
    if (phase !== 'generating') return
    const id = window.setInterval(() => {
      setMessageIndex((index) => (index + 1) % START_MESSAGES.length)
    }, START_SIMULATION_MS / (START_MESSAGES.length + 1))
    return () => window.clearInterval(id)
  }, [phase])

  // Live state consistency: when a NEWER valid snapshot arrives while a live
  // round is held but not yet revealed, replace it WHOLESALE (never mix an
  // old round with new data). During revealing/revealed the round stays
  // frozen so the SHOW animation cannot change halfway through; a hint is
  // shown instead and the next START picks the newest snapshot up.
  useEffect(() => {
    if (!liveReady || !mirror.evaluation) return
    if (phase === 'ready' && round?.source === 'live') {
      try {
        setRound({
          source: 'live',
          createdAt: mirror.lastUpdated ?? Date.now(),
          rows: liveValuesToRows(mirror.evaluation.values),
        })
      } catch {
        /* keep the previously held round — never partial updates */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mirror.evaluation])

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

  // A newer snapshot arrived while the held live round is frozen mid/after SHOW.
  const newerSnapshotAvailable =
    round?.source === 'live' &&
    mirror.lastUpdated !== null &&
    round.createdAt !== null &&
    mirror.lastUpdated > round.createdAt &&
    (phase === 'revealing' || phase === 'revealed')

  function statusLine(): string {
    if (phase === 'idle') {
      return liveReady
        ? 'Live /m11 snapshot available — press START to load it.'
        : 'No round yet — press START.'
    }
    if (phase === 'generating') return 'Preparing demo round…'
    if (phase === 'ready') {
      return round?.source === 'live'
        ? 'Live /m11 round loaded — press SHOW to reveal it.'
        : 'Demo round ready — press SHOW to reveal it.'
    }
    if (phase === 'revealing') return 'Revealing result…'
    return round?.source === 'live'
      ? 'Live round complete — press START to reload the current /m11.'
      : 'Round complete — press START for a new round.'
  }

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
        {/* Round status line + explicit data-source badge */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p aria-live="polite" className="text-sm font-medium text-slate-300">
            {statusLine()}
            {phase === 'revealed' && (
              <span className="ml-2 rounded-full bg-emerald-400/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
                {safeCellCount} safe cells
              </span>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {newerSnapshotAvailable && (
              <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-200">
                Newer /m11 snapshot received — reload with START
              </span>
            )}
            <span
              data-testid="data-source-badge"
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                badgeSource === 'live'
                  ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                  : 'border-amber-400/40 bg-amber-400/10 text-amber-300'
              }`}
              title={
                badgeSource === 'live'
                  ? 'Grid mirrors the observed read-only /m11 snapshot (same data APP 2 reads)'
                  : 'Locally generated simulation data — not from Firebase'
              }
            >
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${
                  badgeSource === 'live' ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              {badgeSource === 'live' ? 'Firebase — Read Only' : 'Demo / Local Simulation'}
            </span>
            {round && (
              <p className="text-xs tabular-nums text-slate-600">
                {round.source === 'live'
                  ? `live /m11 · received ${new Date(round.createdAt).toLocaleTimeString()}`
                  : `seed ${round.seed} · generated ${new Date(round.createdAt).toLocaleTimeString()}`}
              </p>
            )}
          </div>
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

        {/* Generating overlay message (demo mode only — live START is instant) */}
        {phase === 'generating' && (
          <p className="flex items-center justify-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-4 py-3 text-center text-sm font-medium text-cyan-200 animate-pulse-soft">
            {START_MESSAGES[messageIndex]}
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              (demo simulation)
            </span>
          </p>
        )}

        <GameGrid
          rows={round?.rows ?? null}
          phase={phase}
          revealedRows={revealedRows}
          nextSource={nextSource}
        />

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
