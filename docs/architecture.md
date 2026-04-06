# Neighborhood Game Quiz — Architecture

## Purpose

This document describes the system that currently exists in the repository and the architectural gaps that still remain before the project becomes an event-ready MVP.

Use it when you need:

- the current codebase shape
- runtime responsibilities and request flow
- trust boundaries and data ownership
- the architectural roadmap for the next phase

It focuses on:

- the current codebase structure
- runtime responsibilities and request flow
- where trust and data ownership live today
- which parts of the original MVP direction are already implemented
- which pieces are still deferred to later milestones

Tooling and local workflow live in `dev.md`. Product intent lives in `product.md`. UX goals live in `experience.md`. Platform setting ownership lives in `operations.md`.

## Current Architecture Summary

The current implementation is:

- a React single-page app for the attendee experience
- Supabase-backed published event content tables for routes and landing-page summaries
- a shared TypeScript domain module for quiz runtime shape, mapping, validation, and scoring
- two Supabase edge functions for session bootstrap and trusted completion
- Supabase SQL migrations that store published content, record completion attempts, and award one raffle entitlement per event/session pair
- local browser state during quiz play, with the backend owning the final verification result

The core architectural principle already embodied in the code is:

Keep the quiz interaction local and fast, but make the completion state backend-backed and harder to spoof.

## Current Codebase Structure

### Top-Level Layout

- `apps/web`
  The attendee-facing single-page application.
- `shared`
  Shared TypeScript domain logic used by both the browser and Supabase functions.
- `supabase/functions`
  Edge functions for session bootstrap and trusted completion.
- `supabase/migrations`
  SQL schema, tables, and RPC logic for quiz completion and raffle entitlement behavior.
- `docs`
  Product, UX, architecture, and development documentation.

### Frontend Structure

The current frontend is still intentionally small, but the quiz flow is now
grouped into a dedicated `apps/web/src/game/` module:

- `apps/web/src/main.tsx`
  Browser entry point. Mounts the React app.
- `apps/web/src/App.tsx`
  Root shell and pathname-based route selection.
- `apps/web/src/routes.ts`
  Central route definitions plus pathname normalization and matching.
- `apps/web/src/usePathnameNavigation.ts`
  Minimal client-side navigation hook built on the History API.
- `apps/web/src/pages/LandingPage.tsx`
  Product overview and entry point into published demo events.
- `apps/web/src/pages/GameRoutePage.tsx`
  Async route loader that resolves `/game/:slug` into published content before
  rendering the quiz shell.
- `apps/web/src/pages/GamePage.tsx`
  Quiz shell for an already-loaded event. It bootstraps the session, consumes
  the quiz hook, and renders quiz panels from the game module.
- `apps/web/src/pages/NotFoundPage.tsx`
  Fallback route.
- `apps/web/src/game/useQuizSession.ts`
  Public quiz-session hook that coordinates reducer state, derived selectors,
  and completion submission.
- `apps/web/src/game/quizSessionState.ts`
  Internal pure reducer/state-machine logic for quiz progression and completion.
- `apps/web/src/game/quizSessionSelectors.ts`
  Internal pure derived-state selectors for React-facing quiz view state.
- `apps/web/src/game/quizUtils.ts`
  Public quiz-specific selection, label, and feedback helpers.
- `apps/web/src/game/components/`
  Quiz-specific intro, question, feedback, and completion panels extracted from
  the route shell.
- `apps/web/src/lib/quizApi.ts`
  Client-side session bootstrap and completion submission logic, including the local-development fallback.
- `apps/web/src/lib/quizContentApi.ts`
  Browser reads for published event summaries and route content.
- `apps/web/src/lib/supabaseBrowser.ts`
  Shared browser-side Supabase env, auth-header, and error helpers used by
  both content reads and function calls.
- `apps/web/src/lib/session.ts`
  Small client id-generation helpers.
- `apps/web/src/types/quiz.ts`
  Client-side types for completion payloads and results.
- `apps/web/src/data/games.ts`
  Re-export layer for shared quiz definitions.
- `apps/web/src/styles.scss`
  Frontend styling entrypoint.
- `apps/web/src/styles/`
  SCSS partials for tokens, mixins, layout, landing-page UI, quiz UI, and responsive rules.

### Shared Domain Structure

The shared layer now exposes a stable entrypoint plus focused implementation modules:

- `shared/game-config.ts`
  Public compatibility entrypoint for existing imports.
- `shared/game-config/`
  Internal shared modules for types, published-row mapping, explicit sample
  fixtures, validation, and answer/scoring logic.

Together they contain:

- shared quiz domain types
- DB-row mapping into `GameConfig`
- answer normalization
- scoring
- submitted-answer validation
- explicit sample fixtures for tests and the local-only prototype fallback

Published quiz content now lives in Supabase, but this shared layer is still
the source of truth for the in-memory quiz model and quiz correctness once that
content has been loaded.

### Backend Structure

The Supabase side is intentionally small:

- `supabase/functions/issue-session/index.ts`
  Creates or reuses the signed browser session credential.
- `supabase/functions/complete-quiz/index.ts`
  Validates the completion payload, verifies the session credential, computes the trusted score, and calls the database RPC.
- `supabase/functions/_shared/cors.ts`
  Shared CORS helpers.
- `supabase/functions/_shared/published-game-loader.ts`
  Service-role loader that reads one published event from Supabase and maps it
  into the shared runtime model before trusted validation.
- `supabase/functions/_shared/session-cookie.ts`
  Session signing and verification helpers shared by both the cookie and header-fallback path.
- `supabase/migrations/20260403120000_complete_quiz_entitlements.sql`
  Database objects that store completion attempts and ensure only one raffle entitlement is granted per event/session pair.
- `supabase/migrations/20260406130000_add_published_quiz_content.sql`
  Published event, question, and option tables plus demo-event backfill and
  public read policies.

## What Is Implemented Now

### Database-backed published content with shared runtime logic

Published event, question, and option records now live in Supabase.

Those rows are mapped into the shared `GameConfig` runtime shape before either
the browser or backend uses them.

That means:

- the frontend route loads and the backend completion path use the same
  canonical event content
- the frontend still renders from the same runtime shape that the backend
  validates
- score/review behavior cannot drift from server-side completion logic without a code change
- malformed published content fails fast during mapping and validation instead
  of becoming an implicit UI-only problem

### Browser-session trust for the no-login MVP

The backend issues a signed browser session through `issue-session`.

That credential is then used by `complete-quiz` to:

- associate completions with a backend-controlled browser session
- avoid trusting a client-generated session identifier
- allow repeat completions without minting repeat raffle entitlements

The preferred transport is still a secure cookie, but the frontend also stores the signed session token fallback and sends it explicitly when browsers refuse cross-site cookie round-trips.

That means the trust boundary is still backend-controlled, but it no longer depends on every browser accepting a third-party cookie round-trip between the Vercel-hosted SPA and the Supabase edge-function origin.

This is intentionally lighter than full user identity, but it is stronger than a purely client-rendered completion screen.

### Local quiz state with backend-owned completion

The player experience is client-driven until the end of the quiz.

Today:

- question flow, progress, pending answers, retries, and retakes are managed locally in the browser
- final verification is returned from Supabase
- the completion screen displays backend-produced verification data rather than an entirely local success state

### Multiple quiz modes

The current shared game model and frontend support more than one quiz behavior:

- `final_score_reveal`
- `instant_feedback_required`

This capability is implemented in both the shared config model and the `useQuizSession` reducer flow.

## Runtime Request Flow

The current system works like this:

1. A user lands on the frontend hosted on Vercel.
2. The React app resolves the pathname locally and, for `/game/:slug`, loads the
   published event content from Supabase with the publishable key.
3. The landing page likewise reads published demo summaries from Supabase.
4. Missing or unpublished event slugs render an explicit unavailable state
   without revealing which case occurred.
5. When the user starts a game, the browser calls the Supabase `issue-session`
   edge function.
6. Supabase returns a signed browser session credential and attempts to set the
   secure session cookie.
7. The player completes the quiz entirely in local browser state.
8. At the end, the browser submits answers, duration, event id, and request id
   to `complete-quiz`.
9. The backend verifies the signed session credential, reloads the canonical
   published event by `eventId`, validates answers against the shared
   `game-config` runtime model, recomputes score, and executes the database RPC.
10. The RPC records the completion attempt, creates or reuses the raffle
    entitlement, and returns the official verification data.
11. The frontend renders the completion screen using that trusted response.

This flow keeps question-to-question interaction fast while reserving the final trust decision for the backend.

## Current Backend Surface

The current implementation uses:

- `issue-session`
  Prepares the signed browser session credential used as the trust boundary for the no-login MVP.
- `complete-quiz`
  Owns final validation, scoring, dedupe, and verification-code return.
- direct PostgREST reads for published `quiz_events`, `quiz_questions`, and
  `quiz_question_options`
  The browser uses the publishable key plus RLS-filtered reads for public event
  content, while the backend uses the same tables through the service-role key.

There is still no custom general-purpose application API beyond those bounded
surfaces, and that is intentional. The system exposes only the reads and
trusted function endpoints needed by the attendee flow.

## Data Ownership Today

### Client-Owned During Play

The browser currently owns:

- published summary and event reads for public rendering
- current question index
- pending selection state
- submitted local answers
- transient feedback state
- local progress state during a run
- development-only fallback completion data when Supabase env vars are absent

### Backend-Owned At Completion

Supabase currently owns:

- published event, question, and option records
- signed browser-session trust
- final answer validation
- trusted score calculation
- completion attempt persistence
- raffle entitlement dedupe
- verification code return

## Current Deployment Shape

The current deployment model is:

- `Vercel` hosts the static frontend build from `apps/web`
- `Vite` produces that frontend build and powers local development
- `Supabase` hosts the database and edge functions

Those services have distinct roles:

- `Vite` is not a hosting platform. It is the frontend build tool and local dev server.
- `Vercel` is not the backend of record. It serves the built SPA and handles route rewrites for browser navigation.
- `Supabase` is not rendering the quiz UI. It stores data and runs the trusted completion/session logic.

In this repo, [apps/web/vercel.json](../apps/web/vercel.json) rewrites `/game/:path*` to `index.html` so the SPA can resolve those URLs in the browser after deployment.

The current deployment discipline is simpler:

1. Develop and validate changes locally against the configured remote Supabase project or the explicit offline fallback.
2. Use pull requests and CI to review changes before merge.
3. Merge to `main`.
4. Let Vercel Git integration deploy the frontend from the merged repo state.
5. Let [`.github/workflows/release.yml`](../.github/workflows/release.yml) apply Supabase migrations and deploy Edge Functions to the production project from the same repo state.

This keeps deployment repo-driven without requiring hotfixes to start in production, and without introducing preview-branch infrastructure on the backend yet.

## Remaining Gaps To Event-Ready MVP

The repository has a working prototype slice, but it does not yet satisfy the full event-ready MVP described in `product.md` and `experience.md`. The major remaining gaps are:

### Organizer/admin tooling

Today, there is no organizer interface.

What is missing:

- creating and editing events without code changes
- publishing and unpublishing events
- managing sponsor attribution and question content

### Analytics and reporting

Today, the backend persists trusted completion data, but there is no reporting surface.

What is missing:

- completion/start reporting
- timing summaries
- organizer-visible event metrics

### Production event lookup and publish model

Today, the web app includes a marketing/demo landing page and direct
`/game/:slug` routes backed by published event records.

What is missing for live operation:

- clean handling for draft, expired, or unknown event routes
- a production path where QR codes open directly into a live event flow without relying on the demo overview

### Stronger anti-abuse, if needed

Today, the trust boundary is:

- signed browser session credential
- one raffle entitlement per event/session pair

What is not yet implemented:

- person-level dedupe
- multi-device abuse controls
- more advanced operational fraud handling

This is an explicit product tradeoff, not an accidental omission.

## Roadmap

The most sensible next architectural steps are:

1. Add a staging or branch-based Supabase promotion path if local verification plus direct-to-production release stops feeling sufficient.
2. Add organizer-facing content management and publish controls on top of the
   published event schema.
3. Add lightweight analytics/reporting for live events.
4. Add richer publish behavior such as drafts, previews, or expiry windows if
   live operations need them.
5. Revisit abuse controls after observing live event behavior.
