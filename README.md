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

This repository now includes:

- a Vite + React attendee experience prototype
- sample quizzes with multiple feedback modes
- reducer-based quiz flow with submit-per-question behavior
- Supabase scaffolding for completion storage and single raffle entitlements per event/session

Initial validation target:

- Madrona Music in the Playfield

## Documentation

- [Product Overview](./docs/product.md) explains the problem, users, value proposition, and success criteria.
- [UX Philosophy and Experience](./docs/experience.md) describes how the attendee and volunteer experience should feel and flow.
- [Architecture Notes](./docs/architecture.md) defines the system shape, data model, and frontend/backend responsibilities.
- [Development Direction](./docs/dev.md) captures framework choices, technical defaults, open implementation questions, and milestones.

## Planned Experience

The intended attendee experience is:

1. Scan QR code
2. Start immediately with no login
3. Answer one question at a time in a lightweight SPA flow
4. Complete the quiz in under 2 minutes
5. Show a clear completion screen to receive a raffle ticket

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

## Next Steps

- connect the Supabase function and migration to a live project
- validate the experience in a live neighborhood event
- add organizer-facing content management

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
