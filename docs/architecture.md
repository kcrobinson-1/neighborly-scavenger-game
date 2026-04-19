# Neighborhood Game — Architecture

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
- a Supabase Auth-backed admin route for private draft visibility
- Supabase-backed published event content tables for routes and landing-page summaries
- private authoring draft and admin-allowlist tables protected by RLS
- a shared TypeScript domain module for game runtime shape, mapping, validation, and scoring
- Supabase edge functions for session bootstrap, trusted completion, and
  authenticated authoring transitions
- Supabase SQL migrations that store published content, record completion attempts, and award one game entitlement per event/session pair
- local browser state during game play, with the backend owning the final verification result

The core architectural principle already embodied in the code is:

Keep the game interaction local and fast, but make the completion state backend-backed and harder to spoof.

## Current Codebase Structure

### Top-Level Layout

- `apps/web`
  The attendee-facing single-page application.
- `shared`
  Shared TypeScript domain logic used by both the browser and Supabase functions.
- `supabase/functions`
  Edge functions for session bootstrap and trusted completion.
- `supabase/migrations`
  SQL schema, tables, and RPC logic for game completion and entitlement behavior.
- `docs`
  Product, UX, architecture, and development documentation.

### Frontend Structure

The current frontend is still intentionally small, but the game flow is now
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
- `apps/web/src/pages/AdminPage.tsx`
  Thin route adapter for `/admin` that composes the admin module and keeps
  route navigation at the page boundary.
- `apps/web/src/pages/GameRoutePage.tsx`
  Async route loader that resolves `/event/:slug/game` into published content
  before rendering the game shell.
- `apps/web/src/pages/GamePage.tsx`
  Game shell for an already-loaded event. It bootstraps the session, consumes
  the game hook, and renders game panels from the game module.
- `apps/web/src/pages/NotFoundPage.tsx`
  Fallback route.
- `apps/web/src/game/useGameSession.ts`
  Public game-session hook that coordinates reducer state, derived selectors,
  and completion submission.
- `apps/web/src/game/gameSessionState.ts`
  Internal pure reducer/state-machine logic for game progression and completion.
- `apps/web/src/game/gameSessionSelectors.ts`
  Internal pure derived-state selectors for React-facing game view state.
- `apps/web/src/game/gameUtils.ts`
  Public game-specific selection, label, and feedback helpers.
- `apps/web/src/game/components/`
  Game-specific intro, question, feedback, and completion panels extracted from
  the route shell.
- `apps/web/src/lib/gameApi.ts`
  Client-side session bootstrap and completion submission logic, including the local-development fallback.
- `apps/web/src/lib/adminGameApi.ts`
  Browser auth, admin-status RPC, private draft reads, and authenticated
  authoring function calls.
- `apps/web/src/lib/gameContentApi.ts`
  Browser reads for published event summaries and route content.
- `apps/web/src/lib/supabaseBrowser.ts`
  Shared browser-side Supabase env, auth-header, and error helpers used by
  public content reads, admin auth, and function calls.
- `apps/web/src/lib/session.ts`
  Small client id-generation helpers.
- `apps/web/src/admin/`
  Admin-session and dashboard hooks plus presentational components for
  magic-link sign-in, status states, the event workspace, and selected draft
  event routes under `/admin`.
- `apps/web/src/types/game.ts`
  Client-side types for completion payloads and results.
- `apps/web/src/data/games.ts`
  Re-export layer for shared game definitions.
- `apps/web/src/styles.scss`
  Frontend styling entrypoint.
- `apps/web/src/styles/`
  SCSS partials for tokens, mixins, layout, landing-page UI, focused game UI
  component groups, admin UI, and responsive rules.

### Shared Domain Structure

The shared layer now exposes a stable entrypoint plus focused implementation modules:

- `shared/game-config.ts`
  Public compatibility entrypoint for existing imports.
- `shared/game-config/`
  Internal shared modules for types, published-row mapping, explicit sample
  fixtures, validation, and answer/scoring logic.

Together they contain:

- shared game domain types
- DB-row mapping into `GameConfig`
- answer normalization
- scoring
- submitted-answer validation
- explicit sample fixtures for tests and the local-only prototype fallback

Published game content now lives in Supabase, but this shared layer is still
the source of truth for the in-memory game model and game correctness once that
content has been loaded.

### Backend Structure

The Supabase side is intentionally small:

- `supabase/functions/issue-session/index.ts`
  Creates or reuses the signed browser session credential. When an `event_id`
  is present in the POST body, also fires a best-effort upsert into
  `game_starts` to record the funnel denominator for analytics.
- `supabase/functions/complete-game/index.ts`
  Orchestrates trusted completion requests: origin and method gates, session
  verification, published content loading, shared validation and scoring, and
  final response mapping.
- `supabase/functions/complete-game/`
  Local helper modules for completion payload parsing, JSON responses,
  dependency wiring, and service-role RPC persistence used by the handler and
  function tests.
- `supabase/functions/save-draft/index.ts`
  Authenticated admin endpoint that validates canonical draft content and saves
  it to the private draft table. It also accepts an optional top-level
  `eventCode`, generates one server-side when needed, and preserves the
  database-owned event-code lock after publish.
- `supabase/functions/generate-event-code/index.ts`
  Authenticated admin endpoint that returns a non-persisted random 3-letter
  event-code suggestion for future admin regenerate controls. Save still happens
  through `save-draft`, which remains the persistence authority.
- `supabase/functions/publish-draft/index.ts`
  Authenticated admin endpoint that validates a draft and calls the
  service-role publish RPC.
- `supabase/functions/unpublish-event/index.ts`
  Authenticated admin endpoint that hides a live event without deleting draft or
  version history.
- `supabase/functions/_shared/admin-auth.ts`
  Shared Supabase Auth JWT and admin allowlist verification for authoring
  endpoints.
- `supabase/functions/_shared/authoring-http.ts`
  Shared CORS, method, configuration, admin-auth, and JSON response handling
  for authenticated authoring endpoints.
- `supabase/functions/_shared/cors.ts`
  Shared CORS helpers.
- `supabase/functions/_shared/published-game-loader.ts`
  Service-role loader that reads one published event from Supabase and maps it
  into the shared runtime model before trusted validation.
- `supabase/functions/_shared/session-cookie.ts`
  Session signing and verification helpers shared by both the cookie and header-fallback path.
- `supabase/migrations/20260403120000_complete_quiz_entitlements.sql`
  Historical filename; creates database objects that store completion attempts
  and ensure only one game entitlement is granted per event/session pair. The
  active SQL objects are renamed by later migrations.
- `supabase/migrations/20260405171549_fix_verification_code_pgcrypto_search_path.sql`
  Fixes the pgcrypto search path used for verification code generation.
- `supabase/migrations/20260405175756_harden_completion_backend.sql`
  Hardens the completion backend with additional server-side guards.
- `supabase/migrations/20260406130000_add_published_quiz_content.sql`
  Published event, question, and option tables plus demo-event backfill and
  public read policies.
- `supabase/migrations/20260406150000_add_quiz_authoring_drafts.sql`
  Private draft and version tables plus backfill from the current published
  demo events.
- `supabase/migrations/20260407103000_add_quiz_authoring_auth.sql`
  Admin allowlist table (`admin_users`), admin-status RPC (`is_admin()`),
  authoring RLS policies, and draft audit stamping.
- `supabase/migrations/20260410170000_add_quiz_authoring_publish_workflow.sql`
  Game event audit log plus service-role publish and unpublish RPCs that update
  the public runtime projection transactionally.
- `supabase/migrations/20260415000000_add_quiz_event_draft_slug_lock_trigger.sql`
  Database trigger that enforces slug immutability once an event is first
  published. The trigger fires under the row write lock so no concurrent
  publish can bypass the check; the application layer also validates this
  before upserting, but the trigger is the authoritative enforcement point.
- `supabase/migrations/20260415010000_make_sponsor_nullable.sql`
  Drops the `NOT NULL` constraint on `game_questions.sponsor` so unsponsored
  house questions can be modeled correctly. Required before analytics views
  can distinguish sponsored from unsponsored questions.
- `supabase/migrations/20260416000000_add_quiz_starts.sql`
  Adds the `game_starts` table (`event_id`, `client_session_id`, `issued_at`)
  with a unique constraint on `(event_id, client_session_id)` for idempotent
  inserts. RLS enabled; analytics-only, accessed via service role. Provides
  the funnel denominator (starts → completions → entitlements) that is
  permanently unrecoverable without this table in place before an event runs.
- `supabase/migrations/20260416010000_add_quiz_starts_event_fk.sql`
  Adds a foreign key from `game_starts.event_id` to `game_events(id) ON DELETE
  CASCADE`. Enforces referential integrity so `issue-session` cannot record
  start rows for nonexistent event IDs (which would pollute analytics), and
  ensures start rows are cleaned up if an event is hard-deleted.
- `supabase/migrations/20260418000000_rename_database_terminology_to_game.sql`
  Renames the persistent SQL contract from the historical quiz/raffle names to
  the current game/entitlement names. The active schema uses `game_events`,
  `game_questions`, `game_question_options`, `game_completions`,
  `game_entitlements`, `game_event_drafts`, `game_event_versions`,
  `game_event_audit_log`, `game_starts`, `admin_users`, `is_admin()`,
  `complete_game_and_award_entitlement()`, `publish_game_event_draft()`, and
  `unpublish_game_event()`.
- `supabase/migrations/20260418010000_rename_authoring_entitlement_label_json.sql`
  Renames authoring draft/version JSON from the historical `raffleLabel` key to
  `entitlementLabel` and updates `publish_game_event_draft()` so it projects
  draft content into `game_events.entitlement_label`.
- `supabase/migrations/20260418020000_update_demo_game_copy.sql`
  Updates seeded demo event, question, and answer-option copy to the Phase 4
  game/reward wording used by the frontend fixtures and browser tests.
- `supabase/migrations/20260418030000_add_event_code_columns.sql`
  Adds nullable `event_code` columns to private drafts and published events
  with uppercase 3-letter format checks.
- `supabase/migrations/20260418040000_backfill_event_code.sql`
  Backfills existing testing/demo rows deterministically, makes event codes
  required, adds unique indexes, and creates `generate_random_event_code()` for
  service-role generation.
- `supabase/migrations/20260418050000_lock_event_code_after_publish.sql`
  Adds the database trigger that prevents event-code changes after first
  publish.
- `supabase/migrations/20260418060000_project_event_code_on_publish.sql`
  Updates `publish_game_event_draft()` so the published `game_events` projection
  receives the draft event code.

## What Is Implemented Now

### Database-backed published content with shared runtime logic

Published game event, question, and option records now live in Supabase.

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

That credential is then used by `complete-game` to:

- associate completions with a backend-controlled browser session
- avoid trusting a client-generated session identifier
- allow repeat completions without minting repeat game entitlements

The preferred transport is still a secure cookie, but the frontend also stores the signed session token fallback and sends it explicitly when browsers refuse cross-site cookie round-trips.

That means the trust boundary is still backend-controlled, but it no longer depends on every browser accepting a third-party cookie round-trip between the Vercel-hosted SPA and the Supabase edge-function origin.

This is intentionally lighter than full user identity, but it is stronger than a purely client-rendered completion screen.

### Local game state with backend-owned completion

The player experience is client-driven until the end of the game.

Today:

- question flow, progress, pending answers, retries, and retakes are managed locally in the browser
- final verification is returned from Supabase
- the completion screen displays backend-produced verification data rather than an entirely local success state

### Multiple game feedback modes

The current shared game model and frontend support more than one game behavior:

- `final_score_reveal`
- `instant_feedback_required`

This capability is implemented in both the shared config model and the `useGameSession` reducer flow.

### Admin event workspace for authoring access

The web app now includes a dedicated `/admin` route.

Today that route:

- signs admins in with Supabase Auth magic links
- checks a private email allowlist through `public.is_admin()`
- shows an event-centered workspace for private draft events visible to
  allowlisted admins
- supports direct event selection under `/admin/events/:eventId`
- lets admins create starter drafts and duplicate existing private drafts
  through the authenticated draft save path
- lets admins edit selected event-level draft details without changing live
  attendee content
- lets admins edit existing question text, sponsor attribution, selection mode,
  option labels, and correct answers in private drafts
- lets admins add, duplicate, reorder, and delete draft questions plus add and
  delete draft answer options
- keeps non-admin authenticated users out of the draft data path

The browser requests magic links with an explicit `/admin` redirect on the
current origin. Supabase Auth dashboard settings still have to allow that URL,
and the project Site URL should match the deployed web origin so email links do
not fall back to a local default.

The visible admin page can create, duplicate, and update event-level,
question-level, and answer-option private draft content, but the backend API
surface owns validation and persistence:

- `save-draft` writes validated private draft JSON for allowlisted admins
- `publish-draft` validates the draft and updates the public event, question,
  and option tables through one database transaction
- `unpublish-event` clears the public event's `published_at` value while
  preserving private draft and version history
- `game_event_audit_log` records publish and unpublish transitions

The current scope still stops short of a preview route or AI authoring UI.

## Runtime Request Flow

The current system works like this:

1. A user lands on the frontend hosted on Vercel.
2. The React app resolves the pathname locally and, for `/event/:slug/game`,
   loads the published event content from Supabase with the publishable key.
3. The landing page likewise reads published demo summaries from Supabase.
4. Missing or unpublished event slugs render an explicit unavailable state
   without revealing which case occurred.
5. When the user starts a game, the browser calls the Supabase `issue-session`
   edge function with the `event_id` in the request body.
6. Supabase returns a signed browser session credential and attempts to set the
   secure session cookie. As a best-effort side effect, it upserts a row into
   `game_starts` so the event has a permanent record of this session starting.
7. The player completes the game entirely in local browser state.
8. At the end, the browser submits answers, duration, event id, and request id
   to `complete-game`.
9. The backend verifies the signed session credential, reloads the canonical
   published event by `eventId`, validates answers against the shared
   `game-config` runtime model, recomputes score, and executes the database RPC.
10. The RPC records the completion attempt, creates or reuses the game
    entitlement, and returns the official verification data.
11. The frontend renders the completion screen using that trusted response.

This flow keeps question-to-question interaction fast while reserving the final trust decision for the backend.

## Current Backend Surface

The current implementation uses:

- `issue-session`
  Prepares the signed browser session credential used as the trust boundary
  for the no-login MVP. When `event_id` is present in the request body, also
  writes a best-effort start row to `game_starts` for analytics. A DB failure
  on the start write does not prevent the session response from returning —
  session issuance is the trust boundary; analytics is observability.
- `complete-game`
  Owns final validation, scoring, dedupe, and verification-code return.
- direct PostgREST reads for published `game_events`, `game_questions`, and
  `game_question_options`
  The browser uses the publishable key plus RLS-filtered reads for public event
  content, while the backend uses the same tables through the service-role key.
- direct authenticated PostgREST reads for private `game_event_drafts`
  The admin shell loads draft summaries through the authenticated browser
  session plus RLS.
- `save-draft`
  Authenticates the Supabase user, checks the admin allowlist, validates
  canonical draft content, and writes private draft rows with service-role
  privileges.
- `publish-draft`
  Authenticates an admin, revalidates the draft through shared game logic, and
  calls `public.publish_game_event_draft(...)` to update live public content in
  one transaction.
- `unpublish-event`
  Authenticates an admin and calls `public.unpublish_game_event(...)` to hide a
  live event without deleting authoring history.
- `public.is_admin()`
  Security-definer SQL helper that turns the current authenticated email/user
  context into one shared allowlist decision for both the admin UI and RLS.

There is still no custom general-purpose application API beyond those bounded
surfaces, and that is intentional. The system exposes only the reads and
trusted function endpoints needed by the attendee flow.

## Data Ownership Today

### Client-Owned During Play

The browser currently owns:

- published summary and event reads for public rendering
- the persisted Supabase Auth session for `/admin`
- current question index
- pending selection state
- submitted local answers
- transient feedback state
- local progress state during a run
- development-only fallback completion data when Supabase env vars are absent

### Backend-Owned For Completion And Authoring

Supabase currently owns:

- published event, question, and option records
- private authoring drafts, immutable versions, and audit rows
- draft save, publish, and unpublish transitions
- signed browser-session trust
- game start records (`game_starts`) for analytics funnel tracking
- final answer validation
- trusted score calculation
- completion attempt persistence
- game entitlement dedupe
- verification code return

## Current Deployment Shape

The current deployment model is:

- `Vercel` hosts the static frontend build from `apps/web`
- `Vite` produces that frontend build and powers local development
- `Supabase` hosts the database and edge functions

Those services have distinct roles:

- `Vite` is not a hosting platform. It is the frontend build tool and local dev server.
- `Vercel` is not the backend of record. It serves the built SPA and handles route rewrites for browser navigation.
- `Supabase` is not rendering the game UI. It stores data and runs the trusted completion/session logic.

In this repo, [apps/web/vercel.json](../apps/web/vercel.json) rewrites `/admin`
and `/event/:path*` to `index.html` so the SPA can resolve those URLs in the
browser after deployment.

The current deployment discipline is simpler:

1. Develop and validate changes locally against the configured remote Supabase project or the explicit offline fallback.
2. Use pull requests and CI to review changes before merge.
3. Merge to `main`.
4. Let Vercel Git integration deploy the frontend from the merged repo state.
5. Let [`.github/workflows/release.yml`](../.github/workflows/release.yml) apply Supabase migrations and deploy Edge Functions to the production project from the same repo state.

This keeps deployment repo-driven without requiring hotfixes to start in production, and without introducing preview-branch infrastructure on the backend yet.

## Post-MVP Planned Work

The MVP milestone is complete. The following areas represent planned post-MVP
enhancements, deferred capabilities, and open operational questions that were
intentionally out of scope for the initial release.

### Organizer/admin tooling

The admin workspace ships create, duplicate, event-level edit, question and
option edit, publish, and unpublish. The deferred capabilities are:

- preview UI: let an admin see the attendee experience before publishing
- AI-assisted authoring entry points in the admin experience

### Analytics and reporting

The backend now persists both game start records (`game_starts`) and trusted
completion data (`game_completions`, `game_entitlements`). This gives the
full funnel: starts → completions → entitlements.

What is still missing:

- SQL views for completion rate, score distribution, and timing summaries
- organizer-visible event reporting surface in the admin workspace

### Production event lookup and publish model

Today, the web app includes a marketing/demo landing page and direct
`/event/:slug/game` routes backed by published event records.

What is missing for live operation:

- clean handling for draft, expired, or unknown event routes
- a production path where QR codes open directly into a live event flow without relying on the demo overview

### Stronger anti-abuse, if needed

Today, the trust boundary is:

- signed browser session credential
- one game entitlement per event/session pair

What is not yet implemented:

- person-level dedupe
- multi-device abuse controls
- more advanced operational fraud handling

This is an explicit product tradeoff, not an accidental omission.

## Roadmap

The most sensible next architectural steps are:

1. Add a staging or branch-based Supabase promotion path if local verification plus direct-to-production release stops feeling sufficient.
2. Add admin draft preview (Phase 4.5, deferred post-MVP) and AI-assisted
   authoring entry points (Phase 4.7, deferred post-MVP) on top of the shipped
   admin authoring surface.
3. Add lightweight analytics/reporting for live events.
4. Add richer publish behavior such as drafts, previews, or expiry windows if
   live operations need them.
5. Revisit abuse controls after observing live event behavior.
