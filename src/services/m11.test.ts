import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { generateDemoRound } from '../utils/generator'
import {
  M11_PUBLISHING_ENABLED,
  PublishingDisabledError,
  assertM11ChildPath,
  publishDemoRound,
} from './m11'

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
