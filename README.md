# Neighborly Scavenger Game

`Neighborly Scavenger Game` is a mobile-first neighborhood event quiz designed to help local organizers raise sponsor revenue and drive attendee engagement through a short, game-like experience.

The current product shape is:

- attendees scan a QR code at an event
- complete a fast 5-7 question experience
- see local sponsors woven into the game
- finish with a backend-verified raffle-entry confirmation state
- admins can sign in at `/admin` to create, duplicate, review, and update
  event details, questions, and answer options for private draft events through
  authenticated authoring APIs

The product is intended for community events like concerts, fairs, and neighborhood markets, where the experience needs to be fast, outdoor-friendly, and easy to run without technical overhead.

## Current Milestone

This repository currently includes:

- a Vite + React attendee experience prototype
- a landing page plus published demo game routes
- database-backed published event and quiz content
- a Supabase Auth-backed admin event workspace for private draft access plus
  draft create, duplicate, event-detail edit, question edit, answer-option
  edit, and publish/unpublish actions at `/admin`
- a publish checklist that validates draft content before allowing publish,
  with named per-check pass/fail indicators and a live-URL confirmation after
  a successful publish
- authenticated admin APIs for draft save, publish, and unpublish operations
- one-question-at-a-time quiz flow with back navigation
- multiple quiz feedback modes
- shared quiz mapping, validation, and scoring logic
- Supabase-backed browser-session bootstrap
- Supabase-backed completion verification
- SQL-backed single raffle entitlement per event/session pair
- SQL-backed draft publishing that transactionally updates public quiz content

The current prototype is usable for engineering validation and local/demo testing, but it is not yet the full event-ready MVP described in the product and UX docs.

Initial validation target:

- Madrona Music in the Playfield

## Repo Shape

The codebase is intentionally small and split by responsibility:

- `apps/web`
  React attendee experience built with Vite
- `shared`
  shared `game-config.ts` entrypoint plus `shared/game-config/` modules for DB mapping, quiz runtime shape, validation, scoring, and explicit sample fixtures
- `supabase/functions`
  Edge Functions for session issuance and trusted completion
- `supabase/migrations`
  database schema, RPCs, and backend hardening
- `docs`
  product, UX, architecture, development, and operations guidance

Runtime responsibilities are:

- `Vercel` serves the web app
- the browser runs the quiz flow locally during play
- `Supabase` handles the trusted completion step at the end

## Documentation

Start with [docs/README.md](./docs/README.md) for the documentation map.

The docs intentionally call unresolved decisions out as open questions instead
of guessing.

The main docs are:

- [Product Overview](./docs/product.md)
  why the product exists, who it serves, and what success looks like
- [UX Philosophy and Experience](./docs/experience.md)
  how the attendee, volunteer, and organizer flows should feel
- [Architecture Notes](./docs/architecture.md)
  current system shape, trust boundaries, and runtime flow
- [Database-backed Quiz Content](./docs/database-backed-quiz-content.md)
  durable implementation reference for the published-content milestone
- [Quiz Authoring Plan](./docs/quiz-authoring-plan.md)
  proposed path for organizer/admin quiz creation, editing, preview, and publish
- [Development Guide](./docs/dev.md)
  local workflow, validation commands, troubleshooting, and release flow
- [Testing Strategy](./docs/testing.md)
  what should be tested across the site, shared logic, Supabase, and UX flows
- [Operations Guide](./docs/operations.md)
  which settings are repo-managed versus manually maintained across GitHub,
  Vercel, and Supabase, plus the current live monitoring and log-triage runbook
- [Open Questions](./docs/open-questions.md)
  unresolved product, workflow, and operational decisions that should stay explicit
- [Documentation Quality Checklist](./docs/documentation-quality-checklist.md)
  action checklist for keeping the documentation set accurate and complete
- [Release Readiness](./docs/release-readiness.md)
  living release readiness plan, release gates, and senior-engineer quality-check methodology

## Quick Start

Install dependencies at the repo root:

```bash
npm install
```

### Contributing To The Existing Project

If you have access to the shared Supabase project:

1. Copy [apps/web/.env.example](./apps/web/.env.example) to `apps/web/.env`.
2. Set:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`

3. Start the app:

```bash
npm run dev:web
```

Use `npm run dev:web:local` if you want a fixed local origin for browser automation.

Published landing-page summaries and `/game/:slug` routes now load from
Supabase-backed published content in this mode.

The admin authoring shell and authoring APIs also require:

- Supabase Auth Site URL and redirect URLs that include the `/admin` origins
  you use
- your normalized admin email to be active in `public.quiz_admin_users`

If you do not have backend access and only need frontend iteration:

1. Copy [apps/web/.env.example](./apps/web/.env.example) to `apps/web/.env`.
2. Set:

- `VITE_ENABLE_LOCAL_PROTOTYPE_FALLBACK=true`

3. Leave the Supabase env vars unset.
4. Start the app with `npm run dev:web` or `npm run dev:web:local`.

In this explicit local-only mode, the app uses shared sample fixtures for both
route content and completion fallback behavior.

Constraint:

- `/admin` does not support the local-only prototype fallback; it requires a
  configured Supabase project for auth and private draft reads

Validation commands:

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

For local contributor setup:

- run `npm run test:setup:local` once to check Docker/Deno and install Playwright Chromium
- run `npm run validate:local` to execute the full local validation flow, including the browser suite plus the local Supabase integration and database checks

For contributor setup details, local workflow notes, and troubleshooting, use [docs/dev.md](./docs/dev.md).

### Creating Your Own Deployment From A Fork

If you are launching your own copy, use the deployment instructions in [docs/dev.md](./docs/dev.md) together with the ownership guidance in [docs/operations.md](./docs/operations.md).

In short:

- create your own Supabase project
- apply the repo migrations and deploy the Edge Functions
- configure Supabase Auth redirect URLs for your `/admin` origins
- add at least one allowlisted admin email in `public.quiz_admin_users`
- create your own Vercel project for `apps/web`
- set the frontend env vars in Vercel
- set Supabase secrets such as `SESSION_SIGNING_SECRET` and `ALLOWED_ORIGINS`

## Release Model

This repo currently uses:

- [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) for validation
- [`.github/workflows/release.yml`](./.github/workflows/release.yml) for production Supabase promotion after successful CI on `main`
- [`.github/workflows/production-admin-smoke.yml`](./.github/workflows/production-admin-smoke.yml) for post-release admin smoke validation against dedicated production smoke fixtures
- Vercel Git integration to deploy the frontend from `main`

Recommended release path:

1. Reproduce and validate the change locally.
2. Open a pull request.
3. Let CI verify the repo.
4. Merge to `main`.
5. Let Vercel publish the frontend from the merged commit.
6. Let the release workflow promote the repo-backed Supabase changes.
7. Let the production admin smoke workflow verify deployed admin auth,
   authoring functions, publish, unpublish, and public route state against
   dedicated smoke fixtures.

Operational setting ownership lives in [docs/operations.md](./docs/operations.md).

## Next Phase

With the current MVP scope, Phases 4 and 5 are complete. Phase 4.5 (admin draft
preview) and Phase 4.7 (AI-assisted authoring) are explicitly deferred post-MVP.

Planned post-MVP enhancements:

- admin draft preview (Phase 4.5, deprioritized post-MVP)
- admin AI-assisted authoring (Phase 4.7, post-MVP)
- analytics and reporting for starts, completions, and completion time
- richer publishing controls such as expiry windows for live event URLs
- stronger anti-abuse controls if live event usage shows browser-session dedupe is insufficient
