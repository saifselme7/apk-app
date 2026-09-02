import type { M_KEYS } from '../config/game'

/** A firebase child key under /m11: "m1" … "m50". */
export type MKey = (typeof M_KEYS)[number]

/** The only two values the contract allows — always STRINGS. */
export type M11Value = '0' | '1'

/** Object stored at /m11/mN — its single key equals the child name. */
export type M11Child<K extends MKey = MKey> = { readonly [key in K]: M11Value }

/**
 * Dynamic-access view of a child wrapper — for loops that iterate over the
 * 50 keys (the strongly-typed M11Child union cannot be indexed dynamically).
 */
export type M11ChildRecord = Readonly<Record<string, M11Value>>

/** A complete, validated /m11 node: all 50 children present. */
export type M11Node = { readonly [K in MKey]: M11Child<K> }

/** Partial node as observed from a live read-only listener. */
export type M11Snapshot = Partial<Record<MKey, M11Value | null>>

/** A single grid cell in the UI view model. */
export interface CellView {
  readonly key: MKey
  readonly value: M11Value
}

/** One logical row (row 1 = bottom … row 10 = top). */
export interface RowView {
  readonly row: number
  readonly multiplier: number
  readonly cells: readonly CellView[]
}

/** A locally generated demo round (never automatically published anywhere). */
export interface DemoRound {
  readonly seed: number
  readonly createdAt: number
  readonly node: M11Node
  readonly rows: readonly RowView[]
}

/** Console phase state machine. */
export type RoundPhase = 'idle' | 'generating' | 'ready' | 'revealing' | 'revealed'

/** Firebase connection status for the UI. */
export type FirebaseConnectionState =
  | 'unconfigured'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error'
