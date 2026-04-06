# Web Quiz Module Refactor Plan

## Purpose

This folder owns the frontend quiz module for the attendee game flow.

The current implementation already has the right high-level boundary:

- `useQuizSession.ts` owns the reducer-backed quiz session flow
- `quizUtils.ts` owns quiz-specific pure helpers

This refactor keeps that boundary intact while making the module easier to read,
test, and maintain.

## Current Pain Points

- `useQuizSession.ts` mixes reducer logic, state helpers, derived view state,
  side-effect orchestration, and hook-facing actions in one large file.
- `GamePage.tsx` still owns several quiz-specific presentation components that
  fit better inside this module.
- The current folder lacks a local guide that explains which files are public
  entrypoints, which files are internal implementation details, and how tests
  map onto the module.

## Target Architecture

- Keep `useQuizSession.ts` as the stable public hook entrypoint.
- Extract reducer-owned state machine logic into internal files in this folder.
- Extract derived session selectors into internal files in this folder.
- Move quiz-specific UI panels from `pages/GamePage.tsx` into
  `game/components/`.
- Keep `quizUtils.ts` as the stable pure-helper entrypoint.
- Add matching tests so the refactor preserves behavior while making the new
  internal seams easier to validate directly.

## Commit Plan

1. `docs(game): add module refactor plan readme`
2. `refactor(game): extract quiz session state machine`
3. `refactor(game): separate hook selectors and derived session state`
4. `refactor(game): extract quiz UI components from game page`
5. `test(game): add quiz utils and page wiring coverage`
6. `docs(game): finalize module documentation`

## Todo Checklist

- [x] Add this README with the working plan and checklist.
- [ ] Extract quiz session state machine files and matching tests.
- [ ] Extract derived session selectors/helpers and matching tests.
- [ ] Extract quiz UI components from `GamePage.tsx` and add matching tests.
- [ ] Add direct `quizUtils` coverage and focused `GamePage` wiring coverage.
- [ ] Finalize this README as a stable module guide.
- [ ] Update `docs/architecture.md` for the new frontend structure.
- [ ] Update `docs/testing.md` for the new test layout and coverage.
- [ ] Run final review, final validation, and open a review-ready PR.

## Non-Goals

- No user-facing copy changes.
- No route changes.
- No CSS class changes except extraction-safe moves that preserve output.
- No scoring, correctness, or backend behavior changes.
- No movement of shared quiz rules out of `shared/game-config`.

## Validation Standard

Before each implementation commit, run:

```bash
npm run lint
npm test
npm run test:functions
npm run test:supabase
npm run build:web
deno check --no-lock supabase/functions/issue-session/index.ts
deno check --no-lock supabase/functions/complete-quiz/index.ts
```

Each commit should stay reviewable, behaviorally unchanged, and green.
