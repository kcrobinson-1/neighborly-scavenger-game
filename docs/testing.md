# Testing Strategy

## Document Role

This doc describes what should be tested in this repository, what is intentionally not worth testing yet, and where different checks should run.

Use it when you need:

- a repo-specific testing strategy instead of generic frontend advice
- guidance on unit vs integration vs UX coverage
- clarity on when to mock Supabase and when to run against a real local Supabase stack
- a phased todo list for rolling out test coverage without overbuilding

Current setup and release workflow still live in `dev.md`. System responsibilities and trust boundaries live in `architecture.md`. UX goals live in `experience.md`. Release gates that depend on test coverage live in [`release-readiness.md`](./plans/release-readiness.md), which links back into the Todo List in this file rather than duplicating it.

## Current State

Today the repo validation surface includes:

- `npm run lint`
- `npm test`
- `npm run test:functions`
- `npm run test:functions:integration`
- `npm run test:e2e`
- `npm run test:e2e:attendee:trusted-backend`
- `npm run test:e2e:admin`
- `npm run test:e2e:admin:production-smoke`
- `npm run test:db`
- `npm run test:supabase`
- `npm run build:web`
- `deno check --no-lock supabase/functions/issue-session/index.ts`
- `deno check --no-lock supabase/functions/complete-game/index.ts`
- `deno check --no-lock supabase/functions/save-draft/index.ts`
- `deno check --no-lock supabase/functions/generate-event-code/index.ts`
- `deno check --no-lock supabase/functions/publish-draft/index.ts`
- `deno check --no-lock supabase/functions/unpublish-event/index.ts`
- `npm run ui:review:capture` for screenshot-based browser review
- [`.github/workflows/production-admin-smoke.yml`](../.github/workflows/production-admin-smoke.yml)
  for post-release and manual production admin smoke runs against dedicated smoke fixtures

That baseline is now a real first-wave strategy, not just static validation. The repo already has focused shared-domain tests, frontend behavior tests, a mobile Playwright smoke suite (fallback mode plus trusted-backend mode), pgTAP coverage for the completion RPC, Deno coverage for the Edge Function trust boundary, and a real local Supabase integration test for the full session-plus-completion path.

## Developer Test Guide

Use this table to pick the smallest useful command for your change.

| Goal | Command | What it covers | What it does **not** cover | Run when |
| --- | --- | --- | --- | --- |
| Fast static + unit confidence | `npm run lint` and `npm test` | TypeScript/frontend/shared-domain/unit behavior and linting | Real Supabase stack, browser e2e, production behavior | Almost every PR |
| Edge Function request/helper logic | `npm run test:functions` | Deno-level function helper and handler behavior | Real Supabase runtime wiring and DB/RPC integration | Edge Function logic changes |
| Trust-path backend integration | `npm run test:supabase` | Local Supabase stack, function integration (`issue-session` + `complete-game`), pgTAP DB checks | Browser/admin UX path, production deployment wiring | Backend trust/data/auth changes |
| Attendee browser smoke (fallback mode) | `npm run test:e2e` | Mobile browser smoke for attendee route flow with explicit prototype fallback mode | Trusted backend persistence assertions, admin flows | Attendee UX/route-shell changes |
| Attendee browser smoke (trusted backend) | `npm run test:e2e:attendee:trusted-backend` | Mobile attendee flow against local Supabase + local functions runtime, with assertions for success persistence, malformed-submission non-persistence, and session-bootstrap failure messaging | PR CI wiring, production deployment behavior, admin flows | Attendee trust-path smoke updates and backend completion-path confidence checks |
| Admin local e2e | `npm run test:e2e:admin` | Real local Supabase-backed `/admin` auth/allowlist/save/publish/unpublish flow | Deployed production auth redirect and production infrastructure wiring | Admin auth/authoring/publish or related UI changes |
| Full local default gate | `npm run validate:local` | Lint, unit tests, Deno function tests, attendee Playwright smoke, local Supabase validation, web build, Deno checks | Admin local e2e and production smoke | Before handoff when you need broad local confidence |
| Production admin smoke | `npm run test:e2e:admin:production-smoke` (normally via workflow) | Deployed production admin auth/allowlist/save/publish/unpublish on dedicated smoke fixtures | General attendee production coverage, non-smoke event data, PR CI checks | Post-release validation or manual production smoke rerun |

## Coverage Snapshot

### Covered Today

- shared-domain correctness and validation logic
- frontend reducer/session/API behavior
- Edge Function helpers and handler request validation
- local Supabase trust-path integration and pgTAP database rules
- attendee mobile browser smoke (fallback-mode deterministic path)
- attendee mobile browser smoke (trusted backend with success + rejection DB assertions and bootstrap-failure messaging)
- local admin e2e against real local Supabase
- production admin smoke (manual + post-release workflow) against dedicated smoke fixtures

### Intentionally Not Covered Yet

- Playwright attendee smoke in PR CI
- broad cross-browser matrix for attendee/admin e2e
- visual regression/screenshot diff gates
- remote-production browser checks for attendee flow
- comprehensive production role-matrix testing beyond dedicated smoke users

For currently tracked testing gaps and sequencing, see the backlog-linked items in:

- [`docs/backlog.md`](./backlog.md)
- [`docs/testing.md` — Todo List](#todo-list)

## Trust-Path Validation Strategy

The trust-path validation layer landed in four steps:

1. Add Deno unit coverage for the shared Edge Function trust helpers.
2. Refactor the Edge Function entrypoints just enough to make request handling directly testable without depending on `Deno.serve` side effects.
3. Add Deno handler tests for the important request and response behavior of `issue-session` and `complete-game`.
4. Add one local Supabase integration test that runs the real local stack, serves the local Edge Functions, and exercises the full session bootstrap plus completion flow over HTTP.

The intended split is:

- helper and handler tests should stay fast and deterministic, using dependency injection instead of a real database
- the local integration test should prove the full trust path with real Supabase services, real function wiring, and the shared game config
- local contributor workflow and CI should expose this trust-path validation as a first-class command instead of leaving it implicit

## Trust-Path Execution Checklist

- [x] Add a dedicated repo command for Deno-based Edge Function tests.
- [x] Add helper tests for `cors.ts`.
- [x] Add helper tests for `session-cookie.ts`.
- [x] Refactor `issue-session` so its request handler can be imported and tested directly.
- [x] Refactor `complete-game` so its request handler and payload normalization can be tested directly.
- [x] Add Deno handler tests for `issue-session`.
- [x] Add Deno handler tests for `complete-game`, including payload validation and trusted completion behavior.
- [x] Add a local Supabase integration test for `issue-session` plus `complete-game`.
- [x] Add a repo command for the local trust-path integration test.
- [x] Update local validation and CI to run the new trust-path checks.
- [x] Update contributor docs so the new commands and local prerequisites are clear.

## Admin Functionality Validation Goal

Current status:

- local admin end-to-end validation is now available through
  `npm run test:e2e:admin`
- contributor workflow docs in `docs/dev.md` now require this command for
  admin-affecting changes

Current production posture:

- a dedicated production smoke workflow now runs post-release and also supports
  manual `workflow_dispatch` reruns
- the production smoke path remains separate from normal PR CI because it
  intentionally touches a dedicated production smoke event

Tracking:

- rollout policy, ownership, and triage are now tracked in
  [`production-admin-smoke-tracking.md`](./tracking/production-admin-smoke-tracking.md)

The desired end state is:

- a contributor can run one documented local command (`npm run test:e2e:admin`)
  that verifies the full admin surface against a real local Supabase stack and
  local web app
- that command covers admin sign-in/session setup, allowlist authorization,
  private draft visibility, draft save, publish, unpublish, and the public
  attendee route after publish state changes
- `docs/dev.md` tells contributors and agents to run that command before
  opening a PR when a change might affect admin auth, authoring APIs, draft
  persistence, publish/unpublish behavior, Supabase Auth configuration, or the
  admin UI
- a release workflow or post-release workflow has a lightweight production smoke
  check that proves deployed admin auth and deployed authoring functions still
  work after production Supabase migrations and function deployment

The value of this goal is operational confidence. Admin authoring can change
live attendee content, so the repo should catch broken auth redirects,
allowlist regressions, RLS mistakes, function deployment gaps, and
publish/unpublish transaction failures before a real event depends on them.

Avoid overengineering this into a general user-management test platform. The
first version should not introduce broad role matrices, large visual snapshot
suites, production mutation tests against real event content, or PR checks that
depend on a shared production Supabase project. Keep the local suite
deterministic and use production smoke only for a dedicated test admin and test
event.

Recommended rollout status:

1. [x] Add local admin test seed data.
   Seed a known admin user or authenticated test path, an active
   `public.admin_users` row, and a dedicated authoring test event in the
   local Supabase stack.
2. [x] Add a local admin auth test helper.
   Prefer a deterministic local Supabase Auth session setup over reading magic
   links from email. The helper should document exactly how it creates or
   restores the admin session.
3. [x] Add local browser coverage for the admin shell.
   Use Playwright to open `/admin`, establish the admin session, verify the
   allowlisted state, and confirm draft summaries render.
4. [x] Add local mutation coverage for authoring APIs.
   Exercise `save-draft`, `publish-draft`, and `unpublish-event` against only a
   dedicated test event, then verify the public `/event/:slug/game` route reflects
   the expected publish state.
5. [x] Expose the suite as a repo command.
   Landed as `npm run test:e2e:admin`, intentionally separate from
   `npm run validate:local` for now.
6. [x] Update contributor workflow docs.
   `docs/dev.md` now names the command for admin-affecting changes.
7. [x] Add production smoke after the local suite is stable.
   Landed as [`.github/workflows/production-admin-smoke.yml`](../.github/workflows/production-admin-smoke.yml).
   It keeps `workflow_dispatch` reruns, adds automatic post-release coverage,
   and retains a dedicated production smoke event so this remains separate from
   normal PR CI.

## Implementation Notes

The current setup includes a few deliberate choices that are worth documenting:

- tests live under the root `tests/` directory instead of being colocated everywhere
  this keeps test-only files out of the main app and shared build surfaces while the suite is still small
- `Vitest` currently uses one global `jsdom` environment
  shared-domain tests would also work in pure Node, but one config keeps the early repo setup simple because the hook tests need a browser-like environment
- frontend API tests currently mock `fetch` and `window.localStorage` directly
  that is enough for the current `gameApi` and hook coverage; `msw` is still a good follow-on option if request mocking grows more complex
- Playwright smoke tests intentionally run with `VITE_ENABLE_LOCAL_PROTOTYPE_FALLBACK=true`
  this keeps browser smoke coverage deterministic and independent from local Supabase env setup
- the Playwright config also clears inherited Supabase browser env vars
  that prevents a contributor's shell config from silently switching the smoke suite onto a remote backend
- the Playwright mobile project uses Chromium-backed mobile emulation, not WebKit
  the original iPhone device preset implied WebKit, but Chromium is the lower-friction browser target for this repo's local workflow and CI
- database tests live in `supabase/tests/database` and depend on a local Supabase stack
  in practice that means a Docker API-compatible runtime must be available locally; the `test:db` script owns Supabase startup in both local runs and CI
- `npm run test:db` now manages the local stack for contributors
  it checks Docker, starts `npx supabase start` when needed, runs pgTAP, and only stops the stack afterward if it started it itself
- `npm run validate:local` is the repo-level local validation shortcut
  it runs lint, unit tests, Edge Function Deno tests, Playwright smoke, the shared local Supabase validation command, the web build, and the two Deno checks in one pass
- `npm run test:e2e:attendee:trusted-backend` is the local attendee trusted-backend smoke command
  it starts local Supabase + local functions runtime, runs the mobile attendee
  flow against published content, and verifies completion persistence via
  service-role database assertions
- `npm run test:e2e:admin` is the local admin end-to-end validation command
  it prepares deterministic admin auth and draft fixtures, then runs Playwright
  against the real local Supabase-backed `/admin` workflow
- `npm run test:e2e:admin:production-smoke` is the production smoke runner used
  by the `Production Admin Smoke` workflow
  it polls deployed route readiness, then runs a single-worker Playwright suite
  against the deployed admin surface with dedicated smoke fixtures
- `npm run test:supabase` is the shared local-backend validation command
  it reuses one local Supabase stack for the Edge Function integration test and the pgTAP database suite
- `deno.json` keeps `nodeModulesDir` in manual mode
  that avoids `deno check` rewriting the Node workspace installation in ways that can break Playwright resolution
- the Edge Function request handlers are now exported behind `create*Handler` factories
  that keeps the production `Deno.serve` entrypoints intact while letting Deno tests cover request behavior without spinning up a server
- the trust-path integration script starts `supabase functions serve` itself and reuses the local stack when one already exists
  this keeps the real function path test runnable from one repo command without assuming a manually managed Edge Function runtime

## Strategy Summary

The right shape for this repo is:

1. Keep static validation fast and mandatory.
2. Add focused unit tests for the pure shared game logic that acts as the source of truth.
3. Add a small number of frontend integration tests around the reducer flow and browser API boundary.
4. Add real database tests for the SQL RPC and entitlement rules.
5. Add a small set of browser-driven end-to-end and UX checks for the mobile attendee flow.
6. Avoid broad snapshot suites, excessive component tests, and tests against a shared remote Supabase project in CI.

This is a small MVP-stage product. The goal is confidence at the trust boundaries and user-critical flows, not maximal test count.

## Testing Principles

### Test the seams where bugs would actually hurt

The highest-value seams in this repo are:

- shared answer validation and scoring
- frontend game progression and completion retry behavior
- backend session verification and request validation
- SQL idempotency and single-entitlement enforcement
- the mobile browser flow from intro to completion screen

### Prefer one strong test at the right layer over three weak tests at the wrong layer

Examples:

- test `scoreAnswers` and `validateSubmittedAnswers` directly instead of only through UI clicks
- test the completion RPC in a real database instead of mocking Postgres and asserting call arguments
- test the happy-path attendee flow in a real browser instead of creating many snapshot-only component tests

### Mock external boundaries, not core business rules

Use mocks when isolating browser code from network behavior.

Do not mock:

- the shared game domain logic when it is the thing being trusted
- the SQL RPC when testing entitlement and idempotency behavior
- the reducer flow with shallow component tests that only assert implementation details

### Keep CI deterministic

PR CI should not depend on:

- a shared remote Supabase project
- manually managed event data
- flaky visual diffs

Use a local Supabase stack for integration tests when backend realism is needed.

## What Needs Coverage

### Shared Domain

The shared `shared/game-config.ts` surface is the most important unit-test target because it drives both frontend rendering and backend verification.

Test:

- `normalizeOptionIds`
  dedupes, sorts, and handles repeated ids consistently
- `answersMatch`
  order-insensitive matching for single and multiple selection
- `scoreAnswers`
  correct scoring across complete, partial, and missing answers
- `normalizeSubmittedAnswers`
  canonical answer payload generation for persistence
- `validateSubmittedAnswers`
  missing questions, unknown question ids, invalid option ids, single-select over-selection, multiple-select validity
- `validateGames`
  duplicate ids/slugs, invalid correct answers, invalid single-select definitions, empty question lists
- catalog lookup functions
  by id and by slug, especially around the featured sample route

Why this matters:

- a bug here can make the browser and backend disagree
- this is the easiest layer to test and the best place to prevent drift

### Frontend Site

The site does not need exhaustive tests for every presentational component. It does need focused behavior tests around the game flow and API boundary.

Test:

- `useGameSession`
  start, select, submit, back navigation, feedback transitions, completion submission phase, retry behavior, retake reset
- `gameSessionState`
  reducer transitions and non-React state-machine behavior
- `gameSessionSelectors`
  read-only derived state such as progress, phase booleans, and current-question selection
- `gameUtils`
  selection behavior, selection labels, feedback copy helpers where logic exists
- extracted game components
  focused rendering and interaction checks where the extracted component boundary now carries meaningful UI logic
- `gameApi`
  missing env handling, explicit offline fallback gating, stored session token handling, `401` retry path, idempotent request reuse on retry, local fallback persistence behavior
- route-level rendering
  landing page, featured game route, missing route, missing game route
- focused wiring tests around `GamePage`
  enough to prove the intro, active-question, start-error, and completion flows are still wired correctly after game-module refactors

Do not aim for:

- snapshot tests for the entire page tree
- tests for purely visual SCSS details
- one test per tiny stateless component if the behavior is already covered at a higher layer

### Supabase Edge Functions

The Edge Functions are thin, but they sit on important trust boundaries.

Test:

- `issue-session`
  rejects disallowed origins, rejects wrong methods, returns session-ready payload, reuses an existing valid session, includes `Set-Cookie` when creating a new session
- `complete-game`
  rejects disallowed origins, wrong methods, invalid JSON, invalid payload shapes, unknown events, invalid sessions, invalid answers
- request normalization behavior
  duration clamping, trusted score recomputation, canonical answer persistence inputs
- helper modules
  CORS origin parsing, cookie parsing, session signature verification, header fallback behavior

Recommended split:

- small unit tests for helpers and extracted pure validation logic
- integration tests for the request/response behavior of the actual handlers

This may require a light refactor so handler logic can be imported and tested without depending entirely on `Deno.serve`.

### Supabase Database

The SQL migration contains real business logic and should be tested directly in Postgres.

Test the RPC `complete_game_and_award_entitlement` for:

- first completion creates one entitlement
- repeat completion with a new `request_id` increments `attempt_number` but reuses the entitlement
- retry with the same `request_id` is idempotent
- `verification_code` stays stable for the same event/session pair
- `first_completion_id` is set only once
- unique constraints prevent duplicate attempts and duplicate request ids
- duration and attempt constraints behave as expected
- grants and revokes match the intended security model

This is the place where real database tests are required. Mocking this layer would miss the highest-risk behavior in the backend.

### UX And End-To-End Browser Flow

Yes, this repo should have UX tests, but they should be targeted.

What to cover in browser automation:

- direct load of the featured game route
- start screen to completion happy path on mobile
- back navigation
- instant-feedback-required wrong-answer and correct-answer flow
- multiple-selection flow
- missing-route and missing-game fallbacks
- start-screen error state when backend setup fails
- one completion submission retry case after a forced `401`

The existing screenshot capture script is already useful for review. Keep it for before/after artifact generation, but add assertion-based Playwright tests for release confidence.

UX tests should verify:

- mobile-first layout does not block task completion
- one-step-at-a-time flow still works
- progress and completion states remain understandable
- direct route loading still works after routing or deploy config changes

The fallback-mode smoke suite intentionally stays deterministic and independent
from Supabase configuration. The trusted-backend attendee smoke suite exists
alongside it to prove browser completion reaches the real local backend
persistence path.

## When To Mock Supabase

Use mocked Supabase behavior in frontend tests when the goal is to verify browser logic, not backend correctness.

Good mock use cases:

- `gameApi` handling of 200, 400, 401, and 500 responses
- retry after session refresh
- offline fallback behavior when env vars are absent
- `GamePage` integration tests that need stable completion results

Prefer mocking at the `fetch` boundary or using `msw` instead of mocking internal React hooks or shared game logic.
One exception in this repo is route-shell wiring around `GamePage`, where mocking
`useGameSession` is acceptable because the hook itself has direct behavior
coverage and the page test is intentionally verifying shell-to-module wiring.

## When To Use Real Supabase Behavior

Use a real local Supabase stack when the behavior under test depends on:

- SQL constraints
- RPC logic
- service-role access
- cookies, session headers, and real function wiring
- the end-to-end completion path

For this repo, "real Supabase integration test" should mean local Supabase started by the CLI, not a shared remote project.

## What Is Overkill Right Now

The following would be too much for the current MVP stage:

- exhaustive component-level test coverage for every presentational React component
- visual regression baselines for every screen and breakpoint
- a large matrix of browser/device combinations in CI
- load testing and heavy performance harnesses before real event traffic justifies them
- contract tests against a shared remote Supabase project on every PR
- testing the development-only offline fallback as deeply as the real backend path
- snapshot testing big JSX trees as a substitute for meaningful assertions

If a test does not protect game correctness, completion trust, or the mobile attendee flow, it is probably not first-wave coverage.

## Recommended Tooling

Recommended additions:

- `Vitest`
  fast unit and integration tests aligned with the Vite frontend toolchain
- `@testing-library/react`
  route and component integration tests from the user-facing DOM perspective
- `Playwright Test`
  assertion-based mobile-first end-to-end and UX coverage
- `pgTAP`
  Postgres-level tests for the completion RPC and database constraints

Still useful to add when the suite grows:

- `@testing-library/user-event`
  realistic click and keyboard interactions once more DOM-driven integration tests are added
- `msw`
  stable network mocking for browser-facing tests if direct `fetch` stubs start getting repetitive
- built-in `Deno.test`
  lightweight function/helper tests on the Edge Function side

Suggested non-goals:

- do not add Jest alongside Vitest
- do not add Cypress when Playwright is already in the repo

## Where Tests Should Run

### Local Development

Run the smallest relevant set while iterating:

- shared/frontend changes: `npm run lint`, `npm test`, `npm run build:web`
- Edge Function changes: lint, `deno check`, Deno tests, relevant local integration tests
- migration changes: `npm run test:db` against a local Supabase stack
- UX changes: `npm run test:e2e` plus the screenshot capture workflow when visuals materially changed
- attendee trust-path smoke changes: `npm run test:e2e:attendee:trusted-backend`

Notes:

- `npm run test:supabase` and `npm run test:db` require a Docker API-compatible runtime because the local Supabase stack depends on it
- `npm run test:setup:local` is the easiest one-time setup path for local contributors
- `npm run test:e2e` exercises fallback-mode route and interaction behavior
- `npm run test:e2e:attendee:trusted-backend` proves browser completion reaches local backend persistence; use both commands when attendee trust-path smoke changes are involved

### Pull Request CI

PR CI currently runs:

- `npm run lint`
- `npm test`
- `npm run test:functions`
- `npm run test:supabase`
- `npm run test:e2e:attendee:trusted-backend`
- `npm run build:web`
- `deno check` for all shipped Edge Function entrypoints

The shared `test:supabase` step now owns local Supabase startup for the backend validation slice, so CI only pays that setup cost once for the trust-path integration and database tests.

Keep PR CI focused on fast confidence:

- one or two happy paths
- one or two critical edge cases
- no giant screenshot diff gate

Still worth adding to PR CI:

- the local admin functionality suite once it is stable enough to run
  deterministically before release

### Post-Merge Or Nightly

If the suite grows, the heavier checks can run after merge or on a schedule:

- fuller Playwright coverage
- longer-running local Supabase integration scenarios
- optional screenshot artifact capture for UX review
- production admin smoke against a dedicated test admin and test event after
  release

This is optional for now. The repo does not yet need an elaborate nightly test matrix.

## Suggested Rollout Order

Completed first wave:

1. Add shared-domain unit tests.
2. Add frontend tests for `useGameSession` and `gameApi`.
3. Add Postgres tests for the completion RPC and entitlement rules.
4. Add assertion-based Playwright smoke tests for the mobile attendee path.

Completed second wave:

5. Add a few Deno tests for session/cors helpers and request validation.
6. Add a local Supabase integration test that exercises the full function path.

Completed third wave:

7. Add trusted-backend attendee Playwright smoke coverage to PR CI.

That order still gives the most confidence for the least complexity.

Progress note:

- steps 5 through 7 are now complete

## Proposed Test Inventory

The first useful wave should probably include:

- shared answer normalization, validation, scoring, and catalog tests
- `useGameSession` happy path, instant-feedback mode, back navigation, retry, and retake tests
- `gameSessionState`, `gameSessionSelectors`, and `gameUtils` tests for the pure game module seams
- focused `GamePage` route-shell wiring tests plus extracted game component tests
- `gameApi` session bootstrap, missing env, offline fallback, and `401` retry tests
- RPC tests for idempotency, single entitlement, attempt numbering, and verification code reuse
- Playwright mobile smoke for featured flow, spotlight wrong-answer path, and direct route loading
- Playwright mobile trusted-backend smoke with DB assertions for completion and entitlement persistence

Everything beyond that should earn its keep.

## Todo List

### Immediate

- [x] Add `Vitest` and create a root test script for shared and frontend tests.
- [x] Add shared-domain tests for `answers.ts`, `game-validation.ts`, and `catalog.ts`.
- [x] Add frontend tests for `useGameSession`.
- [x] Add frontend tests for `gameApi` with mocked network responses and storage.
- [x] Add Playwright Test config instead of relying only on the screenshot script.
- [x] Add a small mobile smoke suite that covers featured flow, direct route load, and not-found states.
- [x] Add local database tests for `complete_game_and_award_entitlement`.

### Soon After

- [x] Add Deno tests for `session-cookie.ts` and `cors.ts`.
- [x] Refactor Edge Function request handling slightly if needed so validation and response logic are directly testable.
- [x] Add an integration test that exercises `issue-session` plus `complete-game` against a local Supabase stack.
- [x] Add trusted-backend attendee Playwright smoke coverage that runs against local Supabase + local Edge Functions and asserts completion persistence through database reads.
- [x] Add attendee smoke malformed-submission rejection coverage that forces a backend `400`, asserts no completion persistence for the malformed request, and verifies retry-to-success.
- [x] Add attendee smoke bootstrap-failure messaging coverage that forces `issue-session` startup failure and asserts the intro error banner plus backend failure detail.
- [x] Add PR CI coverage for the Playwright smoke suite.
- [x] Add PR CI coverage for Deno function tests.
- [x] Add local end-to-end admin functionality coverage for sign-in/session
  setup, allowlist authorization, draft reads, save, publish, unpublish, and
  public route verification against a dedicated local test event.
- [x] Document the admin functionality test command in `docs/dev.md` and require
  it before PR handoff for admin, authoring, auth, RLS, publish/unpublish, and
  related Supabase configuration changes.

### Known Flaky Tests

- [ ] **Stabilize `AdminPage > draft changes not published label > shows the status label
  after a save on a live event, then clears it after publish`**
  (`tests/web/pages/AdminPage.test.tsx`)
  Intermittently fails in CI with "Unable to find an element with the text: /Draft
  changes not published/". The test exercises multiple sequential async state
  transitions (save → publish → banner clear). The likely cause is a `waitFor` or
  `findBy*` assertion firing before the preceding async state settles. Fix: audit
  the async sequencing in this test case, replace any `getBy*` calls that follow
  async actions with `findBy*` or explicit `waitFor`, and confirm the test passes
  reliably across 10+ local runs before closing.

### Later, Only If Needed

- [ ] Add broader Playwright coverage for retry-after-401 and backend failure messaging.
- [ ] Add test helpers for reusable sample payloads and session tokens.
- [ ] Add post-merge or nightly longer-running integration coverage if the product surface expands.
- [x] Add post-release production admin smoke coverage using a dedicated
  production test admin and test event.
- [ ] Revisit visual regression tooling only if design churn slows down and stable screenshots become worth maintaining.
