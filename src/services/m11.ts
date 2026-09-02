import { onValue, ref, type Unsubscribe } from 'firebase/database'
import { M_KEYS } from '../config/game'
import { FORBIDDEN_TOP_LEVEL_PATHS, M11_PATH } from '../config/firebase'
import type { M11Node, MKey } from '../types/game'
import { evaluateM11Snapshot, type M11SyncEvaluation } from '../utils/m11Snapshot'
import { getDemoDatabase } from './firebase'

/**
 * PHASE BOUNDARY (unchanged since Phase 2):
 * Publishing stays disabled. This service is READ-ONLY — it only ever
 * attaches listeners to /m11 and evaluates what it observes.
 */
export const M11_PUBLISHING_ENABLED = false

/** Thrown by publishDemoRound — the only "publish" entry point, always disabled. */
export class PublishingDisabledError extends Error {
  constructor() {
    super(
      'Publishing to Firebase is disabled in this phase — the demo only observes /m11 read-only.',
    )
    this.name = 'PublishingDisabledError'
  }
}

const KNOWN_KEYS: ReadonlySet<string> = new Set<string>(M_KEYS)

/**
 * Guard: the only database paths this app may ever reference are
 * /m11/m1 … /m11/m50. Everything else — especially the demo Android
 * client's own nodes — is rejected here before any SDK call.
 */
export function assertM11ChildPath(path: string): void {
  const segments = path.split('/').filter(Boolean)
  const top = segments[0] ?? ''
  if ((FORBIDDEN_TOP_LEVEL_PATHS as readonly string[]).includes(top)) {
    throw new Error(`Access to "/${top}" is forbidden — that node belongs to the demo client.`)
  }
  if (segments.length !== 2 || segments[0] !== M11_PATH || !KNOWN_KEYS.has(segments[1])) {
    throw new Error(`Illegal database path "${path}". Only /m11/m1 … /m11/m50 are allowed.`)
  }
}

/** One read-only observation of /m11, already validated against the contract. */
export interface M11SyncUpdate {
  readonly evaluation: M11SyncEvaluation
  readonly receivedAt: number
}

export interface M11SyncHandlers {
  onUpdate: (update: M11SyncUpdate) => void
  onError?: (error: unknown) => void
}

/**
 * READ-ONLY live observation of /m11 (m1 … m50).
 *
 * - attaches a single `onValue` listener to the FIXED literal path "/m11"
 *   (never user-controlled, never a forbidden node);
 * - every snapshot is validated against the frozen contract
 *   { mN: { mN: "0" | "1" } } by the pure evaluator;
 * - empty, incomplete, or malformed data is REPORTED to the caller —
 *   never repaired, initialized, defaulted, or deleted;
 * - performs no mutating SDK operation of any kind (no write, update,
 *   remove, push, or disconnect registration).
 */
export function subscribeToM11Sync(handlers: M11SyncHandlers): Unsubscribe {
  const database = getDemoDatabase()
  const nodeRef = ref(database, M11_PATH) // fixed read-only path

  return onValue(
    nodeRef,
    (snapshot) => {
      handlers.onUpdate({
        evaluation: evaluateM11Snapshot(snapshot.val()),
        receivedAt: Date.now(),
      })
    },
    (error) => handlers.onError?.(error),
  )
}

/**
 * THE single guarded write path for /m11 publishing (future phase).
 *
 * Permanently disabled in this codebase for the current phase: there is
 * deliberately NO write call here at all — this function always throws,
 * whatever the flag says. A later, explicitly approved phase must implement
 * the contract-exact writes described below:
 *   - 50 per-child upserts (update, never set/remove)
 *   - values are the STRINGS "0"/"1" wrapped as { mN: value }
 *   - all 50 keys always present, no deletions, no other nodes
 *   - every path passed through assertM11ChildPath first
 */
export async function publishDemoRound(_node: M11Node): Promise<void> {
  // Intentionally unused: publishing does not exist in this phase.
  void _node
  throw new PublishingDisabledError()
}

/** Re-exported for callers that need the key type of the observed node. */
export type { MKey }
