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

1. **Offline demo mode (default when `VITE_FIREBASE_API_KEY` is empty)** —
   zero Firebase network activity. Everything (grid, rounds, online-user
   counter) is simulated locally.
2. **Read-only live mode** — with the required values present
   (`apiKey`, `databaseURL`, `projectId`), the console attaches a
   **read-only** live mirror to `/m11` and shows a DB status pill.
   It never writes.

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
(row 1 easiest ×1.23 … row 10 ×349.68).

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
