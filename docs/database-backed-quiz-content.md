# Database-backed Quiz Content

## Status

- State: working plan
- Branch: `codex/database-backed-quiz-content`
- Last updated: 2026-04-06

## Summary

This milestone moves published quiz and event content out of the shared
hardcoded sample catalog and into Supabase-managed relational tables.

The MVP keeps the existing trust boundary intact:

- the browser reads published content for rendering
- the backend loads the same published content for trusted validation and scoring
- shared TypeScript remains the single in-memory source of truth for quiz
  answer normalization, validation, and scoring once content has been loaded

This change does not add organizer tooling, preview workflows, versioning, or a
generic CMS. It adds only the minimum content model and loading paths needed to
support production-minded event URLs.

## Scope

In scope:

- minimal schema for published quiz content
- migration-backed seed/backfill for the current demo events
- public published-content read path for the web app
- service-role published-content read path for trusted completion
- shared mapping from DB rows into `GameConfig`
- explicit runtime behavior for missing, unpublished, malformed, and read-error
  cases
- tests and docs that reflect the new source of content truth

Out of scope:

- organizer/admin authoring UI
- preview or staged publishing workflows beyond `published_at`
- rich media, sponsor asset management, or theming fields
- analytics, reporting, or caching beyond obvious request-level reuse
- schema versioning for quiz content
- speculative abstractions for future editing systems

## Decisions

### 1. Minimal schema

Chosen tables:

- `public.quiz_events`
- `public.quiz_questions`
- `public.quiz_question_options`

`quiz_events` columns:

- `id text primary key`
- `slug text not null unique`
- `name text not null`
- `location text not null`
- `estimated_minutes integer not null`
- `raffle_label text not null`
- `intro text not null`
- `summary text not null`
- `feedback_mode text not null`
- `allow_back_navigation boolean not null default true`
- `allow_retake boolean not null default true`
- `published_at timestamptz null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

`quiz_questions` columns:

- `event_id text not null`
- `id text not null`
- `display_order integer not null`
- `sponsor text not null`
- `prompt text not null`
- `selection_mode text not null`
- `explanation text null`
- `sponsor_fact text null`
- primary key `(event_id, id)`
- unique `(event_id, display_order)`

`quiz_question_options` columns:

- `event_id text not null`
- `question_id text not null`
- `id text not null`
- `display_order integer not null`
- `label text not null`
- `is_correct boolean not null default false`
- primary key `(event_id, question_id, id)`
- unique `(event_id, question_id, display_order)`

Rationale:

- normalized enough to keep events, questions, and options maintainable
- explicit ordering and publication state are first-class
- enough sponsor content exists for the current product without inventing a
  sponsor management subsystem

### 2. Public read surface

Chosen approach:

- direct PostgREST reads with RLS, not a new read-only Edge Function

Rationale:

- this keeps the backend surface minimal
- published content is appropriate for direct public reads
- the schema already lives in Supabase and the browser already depends on
  Supabase configuration
- the same tables can be read by the browser with the publishable key and by
  the backend with the service role key

### 3. Canonical runtime model

Chosen approach:

- keep `GameConfig` as the shared canonical in-memory model
- map DB rows into `GameConfig` before quiz rendering or trusted scoring

Rationale:

- preserves one shared answer/scoring model across web and backend
- avoids duplicating quiz-specific runtime shapes
- keeps the quiz reducer and browser UI mostly unchanged

### 4. Trusted backend loading

Chosen approach:

- `complete-quiz` loads published content by `eventId` through a small shared
  loader module under `supabase/functions/_shared`
- the loader returns `null` for missing or unpublished content
- the loader throws on malformed content or backend read failures

Failure behavior:

- missing/unpublished event: `400 Quiz event was not found.`
- malformed content or backend read failure: `500` trusted backend error

Rationale:

- `complete-quiz` already receives `eventId`
- scoring must run against canonical content fetched within the trust boundary
- keeping a loader module separate from the handler keeps the request code
  readable and testable

### 5. Sample games

Chosen approach:

- remove sample catalog use from normal runtime route resolution
- retain sample games only as explicit fixtures for tests and the
  browser-only local prototype fallback
- seed those same demo events into the database so the current featured and
  secondary demo URLs continue to work in the standard Supabase-backed path

Rationale:

- preserves current demo ergonomics without leaving the hardcoded catalog as the
  default runtime dependency
- keeps offline fallback explicit instead of accidental

### 6. Route behavior

Chosen behavior:

- malformed `/game/...` path: existing `NotFoundPage`
- valid slug but missing or unpublished event: explicit game unavailable state
  without revealing which case occurred
- malformed DB content: explicit load error with retry affordance
- missing Supabase config or network/read failure: explicit load error with no
  silent sample fallback

Rationale:

- published event URLs should fail clearly without turning back into implicit
  hardcoded demos
- missing and unpublished routes should stay indistinguishable on the public
  surface

## Tradeoffs

- Direct PostgREST reads are simpler than a read-only function, but they expose
  the public read model more directly. RLS and tight selected columns keep this
  bounded for the MVP.
- Leaving completion tables on `event_id text` avoids risky backfill/FK work in
  the milestone, but it postpones stronger relational guarantees.
- Seeding the existing demos into the database preserves continuity, but it also
  means sample data remains part of the development story until organizer
  tooling exists.

## Planned Structure

- `shared/game-config/`
  keep types plus answer/scoring logic, add DB mapping, move sample content into
  an explicit fixture path, and document module ownership
- `supabase/functions/_shared/`
  add DB-backed published-content loader helpers for trusted backend use
- `apps/web/src/lib/`
  split Supabase browser config/read helpers from completion/session helpers
- `apps/web/src/pages/`
  keep `GamePage` as the quiz shell, but add route-level async loading behavior

## Commit Plan

- [x] `docs(database-backed-quiz-content): capture MVP scope and decisions`
- [x] `feat(supabase): add published quiz content schema and demo backfill`
- [x] `refactor(shared): add DB-to-GameConfig mapping and isolate sample fixtures`
- [ ] `feat(supabase): load canonical published quiz content in complete-quiz`
- [ ] `feat(web): load game routes and demo summaries from published quiz content`
- [ ] `docs: finalize durable reference and refresh repo docs`

## Validation Plan

Baseline before editing:

- [x] `npm run lint`
- [x] `npm test`
- [x] `npm run test:functions`
- [x] `npm run test:supabase`
- [x] `npm run build:web`
- [x] `deno check --no-lock supabase/functions/issue-session/index.ts`
- [x] `deno check --no-lock supabase/functions/complete-quiz/index.ts`

Expected per-stage validation:

- schema/db commit: `npm run test:supabase`
- shared/backend commits:
  `npm run lint`, `npm test`, `npm run test:functions`, `npm run test:supabase`,
  `deno check --no-lock supabase/functions/issue-session/index.ts`,
  `deno check --no-lock supabase/functions/complete-quiz/index.ts`
- web commit: previous commands plus `npm run build:web` and `npm run test:e2e`
- final branch pass: full validation suite plus final self-review

Validation implementation note:

- local Supabase validation now needs to reset the local database to the
  current repo migrations before integration and pgTAP runs so warm local stack
  state cannot hide new schema changes

## Progress Checklist

- [x] Ground in current docs, shared config, web flow, backend flow, and
      migrations
- [x] Create dedicated branch
- [x] Run full baseline validation suite on the new branch
- [x] Add decision doc and commit it
- [x] Add published content schema and seeded demo events
- [x] Add shared DB row mapping and tests
- [ ] Add backend published-content loader and switch `complete-quiz`
- [ ] Add browser published-content reads and async route integration
- [ ] Update architecture/dev/README docs
- [ ] Run before/after UI review captures
- [ ] Complete final whole-branch validation and self-review

## Deferred Future Improvements

- add organizer/admin authoring UI
- introduce preview or draft workflows beyond `published_at`
- decide whether `quiz_completions.event_id` and `raffle_entitlements.event_id`
  should become foreign keys once historical data guarantees are clear
- add caching or response shaping if public content reads grow more expensive
- add event expiry semantics or publish windows if production needs them
- add sponsor assets, theming, or richer content blocks only after live editing
  requirements are better understood
