import { useEffect, useState } from 'react'
import { isFirebaseConfigured } from '../services/firebase'
import { subscribeToM11 } from '../services/m11'
import type { M11Snapshot } from '../types/game'

export interface M11MirrorState {
  /** True when Firebase is configured and the mirror is attached. */
  active: boolean
  /** Latest values observed at /m11 (read-only). */
  snapshot: M11Snapshot
  /** Human-friendly error message, if any. */
  error: string | null
  /** When the last child event arrived. */
  lastUpdated: number | null
}

/**
 * Read-only live mirror of /m11 — exactly the events the demo Android
 * client consumes (child_added / child_changed). Never writes.
 */
export function useM11Mirror(): M11MirrorState {
  const [active] = useState(() => isFirebaseConfigured())
  const [snapshot, setSnapshot] = useState<M11Snapshot>({})
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)

  useEffect(() => {
    if (!active) return
    let unsubscribe: (() => void) | undefined
    try {
      unsubscribe = subscribeToM11({
        onChild: (key, value) => {
          setSnapshot((previous) => ({ ...previous, [key]: value }))
          setLastUpdated(Date.now())
        },
        onError: () => setError('Live mirror connection error.'),
      })
    } catch {
      setError('Firebase mirror could not start.')
    }
    return () => unsubscribe?.()
  }, [active])

  return { active, snapshot, error, lastUpdated }
}
