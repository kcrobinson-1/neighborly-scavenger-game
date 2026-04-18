# Web Game Module

## Purpose

This folder owns the frontend game module for the attendee game flow.

It keeps the game-specific browser code together while leaving shared game
correctness in `shared/game-config` and backend trust/completion behavior in
`apps/web/src/lib/gameApi.ts` plus the Supabase backend.

## Public Entrypoints

- `useGameSession.ts`
  Public React hook for the game session lifecycle. This is the main interface
  that route-level UI should consume.
- `gameUtils.ts`
  Public pure helper surface for game-specific selection, labeling, and
  feedback-copy logic.

These are the stable imports that other frontend files should prefer.

## Internal Structure

- `gameSessionState.ts`
  Pure reducer-owned state machine types, initial-state helpers, request-id
  creation for final-question completion, and transition logic.
- `gameSessionSelectors.ts`
  Pure derived-state selectors that turn reducer state plus game config into the
  React-facing view state used by the page and game components.
- `components/`
  Game-specific presentation components used by `GamePage.tsx`.
  These components should stay presentational and receive state/actions through
  props rather than owning game business rules themselves.

## Ownership Boundaries

- `GamePage.tsx` should stay a route shell.
  It handles route-level framing, session bootstrap, and choosing which game
  panel to render.
- `useGameSession.ts` owns the browser game lifecycle.
  It wires reducer state, derived selectors, completion submission, retries, and
  hook-facing actions together.
- `gameSessionState.ts` owns state transitions.
  If a game phase or reducer transition changes, update that file first.
- `gameSessionSelectors.ts` owns read-only derived state.
  If a page/component needs new derived booleans or progress calculations, add
  them there instead of growing the hook body.
- `gameUtils.ts` owns frontend-only helper logic.
  Keep shared answer correctness, scoring, and validation in `shared/game-config`.

## Testing Layout

- `tests/web/game/useGameSession.test.ts`
  Hook contract coverage.
- `tests/web/game/gameSessionState.test.ts`
  Pure reducer/state-machine coverage.
- `tests/web/game/gameSessionSelectors.test.ts`
  Pure derived-state selector coverage.
- `tests/web/game/gameUtils.test.ts`
  Pure helper coverage.
- `tests/web/game/components/`
  Focused component rendering and interaction coverage for extracted game
  panels.
- `tests/web/pages/GamePage.test.tsx`
  Route-shell wiring coverage for intro, active question, start-error, and
  completion states.

## Maintenance Notes

- Keep this module non-authoritative for game correctness.
  Shared game rules still belong in `shared/game-config`.
- Preserve current strings and class names when refactoring components unless
  there is an intentional UX change.
- Prefer adding a small pure helper or selector over pushing more logic back
  into `GamePage.tsx`.
- Prefer direct tests for pure state, selector, and helper modules plus focused
  wiring tests for the page shell.

## Current Status

The game module refactor is complete. The reducer, derived selectors, game
panels, and tests now follow the current module boundaries described above.
