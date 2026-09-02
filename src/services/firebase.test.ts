import { afterEach, describe, expect, it, vi } from 'vitest'
import { FIREBASE_ENV } from '../config/firebase'
import {
  FirebaseNotConfiguredError,
  getDemoDatabase,
  isFirebaseConfigured,
  readFirebaseConfigFromEnv,
} from './firebase'

/** Stubs every VITE_FIREBASE_* variable deterministically (ignores local .env). */
function stubFirebaseEnv(values: Partial<Record<string, string>> = {}) {
  for (const name of Object.values(FIREBASE_ENV)) {
    vi.stubEnv(name, values[name] ?? '')
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('Firebase configuration detection', () => {
  it('reports "not configured" when every variable is missing/empty', () => {
    stubFirebaseEnv()
    expect(readFirebaseConfigFromEnv()).toBeNull()
    expect(isFirebaseConfigured()).toBe(false)
  })

  it('is not configured when only the apiKey is present', () => {
    stubFirebaseEnv({ [FIREBASE_ENV.apiKey]: 'test-key' })
    expect(readFirebaseConfigFromEnv()).toBeNull()
    expect(isFirebaseConfigured()).toBe(false)
  })

  it('treats whitespace-only required values as missing', () => {
    stubFirebaseEnv({
      [FIREBASE_ENV.apiKey]: '   ',
      [FIREBASE_ENV.databaseURL]: 'https://demo.firebaseio.com',
      [FIREBASE_ENV.projectId]: 'demo',
    })
    expect(readFirebaseConfigFromEnv()).toBeNull()
  })

  it('is not configured when the databaseURL is missing', () => {
    stubFirebaseEnv({
      [FIREBASE_ENV.apiKey]: 'test-key',
      [FIREBASE_ENV.projectId]: 'demo',
    })
    expect(isFirebaseConfigured()).toBe(false)
  })

  it('is not configured when the projectId is missing', () => {
    stubFirebaseEnv({
      [FIREBASE_ENV.apiKey]: 'test-key',
      [FIREBASE_ENV.databaseURL]: 'https://demo.firebaseio.com',
    })
    expect(isFirebaseConfigured()).toBe(false)
  })

  it('returns the full config when apiKey, databaseURL and projectId are set', () => {
    stubFirebaseEnv({
      [FIREBASE_ENV.apiKey]: 'test-key',
      [FIREBASE_ENV.authDomain]: 'demo.firebaseapp.com',
      [FIREBASE_ENV.databaseURL]: 'https://demo.firebaseio.com',
      [FIREBASE_ENV.projectId]: 'demo',
      [FIREBASE_ENV.storageBucket]: 'demo.appspot.com',
    })
    const config = readFirebaseConfigFromEnv()
    expect(config).not.toBeNull()
    expect(config?.apiKey).toBe('test-key')
    expect(config?.databaseURL).toBe('https://demo.firebaseio.com')
    expect(config?.projectId).toBe('demo')
    expect(config?.authDomain).toBe('demo.firebaseapp.com')
    expect(config?.storageBucket).toBe('demo.appspot.com')
    expect(isFirebaseConfigured()).toBe(true)
  })

  it('works without the optional variables (only the 3 required set)', () => {
    stubFirebaseEnv({
      [FIREBASE_ENV.apiKey]: 'test-key',
      [FIREBASE_ENV.databaseURL]: 'https://demo.firebaseio.com',
      [FIREBASE_ENV.projectId]: 'demo',
    })
    expect(readFirebaseConfigFromEnv()).not.toBeNull()
    expect(isFirebaseConfigured()).toBe(true)
  })
})

describe('Database initialization guard', () => {
  it('refuses to initialize the database when configuration is missing', () => {
    stubFirebaseEnv()
    expect(() => getDemoDatabase()).toThrow(FirebaseNotConfiguredError)
  })

  it('exposes a friendly, non-leaking error message', () => {
    stubFirebaseEnv()
    try {
      getDemoDatabase()
      throw new Error('expected getDemoDatabase to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(FirebaseNotConfiguredError)
      expect((error as Error).message).toContain('.env.example')
      expect((error as Error).message).not.toContain('test-key')
    }
  })
})
