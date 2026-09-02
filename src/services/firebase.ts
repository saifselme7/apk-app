import { getApp, getApps, initializeApp } from 'firebase/app'
import { getDatabase, onValue, ref, type Database, type Unsubscribe } from 'firebase/database'
import { FIREBASE_ENV } from '../config/firebase'

export interface FirebaseEnvConfig {
  apiKey?: string
  authDomain?: string
  databaseURL?: string
  projectId?: string
  storageBucket?: string
  messagingSenderId?: string
  appId?: string
}

/** Raised when Firebase is used without a complete `.env` configuration. */
export class FirebaseNotConfiguredError extends Error {
  constructor() {
    super(
      'Firebase is not configured for this demo. Copy .env.example to .env and fill in the demo project values (see README).',
    )
    this.name = 'FirebaseNotConfiguredError'
  }
}

function readEnvConfig(): FirebaseEnvConfig {
  const env = import.meta.env
  return {
    apiKey: env[FIREBASE_ENV.apiKey],
    authDomain: env[FIREBASE_ENV.authDomain],
    databaseURL: env[FIREBASE_ENV.databaseURL],
    projectId: env[FIREBASE_ENV.projectId],
    storageBucket: env[FIREBASE_ENV.storageBucket],
    messagingSenderId: env[FIREBASE_ENV.messagingSenderId],
    appId: env[FIREBASE_ENV.appId],
  }
}

/**
 * Returns the demo Firebase configuration, or null when the required values
 * are missing — in which case the app runs in "offline demo mode"
 * (zero Firebase network activity by design).
 */
export function readFirebaseConfigFromEnv(): FirebaseEnvConfig | null {
  const config = readEnvConfig()
  const required = [config.apiKey, config.databaseURL, config.projectId]
  const missing = required.some((value) => !value || value.trim().length === 0)
  return missing ? null : config
}

export function isFirebaseConfigured(): boolean {
  return readFirebaseConfigFromEnv() !== null
}

let cachedDatabase: Database | null = null

/** Lazily initializes and returns the demo Realtime Database handle. */
export function getDemoDatabase(): Database {
  if (cachedDatabase) return cachedDatabase

  const config = readFirebaseConfigFromEnv()
  if (!config?.apiKey || !config.databaseURL || !config.projectId) {
    throw new FirebaseNotConfiguredError()
  }

  const app = getApps().length
    ? getApp()
    : initializeApp({
        apiKey: config.apiKey,
        authDomain: config.authDomain ?? undefined,
        databaseURL: config.databaseURL,
        projectId: config.projectId,
        storageBucket: config.storageBucket ?? undefined,
        messagingSenderId: config.messagingSenderId ?? undefined,
        appId: config.appId ?? undefined,
      })

  cachedDatabase = getDatabase(app)
  return cachedDatabase
}

/**
 * Subscribe to the SDK connection indicator (.info/connected).
 * This is a read-only status probe — it never writes data.
 */
export function subscribeToConnectionState(
  onChange: (connected: boolean) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  const database = getDemoDatabase()
  return onValue(
    ref(database, '.info/connected'),
    (snapshot) => onChange(snapshot.val() === true),
    (error) => onError?.(error),
  )
}
