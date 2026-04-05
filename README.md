# Neighborly Scavenger Game

`Neighborly Scavenger Game` is a mobile-first neighborhood event quiz designed to help local organizers raise sponsor revenue and drive attendee engagement through a short, game-like experience.

The current product shape is:

- attendees scan a QR code at an event
- complete a fast 5-7 question experience
- see local sponsors woven into the game
- finish with a backend-verified raffle-entry confirmation state

The product is intended for community events like concerts, fairs, and neighborhood markets, where the experience needs to be fast, outdoor-friendly, and easy to run without technical overhead.

## Current Milestone

This repository currently includes:

- a Vite + React attendee experience prototype
- a landing page plus sample game routes
- one-question-at-a-time quiz flow with back navigation
- multiple quiz feedback modes
- shared quiz content, validation, and scoring logic
- Supabase-backed browser-session bootstrap
- Supabase-backed completion verification
- SQL-backed single raffle entitlement per event/session pair

The current prototype is usable for engineering validation and local/demo testing, but it is not yet the full event-ready MVP described in the product and UX docs.

Initial validation target:

- Madrona Music in the Playfield

## Repo Shape

The codebase is intentionally small and split by responsibility:

- `apps/web`
  React attendee experience built with Vite
- `shared`
  shared `game-config.ts` entrypoint plus `shared/game-config/` modules for quiz definitions, lookup logic, validation, and scoring
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

The main docs are:

- [Product Overview](./docs/product.md)
  why the product exists, who it serves, and what success looks like
- [UX Philosophy and Experience](./docs/experience.md)
  how the attendee, volunteer, and organizer flows should feel
- [Architecture Notes](./docs/architecture.md)
  current system shape, trust boundaries, and runtime flow
- [Development Guide](./docs/dev.md)
  local workflow, validation commands, troubleshooting, and release flow
- [Operations Guide](./docs/operations.md)
  which settings are repo-managed versus manually maintained across GitHub, Vercel, and Supabase

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

If you do not have backend access and only need frontend iteration:

1. Copy [apps/web/.env.example](./apps/web/.env.example) to `apps/web/.env`.
2. Set:

- `VITE_ENABLE_LOCAL_PROTOTYPE_FALLBACK=true`

3. Leave the Supabase env vars unset.
4. Start the app with `npm run dev:web` or `npm run dev:web:local`.

Validation commands:

```bash
npm run lint
npm run build:web
deno check --no-lock supabase/functions/issue-session/index.ts
deno check --no-lock supabase/functions/complete-quiz/index.ts
```

For contributor setup details, local workflow notes, and troubleshooting, use [docs/dev.md](./docs/dev.md).

### Creating Your Own Deployment From A Fork

If you are launching your own copy, use the deployment instructions in [docs/dev.md](./docs/dev.md) together with the ownership guidance in [docs/operations.md](./docs/operations.md).

In short:

- create your own Supabase project
- apply the repo migrations and deploy the Edge Functions
- create your own Vercel project for `apps/web`
- set the frontend env vars in Vercel
- set Supabase secrets such as `SESSION_SIGNING_SECRET` and `ALLOWED_ORIGINS`

## Release Model

This repo currently uses:

- [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) for validation
- [`.github/workflows/release.yml`](./.github/workflows/release.yml) for production Supabase promotion after successful CI on `main`
- Vercel Git integration to deploy the frontend from `main`

Recommended release path:

1. Reproduce and validate the change locally.
2. Open a pull request.
3. Let CI verify the repo.
4. Merge to `main`.
5. Let Vercel publish the frontend from the merged commit.
6. Let the release workflow promote the repo-backed Supabase changes.

Operational setting ownership lives in [docs/operations.md](./docs/operations.md).

## Next Phase

The main remaining gaps before the broader event-ready MVP are:

- database-backed event and quiz content instead of shared hardcoded sample data
- organizer/admin tooling for editing and publishing events
- analytics and reporting for starts, completions, and completion time
- direct event-entry production routes instead of sample/demo routing
- stronger anti-abuse controls if live event usage shows browser-session dedupe is insufficient
