import { Check, Dices, Eye, Loader2, RefreshCw } from 'lucide-react'
import type { RoundPhase } from '../types/game'

export interface ActionButtonsProps {
  phase: RoundPhase
  onStart: () => void
  onShow: () => void
}

const BASE_BUTTON =
  'inline-flex h-[52px] flex-1 min-w-[150px] items-center justify-center gap-2.5 rounded-2xl px-6 text-base font-extrabold uppercase tracking-wider transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none sm:min-w-[210px]'

/** START (generate demo round) and SHOW (progressive reveal) controls. */
export function ActionButtons({ phase, onStart, onShow }: ActionButtonsProps) {
  const startDisabled = phase === 'generating' || phase === 'revealing'
  const showDisabled = phase !== 'ready'
  const revealing = phase === 'revealing'

  const startLabel =
    phase === 'generating'
      ? 'Preparing…'
      : phase === 'idle'
        ? 'Start'
        : 'Start new round'

  const showLabel = revealing ? 'Revealing…' : phase === 'revealed' ? 'Result shown' : 'Show'

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
      <button
        type="button"
        onClick={onStart}
        disabled={startDisabled}
        aria-label={startLabel}
        className={`${BASE_BUTTON} bg-gradient-to-r from-cyan-400 to-teal-500 text-slate-950 shadow-lg shadow-cyan-500/20 hover:from-cyan-300 hover:to-teal-400 hover:shadow-cyan-400/30 focus-visible:outline-cyan-300 active:scale-[0.98]`}
      >
        {phase === 'generating' ? (
          <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
        ) : phase === 'idle' ? (
          <Dices aria-hidden="true" className="h-5 w-5" />
        ) : (
          <RefreshCw aria-hidden="true" className="h-5 w-5" />
        )}
        {startLabel}
      </button>

      <button
        type="button"
        onClick={onShow}
        disabled={showDisabled}
        aria-label={showLabel}
        className={`${BASE_BUTTON} border-2 border-amber-400/70 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20 focus-visible:outline-amber-300 active:scale-[0.98]`}
      >
        {revealing ? (
          <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
        ) : phase === 'revealed' ? (
          <Check aria-hidden="true" className="h-5 w-5" />
        ) : (
          <Eye aria-hidden="true" className="h-5 w-5" />
        )}
        {showLabel}
      </button>
    </div>
  )
}
