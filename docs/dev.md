# Development Guide

## Purpose

This document explains how engineers work in the repository today.

Use it for:

- local setup
- validation commands
- release flow
- remote Supabase and fork bootstrap steps
- troubleshooting common integration problems

System shape and data ownership live in `architecture.md`. UX intent lives in `experience.md`. Platform setting ownership lives in `operations.md`.

Testing scope, layer ownership, and rollout priorities live in `testing.md`.

## Current Tooling

This repo currently uses:

- `React`
  attendee-facing UI in `apps/web`
- `TypeScript`
  shared language across frontend code, shared domain logic, and Edge Functions
- `Vite`
  frontend dev server and production build tool
- `Sass`
  styling organization for the web app
- `ESLint`
  repo-wide linting
- `Supabase`
  Postgres, migrations, secrets, and Edge Functions
- `Deno`
  runtime for the Supabase Edge Functions
- `Vercel`
  frontend hosting target

## Repository Shape

The main working areas are:

- `apps/web`
  frontend app
- `shared`
  shared quiz definitions, validation, and scoring
- `supabase/functions`
  trusted backend runtime code
- `supabase/migrations`
  database schema, RPCs, and backend hardening
- `docs`
  product, UX, architecture, development, and operations docs

## Implementation Decisions That Matter During Development

### Shared config before DB-backed content

The app currently uses a shared `game-config` module for sample quizzes.

That is intentional because:

- the frontend needs the content to render the experience
- the backend needs the same content to validate answers and compute score
- sharing the module avoids drift while the project is still pre-admin and pre-CMS

### Reducer-based quiz session

The quiz flow is modeled as a reducer-backed session rather than scattered component state.

That keeps:

- step transitions explicit
- back navigation and retakes easier to reason about
- invalid UI states less likely as the product grows

### Session bootstrap before gameplay

The attendee flow prepares a backend session before quiz start when Supabase is configured.

That means:

- integration failures surface before the user finishes the quiz
- the browser has the signed session credential ready before completion submission
- the start screen is a better place for a recoverable backend setup error

### Offline fallback stays explicit

When Supabase environment variables are missing, the app now fails loudly unless offline mode is explicitly enabled.

That is intentional because:

- backend integration gaps should be visible by default
- the standard development path should exercise the trusted completion flow
- frontend-only work can still continue when needed

Constraint:

- the browser-only fallback is development-only and should not be treated as production backend behavior

## Local Workflow

### Prerequisites

For regular contribution work, install:

- Node `24.14.1` LTS
- npm
- Deno if you need to run the Edge Function checks locally
- Supabase CLI if you are changing Supabase infrastructure or verifying deploy commands
- Playwright Chromium if you are running the UI-review capture flow

Install dependencies at the repo root:

```bash
npm install
```

### Remote Supabase-backed development

Use this path when you have access to the shared backend and want the real completion flow:

1. Copy `apps/web/.env.example` to `apps/web/.env`
2. Set:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`

3. Start the app:

```bash
npm run dev:web
```

For a fixed local origin, use:

```bash
npm run dev:web:local
```

Notes:

- Vercel access is not required for routine local development
- if you use remote Supabase locally, the project `ALLOWED_ORIGINS` secret must include your exact local origin
- `http://127.0.0.1:4173` and `http://localhost:4173` are distinct origins
- the shared project already allows `http://127.0.0.1:4173`, `http://localhost:4173`, `http://127.0.0.1:5173`, and `http://localhost:5173`

### Frontend-only fallback development

Use this path when you do not have backend access and only need frontend iteration:

1. Copy `apps/web/.env.example` to `apps/web/.env`
2. Set:

- `VITE_ENABLE_LOCAL_PROTOTYPE_FALLBACK=true`

3. Leave the Supabase env vars unset
4. Start the app with `npm run dev:web` or `npm run dev:web:local`

Constraint:

- this fallback is development-only and should not be treated as production trust logic

## Validation Commands

The current validation set is:

```bash
npm run lint
npm run build:web
deno check --no-lock supabase/functions/issue-session/index.ts
deno check --no-lock supabase/functions/complete-quiz/index.ts
```

Those commands are also reflected in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

Broader test strategy guidance, including what should eventually run in PR CI versus local-only iteration, lives in [testing.md](./testing.md).

## UI Review Workflow

Use browser review when validating UI changes, especially mobile-first flow changes.

Preferred path:

1. Start the app locally, usually with `npm run dev:web:local`
2. Make sure Playwright Chromium is available
3. Run:

```bash
npm run ui:review:capture
```

Notes:

- prefer a real browser pass over code-only visual guesses
- prefer remote Supabase-backed UI review when the env vars are configured locally
- if you must use the offline fallback, run against the Vite dev server rather than `vite preview`

## Fresh Deployment From A Fork

Use this section only when creating a new deployment outside the shared project.

### Supabase

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
npx supabase secrets set SESSION_SIGNING_SECRET=your-long-random-secret
npx supabase secrets set ALLOWED_ORIGINS=http://127.0.0.1:4173,http://localhost:4173,http://127.0.0.1:5173,http://localhost:5173,https://your-production-web-origin.example
npx supabase functions deploy issue-session
npx supabase functions deploy complete-quiz
```

Then set these frontend env vars locally and in your Vercel project:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`

### Vercel

- create your own Vercel project for `apps/web`
- keep the SPA route rewrite in `apps/web/vercel.json`
- create your own local `.vercel/` link metadata after checkout; the folder is git-ignored on purpose

## Release Flow

The intended release path is:

1. Reproduce and validate the change locally.
2. Open a pull request.
3. Let CI run the repo checks.
4. Merge to `main`.
5. Let Vercel Git integration publish the frontend from the merged commit.
6. Let [`.github/workflows/release.yml`](../.github/workflows/release.yml) apply production Supabase migrations and deploy production Edge Functions from that same repo state.

The release workflow currently expects these GitHub Actions secrets:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`

Important boundary:

- Vercel environment variable values remain managed in Vercel
- Supabase secrets such as `SESSION_SIGNING_SECRET` and `ALLOWED_ORIGINS` remain managed in the Supabase project
- the release workflow promotes code and migrations, not secret values

## Integration Troubleshooting

### Session bootstrap succeeds but completion returns 401

If `issue-session` returns `200` but `complete-quiz` returns `401 Session is missing or invalid`, the session credential is not round-tripping correctly.

Current expectation:

- the backend sets the secure cookie when possible
- the frontend also stores the signed session token fallback and sends it explicitly on later requests

If this regresses, inspect both Edge Functions together rather than treating it as a frontend-only bug.

### Completion returns 500 after backend verification succeeds

If the user reaches the completion step but receives the generic backend failure message, inspect the Supabase Edge Function logs for the `details` field returned by `complete-quiz`.

One concrete gotcha already hit in this repo:

- if a hardened Postgres function sets `search_path = public`, extension functions such as `gen_random_bytes(...)` are no longer resolved implicitly in Supabase
- use `extensions.gen_random_bytes(...)` explicitly inside hardened functions that rely on `pgcrypto`

## Next Engineering Phase

The next likely development steps are:

1. Move event and quiz content out of the shared `game-config` module and into database-backed event records.
2. Add organizer/admin tooling for editing, publishing, and operating events without code changes.
3. Add lightweight reporting for quiz starts, completions, and timing.
4. Replace sample/demo routing assumptions with direct event-entry routes suitable for QR distribution.
5. Decide whether live usage justifies stronger abuse controls than the current browser-session dedupe model.

For the broader product target, read `product.md` and `experience.md`. For the current implementation shape, read `architecture.md`.
