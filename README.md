# Neighborly Scavenger Game

`Neighborly Scavenger Game` is a mobile-first neighborhood event quiz designed to help local organizers raise sponsor revenue and drive attendee engagement through a short, game-like experience.

The concept is simple:

- attendees scan a QR code at an event
- complete a fast 5-7 question experience
- see local sponsors woven into the game
- finish with a raffle-entry confirmation screen

The product is intended for community events like concerts, fairs, and neighborhood markets, where the experience needs to be fast, outdoor-friendly, and easy to run without technical overhead.

## Goals

- Create a fundraiser that feels fun rather than transactional
- Give local sponsors active visibility instead of passive logo placement
- Keep the attendee flow under 2 minutes
- Make setup simple enough for organizers to run with minimal training

## Current Status

This repository currently includes:

- a Vite + React attendee experience prototype
- a landing page plus sample game routes
- one-question-at-a-time quiz flow with back navigation
- multiple quiz feedback modes
- shared quiz content, validation, and scoring logic
- Supabase-backed browser-session bootstrap
- Supabase-backed completion verification
- SQL-backed single raffle entitlement per event/session pair

The current prototype is usable for engineering validation and local/demo testing, but it is not yet the full event-ready MVP described in the older product and UX docs.

Initial validation target:

- Madrona Music in the Playfield

## What Exists Today

The current codebase is intentionally small and split by responsibility:

- `apps/web` contains the React attendee experience built with Vite
- `apps/web/src/pages` contains route-level screens such as the landing page, game flow, and not-found state
- `apps/web/src/game` contains quiz-session logic and quiz-specific helpers
- `apps/web/src/lib` contains client-side API and session helpers
- `apps/web/src/data` re-exports shared quiz content into the web app
- `shared` contains `game-config.ts`, the shared quiz definitions and scoring/validation logic used by both browser and backend code
- `supabase/functions` contains the edge functions used to issue browser sessions and finalize quiz completion
- `supabase/migrations` contains the database schema and RPC setup for completion and entitlement tracking
- `docs` contains product, UX, architecture, and development guidance

The runtime split is:

- `Vercel` serves the web app
- the browser runs the quiz locally during play
- `Supabase` handles the trusted completion step at the end

## What Still Needs To Be Built

The earlier product and UX docs described a broader event-ready MVP than what currently exists in code today. The main remaining gaps are:

- database-backed event and quiz content instead of shared hardcoded sample data
- organizer/admin tooling for editing and publishing events
- analytics and reporting for starts, completions, and completion time
- direct event-entry production routes instead of sample/demo routing
- stronger anti-abuse controls if live event usage shows browser-session dedupe is insufficient

## Platform Overview

This system uses three major platform pieces:

- `Vite` is the frontend dev server and build tool for `apps/web`. It powers local development, TypeScript-aware builds, and the static files that get deployed.
- `Vercel` hosts the built frontend as a static site. In this repo, [apps/web/vercel.json](./apps/web/vercel.json) rewrites `/game/*` paths back to `index.html` so the single-page app router can handle those routes in the browser.
- `Supabase` provides the backend pieces for the current prototype slice: Postgres, SQL migrations, and edge functions. In this project it is responsible for issuing a signed browser session, validating quiz submissions, deduplicating entitlements, and returning the official verification state.

## Documentation

- [Product Overview](./docs/product.md) explains the problem, users, value proposition, and success criteria.
- [UX Philosophy and Experience](./docs/experience.md) describes how the attendee and volunteer experience should feel and flow.
- [Architecture Notes](./docs/architecture.md) describes the current system shape, code layout, runtime flow, and backend/data responsibilities.
- [Development Guide](./docs/dev.md) explains the toolchain, local workflow, deployment setup, and near-term implementation roadmap.

If you want the detailed code walkthrough, start with [docs/architecture.md](./docs/architecture.md). If you want the toolchain and local workflow, start with [docs/dev.md](./docs/dev.md).

## Current Experience

The implemented attendee experience is:

1. Open the site
2. Choose a sample game from the landing page
3. Start immediately with no login
4. Answer one question at a time in a lightweight SPA flow
5. Complete the quiz in under a few minutes
6. Show a clear completion screen with a backend-backed verification code

The UX direction emphasizes:

- mobile-first design
- outdoor readability
- one decision per screen
- sponsor visibility without interruptive ads
- a clear, verifiable completion state

## MVP Boundaries

The current MVP intentionally avoids:

- generalized SaaS complexity
- advanced analytics dashboards
- heavy anti-fraud systems
- billing and payments infrastructure

## Success Criteria

- At least 30% of estimated attendees start the quiz
- At least 70% of participants complete it
- Median completion time stays at or below 2 minutes
- Organizers can set up the experience in under 1 hour

## Roadmap

Near-term improvements still to be implemented:

- connect the Supabase migration and functions to a live project for event testing
- move quiz/event content from shared TypeScript into database-backed event records
- add organizer-facing content management and publish controls
- shift from sample/demo routes toward direct event-entry routes for live QR usage
- add lightweight reporting for starts, completions, and completion time
- revisit anti-abuse if live event behavior shows browser-session dedupe is insufficient

## Local Setup

Install dependencies at the repo root:

```bash
npm install
```

Run the web app:

```bash
npm run dev:web
```

To enable Supabase-backed completions, copy [apps/web/.env.example](./apps/web/.env.example) to `apps/web/.env` and set:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`

Without those values, the app falls back to a local browser-only completion flow so the prototype still works during development.

## Supabase Setup

After creating a Supabase project, link this repo and deploy the backend pieces:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
npx supabase secrets set SESSION_SIGNING_SECRET=your-long-random-secret
npx supabase secrets set ALLOWED_ORIGINS=http://localhost:5173,https://neighborly-scavenger-game-web.vercel.app
npx supabase functions deploy issue-session
npx supabase functions deploy complete-quiz
```

The function configuration is stored in [supabase/config.toml](./supabase/config.toml), so both protected functions are deployed with JWT verification disabled for the current no-login MVP flow. Trust comes from the signed HTTP-only session cookie, not from Supabase auth.

Then add these environment variables locally and in Vercel for the `apps/web` project:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
