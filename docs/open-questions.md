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

- Should live event QR codes always go directly to `/game/:slug`, with `/`
  remaining a demo-overview route only?
  The current web app treats `/` as a preview surface and `/game/:slug` as the
  attendee route, but the long-term production entry contract is still a product
  decision rather than a settled implementation rule.
- **Pre-launch decision:** For the Madrona pre-launch release milestone, the
  current completion screen plus verification code is sufficient for volunteer
  raffle handoff. Revisit stronger proof treatments after this release is
  finished.
- Is one quiz experience per event enough for the MVP, or do some events need
  multiple attendee routes under one organizer-owned event?
  The current runtime model assumes one event maps to one quiz route.
- For an MVP redemption workflow, what is the minimum volunteer check-in
  experience needed beyond showing a completion verification code?
  Initial design direction is documented in
  [`reward-redemption-mvp-design.md`](./reward-redemption-mvp-design.md).
  Decisions already made for MVP scope: keep redemption UI on non-admin routes
  (`/event/:slug/redeem` and `/event/:slug/redemptions`), use
  `<event-acronym>-<4-digit-code>` with event-scoped lookups, use polling
  (not realtime subscriptions) every 5 seconds plus manual refresh for attendee
  status updates, keep redemption as claim-tracking only, support reversible
  redemption, keep offline fallback out of MVP, and use an event-scoped `agent`
  role for redemption operations.

## Authoring And Publishing

- What authenticated roles are needed after the first global quiz-admin
  allowlist?
  The current authoring model uses Supabase Auth plus `public.quiz_admin_users`
  for all admin access. It does not yet define organizer-scoped roles,
  event-level permissions, or non-admin collaborator access.
- With `agent` and `organizer` now split into separate event-scoped roles
  (`agent` for redemption, `organizer` for non-redemption event operations),
  what is the MVP permission matrix between those roles and root admin?
  **MVP decisions landed:** keep role permissions intentionally narrow, manage
  agent/organizer assignments by direct SQL inserts (no role-management UI),
  and require organizer/root-admin privileges for redemption reversal via
  `/event/:slug/redemptions`.
  **Still open for post-MVP:** broader organizer authoring/publish surface,
  assignment self-management UX, and long-term role inheritance model.
- Should the repo add a root-level admin role and UI for managing
  `public.quiz_admin_users` membership instead of requiring direct SQL edits?
  The current setup intentionally keeps allowlist membership as a manual
  Supabase operation, but that is operationally awkward once more than one
  trusted operator needs to grant or revoke access.
- Do organizers need expiry, scheduled publish, or friendlier inactive-event
  behavior beyond immediate unpublish?
  The current backend supports explicit publish and unpublish by clearing
  `quiz_events.published_at`, but richer lifecycle controls are still deferred.
- **Decided:** Slugs are locked after first publish. The admin UI makes the
  slug field read-only once an event has been published, with explanatory inline
  copy and tooltip text. The backend enforces the same rule, and the DB trigger
  protects against concurrent publish/save races. Redirect table approach was
  ruled out due to slug-recycling complexity.

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

## Development And Release Workflow

- Is the current workflow of local validation plus direct promotion to the
  production Supabase project sufficient, or should the repo adopt a branch or
  staging backend path?
  The docs mention this as a likely next step, but the repo has not yet decided
  whether backend preview environments are necessary for normal review flow.
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
