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

## Product And Live Event Operation

- Should live event QR codes always go directly to `/game/:slug`, with `/`
  remaining a demo-overview route only?
  The current web app treats `/` as a preview surface and `/game/:slug` as the
  attendee route, but the long-term production entry contract is still a product
  decision rather than a settled implementation rule.
- What exact volunteer verification affordance is required beyond the current
  completion message plus verification code?
  The product and UX docs are clear that the finish should feel official, but
  the repo does not yet document whether live operation needs a timestamp,
  rotating proof treatment, volunteer fallback flow, or anything stronger than
  the current code-based proof.
- Is one quiz experience per event enough for the MVP, or do some events need
  multiple attendee routes under one organizer-owned event?
  The current runtime model assumes one event maps to one quiz route.

## Authoring And Publishing

- What authenticated roles are needed after the first global quiz-admin
  allowlist?
  The current authoring model uses Supabase Auth plus `public.quiz_admin_users`
  for all admin access. It does not yet define organizer-scoped roles,
  event-level permissions, or non-admin collaborator access.
- Do organizers need expiry, scheduled publish, or friendlier inactive-event
  behavior beyond immediate unpublish?
  The current backend supports explicit publish and unpublish by clearing
  `quiz_events.published_at`, but richer lifecycle controls are still deferred.
- How renameable should event slugs be after QR codes have been printed?
  Stable slugs matter operationally, but the repo does not yet define whether
  post-publish slug changes should be forbidden, redirected, or simply allowed.

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

## Documentation Process

- When should milestone-specific implementation docs be folded back into the
  canonical docs set?
  The repo now has durable docs plus milestone-specific references such as
  `database-backed-quiz-content.md` and `quiz-authoring-plan.md`, but the
  archival or consolidation rule is not yet explicit.
