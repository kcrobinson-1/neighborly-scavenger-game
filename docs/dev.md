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
Unresolved contributor-workflow and release questions live in `open-questions.md`.
Release gates, the senior-engineer quality-check methodology, and the living
release-blocking view live in [`release-readiness.md`](./release-readiness.md).

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

### DB-backed content with a shared runtime model

Published quiz content now lives in Supabase tables, not in the default shared
sample catalog.

The shared `game-config` module still matters because:

- the frontend and backend both map published rows into the same `GameConfig`
  runtime shape
- answer validation and scoring still belong to one shared TypeScript source of
  truth
- explicit sample fixtures remain available for tests and the local-only
  prototype fallback without becoming the standard runtime source

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

### Admin auth stays on the real Supabase path

The new `/admin` route is intentionally different from the attendee fallback
story.

That means:

- `/admin` requires a configured Supabase project
- magic-link auth and private draft reads do not run in the local-only
  prototype fallback
- the allowlist check lives in SQL through `public.is_quiz_admin()`, not in
  browser-only state

Magic-link sign-in uses the current browser origin to request a Supabase Auth
redirect back to `/admin`. For production, Supabase Auth must have the deployed
web origin as its Site URL and must allow the deployed `/admin` URL as a
redirect URL. If those dashboard values still point at a local default such as
`http://localhost:3000`, emailed links can send admins to the wrong origin even
when the app requested the correct redirect.

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
- Supabase CLI if you are changing Supabase infrastructure, running database tests, or verifying deploy commands
- a Docker API-compatible runtime if you need to run the local Supabase stack for database tests
  examples from the Supabase docs include Docker Desktop, OrbStack, Rancher Desktop, and Podman
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
- landing-page summaries and `/game/:slug` now expect published event rows in
  the connected Supabase project; the repo migrations seed the current demo
  events for local and fresh-project setup

If you also need the admin route locally:

1. make sure Supabase Auth redirect URLs include your local `/admin` origin
2. add your normalized email to `public.quiz_admin_users` in the connected
   project
3. make sure the `save-draft`, `publish-draft`, and `unpublish-event` Edge
   Functions are deployed when testing authoring writes against a remote project
4. open `/admin` after starting `npm run dev:web` or `npm run dev:web:local`

### Frontend-only fallback development

Use this path when you do not have backend access and only need frontend iteration:

1. Copy `apps/web/.env.example` to `apps/web/.env`
2. Set:

- `VITE_ENABLE_LOCAL_PROTOTYPE_FALLBACK=true`

3. Leave the Supabase env vars unset
4. Start the app with `npm run dev:web` or `npm run dev:web:local`

Constraint:

- this fallback is development-only and should not be treated as production trust logic
- it also uses explicit shared sample fixtures rather than the published-content
  tables
- it does not support `/admin`; the admin shell requires real Supabase auth and
  private draft reads

## Validation Commands

The current validation set is:

```bash
npm run lint
npm test
npm run test:functions
npm run test:supabase
npm run build:web
deno check --no-lock supabase/functions/issue-session/index.ts
deno check --no-lock supabase/functions/complete-quiz/index.ts
deno check --no-lock supabase/functions/save-draft/index.ts
deno check --no-lock supabase/functions/publish-draft/index.ts
deno check --no-lock supabase/functions/unpublish-event/index.ts
```

Those commands are also reflected in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

Production-only smoke coverage uses a separate command:

```bash
npm run test:e2e:admin:production-smoke
```

That command is intentionally not part of normal local validation or PR CI.

For the full local validation flow, use:

```bash
npm run validate:local
```

For one-time local test setup, use:

```bash
npm run test:setup:local
```

That helper:

- checks that a Docker API-compatible runtime is installed and running
- checks that Deno is installed
- installs Playwright Chromium if it is missing

Local tooling note:

- `deno.json` uses manual `nodeModulesDir` mode so `deno check` does not rewrite the main Node workspace packages and break Playwright resolution

Edge Function isolate lifecycle:

- Edge Function isolates terminate as soon as the response is sent. Unresolved
  promises are discarded at that point — a `.catch()`-only fire-and-forget write
  is not guaranteed to complete and will silently drop data in practice.
- Await all side-effect writes (DB inserts, external calls) before returning the
  response. If a write must be best-effort, use `await` + `try/catch` so the
  write completes but a failure does not block the response. `EdgeRuntime.waitUntil`
  is an alternative for work that genuinely must not delay the response, but
  `await` + `try/catch` is simpler and correct for most cases in this repo.

Edge Function trust-path test notes:

- `npm run test:functions` runs the fast Deno helper and handler tests for the Supabase Edge Functions
- `npm run test:functions:integration` serves the local Edge Functions and exercises the real `issue-session` plus `complete-quiz` flow against the local Supabase stack
- `npm run test:supabase` is the preferred local backend validation command because it runs the trust-path integration test and pgTAP database suite on one shared local stack

Database test note:

- `npm run test:db` runs the pgTAP suite in `supabase/tests/database`
- it requires a local Docker-backed Supabase stack
- the script now starts `npx supabase start` automatically when needed and stops it afterward if it started the stack itself
- `npm run test:supabase` now resets the local database to the current repo
  migrations before running the integration and pgTAP suite so warm local state
  cannot hide schema drift

Broader test strategy guidance, including what should eventually run in PR CI versus local-only iteration, lives in [testing.md](./testing.md).

Admin functionality validation is now exposed as a dedicated local end-to-end
command:

```bash
npm run test:e2e:admin
```

This command resets the local Supabase database, prepares a deterministic
allowlisted admin fixture, and runs the shipped admin MVP workflow in Playwright
against a real local Supabase stack.

Use it when changes can affect admin auth, allowlist checks, draft persistence,
publish/unpublish behavior, Supabase Auth configuration, or the admin UI.

This command is intentionally local-only in Phase 5.1:

- it is not included in `.github/workflows/ci.yml`
- it is not included in `npm run validate:local`

Production smoke validation is exposed as:

```bash
npm run test:e2e:admin:production-smoke
```

This command is intended for the production smoke workflow and checks the
deployed admin surface using dedicated smoke fixtures. It is not part of normal
local contributor validation.

The command:

- polls deployed route readiness (`/admin` and `/game/:slug`) with bounded
  timeout before browser checks start
- runs a single-worker Playwright admin smoke suite against the deployed web
  origin
- expects the smoke environment contract documented in
  [`production-admin-smoke-tracking.md`](./production-admin-smoke-tracking.md)

Manual execution path:

1. Open the `Production Admin Smoke` workflow in GitHub Actions.
2. Use `Run workflow` (`workflow_dispatch`) on `main`.
3. Confirm the `production` environment has all required smoke vars and
   secrets documented in [`operations.md`](./operations.md).

Failure triage categories:

- readiness/deployment propagation
- auth redirect/session setup
- allowlist mismatch
- authoring function write path (`save-draft`, `publish-draft`, `unpublish-event`)
- public route publish-state mismatch

Use the detailed runbook in
[`production-admin-smoke-tracking.md`](./production-admin-smoke-tracking.md)
for owner routing and first-response checks.

For live-event monitoring beyond the smoke workflow, use
[`operations.md` — Live Monitoring And Log Triage](./operations.md#live-monitoring-and-log-triage).

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
- local Supabase-backed route-state review works for published-content loading,
  but the local `supabase functions serve` gateway may still block the
  browser-start session bootstrap because it responds to credentialed preflights
  with wildcard CORS headers; use a configured remote Supabase project when you
  need a full browser-backed trust-path review

### Admin UI review

Use the admin capture mode to screenshot the authenticated admin shell without
reading or writing any production data. All Supabase requests are intercepted
by Playwright before they leave the machine.

Prerequisites:

- the app must be running locally (`npm run dev:web:local` or `npm run preview`)
- `VITE_SUPABASE_URL` must be set in `apps/web/.env` (already required for
  normal development — the capture script reads that file automatically when
  the shell environment does not provide the value)
- Playwright Chromium must be installed

Run:

```bash
npm run ui:review:capture:admin
```

No production data is read or written. Playwright registers `page.route()`
interceptors for all Supabase endpoints (auth session, token exchange,
`is_quiz_admin`, `quiz_event_drafts`, and `save-draft`) before any network
request leaves the machine. The capture script uses `VITE_SUPABASE_URL` from
the shell if present and falls back to `apps/web/.env` so the interceptors are
registered on the correct URL pattern — the requests never reach the remote
project.

Screenshots captured (written to `tmp/ui-review/<timestamp>/`):

| File | State |
|------|-------|
| `01-admin-sign-in-mobile.png` | Sign-in form, iPhone 13 viewport |
| `02-admin-sign-in-desktop.png` | Sign-in form, 1440px desktop viewport |
| `03-admin-all-events-mobile.png` | Authenticated event list, iPhone 13 |
| `04-admin-all-events-desktop.png` | Authenticated event list, 1440px desktop |
| `05-admin-workspace-editor-mobile.png` | Selected event details editor, iPhone 13 |
| `06-admin-workspace-editor-desktop.png` | Selected event details editor, 1440px desktop |
| `07-admin-workspace-validation-error.png` | Client-side validation error on save |
| `08-admin-workspace-save-success.png` | Successful save confirmation message |
| `09-admin-workspace-save-error.png` | Backend save error (simulated 500) |
| `10-admin-question-editor-mobile.png` | Question editor panel open, iPhone 13 |
| `11-admin-question-editor-desktop.png` | Question editor panel open, 1440px desktop |
| `12-admin-unauthorized.png` | Signed-in but not on the admin allowlist |

For an assertion-based mobile smoke check, run:

```bash
npm run test:e2e
```

That Playwright suite starts the local Vite server in explicit prototype-fallback mode, so it can run without Supabase env vars while still covering direct route load, the featured attendee flow, and the not-found fallbacks.

The Playwright config also clears inherited Supabase browser env vars for that run so local shell config does not silently switch the smoke suite onto a remote backend.

If Chromium is not installed yet, either run `npm run test:setup:local`, `npm run test:e2e:install`, or:

```bash
npx playwright install chromium
```

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
npx supabase functions deploy save-draft
npx supabase functions deploy publish-draft
npx supabase functions deploy unpublish-event
```

Then set these frontend env vars locally and in your Vercel project:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`

Then finish the manual authoring setup in Supabase:

- set the Auth Site URL to your deployed web origin, such as
  `https://your-production-web-origin.example`
- add Auth redirect URLs for `http://127.0.0.1:4173/admin`,
  `http://localhost:4173/admin`, and your deployed `/admin` origin
- add at least one normalized admin email to `public.quiz_admin_users`:

```sql
insert into public.quiz_admin_users (email)
values ('admin@example.com')
on conflict (email)
do update set active = true, updated_at = now();
```

Use a lowercase, trimmed email address. To revoke access without deleting the
historical row, set `active = false` for that email.

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
7. Let [`.github/workflows/production-admin-smoke.yml`](../.github/workflows/production-admin-smoke.yml) verify deployed admin auth and authoring workflows against dedicated production smoke fixtures (with manual rerun support).

### Pull Request Notes

Pull requests use [`.github/pull_request_template.md`](../.github/pull_request_template.md)
as a lightweight guide for review-ready context.

Every PR body should include:

- why the change is worth merging, with concrete maintainability, correctness,
  user, or operational value
- the expected user-behavior difference, or an explicit statement that current
  user behavior does not change
- contract and scope notes, especially for APIs, response bodies, persistence,
  authentication, authorization, routing, schema, generated artifacts, and
  production configuration
- target-shape evidence for behavior-preserving refactors and checklist work
- documentation updates or why none were needed
- UX review notes for meaningful UX, layout, interaction, or user-facing copy
  changes. The PR description should include uploaded screenshots for the
  affected states, preferably before/after pairs when the branch changes an
  existing experience, or explicitly state why screenshots were not feasible.
- exact validation commands run and any checks that could not be run
- remaining risk, blockers, or follow-up work

The release workflow currently expects these GitHub Actions secrets:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_PROJECT_REF`

The production smoke workflow expects these additional `production` environment
settings (vars and secrets):

- see [`operations.md`](./operations.md) for the complete smoke settings list

Important boundary:

- Vercel environment variable values remain managed in Vercel
- Supabase secrets such as `SESSION_SIGNING_SECRET` and `ALLOWED_ORIGINS` remain managed in the Supabase project
- the GitHub `SUPABASE_DB_PASSWORD` secret is the production database password
  used only by the release workflow to apply migrations
- the release workflow promotes code and migrations, not Supabase Edge Function
  secret values

## Integration Troubleshooting

For live site, admin, Supabase Edge Function, or database triage during an
event, start with the operator runbook in
[`operations.md` — Live Monitoring And Log Triage](./operations.md#live-monitoring-and-log-triage).

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

1. Add admin draft preview (Phase 4.5, deferred post-MVP) and AI-assisted
   authoring entry points (Phase 4.7, deferred post-MVP).
2. Add lightweight reporting for quiz starts, completions, and timing.
3. Add richer event publish controls such as expiry windows if operations need them.
4. Decide whether live usage justifies stronger abuse controls than the current
   browser-session dedupe model.

For the broader product target, read `product.md` and `experience.md`. For the current implementation shape, read `architecture.md`.
