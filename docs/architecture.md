# Neighborhood Game Quiz — Architecture

## Purpose

This document describes the system that currently exists in the repository and the architectural gaps that still remain before the project becomes an event-ready MVP.

It focuses on:

- the current codebase structure
- runtime responsibilities and request flow
- where trust and data ownership live today
- which parts of the original MVP direction are already implemented
- which pieces are still deferred to later milestones

Tooling and local workflow live in `dev.md`. Product intent lives in `product.md`. UX goals live in `experience.md`.

## Current Architecture Summary

The current implementation is:

- a React single-page app for the attendee experience
- a shared TypeScript domain module for quiz content, validation, and scoring
- two Supabase edge functions for session bootstrap and trusted completion
- a Supabase SQL migration that records completion attempts and awards one raffle entitlement per event/session pair
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

The current frontend is intentionally shallow:

- `apps/web/src/main.tsx`
  Browser entry point. Mounts the React app.
- `apps/web/src/App.tsx`
  Root shell and pathname-based route selection.
- `apps/web/src/routes.ts`
  Central route definitions plus pathname normalization and matching.
- `apps/web/src/usePathnameNavigation.ts`
  Minimal client-side navigation hook built on the History API.
- `apps/web/src/pages/LandingPage.tsx`
  Product overview and entry point into sample games.
- `apps/web/src/pages/GamePage.tsx`
  End-to-end player flow: intro, active question UI, correctness feedback, and completion screen.
- `apps/web/src/pages/NotFoundPage.tsx`
  Fallback route.
- `apps/web/src/game/useQuizSession.ts`
  Reducer-driven quiz session state machine.
- `apps/web/src/game/quizUtils.ts`
  Quiz-specific selection, label, and feedback helpers.
- `apps/web/src/lib/quizApi.ts`
  Client-side session bootstrap and completion submission logic, including the local-development fallback.
- `apps/web/src/lib/session.ts`
  Small client id-generation helpers.
- `apps/web/src/types/quiz.ts`
  Client-side types for completion payloads and results.
- `apps/web/src/data/games.ts`
  Re-export layer for shared quiz definitions.
- `apps/web/src/styles.css`
  Global prototype styling.

### Shared Domain Structure

The shared layer is currently a single file:

- `shared/game-config.ts`

It contains:

- sample game definitions
- shared quiz domain types
- answer normalization
- scoring
- submitted-answer validation
- game lookups by id and slug

This is the current source of truth for quiz correctness. The browser uses it to render and review answers, and the backend uses it to validate and score the final submission.

### Backend Structure

The Supabase side is intentionally small:

- `supabase/functions/issue-session/index.ts`
  Creates or reuses the signed browser session cookie.
- `supabase/functions/complete-quiz/index.ts`
  Validates the completion payload, verifies the session cookie, computes the trusted score, and calls the database RPC.
- `supabase/functions/_shared/cors.ts`
  Shared CORS helpers.
- `supabase/functions/_shared/session-cookie.ts`
  Cookie signing and verification helpers.
- `supabase/migrations/20260403120000_complete_quiz_entitlements.sql`
  Database objects that store completion attempts and ensure only one raffle entitlement is granted per event/session pair.

## What Is Implemented Now

### Shared quiz logic across frontend and backend

Quiz definitions, answer normalization, validation, and scoring all live in `shared/game-config.ts`.

That means:

- the frontend renders from the same source that the backend validates
- score/review behavior cannot drift from server-side completion logic without a code change
- sample game data fails fast if ids or answer definitions are inconsistent

### Browser-session trust for the no-login MVP

The backend issues a signed HTTP-only cookie through `issue-session`.

That cookie is then used by `complete-quiz` to:

- associate completions with a backend-controlled browser session
- avoid trusting a client-generated session identifier
- allow repeat completions without minting repeat raffle entitlements

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
2. The React app loads and resolves the pathname locally.
3. When the user starts a game, the browser calls the Supabase `issue-session` edge function.
4. Supabase returns a signed HTTP-only cookie that represents the browser session.
5. The player completes the quiz entirely in local browser state.
6. At the end, the browser submits answers, duration, event id, and request id to `complete-quiz`.
7. The backend verifies the signed cookie, validates answers against `shared/game-config.ts`, recomputes score, and executes the database RPC.
8. The RPC records the completion attempt, creates or reuses the raffle entitlement, and returns the official verification data.
9. The frontend renders the completion screen using that trusted response.

This flow keeps question-to-question interaction fast while reserving the final trust decision for the backend.

## Current Backend Surface

The current implementation uses two edge functions:

- `issue-session`
  Prepares the signed session cookie used as the trust boundary for the no-login MVP.
- `complete-quiz`
  Owns final validation, scoring, dedupe, and verification-code return.

No general-purpose REST API exists yet, and that is intentional. The system currently exposes only the endpoints needed by the attendee flow.

## Data Ownership Today

### Client-Owned During Play

The browser currently owns:

- current question index
- pending selection state
- submitted local answers
- transient feedback state
- local progress state during a run
- development-only fallback completion data when Supabase env vars are absent

### Backend-Owned At Completion

Supabase currently owns:

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

## Remaining Gaps To Event-Ready MVP

The repository has a working prototype slice, but it does not yet satisfy the full event-ready MVP described in `product.md` and `experience.md`. The major remaining gaps are:

### Database-backed event content

Today, quiz content still lives in `shared/game-config.ts`.

What is missing:

- event records in the database
- question/answer/sponsor records in the database
- published-event reads from the backend instead of hardcoded sample content

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

### Live event routing model

Today, the web app includes a marketing/demo landing page plus sample routes.

What is missing for live operation:

- direct event-entry URLs for QR codes
- event-specific loading instead of sample-game selection
- a production path that opens straight into a live event flow

### Stronger anti-abuse, if needed

Today, the trust boundary is:

- signed HTTP-only cookie
- one raffle entitlement per event/session pair

What is not yet implemented:

- person-level dedupe
- multi-device abuse controls
- more advanced operational fraud handling

This is an explicit product tradeoff, not an accidental omission.

## Roadmap

The most sensible next architectural steps are:

1. Connect the Supabase migration and functions to a live project and validate the completion flow end to end.
2. Move event and quiz content into database-backed records while preserving one trusted scoring/validation path.
3. Add organizer-facing content management and publish controls.
4. Add lightweight analytics/reporting for live events.
5. Replace sample/demo routing with event-specific QR entry flows.
6. Revisit abuse controls after observing live event behavior.
