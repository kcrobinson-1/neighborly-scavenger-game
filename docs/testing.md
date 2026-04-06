# Testing Strategy

## Document Role

This doc describes what should be tested in this repository, what is intentionally not worth testing yet, and where different checks should run.

Use it when you need:

- a repo-specific testing strategy instead of generic frontend advice
- guidance on unit vs integration vs UX coverage
- clarity on when to mock Supabase and when to run against a real local Supabase stack
- a phased todo list for rolling out test coverage without overbuilding

Current setup and release workflow still live in `dev.md`. System responsibilities and trust boundaries live in `architecture.md`. UX goals live in `experience.md`.

## Current State

Today the repo validates with:

- `npm run lint`
- `npm test`
- `npm run build:web`
- `deno check --no-lock supabase/functions/issue-session/index.ts`
- `deno check --no-lock supabase/functions/complete-quiz/index.ts`
- `npm run ui:review:capture` for screenshot-based browser review

That is a useful baseline, but it is not yet a real testing strategy. It catches type and build breakage, but it does not systematically verify quiz correctness, reducer behavior, API retry rules, SQL idempotency, or end-to-end completion behavior.

## Strategy Summary

The right shape for this repo is:

1. Keep static validation fast and mandatory.
2. Add focused unit tests for the pure shared quiz logic that acts as the source of truth.
3. Add a small number of frontend integration tests around the reducer flow and browser API boundary.
4. Add real database tests for the SQL RPC and entitlement rules.
5. Add a small set of browser-driven end-to-end and UX checks for the mobile attendee flow.
6. Avoid broad snapshot suites, excessive component tests, and tests against a shared remote Supabase project in CI.

This is a small MVP-stage product. The goal is confidence at the trust boundaries and user-critical flows, not maximal test count.

## Testing Principles

### Test the seams where bugs would actually hurt

The highest-value seams in this repo are:

- shared answer validation and scoring
- frontend quiz progression and completion retry behavior
- backend session verification and request validation
- SQL idempotency and single-entitlement enforcement
- the real mobile browser flow from intro to verified completion

### Prefer one strong test at the right layer over three weak tests at the wrong layer

Examples:

- test `scoreAnswers` and `validateSubmittedAnswers` directly instead of only through UI clicks
- test the completion RPC in a real database instead of mocking Postgres and asserting call arguments
- test the happy-path attendee flow in a real browser instead of creating many snapshot-only component tests

### Mock external boundaries, not core business rules

Use mocks when isolating browser code from network behavior.

Do not mock:

- the shared quiz domain logic when it is the thing being trusted
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

The site does not need exhaustive tests for every presentational component. It does need focused behavior tests around the quiz flow and API boundary.

Test:

- `useQuizSession`
  start, select, submit, back navigation, feedback transitions, completion submission phase, retry behavior, retake reset
- `quizUtils`
  selection behavior, selection labels, feedback copy helpers where logic exists
- `quizApi`
  missing env handling, explicit offline fallback gating, stored session token handling, `401` retry path, idempotent request reuse on retry, local fallback persistence behavior
- route-level rendering
  landing page, featured game route, missing route, missing game route
- one or two integration tests around `GamePage`
  enough to prove the main button/selection/progress/completion wiring works with mocked network responses

Do not aim for:

- snapshot tests for the entire page tree
- tests for purely visual SCSS details
- one test per tiny stateless component if the behavior is already covered at a higher layer

### Supabase Edge Functions

The Edge Functions are thin, but they sit on important trust boundaries.

Test:

- `issue-session`
  rejects disallowed origins, rejects wrong methods, returns session-ready payload, reuses an existing valid session, includes `Set-Cookie` when creating a new session
- `complete-quiz`
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

Test the RPC `complete_quiz_and_award_entitlement` for:

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

## When To Mock Supabase

Use mocked Supabase behavior in frontend tests when the goal is to verify browser logic, not backend correctness.

Good mock use cases:

- `quizApi` handling of 200, 400, 401, and 500 responses
- retry after session refresh
- offline fallback behavior when env vars are absent
- `GamePage` integration tests that need stable completion results

Prefer mocking at the `fetch` boundary or using `msw` instead of mocking internal React hooks or shared quiz logic.

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

If a test does not protect quiz correctness, completion trust, or the mobile attendee flow, it is probably not first-wave coverage.

## Recommended Tooling

Recommended additions:

- `Vitest`
  fast unit and integration tests aligned with the Vite frontend toolchain
- `@testing-library/react`
  route and component integration tests from the user-facing DOM perspective
- `@testing-library/user-event`
  realistic click and keyboard interactions in frontend tests
- `msw`
  stable network mocking for browser-facing tests without hand-rolling fetch stubs everywhere
- `Playwright Test`
  assertion-based mobile-first end-to-end and UX coverage
- `pgTAP`
  Postgres-level tests for the completion RPC and database constraints
- built-in `Deno.test`
  lightweight function/helper tests on the Edge Function side

Suggested non-goals:

- do not add Jest alongside Vitest
- do not add Cypress when Playwright is already in the repo

## Where Tests Should Run

### Local Development

Run the smallest relevant set while iterating:

- shared/frontend changes: lint, web build, shared/frontend unit tests
- Edge Function changes: lint, `deno check`, Deno tests, relevant local integration tests
- migration changes: SQL tests against local Supabase or local Postgres
- UX changes: Playwright tests plus the screenshot capture workflow when visuals materially changed

### Pull Request CI

PR CI should eventually run:

- `npm run lint`
- `npm run build:web`
- shared/frontend Vitest suite
- Deno function tests
- database tests against a local Supabase or Postgres service
- a small Playwright smoke suite on mobile viewport

Keep PR CI focused on fast confidence:

- one or two happy paths
- one or two critical edge cases
- no giant screenshot diff gate

### Post-Merge Or Nightly

If the suite grows, the heavier checks can run after merge or on a schedule:

- fuller Playwright coverage
- longer-running local Supabase integration scenarios
- optional screenshot artifact capture for UX review

This is optional for now. The repo does not yet need an elaborate nightly test matrix.

## Suggested Rollout Order

1. Add shared-domain unit tests first.
2. Add frontend tests for `useQuizSession` and `quizApi`.
3. Add Postgres tests for the completion RPC and entitlement rules.
4. Add assertion-based Playwright smoke tests for the mobile attendee path.
5. Add a few Deno tests for session/cors helpers and request validation.

That order gives the most confidence for the least complexity.

## Proposed Test Inventory

The first useful wave should probably include:

- shared answer normalization, validation, scoring, and catalog tests
- `useQuizSession` happy path, instant-feedback mode, back navigation, retry, and retake tests
- `quizApi` session bootstrap, missing env, offline fallback, and `401` retry tests
- RPC tests for idempotency, single entitlement, attempt numbering, and verification code reuse
- Playwright mobile smoke for featured flow, spotlight wrong-answer path, and direct route loading

Everything beyond that should earn its keep.

## Todo List

### Immediate

- [x] Add `Vitest` and create a root test script for shared and frontend tests.
- [x] Add shared-domain tests for `answers.ts`, `game-validation.ts`, and `catalog.ts`.
- [x] Add frontend tests for `useQuizSession`.
- [x] Add frontend tests for `quizApi` with mocked network responses and storage.
- [x] Add Playwright Test config instead of relying only on the screenshot script.
- [x] Add a small mobile smoke suite that covers featured flow, direct route load, and not-found states.
- [ ] Add local database tests for `complete_quiz_and_award_entitlement`.

### Soon After

- [ ] Add Deno tests for `session-cookie.ts` and `cors.ts`.
- [ ] Refactor Edge Function request handling slightly if needed so validation and response logic are directly testable.
- [ ] Add an integration test that exercises `issue-session` plus `complete-quiz` against a local Supabase stack.
- [ ] Add PR CI jobs for the new unit, database, and Playwright smoke suites.

### Later, Only If Needed

- [ ] Add broader Playwright coverage for retry-after-401 and backend failure messaging.
- [ ] Add test helpers for reusable sample payloads and session tokens.
- [ ] Add post-merge or nightly longer-running integration coverage if the product surface expands.
- [ ] Revisit visual regression tooling only if design churn slows down and stable screenshots become worth maintaining.
