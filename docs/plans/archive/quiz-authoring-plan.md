# Quiz Authoring Plan

## Status

- State: phased implementation in progress
- Phase 0 status: complete for this document revision
- Phase 1 status: implemented in the current repo
- Phase 2 status: implemented in the current repo
- Phase 3 status: implemented in the current repo as a backend/API milestone
- Phase 4 status: Phases 4.1–4.4 and 4.6 implemented; 4.5 and 4.7 deferred post-MVP
- Phase 5 status: Phase 5.1 complete; Phase 5.2 complete
- Last updated: 2026-04-14
- Owner area: product, UX, web app, shared game domain, and Supabase backend

## Document Status

This document is a complete historical reference for Phases 0–5 of the quiz
authoring implementation. All phases are now either implemented or explicitly
deferred post-MVP. This is not an active execution document.

Post-MVP follow-up items are tracked in [`docs/backlog.md`](../../backlog.md).

## Purpose

This document lays out a practical MVP path for creating and editing quizzes
without code changes.

It covers the problem from three hats:

- product: who the authoring user is, what outcome they need, and what product
  decisions matter most
- UX: which authoring questions most affect usability and what answers best fit
  this product stage
- engineering: how to add authoring safely on top of the current runtime model,
  trust boundary, and published-content flow

It is intentionally a design and execution plan, not an implementation record.

## Plan Maintenance

- Keep this plan synchronized with the code as phased work lands.
- When a phase is complete in the current branch or merged code, mark that phase
  complete here instead of leaving it implied.
- Each phase should end in a reviewable, PR-ready state that can merge into
  `main` without depending on a later phase, unless the doc explicitly calls out
  a different expectation.
- The intended rollout is phase-by-phase. Later phases build on earlier ones,
  but Phase 1 should be mergeable before Phase 2 starts, Phase 2 before Phase 3,
  and so on.

## Why This Is The Next Problem

The current repo already supports:

- database-backed published event content
- shared quiz runtime validation and scoring
- trusted backend completion
- attendee-facing `/game/:slug` routes

The current repo does not yet support:

- creating events without editing repo files or SQL directly
- editing quizzes safely once an event is live
- previewing draft content before publish
- using the implemented authoring APIs through a complete admin UI

That gap is now the main blocker between a usable engineering prototype and an
operational MVP.

## Recommendation Summary

- Build an authenticated admin workspace, not a generalized CMS.
- Optimize the first release for trusted internal admins, not for open
  self-serve multi-tenant SaaS.
- Support both manual editing and AI-assisted draft generation on top of the
  same draft model.
- Use a draft and publish model so in-progress edits never mutate live attendee
  content.
- Keep `shared/game-config` as the canonical runtime model for quiz structure,
  answer validation, and scoring.
- Publish through a trusted backend flow that validates draft content and then
  updates the current public runtime tables.
- Keep the attendee flow boring on purpose. The authoring system should fit the
  current attendee architecture rather than forcing a broad rewrite.

## Product Hat

### Primary User

The first authoring user should be treated as:

- a trusted internal admin responsible for event setup and publishing

This user is not a power user by trade. They are closer to an event planner
than to a CMS administrator.

They are usually trying to do a small number of concrete jobs:

- create a new event
- duplicate last year's or last week's quiz
- edit event details and questions
- generate a first draft of quiz questions with AI and then refine them
- add sponsor attribution and sponsor facts
- preview the attendee experience before it goes live
- publish with confidence
- make a safe correction if something is wrong

### Secondary Users

- internal teammates who support event setup or review content before publish

### Users Who Are Not Primary In The First Version

- sponsors entering their own content directly
- volunteers at the raffle table
- general attendees
- many simultaneous collaborators editing the same event in real time

### Desired End State

From a product perspective, the solution should let a trusted admin:

1. create a new event in under 10 minutes when starting from a prior event
2. build or edit a 5-7 question quiz without touching code or SQL
3. preview the exact attendee flow before publish
4. publish intentionally, with a clear boundary between draft and live content
5. keep the public QR link stable once printed
6. make a safe post-publish correction without risking a half-edited live quiz
7. understand whether the event is draft, live, or archived at a glance

### Product Decisions

These are the recommended product decisions for the MVP authoring system:

- The authoring product is event-centered, not content-library-centered.
- One event should have one current draft and one current live version.
- Publishing should be explicit, never implicit through autosave.
- Cloning an existing event should be a first-class workflow.
- Sponsor support should stay simple at first:
  sponsor name, sponsor fact, and question attribution are enough.
- The first release should support authenticated admins only, not organizer
  self-serve account creation.
- AI should help generate and revise draft content, but it should not publish
  directly to live attendee content.
- Live attendee routes should continue to resolve from published content only.
- Editing a live event should create draft changes that are not live until a
  deliberate republish happens.
- Scheduled publish should be deferred.
- Do not add MVP-only post-publish editing restrictions beyond the explicit
  draft and republish boundary.

### Product Considerations

- Event setup is time-boxed and often happens under deadline pressure.
- Admins will care more about confidence and speed than about advanced layout controls.
- Printed QR codes create a strong requirement for stable slugs and predictable publish behavior.
- Sponsor wording may require review and last-minute changes.
- The system needs to protect the attendee experience from admin mistakes.
- The product is still MVP-stage, so the right tradeoff is clarity over platform breadth.

### Product Open Questions

- Do we need soft unpublish behavior for accidental publishes during setup?
- Is one quiz per event enough, or do some events need multiple experiences or routes?
- Do sponsors need richer assets soon, or is text-only sponsor presence sufficient through the MVP?
- How structured should AI prompting inputs be:
  freeform prompt only, or prompt plus event facts, sponsor list, and target question count?

## UX Hat

### UX Goal

The authoring experience should feel like a focused event setup workflow, not a
generic back office.

The user should feel:

- oriented immediately
- safe to make changes
- confident about what is live versus draft
- able to preview before publish
- able to finish setup without training

### The Most Important UX Questions And Best Answers

#### 1. What should the user see first?

Best answer:

Show an events list with obvious statuses and a primary action to create or
duplicate an event.

Why:

- admins think in terms of events, not abstract content objects
- status clarity matters before any editing begins
- duplication is likely the fastest path for recurring events

#### 2. Should editing happen in one huge form?

Best answer:

No. Use a structured editor with a small number of sections:

- Event details
- Questions
- Preview
- Publish

Why:

- one large form will feel brittle and hard to scan
- questions are the main editing workload and deserve a focused space
- preview and publish need distinct mental modes

#### 3. How should question editing work?

Best answer:

Use a question list plus a focused editor panel for the selected question.

The list should support:

- add question
- duplicate question
- reorder question
- delete question
- show validation badges per question

The editor should support:

- prompt
- sponsor
- selection mode
- answer options
- correct answers
- explanation
- sponsor fact

Why:

- the author needs both sequence awareness and focused editing
- nested fields are easier to manage with one active question at a time

#### 4. How should saving behave?

Best answer:

Draft edits should autosave, but publish should require an explicit action.

Why:

- autosave reduces fear and accidental loss
- explicit publish protects the live attendee experience

UX details:

- show "Saving", "Saved", and error states clearly
- do not make the user guess whether their edits persisted

#### 5. When should validation appear?

Best answer:

Use layered validation:

- immediate inline validation for obvious field issues
- section-level warnings in the editor
- a publish checklist that blocks publish until the draft is valid

Why:

- users should catch mistakes where they occur
- they also need a final confidence pass before going live

#### 6. How should preview work?

Best answer:

Preview should render the same attendee shell and quiz components used by the
public route, but against the draft content.

Why:

- a generic text preview is not enough
- authors need to know how the real flow feels on a phone
- reuse reduces drift between authoring preview and attendee reality

#### 7. What should happen when editing a live event?

Best answer:

Make the draft-versus-live distinction impossible to miss.

Recommended UI language:

- `Live`
- `Draft changes not published`
- `Published 2 hours ago by <name>`

Why:

- the main user risk is thinking a saved draft is already live

#### 8. Do we need real-time collaborative editing?

Best answer:

Not in the first release.

Recommended behavior:

- one mutable draft per event
- last edited by and last edited at shown clearly
- optional soft lock warning if another editor is active

Why:

- this avoids a large class of complexity before it is needed

#### 9. What publishing controls should exist in the first version?

Best answer:

Keep them small and high-confidence:

- Publish draft
- Unpublish
- Archive event
- Duplicate event

Do not start with:

- branching
- merge workflows
- role-specific approval chains
- content scheduling unless a real need appears

#### 10. How should the editor handle destructive actions?

Best answer:

Require confirmation for deleting questions, unpublishing, and archiving, but
do not overload ordinary field edits with confirmation prompts.

Why:

- confirmation should protect meaningful risk, not slow every action

#### 11. How should AI-assisted authoring fit into the UX?

Best answer:

Treat AI as a draft-generation and rewrite assistant inside the same draft
workflow, not as a separate content system.

Recommended capabilities:

- generate an initial set of questions from event details and sponsor inputs
- suggest rewrites for tone, clarity, and sponsor balance
- generate alternates for a selected question
- fill in explanations and sponsor facts

Recommended guardrails:

- AI writes into draft content only
- humans review and edit AI output before publish
- publish checklist still validates the resulting draft the same way as manual edits

Why:

- this preserves one source of authoring truth
- it avoids a split between "AI-generated" and "manually edited" content
- it keeps the trust boundary simple

### Recommended Authoring Flow

1. User lands on the events list.
2. User creates a new event or duplicates an existing one.
3. User fills in event details.
4. User adds or edits questions.
5. User previews the attendee experience in a mobile-sized preview.
6. User resolves validation issues surfaced by the publish checklist.
7. User publishes.
8. User copies or confirms the QR-linked live route.
9. If a correction is needed later, the user edits the draft and republishes.

### UX Scope For The First Release

In scope:

- create event
- duplicate event
- edit event details
- add, edit, reorder, duplicate, and delete questions
- mobile preview
- publish and unpublish
- clear live versus draft state

Post-MVP unless event setup speed requires it:

- AI-assisted draft generation and question rewrites

Out of scope:

- sponsor self-service
- analytics dashboards
- advanced media management
- real-time collaboration
- granular approval workflows
- fully custom theming per event

## Engineering Hat

### Architecture Principles

- Keep attendee runtime reads simple and public.
- Keep authoritative answer validation and scoring in `shared/game-config`.
- Do not let browser draft editing write directly into live public content.
- Introduce the smallest privileged backend surface that safely supports authoring.
- Prefer an evolutionary design that preserves the working attendee flow.

### Recommended High-Level Architecture

The recommended architecture is:

1. add an authenticated authoring area to the existing web app
2. add private draft and version data for admins
3. expose a draft write surface that both the admin UI and AI-assisted
   workflows can target
4. publish drafts through a trusted backend function
5. keep the current public published-content tables as the attendee-facing runtime projection during the first phase

This lets us add safe authoring without forcing a broad rewrite of the current
browser route loader and completion backend.

### Recommended Data Model

Keep the current public runtime tables for attendee reads in phase one:

- `game_events`
- `game_questions`
- `game_question_options`

Add private authoring tables:

- `game_event_drafts`
  one mutable draft per event, stored as authoring JSON plus metadata
- `game_event_versions`
  immutable published snapshots
- `admin_users`
  admin allowlist or profile rows for who can access the authoring surface
- `game_event_audit_log`
  optional but recommended for publish, unpublish, archive, and restore actions

Recommended shape of the draft/version content:

- store a JSON document that maps closely to `GameConfig`
- include authoring-only metadata where needed, but keep the quiz payload easy
  to turn into canonical `GameConfig`
- make the JSON shape ergonomic for both form-based editing and AI/MCP-based
  generation or patching

Why this is the recommended MVP shape:

- nested quiz editing is easier to save and load as one document than as many
  relational writes from the browser
- immutable published versions support rollback and auditability
- keeping the current public tables as the live projection avoids destabilizing
  the attendee flow during authoring rollout
- AI tooling and Supabase MCP can submit one normalized draft payload instead of
  coordinating many live relational row mutations

### AI And MCP Authoring Path

The system should explicitly support a second authoring mode:

- human-driven editing in the admin UI
- AI-assisted draft creation and updates through a structured draft API or
  draft table writes via Supabase MCP

Recommended rule:

AI and MCP integrations should target draft content only, never the public
published tables directly.

Recommended payload contract:

- one event draft document
- optional partial-update operations for focused question edits
- server-side normalization into the canonical draft shape before save

Why:

- it keeps AI-assisted workflows compatible with the manual editor
- it avoids bypassing validation and audit surfaces
- it makes Supabase MCP useful for seeding, bulk edits, and operator workflows
  without turning live attendee data into an unsafe write surface

### Publish Flow

Recommended publish flow:

1. admin edits a private draft
2. browser saves draft through authenticated write APIs
3. admin clicks `Publish`
4. backend loads the draft and checks admin authorization
5. backend maps the draft content into canonical `GameConfig`
6. shared validation runs server-side
7. backend creates a new immutable published version record
8. backend transactionally updates the current public tables used by attendee reads
9. backend records audit metadata and returns the new live status

Important consequence:

The attendee flow continues to read only published content, never drafts.

### Web App Structure

Recommended web structure:

- keep attendee routes under the current `apps/web/src/pages/` and
  `apps/web/src/game/` boundaries
- add a dedicated authoring area under `apps/web/src/admin/`
- add route shells such as:
  - `AdminEventsPage`
  - `AdminEventEditorPage`
  - `AdminPreviewPage` if preview needs its own route
- add a small authenticated data layer such as
  `apps/web/src/lib/adminGameApi.ts`

Important boundary:

The admin UI should not own quiz correctness rules. It should use shared
mapping and validation helpers where possible, and rely on backend publish
validation as the final gate.

### Shared Domain Changes

Recommended shared additions:

- authoring-side draft types that can be mapped into `GameConfig`
- reusable validation helpers that power both draft feedback and publish checks
- optional diff helpers to compare draft versus live versions for publish review

The shared source of truth should remain:

- canonical runtime quiz structure
- answer normalization
- scoring
- publish-time structural validation

### Backend Surface

Recommended backend responsibilities:

- authenticated draft read and write operations
- AI-safe draft upsert or patch operations
- publish operation
- unpublish or archive operation
- optional preview-token issuance if shareable previews become necessary later

Recommended split:

- simple authenticated reads may use PostgREST with RLS
- ordinary draft writes may use PostgREST with RLS if the payload shape stays
  simple, or a small authenticated Edge Function if normalization becomes more
  involved
- privileged transitions such as publish and unpublish should use Edge Functions

Why:

- RLS is a good fit for ordinary per-event draft reads and writes
- publish is high-risk and should stay in a server-controlled transaction with
  shared validation and audit logging
- AI-assisted write paths need a stable contract, so we should prefer one
  intentional draft API shape over teaching AI tools to mutate many tables directly

### Security Model

Recommended security approach:

- use Supabase Auth for admin sign-in
- maintain an admin allowlist or equivalent global admin check for authoring access
- keep public attendee tables read-only for public clients
- restrict draft tables with RLS so only authenticated admins can read or mutate them
- run publish and unpublish through service-role Edge Functions
- record who published and when
- if AI-assisted workflows use elevated operator credentials or service tooling,
  keep those paths limited to draft writes and preserve audit attribution where possible

Security rules that should not change:

- attendee completion trust remains backend-owned
- public event reads remain bounded to published content
- client-side correctness should still not be treated as the official completion result

### Security Considerations

- A saved draft must not become live without an explicit publish step.
- Non-admin users should not gain access to any draft content.
- Slug collisions and route hijacking need server-side enforcement.
- Publish and unpublish need audit history.
- Preview links, if later shared outside the editor, should be signed and time-bounded.
- The authoring system should not require service-role credentials in the browser.
- AI-assisted generation should be treated as untrusted content until it passes
  the same draft and publish validation as manual edits.
- Supabase MCP convenience must not become a loophole for writing directly to
  live public quiz rows.

### Migration Strategy

Recommended migration path:

1. keep the current public runtime tables in place
2. add private authoring tables and auth scaffolding
3. backfill existing published demo events into draft and version records
4. point the new authoring UI at the private authoring tables
5. keep attendee loaders and `complete-game` reading the current public tables
6. only revisit the public read model later if a second-stage refactor becomes worthwhile

This sequence minimizes risk because it isolates authoring changes from the live
attendee path.

### Foreseeable Technical Challenges

- designing a draft JSON shape that is easy to edit but still easy to validate
- supporting slug edits after publish without making link changes too easy to miss
- preventing concurrent-editor confusion without building real-time collaboration
- making preview faithful without coupling admin code too tightly to attendee internals
- migrating seeded and existing events into the new authoring system cleanly
- building publish transactions that update event, question, and option rows safely
- keeping tests and docs aligned as a new privileged surface is added
- defining a stable AI/MCP write contract that supports generation, rewrites,
  and partial edits without making the schema too loose

### Engineering Open Questions

- Should event metadata and quiz content share one draft document, or should they be split?
- Should unpublish remove the public route immediately, or should we support a friendlier expired state?
- Should preview be authenticated-only, or do we need shareable preview links before launch?
- Do we need a rollback action in the first release, or is republishing a prior version enough?
- Is email magic-link auth sufficient, or do we need stronger internal auth controls from day one?
- For Supabase MCP submission, do we want direct draft-table writes, or a thin
  RPC/Edge Function that normalizes and audits AI-generated updates?

## Proposed Decisions

These are the recommended decisions to carry into implementation unless product
research changes them:

- Build the first version for authenticated admins only.
- Keep the authoring system inside the existing web app rather than creating a
  second frontend app.
- Add authenticated admin routes under a dedicated `admin` area.
- Use one mutable draft per event.
- Store draft and version content as JSON shaped to map cleanly into `GameConfig`.
- Design the draft write contract so both the admin UI and AI/Supabase MCP can
  use it.
- Keep the current public tables as the live attendee projection in phase one.
- Make publish an explicit Edge Function-backed action.
- Defer scheduled publish.
- Do not add post-publish restrictions in the MVP beyond the draft and
  republish model.
- Defer real-time collaboration, sponsor self-service, and advanced media workflows.

## Execution Plan

Status note:

- Phase 0 is complete at the planning level in this document. The items below
  are settled scope decisions, not open questions.
- Phase 1 is complete in the current repo and should be treated as merge-ready
  on its own.
- Phase 2 is complete in the current repo and should be treated as merge-ready
  on its own.
- Phase 3 is complete in the current repo as a backend/API milestone.
- Phases 4-5 are still proposed execution work.

### Phase 0: Align Product And Scope (Complete)

Deliverables:

- first-release user model set to authenticated admins only
- event lifecycle states confirmed as `draft`, `live`, and optional `archived`
- scheduled publish explicitly deferred
- post-publish edits remain allowed through draft plus explicit republish

### Phase 1: Shared Domain And Data Model (Complete)

Deliverables:

- draft authoring schema in `supabase/migrations`
- shared draft-to-`GameConfig` mapping and validation helpers
- draft payload contract for manual and AI-assisted writes
- migration plan for existing demo events

Acceptance criteria:

- a draft can represent every current published event shape
- server-side validation can reject malformed drafts before publish
- the phase leaves the repo in a PR-ready state without requiring Phase 2 work

Implementation status:

- implemented in the current repo
- landed as:
  - `feat(supabase): add quiz authoring draft and version tables`
  - `feat(shared): add authoring draft mapping and validation`
  - `test(authoring): cover draft validation and schema backfill`
  - `docs(shared): document draft content module`
- Phase 1 scope intentionally stopped short of auth, admin APIs, or publish
  flows

### Phase 2: Auth And Authorization (Complete)

Deliverables:

- Supabase Auth setup for admin login
- admin allowlist or equivalent global admin gate
- RLS policies for draft reads and writes

Acceptance criteria:

- an authenticated admin can access the authoring system and all draft events
- anonymous users cannot read or write draft content

Implementation status:

- `/admin` now exists inside `apps/web`
- Supabase Auth magic-link sign-in now restores and maintains the admin session
- `admin_users` now provides the private allowlist table
- `public.is_admin()` now provides one shared authorization check for both
  the admin shell and authoring-table RLS
- RLS now exposes `game_event_drafts` and `game_event_versions` only to
  allowlisted authenticated admins
- current scope intentionally stopped short of draft save, AI upsert, and
  publish flows, which are covered by Phase 3

### Phase 3: Admin APIs And Publish Workflow

Deliverables:

- authenticated draft read and save path
- AI/MCP-compatible draft upsert path
- publish Edge Function
- unpublish Edge Function
- audit metadata for live transitions

Acceptance criteria:

- publishing validates and updates the live projection transactionally
- a failed publish cannot leave partially updated public content

Implementation status:

- implemented in the current repo as backend and API groundwork
- `save-draft` validates canonical authoring JSON and writes private draft rows
  for allowlisted admins
- `publish-draft` validates a draft and calls
  `public.publish_game_event_draft(...)` to update public attendee tables in
  one transaction
- `unpublish-event` clears the live event's `published_at` value while keeping
  draft and version history
- `game_event_audit_log` records publish and unpublish transitions
- current scope intentionally stops short of the full editor UI, preview route,
  duplication flow, and AI authoring UI

### Phase 4: Admin UX MVP

Phase 4 should be split into smaller PR-sized subphases. The full UX milestone
touches route structure, authenticated data loading, draft mutations, complex
form state, attendee-preview reuse, publish controls, and AI entry points. That
is too much surface for one reviewable PR, especially because admin UI changes
need both code-level validation and browser review.

Deliverables:

- events list
- create and duplicate event flow
- event details editor
- question builder
- mobile preview
- publish checklist and status surfaces

Post-MVP candidates:

- AI-assisted generate and rewrite entry points
- shareable preview links
- richer unpublish, expiry, scheduled publish, rollback, and role-management
  workflows

Acceptance criteria:

- a trusted admin can create and publish a quiz through the admin UI without
  touching the codebase
- the draft versus live state is obvious in the UI

MVP sequencing:

- MVP now treats Phases 4.1 through 4.4 and 4.6 as the required admin UX
  milestone.
- With that scope, Phase 5 is the next implementation phase.
- Defer Phase 4.5 unless authenticated in-editor preview becomes necessary for
  the first event-ready release; shareable preview links remain post-MVP because
  the preview access model is still an open question.
- Defer Phase 4.7 unless AI-assisted authoring becomes necessary for the first
  event-ready release.

#### Phase 4.1: Admin Event Workspace

Deliverables:

- replace the minimal draft list with an event-centered admin workspace
- keep authenticated admin gating and private draft reads unchanged
- show draft/live status, slug, last saved time, and primary actions for each
  event
- add route/state structure needed for selecting one event without introducing
  editing yet

Acceptance criteria:

- an allowlisted admin can sign in and orient around event status at a glance
- non-admin and missing-config states continue to block draft access
- no draft content or live projection mutation is introduced in this subphase

Implementation status:

- implemented in the current repo as the read-only `/admin` event workspace
- `/admin/events/:eventId` selects one private draft summary for orientation
  without enabling editing
- create, duplicate, edit, preview, publish, unpublish, and AI-assisted entry
  points were deferred to later Phase 4 subphases when this phase landed

Implementation decisions:

- Use the draft event `id` as the selected workspace route segment because it
  is the stable private authoring identifier; keep slugs reserved for public
  attendee routes.
- Keep the selected workspace summary-only in this phase so direct event
  routing does not imply draft content editing, preview, or mutation readiness.
- Expose `Open live quiz` only when `live_version_number` is present because a
  draft-only event has no public attendee projection to open.

Suggested validation:

- `npm test -- tests/web/pages/AdminPage.test.tsx`
- `npm test -- tests/web/lib/adminGameApi.test.ts`
- `npm run build:web`
- browser UI review for `/admin` when Supabase admin configuration is available

#### Phase 4.2: Create And Duplicate Drafts

Deliverables:

- add admin UI actions for creating a new draft event and duplicating an
  existing draft
- use the existing canonical draft save API for all persisted draft creation
- generate new ids and slugs client-side only as draft inputs, with backend
  validation and slug conflict handling still authoritative
- keep duplicate output as an unpublished draft until the admin explicitly
  publishes it

Acceptance criteria:

- an admin can create or duplicate a draft without editing SQL or repo files
- slug collisions and save failures are surfaced without creating live content
- the events list refreshes or updates after successful draft creation

Implementation status:

- implemented in the current repo as create and duplicate actions in the
  authenticated `/admin` event workspace
- successful create and duplicate saves update the visible draft-summary list
  from the `save-draft` response and navigate to `/admin/events/:eventId` for
  the new draft
- create and duplicate failures leave the current list and selected route
  unchanged while surfacing an admin-facing error message
- event details editing, question editing, preview, publish, unpublish, and
  AI-assisted draft entry remain deferred to later Phase 4 subphases

Implementation decisions:

- Use a valid starter draft template with placeholder event details and one
  single-select placeholder question because the canonical draft save path
  rejects empty drafts.
- Generate readable client-side draft ids and slugs with a short unique suffix
  and avoid obvious collisions with the currently visible drafts; the backend
  remains authoritative for validation and uniqueness.
- Duplicate only private draft content loaded through the authenticated draft
  read path, then replace id, slug, and name before saving through
  `save-draft`.
- Keep duplicated drafts unpublished by not copying live-version metadata and
  not calling publish from this phase.
- Use one-at-a-time admin mutation state so create and duplicate actions cannot
  overlap or race local list updates.

Suggested validation:

- `npm test -- tests/web/pages/AdminPage.test.tsx`
- `npm test -- tests/web/admin/draftCreation.test.ts`
- `npm test -- tests/web/lib/adminGameApi.test.ts`
- `npm run build:web`
- browser UI review for create and duplicate paths when Supabase admin
  configuration is available

#### Phase 4.3: Event Details Editor

Deliverables:

- add an editor surface for event-level draft fields: name, slug, location,
  estimated minutes, entitlement label, intro, summary, feedback mode, back
  navigation, and retake settings
- save through `save-draft` using the full canonical draft document
- show saved, saving, and error states clearly
- keep draft edits separate from live attendee content until publish

Acceptance criteria:

- an admin can update event details and reload the draft with the saved changes
- invalid draft payloads and backend save failures produce actionable messages
- existing published attendee routes remain unchanged after draft-only edits

Implementation status:

- implemented in the current repo as an explicit-save event-details editor on
  `/admin/events/:eventId`
- selected event routes load full private draft content only after the event id
  is visible in the authenticated admin's draft-summary list
- saves update only top-level event fields through `save-draft` and preserve the
  draft id plus existing question content
- question editing, preview, publish, unpublish, and live-content mutation remain
  deferred to later Phase 4 subphases

Implementation decisions:

- Use the selected workspace route for the MVP editor because it keeps event
  orientation, duplicate actions, and event-detail edits in one admin context.
- Keep save explicit with a `Save changes` button rather than autosave so
  validation and backend errors are easy to understand.
- Treat event-card inline editing and a separate event-details route as future
  UX options: cards would reduce navigation for quick edits, while a dedicated
  route would make deep-linking and larger editor layouts more explicit.
- Keep slug format validation minimal in the browser and rely on the backend for
  authoritative validation and uniqueness conflict messages.

Suggested validation:

- `npm test -- tests/web/pages/AdminPage.test.tsx`
- `npm test -- tests/web/admin/eventDetails.test.ts`
- `npm test -- tests/web/lib/adminGameApi.test.ts`
- `npm run build:web`
- browser UI review covering saved and failed-save states when practical

#### Phase 4.4: Question Builder

Phase 4.4 should be split into smaller PR-sized subphases. The full question
builder touches nested draft editing, local validation, generated ids, focused
editor UI, list mutations, option mutations, delete confirmation, save
orchestration, screenshots, and broad admin page regression coverage. That is
too much surface for one clean reviewable PR, especially now that
`useAdminDashboard`, `AdminEventWorkspace`, and `AdminPage` tests are already
large.

Phase 4.4 uses these shared decisions across all subphases:

- keep the editor on `/admin/events/:eventId`
- use a question list plus one focused question editor
- keep one explicit full-draft `Save changes` action
- keep 5-7 question-count guidance out of this phase
- persist only through `save-draft`
- keep preview, publish, unpublish, new routes, backend endpoints, schema
  changes, and live-content mutation deferred

#### Phase 4.4.1: Existing Question Content Editing

Deliverables:

- add the question list and focused question editor surfaces
- edit existing question prompt, sponsor, selection mode, explanation, sponsor
  fact, existing option labels, and correct answers
- map question form values back into the full canonical draft document while
  preserving event details and question order
- reuse shared draft validation for local feedback where practical, while
  preserving backend publish validation as the final gate

Status:

- implemented in the current repo as a selected-event question list plus one
  focused existing-question editor under `/admin/events/:eventId`
- selected private drafts still load only after the authenticated admin summary
  list confirms the event is visible
- saves map the focused question form back into the full canonical draft
  document and persist through `save-draft`
- event details, question ids/order, and option ids/order are preserved; add,
  duplicate, reorder, and delete operations remain deferred to Phase 4.4.2
- clearing optional explanation or sponsor fact removes that optional field from
  the saved question content rather than persisting an empty string
- changing selection mode does not auto-repair correct answers; invalid
  selections surface local validation and must be fixed before save

Acceptance criteria:

- an admin can edit existing question content and save the draft through the UI
- question prompt, sponsor, selection mode, option labels, correct answers,
  explanation, and sponsor fact survive save and reload
- malformed existing-question changes surface actionable validation messages
- existing event detail, create, and duplicate flows keep page-level regression
  coverage

Suggested validation:

- focused frontend tests for question form mapping and validation
- page-level tests for selected route question loading, existing-question
  editing, correct-answer editing, local validation failure, save success, save
  failure, and reload
- `npm test -- tests/web/pages/AdminPage.test.tsx tests/web/admin/draftCreation.test.ts tests/web/admin/eventDetails.test.ts tests/web/admin/questionBuilder.test.ts tests/web/lib/adminGameApi.test.ts tests/web/routes.test.ts`
- `npm run build:web`
- browser UI review of focused question editing, validation, saved, and
  failed-save states

#### Phase 4.4.2: Question And Option Structure Management

Phase 4.4.2 is expected to be safe as one PR if Phase 4.4.1 has already landed
the shared question edit buffer, form mapping, focused editor shell, and
full-draft save path. The remaining structural operations share the same
ownership boundary: they transform the selected draft's `questions` array and
then save through the same canonical draft path.

Split Phase 4.4.2 further only if implementation review shows the structural
operations no longer fit one clean PR. The fallback split is:

- 4.4.2a: add, duplicate, reorder, and delete questions
- 4.4.2b: add/delete options, correct-answer repair, and selection-mode repair

Deliverables:

- add, duplicate, reorder, and delete questions
- add and delete options
- generate question and option ids that avoid collisions within the current
  draft/question
- require inline confirmation for deleting questions
- prevent deleting the final question or final option
- repair correct-answer state when options are deleted or selection mode changes
- keep Phase 4.2 create/duplicate regression coverage while delete behavior is
  added

Status:

- implemented in the current repo as question and option structure controls in
  the selected event workspace
- question edits now use a local draft buffer so add, duplicate, reorder,
  delete, option changes, and focused field edits save together through one
  explicit `Save question changes` action
- new question ids use the first available `qN`; new option ids use the first
  available lowercase letter, then `option-N`
- deleting the final question or final option is blocked
- deleting questions requires inline confirmation and remains local until save
- option deletion and selection-mode changes repair correct-answer state before
  save
- preview, publish, unpublish, shareable preview links, backend endpoints,
  schema changes, and live-content mutation remain deferred

Acceptance criteria:

- an admin can build and save a valid question set through the UI
- question ordering, duplicated content, deleted questions/options, and
  correct-answer selection survive save and reload
- invalid structural changes cannot be saved into malformed draft content
- delete actions are reversible until the inline confirmation is accepted

Suggested validation:

- focused frontend tests for question and option structure helpers
- page-level tests for add, duplicate, reorder, delete confirmation/cancel,
  add/delete option, correct-answer repair, save success, save failure, and
  reload
- Phase 4.2 create and duplicate regression tests, including successful create,
  successful duplicate, load/save failures, local list updates, and
  post-create/post-duplicate navigation
- `npm test -- tests/web/pages/AdminPage.test.tsx tests/web/admin/draftCreation.test.ts tests/web/admin/eventDetails.test.ts tests/web/admin/questionBuilder.test.ts tests/web/lib/adminGameApi.test.ts tests/web/routes.test.ts`
- `npm run build:web`
- browser UI review of add, duplicate, reorder, delete, option mutation,
  validation, saved, and failed-save states

Related UX follow-up items discovered during Phases 4.3 and 4.4 are tracked in
[docs/tracking/admin-ux-roadmap.md](../../tracking/admin-ux-roadmap.md). Keep that file focused on
product-facing polish and navigation decisions; workflow tooling stays in
`docs/tracking/dev-workflow-improvements.md`.

#### Phase 4.5: Mobile Preview

Deliverables:

- add an authenticated draft preview that reuses the attendee quiz shell and
  quiz components against draft content
- keep preview read access admin-only; do not add shareable preview links in
  this subphase
- make preview visually mobile-sized and clearly labeled as draft preview
- ensure preview does not issue attendee completion sessions or write entitlement
  data

Acceptance criteria:

- an admin can preview the current draft flow before publish
- preview behavior matches the attendee quiz interaction where draft-only data
  permits it
- preview cannot be confused with a live public route

Suggested validation:

- frontend tests for preview route/state wiring
- `npm run build:web`
- browser UI review using mobile viewport and direct preview route loading

#### Phase 4.6: Publish Checklist And Status Surfaces

Status: implemented in the current repo (`feature/admin-publish-controls`).

Deliverables:

- add publish and unpublish controls backed by the existing authoring functions
- add a publish checklist that blocks publish until draft validation passes
- show live, draft-only, unpublished, and draft-changes-not-published states
  clearly in the editor and event list
- show published version, publish result, slug, and copyable live route after a
  successful publish

Acceptance criteria:

- an admin can publish and unpublish a draft through the UI
- failed publish attempts do not change the visible live status
- draft-only edits after publish are visibly distinct from live content

Suggested validation:

- `npm test -- tests/web/pages/AdminPage.test.tsx`
- `npm test -- tests/web/lib/adminGameApi.test.ts`
- `npm run test:functions`
- `npm run test:supabase`
- `npm run build:web`
- browser UI review covering publish, post-publish draft edit, and unpublish
  flows when Supabase admin configuration is available

#### Phase 4.7: AI-Assisted Draft Entry Points

Priority: post-MVP by default. This can move earlier only if manual creation
and duplication are not fast enough for the first event-ready release.

Deliverables:

- add UI entry points for AI-assisted initial draft generation and selected
  question rewrites
- write AI output into the same canonical draft document used by manual edits
- keep human review and explicit publish required for every AI-assisted change
- preserve the existing backend validation and publish checklist as the final
  gate

Acceptance criteria:

- AI-assisted output is saved only as draft content
- admins can review and edit generated content before publish
- the UI does not introduce a second authoring data model or bypass
  `save-draft`

Suggested validation:

- frontend tests for applying generated draft/question output into editor state
- `npm test -- tests/web/lib/adminGameApi.test.ts`
- `npm run build:web`
- browser UI review of the generated-content review flow when the AI path is
  configured

### Phase 5: Migration, Validation, And Docs

Phase 5 targets the shipped admin MVP surface only:

- included: Phases 4.1 through 4.4 and 4.6
- deferred post-MVP: Phase 4.5 preview and Phase 4.7 AI-assisted entry points

Phase 5 should be split into two PR-sized subphases so validation and docs can
land with clear review boundaries.

#### Phase 5.1: Local Validation And Migration Verification

Status: complete

Deliverables:

- add one deterministic local admin end-to-end validation command:
  `npm run test:e2e:admin`
- cover the shipped admin workflow against a local Supabase stack:
  auth/session bootstrap, allowlist pass, draft visibility, draft save,
  publish, unpublish, and attendee-route publish-state checks
- verify migration and backfill invariants for the shipped admin flow through
  the local Supabase validation path
- keep PR CI unchanged in this phase; require the new admin e2e command in
  local validation for admin-affecting changes

Acceptance criteria:

- one local command verifies the shipped admin MVP workflow end-to-end
- existing attendee routes still behave correctly
- existing completion trust path still validates against published content

Suggested validation:

- `npm run lint`
- `npm test`
- `npm run test:functions`
- `npm run test:supabase`
- `npm run test:e2e:admin`
- `npm run build:web`
- `deno check --no-lock supabase/functions/issue-session/index.ts`
- `deno check --no-lock supabase/functions/complete-game/index.ts`
- `deno check --no-lock supabase/functions/save-draft/index.ts`
- `deno check --no-lock supabase/functions/publish-draft/index.ts`
- `deno check --no-lock supabase/functions/unpublish-event/index.ts`

#### Phase 5.2: Documentation And Workflow Alignment

Status: complete

Deliverables:

- update `README.md`, `docs/architecture.md`, and `docs/dev.md` so shipped
  admin capabilities and deferred 4.5/4.7 status stay consistent
- document when `npm run test:e2e:admin` is required before PR handoff
- align contributor workflow language with the shipped admin scope and local
  validation expectations

Acceptance criteria:

- contributor docs consistently describe the Phase 4 completion boundary and
  Phase 5 validation expectations
- no conflicting doc guidance remains for admin feature status or required
  local checks

Suggested validation:

- `npm run build:web`
- run `npm run test:e2e:admin` once after docs updates so the documented command
  and setup steps are verified

Deferred follow-up after Phase 5:

- production or post-release admin smoke workflow remains out of scope for this
  phase and should be planned separately after local admin e2e coverage is
  stable

## Validation Plan For The Implementation Work

When implementation starts, expect at least:

- `npm run lint`
- `npm run build:web`
- `npm test`
- `npm run test:functions`
- `npm run test:supabase`
- `deno check --no-lock supabase/functions/issue-session/index.ts`
- `deno check --no-lock supabase/functions/complete-game/index.ts`
- `deno check --no-lock supabase/functions/save-draft/index.ts`
- `deno check --no-lock supabase/functions/publish-draft/index.ts`
- `deno check --no-lock supabase/functions/unpublish-event/index.ts`
- browser-based UI review for the admin flow and the unchanged attendee flow

## What Success Looks Like

The design should be considered successful when:

- admins can create and edit quizzes without code changes
- live quizzes cannot be broken by half-finished edits
- the attendee flow still uses published content and the existing trusted
  completion model
- the first version is small enough to implement and validate confidently
- the architecture leaves room for later analytics, richer publish controls,
  and broader non-admin access without forcing a rewrite first
- future admin operations can grant and revoke quiz-authoring access through a
  root-level admin role and UI instead of requiring direct SQL changes to the
  admin allowlist
