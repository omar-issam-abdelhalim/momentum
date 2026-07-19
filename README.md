# Momentum

**A calm, offline-first PWA for weekly and daily goals, deadlines, and habit tracking — built around a custom Saturday–Friday planning week.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Built with React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8)](#pwa-installation)

Momentum is a single-user personal productivity app: no accounts, no backend, no cloud. Every goal, habit, and analytics record lives in your browser's local storage, and the whole app works offline once it's loaded. It's designed to feel premium and unobtrusive — not like a generic admin dashboard — and to answer one question honestly: *are you planning a realistic week?*

---

## Use Momentum

### 👉 [**Open Momentum**](https://omar-issam-abdelhalim.github.io/momentum/)

That's it — **no download, no GitHub account, no sign-up, nothing to clone or install to just try it.** Open the link above in any modern browser (Chrome, Safari, Edge, Firefox) on your phone, tablet, or computer, and the app is ready to use immediately. Installing it as described below is optional and just makes it feel like a native app on your device.

#### Install on Android

1. Open the link above in **Chrome**.
2. Tap the **⋮** menu in the top right.
3. Tap **"Install app"** (or **"Add to Home screen"**).
4. Confirm — Momentum now appears as an app icon on your home screen and app drawer.

#### Add to Home Screen on iPhone / iPad

1. Open the link above in **Safari** (installation must be done from Safari on iOS).
2. Tap the **Share** icon (the square with an arrow pointing up) in the toolbar.
3. Scroll down and tap **"Add to Home Screen."**
4. Tap **"Add"** in the top right — Momentum now appears as an app icon on your home screen.

#### Install on desktop (Chrome, Edge)

1. Open the link above.
2. Click the **install icon** in the address bar (or the in-app "Install" banner near the bottom of the Home screen), then confirm.
3. Momentum opens in its own app window, separate from your browser tabs.

#### Just want to use it in the browser?

That works too — nothing above is required. Momentum runs fully in the browser tab with no loss of functionality; installing only adds a home-screen icon and a standalone window.

#### About your data

Momentum stores everything **locally on the device you're using** — there is no account and no server, so **your data is not automatically synced between your phone, tablet, and computer.** Each device has its own separate copy.

To move your data to another device, or to keep a backup, use **Settings → Export Backup** to save a JSON file, then **Settings → Import Backup** on the other device (or after reinstalling) to restore it.

---

## Contents

- [Use Momentum](#use-momentum)
- [Screenshots](#screenshots)
- [Key features](#key-features)
- [Technology stack](#technology-stack)
- [Architecture overview](#architecture-overview)
- [Getting started](#getting-started)
- [Available scripts](#available-scripts)
- [The custom week: Saturday → Friday](#the-custom-week-saturday--friday)
- [Goals, deadlines & rollover](#goals-deadlines--rollover)
- [Habits & streaks](#habits--streaks)
- [Analytics](#analytics)
- [Local data storage & privacy](#local-data-storage--privacy)
- [Backup, export & import](#backup-export--import)
- [Offline-first behavior](#offline-first-behavior)
- [PWA installation](#pwa-installation)
- [Deploying for HTTPS access](#deploying-for-https-access)
- [Project structure](#project-structure)
- [Testing](#testing)
- [Build & quality checks](#build--quality-checks)
- [Limitations](#limitations)
- [License](#license)

---

## Screenshots

| Home (dark) | Analytics (dark) | Home (light) |
| :---: | :---: | :---: |
| ![Home screen in dark mode, showing weekly progress, goals with deadline badges, and habits with streaks](docs/screenshots/home-dark.png) | ![Analytics screen in dark mode, showing weekly completion trend and planned-vs-completed chart](docs/screenshots/analytics-dark.png) | ![Home screen in light mode](docs/screenshots/home-light.png) |

---

## Key features

- **Weekly & daily goals** with optional deadlines, priority-ordered display (deadlines first, then rolled-over goals, then new goals), and clear overdue/due-today/due-tomorrow indicators.
- **Automatic weekly rollover** — incomplete weekly goals move into the new week on their own, without ever being duplicated, and without losing track of how long they've been outstanding.
- **Daily & weekly habits** with current/best streak tracking.
- **Analytics that answer "am I overplanning?"** — weekly completion trend, planned-vs-completed, rollover rate, and rule-based (not AI, not guesswork) planning-realism insights.
- **History** of recent completions and long-term weekly performance summaries.
- **Backup & restore** — export everything to a single JSON file, validate and re-import it later.
- **Installable, fully offline PWA** — add it to your phone's home screen and use it with no network connection.
- **Light / dark / system theming**, designed intentionally for both, not just an inverted palette.
- **Automatic, safe data cleanup** — detailed goal records age out after ~14 days, but only after their week's aggregate stats are permanently preserved.

## Technology stack

| Layer | Choice |
| --- | --- |
| UI | React 18 + TypeScript, Vite |
| Styling | Tailwind CSS with custom design tokens (light/dark/system theming) |
| Local storage | [Dexie.js](https://dexie.org) over IndexedDB |
| Charts | [Recharts](https://recharts.org) (lazy-loaded — only fetched when Analytics is opened) |
| Dates | [date-fns](https://date-fns.org) + a hand-written Saturday–Friday week engine |
| Icons | [lucide-react](https://lucide.dev) |
| PWA | [vite-plugin-pwa](https://vite-pwa-org.netlify.app) (Workbox) — service worker, manifest, offline caching |
| Testing | [Vitest](https://vitest.dev), [fake-indexeddb](https://github.com/dumbmatter/fakeIndexedDB) for Dexie integration tests |

## Architecture overview

Business logic is deliberately layered and kept independent of React and of the database, so the rules that actually matter (date math, sorting, rollover, streaks, analytics) can be unit-tested in isolation:

```
lib/date    → pure calendar/week math (no I/O, no framework)
lib/logic   → pure business rules built on lib/date (sorting, deadlines, streaks,
              rollover, analytics aggregation, cleanup eligibility)
lib/db      → Dexie schema, repositories, and the startup orchestrators
              (rollover runner, cleanup runner) that apply lib/logic against real data
hooks       → thin reactive wrappers (dexie-react-hooks' useLiveQuery) around lib/db
components  → presentational UI, screens compose components + hooks
```

Nothing above `lib/db` computes "what week is it" or "should this goal roll over" independently — everything routes through the same pure functions, which is what keeps rollover idempotent and the analytics numbers trustworthy.

## Getting started

Requires Node.js 18+ and npm.

```bash
git clone https://github.com/omar-issam-abdelhalim/momentum.git
cd momentum
npm install
npm run dev
```

Open the printed `http://localhost:5173` URL. Vite also prints a `Network:` URL — open that from your phone while it's on the same Wi-Fi to test on a real device during development.

## Available scripts

```bash
npm run dev        # start the dev server
npm run build       # type-check (tsc -b) then production build to dist/
npm run preview     # serve the production build locally (also PWA-testable)
npm run test        # run the Vitest suite once
npm run test:watch  # run Vitest in watch mode
npm run typecheck   # tsc -b --noEmit
npm run lint        # eslint .
```

## The custom week: Saturday → Friday

Momentum's week is **not** Monday–Sunday or Sunday–Saturday — it's **Saturday 00:00:00 → Friday 23:59:59.999**, always in the device's local timezone. All week math is centralized in `src/lib/date/week.ts`; no other module computes "the current week" independently. This is covered by dedicated tests for the Friday→Saturday boundary, end-of-month, end-of-year, and a leap-year date.

## Goals, deadlines & rollover

Active goals are sorted with a fixed, testable priority: **deadline goals first (nearest due date first) → rolled-over goals (oldest first) → new goals (oldest first)**. Deadlines are shown as *Overdue / Due today / Due tomorrow / Upcoming* rather than raw dates where possible.

When a week closes, any still-incomplete weekly goal is carried into the next week automatically the next time the app is opened. The rollover **mutates the same goal record in place** — it is never copied — so `rolloverCount` and `originalWeekId` always tell you exactly how long a goal has been outstanding, and re-running rollover (or missing several weeks in a row) can never produce duplicates. Each closed week also gets a permanent, lightweight `WeeklySnapshot` before its goals move on, which is what powers Analytics and History long after the detailed goal rows are gone.

## Habits & streaks

Habits are daily or weekly. Daily habits reset at local midnight; weekly habits reset every Saturday. Streaks are computed from the underlying completion events (not a counter that can drift): a streak counts consecutive completed periods ending at "now," and isn't broken just because the *current* period hasn't been completed yet — only a genuinely missed prior period breaks it.

## Analytics

- **Weekly completion trend** — a line chart of completion % per week.
- **Planned vs. completed** — bar comparison to spot overplanning at a glance.
- **Rollover rate** — how often goals carry over, per week and on average.
- **Rule-based planning-realism insights** — plain, factual observations (e.g. *"you're completing about X% of planned goals on average"*), never psychological or medical framing.
- **Habit consistency** — per-habit completion rate over a trailing window, plus current/best streaks.

## Local data storage & privacy

Everything — goals, habits, completions, weekly snapshots, settings — lives in **IndexedDB** on your device via Dexie. Nothing is ever sent to a server; there is no backend. Theme preference is additionally mirrored into `localStorage` purely so the app can apply the correct theme before first paint (IndexedDB reads are inherently async); IndexedDB remains the source of truth and is what backups export.

To keep IndexedDB from growing forever, detailed goal records are cleaned up ~14 days after they stop being operationally relevant — but only *after* that week's aggregate stats have already been folded into a permanent `WeeklySnapshot`. Snapshots and habit completion events are never deleted automatically, so long-term Analytics stays accurate even as detail rows age out.

## Backup, export & import

Settings → **Export backup** downloads a timestamped, schema-versioned JSON file. **Import backup** validates the file's structure before touching anything; on a valid file it asks for confirmation, then replaces all local data with the backup's contents. (v1 replaces rather than merges — the safer choice with no conflict-resolution UI yet.)

## Offline-first behavior

Once loaded, Momentum works fully offline: viewing, adding, completing, editing, and deleting goals and habits, and viewing locally available analytics, all work with no network connection. This is backed by a Workbox-generated service worker that precaches the app shell — verified by killing the dev server entirely and confirming the app still loads from cache.

## PWA installation

The app ships as a fully configured installable PWA (manifest, service worker, offline app-shell caching).

- **Desktop Chrome/Edge**: an install icon appears in the address bar, or use the in-app "Install" banner that appears near the bottom of the Home screen (dismissible, unobtrusive, only shown when the browser reports the app is installable).
- **Android Chrome**: menu → "Install app" / "Add to Home screen".
- **iOS Safari**: Share → "Add to Home Screen" (iOS doesn't support the install-prompt event, so this step is manual).

To test on your phone during development, run `npm run dev`, make sure your phone is on the same Wi-Fi as your computer, and open the `Network:` URL Vite prints. For a real installable experience you'll want HTTPS — see below.

## Deploying for HTTPS access

The live app at **https://omar-issam-abdelhalim.github.io/momentum/** is deployed on **GitHub Pages**, built and published automatically by the GitHub Actions workflow at [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) on every push to `main`. That workflow runs the full check suite (typecheck, lint, tests) before building, so a broken change never reaches production.

The app is a static build with no backend, so any static HTTPS host works if you want to deploy your own fork:

```bash
npm run build
# deploy the contents of dist/ to Netlify, Vercel, Cloudflare Pages, a custom domain, etc.
```

No environment variables or server configuration are required for a root-domain deploy. GitHub Pages is the one exception: since a GitHub Pages *project* site is served from a subpath (`https://<user>.github.io/<repo>/`, not the domain root), the build needs to know that ahead of time so the PWA manifest, service worker scope, and asset URLs all agree — that's what the `GITHUB_PAGES=true npm run build` step in the CI workflow does (see the `base` logic in `vite.config.ts`). Building normally (`npm run build`, no env var) targets the domain root and is correct for every other host.

Once deployed, open the HTTPS URL on your phone and install it from there — that installation's data is separate from any other device (local storage is per-device); use Export/Import in Settings to move data between them.

## Project structure

```
src/
  config/app.config.ts      # app name/version — the one place to rebrand the UI
  types/models.ts           # Goal, Habit, HabitCompletion, WeeklySnapshot, AppSettings
  lib/
    date/week.ts             # the Saturday–Friday custom week engine
    date/format.ts           # display-only date formatting helpers
    db/                      # Dexie schema + repositories (goals, habits, settings, snapshots)
    db/rolloverRunner.ts      # idempotent weekly rollover, run at startup
    db/cleanupRunner.ts       # 14-day detailed-record cleanup, run at startup
    logic/                    # pure, unit-tested business rules:
                               #   goalSort, deadline urgency, streaks, rollover math,
                               #   analytics aggregation, cleanup eligibility
    backup/backup.ts          # export/import/validate JSON backups
    seed/seedData.ts          # dev-only sample data (never runs automatically)
  hooks/                     # useGoals, useHabits, useTheme, useAppInit (reactive Dexie queries)
  components/                # ui/ primitives, goals/, habits/, layout/ (nav, install prompt)
  screens/                   # HomeScreen, AnalyticsScreen, HistoryScreen, SettingsScreen
  App.tsx, main.tsx
```

## Testing

```bash
npm run test
```

The suite (Vitest) covers the business logic that actually matters to get right: custom week boundaries (including the Friday 23:59 → Saturday 00:00 transition, end-of-month, end-of-year, and a leap-year date), goal sorting and deadline urgency, streak calculation, weekly rollover idempotency and multi-week-gap handling (via `fake-indexeddb`, exercising the real Dexie code path), analytics aggregation, data-cleanup eligibility rules, and backup validation/round-tripping.

## Build & quality checks

```bash
npm run typecheck   # tsc -b --noEmit
npm run lint         # eslint .
npm run test          # vitest run
npm run build          # production build
```

All four are expected to pass cleanly before any change is considered done.

## Limitations

- No cloud sync — data is per-device; use Export/Import to move it between devices.
- Import replaces all local data rather than merging with existing data.
- No calendar-heatmap habit view (kept out of v1 as a nice-to-have).
- App icons are generated placeholder monograms, not custom artwork.

## License

Released under the [MIT License](LICENSE) © Omar Issam.
