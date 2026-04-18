# Open Questions

## Purpose

This file tracks unresolved decisions that materially affect product, UX,
architecture, operations, or contributor workflow.

Use it when:

- a doc would otherwise be forced to guess
- the code clearly supports groundwork but not the final decision
- a reviewer or future contributor needs to know which questions are still open

If a question is answered in code, docs, or platform setup, update or remove it
here in the same change.

When a quality check pass runs against an upcoming release, the subset of these
items that blocks the current release target is mirrored under
[Release-Blocking Open Questions in `release-readiness.md`](./release-readiness.md#release-blocking-open-questions).
Do not duplicate the question body there; mirror the title and link back to
this file.

## Product And Live Event Operation

- Is one quiz experience per event enough for the MVP, or do some events need
  multiple attendee routes under one organizer-owned event?
  The current runtime model assumes one event maps to one game route.
  **Post-MVP product direction:** events should not be limited to a single game
  and are expected to have their own event page concept.
- Should live event QR codes always route directly to event/game entry surfaces
  while `/` becomes a marketing page post-MVP?
  Current behavior is `/` preview plus `/game/:slug` attendee route; long-term
  URL contract is not finalized.

## Authoring And Publishing

- Should the repo add a root-level admin role and UI for managing
  `public.quiz_admin_users` membership instead of requiring direct SQL edits?
  The current setup intentionally keeps allowlist membership as a manual
  Supabase operation, but that is operationally awkward once more than one
  trusted operator needs to grant or revoke access.
  Priority direction: next milestone.
- After the MVP role split (`admin`, `organizer`, `agent`), what is the
  long-term permission model?
  Open points include organizer authoring/publish scope, assignment
  self-management UX, and long-term role inheritance across event boundaries.
- Do organizers need expiry, scheduled publish, or friendlier inactive-event
  behavior beyond immediate unpublish?
  The current backend supports explicit publish and unpublish by clearing
  `quiz_events.published_at`, but richer lifecycle controls are still deferred.
  Priority direction: low priority; not in current roadmap.

Detailed authoring-specific scope questions are expanded further in
[`quiz-authoring-plan.md`](./quiz-authoring-plan.md).

## Reporting And Sponsor Measurement

- Which event metrics are required first: starts, completions, completion time,
  sponsor-level engagement, or volunteer handoff counts?
  The backend now persists trusted completion data, but there is no reporting
  surface yet and no documented minimum reporting slice.
- What proof of value do sponsors actually need after an event?
  The product docs frame sponsor engagement as a goal, but the repo does not yet
  capture whether sponsors need simple inclusion proof, aggregate event totals,
  or question-level reporting.
  Priority direction: low priority; not in current roadmap.

## Development And Release Workflow

- Is the current workflow of local validation plus direct promotion to the
  production Supabase project sufficient, or should the repo adopt a branch or
  staging backend path?
  The docs mention this as a likely next step, but the repo has not yet decided
  whether backend preview environments are necessary for normal review flow.
  Priority direction: low priority; not in current roadmap.
- What is the supported full-browser UI-review path for backend-backed preview
  environments?
  Local browser review currently prefers a configured remote Supabase project
  because `supabase functions serve` can block the browser trust path with CORS
  behavior during credentialed preflights.

## Trust Boundary And Abuse Controls

- Is browser-session dedupe enough once the product is used at real events, or
  will live usage require person-level or device-level abuse controls?
  The current MVP intentionally uses a lighter no-login trust boundary and does
  not yet answer how much stronger it needs to become.
  Follow-up direction: maintain a dedicated security notes doc that tracks
  abuse/threat scenarios against both system integrity and game integrity.
