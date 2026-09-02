# Apple Console — Operator Demo

A polished **DEMO web replacement** for the original Android operator app
("APP 1"). It reproduces the operator workflow — login, 10×5 apple grid,
multiplier ladder, START / SHOW — as a standalone simulation.

> **This is a demo only.** No real money, no wagering, no deposits, no
> connection to any betting platform. Firebase **publishing is disabled**
> in this phase: rounds are generated and displayed locally and never
> written anywhere.

## Quick start

```bash
npm install
npm run dev
```

Open the printed URL. Login accepts **any non-empty operator ID** plus the
demo passcode:

- default passcode: `demo-access`
- override it with `VITE_DEMO_PASSWORD` in your `.env`

The original Android app's shared secret is deliberately **not** used and
must never be added to this codebase.

## Scripts

| Command             | What it does                                  |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Vite dev server                               |
| `npm run build`     | Type-check (`tsc --noEmit`) + production build |
| `npm run preview`   | Serve the production build                    |
| `npm run typecheck` | TypeScript only                               |
| `npm run lint`      | ESLint (zero warnings allowed)                |
| `npm test`          | Vitest suite (generator, validation, UI)      |

## Environment

Copy `.env.example` to `.env` (git-ignored) and adjust:

```
VITE_DEMO_PASSWORD=demo-access
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=zaem-a8d30.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://zaem-a8d30-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=zaem-a8d30
VITE_FIREBASE_STORAGE_BUCKET=zaem-a8d30.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Two modes:

1. **Offline demo mode (when `VITE_FIREBASE_DATABASE_URL` is unset/invalid)**
   — zero Firebase network activity. Everything (grid, rounds, online-user
   counter) is simulated locally, and the demo generator works fully.
   **Only the database URL is required for live mode**: copy
   `.env.example` to `.env` as-is and the mirror works — no API key, no
   Firebase console access needed. The RTDB connection authorizes per
   security rules (the demo database is publicly readable, verified by an
   unauthenticated REST read in Phase 4); an API key is only used by other
   Firebase services and is never required here. All other
   `VITE_FIREBASE_*` values are optional passthroughs.
2. **Read-only live mode** — with the required values present
   (`apiKey`, `databaseURL`, `projectId`), the console attaches a
   **read-only** `onValue` listener to `/m11` (m1–m50). Every snapshot is
   validated against the `{ mN: "0" | "1" }` contract and the DB status
   panel shows:

   | State                    | Meaning                                                  |
   | ------------------------ | -------------------------------------------------------- |
   | Not configured           | no `.env` → offline demo mode                            |
   | Connecting               | SDK connecting (`.info/connected` probe)                 |
   | Connected (read-only)    | attached; observing `/m11`                               |
   | Disconnected / Error     | connection lost / probe or listener failure              |
   | /m11 sync: Syncing…      | attached, waiting for the first snapshot                 |
   | /m11 sync: Empty         | node exists with no children — warning shown, no repair  |
   | /m11 sync: Incomplete    | some of m1–m50 missing — keys listed, never created      |
   | /m11 sync: Invalid data  | malformed children listed; nothing repaired or overwritten |
   | /m11 sync: In sync       | 50/50 keys valid + safe/bomb counts                      |

   Missing, empty, or malformed data is **reported, never repaired** — the
   app contains no Firebase write call at all (statically audited by a
   unit test that scans the whole `src/` tree).

### Grid data source (Phase 5A + explicit dual actions)

The console has two strictly separated data sources, always shown by the
badge next to the status line, with **one explicit action each**:

- **LOAD LIVE ROUND** → **"Firebase — Read Only"** (green badge): enabled
  when Firebase is configured **and** `/m11` is currently valid (50/50
  keys). It freezes the observed snapshot into the round — nothing is
  generated — so the grid mirrors **exactly** what the Android demo client
  displays. SHOW reveals that frozen snapshot progressively. If a newer
  snapshot arrives while the live round is held but not yet shown, it is
  replaced wholesale; during a reveal the round stays frozen (a hint
  points out newer data).
- **NEW DEMO ROUND** → **"Demo / Local Simulation"** (amber badge): always
  available (except mid-generation/mid-reveal). Generates a fresh local
  round with the demo generator — completely independent from Firebase
  (never read for this path, never written) — and SHOW reveals it. A new
  demo round replaces the previous held round wholesale; live snapshots
  arriving mid-reveal never mutate it.

Locally generated data is never presented as Firebase data. Firebase stays
strictly read-only: no write path exists anywhere in the app.

Never commit `.env`. Only placeholders belong in `.env.example`.

## The /m11 contract (frozen — do not break)

The existing demo Android client ("APP 2") reads `/m11` via child events
and crashes on a missing child. Any future publishing must satisfy:

- exactly the 50 keys `m1` … `m50`;
- each child stored as a wrapper object: `{ "m3": "1" }` — the value is
  the **string** `"0"` (bomb) or `"1"` (safe), never a number;
- per-child **upserts only** (`update`), never `set`/`remove`;
- rows 1–10 own `m(5N-4)` … `m(5N)`;
- never write `/main`, `/xbetmoney`, `/users`, `/bet1`, `/data` — those
  nodes belong to the demo client.

All writes (once a later phase enables them) go through the single guarded
service `src/services/m11.ts`, which enforces the path allowlist above.
The generator's safe-cell curve per row is `1, 1, 1, 1, 2, 2, 2, 2, 2, 4`
(row 1 easiest ×1.23 … row 10 ×349.68). This is **exactly the original
operator app's algorithm** (Phase-1 audit F4, smali-verified: rows 1–4
exactly 1 safe cell, rows 5–9 exactly 2, row 10 exactly 4 — uniform
placement, no odds tuning), so every demo round contains exactly 18 safe
cells and is deterministic per seed. Note: a live `/m11` round **may** show
a different distribution if it was created/edited outside that algorithm —
e.g. the round observed in Phase 4 had rows 8–9 with 3 safe cells (20
total), which the audited algorithm cannot produce. Demo rounds never copy
or write Firebase data; they are pure local simulation.

## Project layout

```
src/
  config/       game.ts (grid, rows, curve, timings) · firebase.ts (env names)
  types/        M11Node, RoundPhase, RowView, …
  utils/        generator.ts · validation.ts · random.ts
  services/     firebase.ts (lazy init) · m11.ts (guarded, publishing OFF)
                demoAuth.ts (env passcode gate — NOT authentication)
  hooks/        useDemoSession · useSimulatedOnlineUsers
                useFirebaseConnection · useM11Mirror
  components/   Header · GameGrid · MultiplierLadder · ActionButtons
                DemoBanner · ConnectionPill · MirrorPanel · ErrorBoundary
  pages/        Login.tsx · Console.tsx
  layouts/      ConsoleLayout.tsx
```

## Accessibility & UX notes

- keyboard-navigable, visible focus rings, ≥44px touch targets;
- `prefers-reduced-motion` respected (reveal steps drop to 80 ms and
  animations are effectively disabled);
- the demo banner ("Demo simulation — no real money …") is always visible;
- errors render friendly messages — never stack traces or env values.
