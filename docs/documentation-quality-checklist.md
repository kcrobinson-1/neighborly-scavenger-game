# Documentation Quality Checklist

## Purpose

This checklist tracks the concrete actions that bring the repo docs up to a
high standard and keep them there as the product grows.

Use it as:

- a maintenance checklist during doc-focused work
- a review aid when structural changes land
- a place to record recurring docs debt without guessing future decisions

## Baseline That Now Exists

- [x] Root `README.md` explains the current milestone, repo shape, quick start,
  validation commands, and release model.
- [x] `docs/README.md` acts as a docs hub with topic ownership boundaries.
- [x] Core canonical docs exist for product, experience, architecture,
  development, testing, and operations.
- [x] Repo-specific contributor guidance exists in `AGENTS.md`.
- [x] Area readmes exist for the extracted web quiz module and shared quiz
  domain.
- [x] Open questions are tracked explicitly in `docs/open-questions.md` instead
  of being guessed inside canonical docs.
- [x] A living release readiness and quality-check plan exists in
  [`docs/release-readiness.md`](./release-readiness.md) and coordinates with
  the trackers in this file rather than duplicating them.

## Keep The Canonical Docs Honest

- [x] Remove branch-specific status notes from durable implementation docs once
  the work lands on `main`.
- [x] Keep docs/testing status and todo sections aligned with the actual test
  surface in the repo.
- [x] Keep milestone-plan phase status current as later authoring phases land.
- [x] Fold milestone-specific implementation notes back into canonical docs when
  those notes stop being active execution references.

## Keep Process Guidance Strong

- [x] Tell contributors and agents to record unknowns as open questions instead
  of inventing decisions.
- [x] Cross-link the docs hub, README, and contributor instructions so the doc
  set is discoverable from multiple entrypoints.
- [x] Add a canonical admin/auth workflow doc once quiz authoring moves beyond
  shared-schema groundwork. (Covered by `docs/architecture.md` admin workspace
  section and `docs/dev.md` admin auth and local workflow notes.)
- [ ] Add a canonical analytics/reporting doc once organizer-visible metrics
  exist.
- [ ] Document a supported backend preview or staging workflow if the repo adopts
  one beyond the current direct-to-production release model.

## Keep Docs Coupled To Code Changes

- [ ] When routes, trust boundaries, or runtime ownership change, update
  `README.md`, `docs/architecture.md`, and `docs/dev.md` in the same pass.
- [ ] When validation commands, CI behavior, or local setup change, update
  `docs/dev.md`, `docs/testing.md`, and any affected workflow docs together.
- [ ] When UX-facing flows change materially, keep `docs/experience.md`, UI
  review expectations, and PR screenshot guidance aligned.
- [ ] When new modules or structural boundaries are introduced, add or update
  local readmes where the ownership would otherwise be non-obvious.

## Review Checklist For Future Doc Passes

- [ ] Check whether every doc still distinguishes current implementation from
  target-state product intent.
- [ ] Check whether any "future", "later", or "next" language should now be
  converted into either implemented behavior or an explicit open question.
- [ ] Check whether contributor guidance still matches the real validation
  commands and release workflow.
- [ ] Check whether docs duplicate the same procedure in multiple places instead
  of linking to one canonical owner.
