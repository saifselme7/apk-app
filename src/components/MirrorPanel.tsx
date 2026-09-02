import { Lock, Wifi, WifiOff } from 'lucide-react'
import { M_KEYS } from '../config/game'
import type { M11Snapshot } from '../types/game'
import type { M11MirrorState } from '../hooks/useM11Mirror'
import type { FirebaseConnectionState } from '../types/game'

export interface MirrorPanelProps {
  connection: FirebaseConnectionState
  mirror: M11MirrorState
}

/** Status card: Firebase connection + read-only /m11 mirror summary. */
export function MirrorPanel({ connection, mirror }: MirrorPanelProps) {
  const knownValues = M_KEYS.map((key) => mirror.snapshot[key]).filter(
    (value) => value !== undefined,
  )
  const present = knownValues.filter((value) => value === '0' || value === '1').length

  return (
    <aside
      aria-label="Database status"
      className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 text-sm"
    >
      <div className="flex items-center gap-2 font-semibold text-slate-200">
        {mirror.active ? (
          <Wifi aria-hidden="true" className="h-4 w-4 text-emerald-400" />
        ) : (
          <WifiOff aria-hidden="true" className="h-4 w-4 text-slate-500" />
        )}
        Firebase · Realtime Database
      </div>

      <dl className="mt-3 space-y-2 text-[13px] leading-relaxed text-slate-400">
        <div className="flex justify-between gap-4">
          <dt>Status</dt>
          <dd className="text-right font-medium text-slate-300">
            {connection === 'unconfigured' && 'Offline demo mode'}
            {connection === 'connecting' && 'Connecting…'}
            {connection === 'connected' && 'Connected (read-only)'}
            {connection === 'disconnected' && 'Disconnected'}
            {connection === 'error' && 'Connection error'}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Live /m11 mirror</dt>
          <dd className="text-right font-medium text-slate-300">
            {mirror.active ? `${present}/50 keys present` : 'Not attached'}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Publishing</dt>
          <dd className="inline-flex items-center gap-1.5 text-right font-medium text-amber-300">
            <Lock aria-hidden="true" className="h-3.5 w-3.5" />
            Disabled (phase boundary)
          </dd>
        </div>
      </dl>

      {mirror.error && (
        <p role="status" className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          {mirror.error}
        </p>
      )}
      {!mirror.active && (
        <p className="mt-3 border-t border-slate-800 pt-3 text-xs leading-relaxed text-slate-500">
          Running fully offline — no Firebase calls are made. To preview the live read-only
          mirror against the demo project, copy <code className="text-slate-400">.env.example</code>{' '}
          to <code className="text-slate-400">.env</code> and fill in the values (see README).
        </p>
      )}
    </aside>
  )
}

/** Re-export for convenience so the snapshot type is discoverable here. */
export type { M11Snapshot }
