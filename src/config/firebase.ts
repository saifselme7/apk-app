/**
 * Firebase (demo backend) configuration.
 * Every value comes from environment variables — nothing is hardcoded here.
 */

export const FIREBASE_ENV = {
  apiKey: 'VITE_FIREBASE_API_KEY',
  authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
  databaseURL: 'VITE_FIREBASE_DATABASE_URL',
  projectId: 'VITE_FIREBASE_PROJECT_ID',
  storageBucket: 'VITE_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'VITE_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'VITE_FIREBASE_APP_ID',
} as const

/** Minimum required values for the read-only demo integration (RTDB only). */
export const REQUIRED_FIREBASE_ENV: readonly string[] = [
  FIREBASE_ENV.apiKey,
  FIREBASE_ENV.databaseURL,
  FIREBASE_ENV.projectId,
]

/** The single node this demo is ever allowed to touch. */
export const M11_PATH = 'm11'

/**
 * Top-level nodes owned by the existing demo Android client.
 * NEVER access these — reads or writes — in any phase.
 * (Writing /main force-closes clients sitting on the splash screen.)
 */
export const FORBIDDEN_TOP_LEVEL_PATHS = ['main', 'xbetmoney', 'users', 'bet1', 'data'] as const
