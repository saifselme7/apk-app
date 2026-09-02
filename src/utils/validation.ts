import { M_KEYS, ROWS } from '../config/game'
import type { M11ChildRecord, M11Node } from '../types/game'

export type Validation = { valid: true } | { valid: false; errors: string[] }

/** The only legal cell values in the contract: the STRINGS "0" and "1". */
export function isM11Value(value: unknown): value is '0' | '1' {
  return value === '0' || value === '1'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function describe(value: unknown): string {
  const json = JSON.stringify(value)
  return json === undefined ? String(value) : json
}

/**
 * Validates a full /m11 node against the demo contract:
 *  - exactly the 50 keys m1…m50 (no missing keys, no extras)
 *  - every child is an object with exactly ONE entry
 *  - that entry's key equals the child name (e.g. /m11/m3 stores { m3: "1" })
 *  - the value is the STRING "0" or "1" (never number/boolean/object)
 */
export function validateM11Node(node: unknown): Validation {
  if (!isRecord(node)) {
    return { valid: false, errors: ['The round must be an object.'] }
  }

  const errors: string[] = []

  for (const key of M_KEYS) {
    if (!(key in node)) {
      errors.push(`Missing key "${key}".`)
      continue
    }
    const child = node[key]
    if (!isRecord(child)) {
      errors.push(`"${key}" must be an object like { "${key}": "0" | "1" }, got ${describe(child)}.`)
      continue
    }
    const childKeys = Object.keys(child)
    if (childKeys.length !== 1) {
      errors.push(`"${key}" must contain exactly one entry, got ${childKeys.length}.`)
      continue
    }
    const innerKey = childKeys[0]
    if (innerKey !== key) {
      errors.push(`"${key}" has a mismatched inner key "${innerKey}".`)
      continue
    }
    if (!isM11Value(child[innerKey])) {
      errors.push(`"${key}" must be the string "0" or "1", got ${describe(child[innerKey])}.`)
    }
  }

  const knownKeys = new Set<string>(M_KEYS)
  const extras = Object.keys(node).filter((key) => !knownKeys.has(key))
  if (extras.length > 0) {
    errors.push(`Unexpected extra keys: ${extras.join(', ')}.`)
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors }
}

/** Safe ("1") cell count per row, in row order — used by tests and the UI summary. */
export function rowSafeCounts(node: M11Node): number[] {
  return ROWS.map((row) =>
    row.keys.filter((key) => (node[key] as M11ChildRecord)[key] === '1').length,
  )
}

/** Validates the operator ID entered at the demo gate. */
export function validateOperatorId(id: string): Validation {
  const trimmed = id.trim()
  if (trimmed.length === 0) {
    return { valid: false, errors: ['Enter your operator ID.'] }
  }
  if (trimmed.length > 40) {
    return { valid: false, errors: ['Operator ID is too long (max 40 characters).'] }
  }
  return { valid: true }
}
