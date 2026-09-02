import {
  onChildAdded,
  onChildChanged,
  ref,
  update,
  type DataSnapshot,
  type Unsubscribe,
} from 'firebase/database'
import { M_KEYS } from '../config/game'
import { FORBIDDEN_TOP_LEVEL_PATHS, M11_PATH } from '../config/firebase'
import type { M11Node, M11Value, MKey } from '../types/game'
import { isM11Value, validateM11Node } from '../utils/validation'
import { getDemoDatabase } from './firebase'

/**
 * PHASE BOUNDARY:
 * Publishing stays disabled until a later phase explicitly enables it.
 * The architecture below is complete; flipping this flag (plus approval)
 * is the only change required to activate publishing.
 */
export const M11_PUBLISHING_ENABLED = false

/** Thrown by publishDemoRound while publishing is disabled. */
export class PublishingDisabledError extends Error {
  constructor() {
    super(
      'Publishing to Firebase is disabled in this phase — the demo only prepares rounds locally.',
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
  if (
    segments.length !== 2 ||
    segments[0] !== M11_PATH ||
    !KNOWN_KEYS.has(segments[1])
  ) {
    throw new Error(`Illegal database path "${path}". Only /m11/m1 … /m11/m50 are allowed.`)
  }
}

/** Live, READ-ONLY mirror of /m11 using contract-compatible child events. */
export function subscribeToM11(handlers: {
  onChild: (key: MKey, value: M11Value | null) => void
  onError?: (error: unknown) => void
}): Unsubscribe {
  const database = getDemoDatabase()
  const nodeRef = ref(database, M11_PATH) // fixed path — never user-controlled

  const parse = (snapshot: DataSnapshot) => {
    const key = snapshot.key
    if (key === null || !KNOWN_KEYS.has(key)) return // extras are ignored, like the demo client
    const raw = snapshot.val()
    const value =
      raw !== null && typeof raw === 'object' && isM11Value((raw as Record<string, unknown>)[key])
        ? ((raw as Record<string, unknown>)[key] as M11Value)
        : null
    handlers.onChild(key as MKey, value)
  }

  const unsubscribers: Unsubscribe[] = [
    onChildAdded(nodeRef, parse, (error) => handlers.onError?.(error)),
    onChildChanged(nodeRef, parse, (error) => handlers.onError?.(error)),
  ]
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
}

/**
 * THE single guarded write path for /m11 publishing (future phase).
 *
 * Currently DISABLED — it always throws before touching the database.
 * When a later approved phase enables it, the writes will be exactly
 * contract-compatible with the original operator app and the demo
 * Android client:
 *   - 50 per-child upserts (update, never set/remove)
 *   - values are the STRINGS "0"/"1" wrapped as { mN: value }
 *   - all 50 keys always present, no deletions, no other nodes
 */
export async function publishDemoRound(node: M11Node): Promise<void> {
  if (!M11_PUBLISHING_ENABLED) {
    throw new PublishingDisabledError()
  }

  const validation = validateM11Node(node)
  if (!validation.valid) {
    throw new Error(`Refusing to publish an invalid round: ${validation.errors.join(' ')}`)
  }

  const database = getDemoDatabase()
  for (const key of M_KEYS) {
    const path = `${M11_PATH}/${key}`
    assertM11ChildPath(path)
    const child = node[key] as unknown as Record<string, M11Value>
    await update(ref(database, path), child)
  }
}
