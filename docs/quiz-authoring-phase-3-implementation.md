# Quiz Authoring Phase 3 Implementation

## Purpose

Track Phase 3 execution while adding the admin API and publish workflow. This
file is active implementation state for this branch and should be finalized
before handoff so it does not drift from the canonical docs.

## Scope

- Add authenticated draft save, publish, and unpublish API endpoints.
- Keep authoring writes out of public attendee tables until explicit publish.
- Publish validated draft content into the existing public runtime projection in
  one server-owned transaction.
- Record audit metadata for publish and unpublish transitions.
- Keep the attendee route loader and `complete-quiz` behavior on published
  public content.

## Non-Goals

- No full admin editor, question builder, mobile preview route, or AI UI.
- No scheduled publish, expiry window, rollback UI, or slug redirect behavior.
- No service-role credentials in the browser.
- No direct AI/MCP writes to public runtime tables.

## Planned Commit Slices

- [x] `docs(authoring): document phase 3 execution plan`
- [x] `feat(supabase): add quiz authoring transition RPCs and audit log`
- [x] `feat(functions): add quiz draft save publish and unpublish endpoints`
- [ ] `test(authoring): cover draft APIs publish projection and docs`

## Target Areas

- `supabase/migrations/`
  Audit log table plus server-owned publish and unpublish RPCs.
- `supabase/functions/`
  New authenticated authoring endpoints.
- `shared/game-config/`
  Pure draft-to-published projection helpers if function code needs them.
- `apps/web/src/lib/adminQuizApi.ts`
  Browser-facing admin API wrapper functions.
- `tests/`
  Shared, Edge Function, web API, and database coverage for the new surfaces.
- `README.md` and `docs/`
  Canonical docs updated after implementation details are known.

## Validation Gates

- Run focused tests after each risky slice where practical.
- Run the final integrated set before handoff:
  - `npm run lint`
  - `npm test`
  - `npm run test:functions`
  - `npm run test:supabase`
  - `npm run build:web`
  - `deno check --no-lock supabase/functions/issue-session/index.ts`
  - `deno check --no-lock supabase/functions/complete-quiz/index.ts`
  - `deno check --no-lock` for each new authoring Edge Function.

## Rollback Expectations

- Removing the Phase 3 migration and function deployments should restore the
  Phase 2 authoring surface because attendee runtime tables remain unchanged
  until publish is explicitly called.
- A failed publish must raise an error before commit and leave existing public
  rows intact.
- Unpublish must hide the public route without deleting drafts or versions.

## Running Status

- [x] Branch selected: `feat/quiz-authoring-phase-3`
- [x] Execution checklist committed
- [x] Database transition layer implemented
- [x] Authoring Edge Functions implemented
- [x] Browser admin API wrappers implemented
- [ ] Tests updated and passing
- [ ] Canonical docs updated
- [ ] Checklist finalized
