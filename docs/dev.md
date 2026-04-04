# Development Guide

## Purpose

This document explains how the current codebase is built and operated during development, and it identifies the implementation work that still remains after the current prototype slice.

System shape and data ownership live in `architecture.md`. UX behavior and visual rules live in `experience.md`.

## Current Tooling In This Repo

The current implementation uses the following stack:

- `React`
  UI library for the attendee-facing single-page application.
- `TypeScript`
  Shared language layer across frontend code, shared domain logic, and Supabase edge functions.
- `Vite`
  Local dev server and production build tool for the web app in `apps/web`.
- `ESLint`
  Repository-wide linting for the React app, shared TypeScript modules, Supabase functions, and the Playwright review script.
- `Vercel`
  Static hosting target for the built frontend.
- `Supabase`
  Hosted Postgres plus edge functions for session issuance, completion validation, and entitlement persistence.
- `Deno`
  Runtime used by the Supabase edge functions.

This doc focuses on how we use those tools during development. The higher-level system ownership and request flow live in `architecture.md`.

## Repository Shape

The current repository layout is:

- `apps/web`
  React frontend workspace.
- `shared`
  Shared quiz types, content, scoring, and validation.
- `supabase/functions`
  Edge-function runtime code.
- `supabase/migrations`
  SQL schema and RPC definitions.
- `docs`
  Product, UX, architecture, and development docs.

This project does not currently need a separate `apps/api` service because Supabase is covering the backend responsibilities we have implemented so far.

## Current Implementation Decisions

### Shared config before DB-backed content

The app currently uses a shared `game-config` module for sample quizzes.

Why this is intentional:

- the frontend needs the content to render the experience
- the backend needs the same content to validate answers and compute score
- sharing the module avoids drift while we are still pre-admin and pre-CMS

This is a transitional step, not the final content-management model.

### Reducer-based quiz session

The quiz flow is modeled as a reducer-backed session rather than scattered local component state.

Why:

- the quiz has real state transitions now: intro, answering, correctness feedback, completion submission, and completion
- back navigation, retries, and retakes are easier to reason about when transitions are explicit
- this reduces the chance of invalid UI states as the product grows

### Session bootstrap before gameplay

The attendee flow prepares a backend session before quiz start when Supabase is configured.

Why:

- it avoids discovering entitlement/session problems only at the very end
- it ensures the browser has the signed session cookie before completion submission
- the start screen is a better place for a recoverable setup error than the final verification moment

### Dev fallback stays isolated

When Supabase environment variables are missing in local development, the app falls back to a browser-only prototype completion flow.

Why:

- it keeps front-end iteration fast
- it avoids blocking UI work on backend setup

Constraint:

- this fallback is intentionally development-only and should not be treated as production trust logic

## Core Tooling Choices

### React + TypeScript

The attendee experience is implemented as a React single-page app with TypeScript.

That choice is reflected in:

- `apps/web/src`
- shared types between frontend and backend
- reducer-driven quiz flow state

### Vite

Vite is the frontend build tool and local development server.

How this repo uses Vite:

- `apps/web/package.json` uses `vite` for local development and `tsc -b && vite build` for production builds
- `apps/web/vite.config.ts` keeps the setup intentionally minimal with the React plugin only
- the top-level `npm run dev:web` and `npm run build:web` scripts delegate into the web workspace

Vite is the tool you interact with while building the frontend locally. It is not the deployment host and it does not replace Supabase.

### Rendering Model

The current app is a SPA with:

- one application shell
- pathname-based routing
- one visible quiz card at a time
- client-side state transitions between quiz steps

### Current Content Model

The current content model is code-backed rather than database-backed.

Today:

- sample games live in the shared `game-config` module, implemented under `shared/game-config/`
- the frontend imports them through `apps/web/src/data/games.ts`
- the backend validates against the same shared definitions

This is intentional for the current prototype slice, but it is still a transitional step.

## What Vercel Is And How This Repo Uses It

`Vercel` is the frontend hosting platform for the attendee experience.

In this project, Vercel is responsible for:

- serving the static files produced by `vite build`
- providing the public frontend URL that event QR codes can point to
- rewriting SPA routes like `/game/first-sample` back to `index.html`

The route rewrite is configured in `apps/web/vercel.json`.

Why it matters:

- the app uses lightweight client-side routing
- without the rewrite, direct requests to nested game URLs would 404 on refresh or first load

Vercel is not currently hosting backend business logic. That logic lives in Supabase.

## What Supabase Is And How This Repo Uses It

`Supabase` is the managed backend platform used for the current prototype slice.

In this repo it provides:

- Postgres storage via SQL migrations in `supabase/migrations`
- edge functions in `supabase/functions`
- a place to store secrets such as `SESSION_SIGNING_SECRET`

The current frontend uses Supabase for two specific actions:

1. `issue-session`
   Creates a signed browser session cookie for the no-login flow.
2. `complete-quiz`
   Validates the submitted answers, computes the trusted score, and awards or reuses the raffle entitlement.

Important implementation detail:

- the current MVP does not use Supabase Auth
- both edge functions run with `verify_jwt = false`
- trust comes from the signed HTTP-only browser cookie rather than from a logged-in user identity

## Suggested Developer Mental Model

When working in this repo, it helps to think in three layers:

- `UI layer`
  React components, styles, and pathname navigation in `apps/web/src`
- `shared domain layer`
  Quiz definitions, catalog lookups, and scoring/validation logic in the shared `game-config` module
- `trusted backend layer`
  Supabase edge functions and SQL that own session verification and raffle entitlement decisions

That model usually tells you where a change belongs:

- visual or interaction change: `apps/web/src`
- scoring or quiz-shape change: the shared `game-config` module
- trust, persistence, or entitlement change: `supabase/functions` and `supabase/migrations`

## Local Workflow

The main local development loop is:

1. Install dependencies with `npm install`
2. Start the web app with `npm run dev:web`
3. Lint the codebase with `npm run lint`
4. Build-check the frontend with `npm run build:web`
5. Type-check edge functions with:

```bash
deno check --no-lock supabase/functions/issue-session/index.ts
deno check --no-lock supabase/functions/complete-quiz/index.ts
```

5. If you want live Supabase-backed completions instead of the local fallback, configure:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`

and deploy/link the Supabase project as described in the root README.

## Current Validation Commands

The codebase is currently checked with:

```bash
npm run lint
npm run build:web
deno check --no-lock supabase/functions/issue-session/index.ts
deno check --no-lock supabase/functions/complete-quiz/index.ts
```

Those commands verify the current lint rules, frontend build path, and edge-function TypeScript/Deno surface.

## Remaining Implementation Roadmap

The repository now has a solid prototype foundation, but it does not yet cover the full event-ready MVP described in `product.md` and `experience.md`. The next development steps to close that gap are:

1. Wire the Supabase deployment to a live project and validate the end-to-end completion path in a real environment.
2. Move event and quiz content out of the shared `game-config` module and into database-backed event records.
3. Add organizer/admin tooling for editing, publishing, and operating events without code changes.
4. Add lightweight reporting for quiz starts, completions, and timing.
5. Replace sample/demo routing assumptions with direct event-entry routes suitable for QR distribution.
6. Decide whether live usage justifies stronger abuse controls than the current browser-session dedupe model.

## How To Read The Older Product And UX Docs

`product.md` and `experience.md` still describe the intended product and UX direction in normative language.

That is useful and intentional:

- those docs explain what the product is trying to become
- this doc explains how the current codebase is actually built today

When they differ, treat:

- `experience.md` as the design target
- `architecture.md` as the current system snapshot plus architecture roadmap
- `dev.md` as the current engineering workflow plus implementation roadmap
