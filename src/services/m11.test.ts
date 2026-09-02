import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { generateDemoRound } from '../utils/generator'
import {
  M11_PUBLISHING_ENABLED,
  PublishingDisabledError,
  assertM11ChildPath,
  publishDemoRound,
} from './m11'

/** Recursively collects non-test TS/TSX source files under a directory. */
function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = resolve(dir, entry.name)
    if (entry.isDirectory()) return collectSourceFiles(full)
    if (!/\.(ts|tsx)$/.test(entry.name) || /\.test\.(ts|tsx)$/.test(entry.name)) return []
    return [full]
  })
}

describe('M11 service — phase boundary', () => {
  it('keeps publishing disabled in this phase', () => {
    expect(M11_PUBLISHING_ENABLED).toBe(false)
  })

  it('publishDemoRound refuses to touch Firebase while publishing is disabled', async () => {
    const round = generateDemoRound(1)
    await expect(publishDemoRound(round.node)).rejects.toBeInstanceOf(PublishingDisabledError)
  })

  it('never uses destructive SDK calls (set/remove) anywhere in the service source', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/services/m11.ts'), 'utf-8')
    expect(source).not.toMatch(/\.\s*set\s*\(/)
    expect(source).not.toMatch(/\.\s*remove\s*\(/)
  })

  it('contains NO Firebase write API call in ANY production source file', () => {
    // Static audit as a permanent test:
    // 1. every firebase/database import must only name READ APIs;
    // 2. no file may reference transaction or disconnect-registration APIs;
    // 3. the Firebase service files must not call set/update/remove at all.
    const readOnlyIdentifiers = new Set([
      'onValue',
      'get',
      'getDatabase',
      'ref',
      'query',
      'Unsubscribe',
      'DataSnapshot',
      'Database',
      'onChildAdded',
      'onChildChanged',
    ])
    const files = collectSourceFiles(resolve(process.cwd(), 'src'))
    expect(files.length).toBeGreaterThan(10)

    for (const file of files) {
      const source = readFileSync(file, 'utf-8')

      const importMatch = source.match(
        /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+'firebase\/database'/,
      )
      if (importMatch) {
        const identifiers = importMatch[1]
          .split(',')
          .map((part) => part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim())
          .filter(Boolean)
        for (const identifier of identifiers) {
          expect(
            readOnlyIdentifiers.has(identifier),
            `${file} imports "${identifier}" from firebase/database — only read APIs are allowed`,
          ).toBe(true)
        }
      }

      expect(source, `${file} must not reference transactions`).not.toContain('runTransaction')
      expect(source, `${file} must not register disconnect handlers`).not.toContain(
        'onDisconnect',
      )
    }

    for (const serviceFile of ['src/services/m11.ts', 'src/services/firebase.ts']) {
      const source = readFileSync(resolve(process.cwd(), serviceFile), 'utf-8')
      expect(source, `${serviceFile} must not call .set()`).not.toMatch(/\.\s*set\s*\(/)
      expect(source, `${serviceFile} must not call .update()`).not.toMatch(/\.\s*update\s*\(/)
      expect(source, `${serviceFile} must not call .remove()`).not.toMatch(/\.\s*remove\s*\(/)
    }
  })

  it('imports only read APIs from the firebase/database SDK in the m11 service', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/services/m11.ts'), 'utf-8')
    const importLine = source.split('\n').find((line) => line.includes("from 'firebase/database'"))
    expect(importLine).toBeDefined()
    expect(importLine).toMatch(/\{\s*onValue,\s*ref/)
  })
})

describe('M11 service — path guard', () => {
  it('accepts exactly the 50 legal child paths /m11/m1 … /m11/m50', () => {
    for (let n = 1; n <= 50; n += 1) {
      expect(() => assertM11ChildPath(`m11/m${n}`)).not.toThrow()
    }
  })

  it('rejects every forbidden top-level node with a clear error', () => {
    for (const forbidden of ['main', 'xbetmoney', 'users', 'bet1', 'data']) {
      expect(() => assertM11ChildPath(`${forbidden}/anything`)).toThrow(/forbidden/i)
    }
  })

  it('rejects unknown nodes, nested paths and non-m11 keys', () => {
    expect(() => assertM11ChildPath('m11/m51')).toThrow(/Illegal database path/)
    expect(() => assertM11ChildPath('other/m1')).toThrow(/Illegal database path/)
    expect(() => assertM11ChildPath('m11')).toThrow(/Illegal database path/)
    expect(() => assertM11ChildPath('m11/m1/m2')).toThrow(/Illegal database path/)
    expect(() => assertM11ChildPath('')).toThrow(/Illegal database path/)
  })
})
