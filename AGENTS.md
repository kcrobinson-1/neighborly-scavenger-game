# Agent Instructions

This file gives repository-specific guidance to AI coding agents working in this project.

Use it as a practical checklist for making changes that stay aligned with the current architecture, documentation, and product stage.

## Development Workflow Source Of Truth

For any repository change beyond a trivial read-only answer, treat
`docs/dev.md` as the development workflow source of truth.

Before editing, read the relevant `docs/dev.md` sections for:

- local setup and environment assumptions
- validation commands
- Supabase, Deno, Vercel, and Playwright workflow notes
- release and pull request expectations
- troubleshooting for the area being changed

`AGENTS.md` defines agent behavior and decision discipline. `docs/dev.md`
defines the current contributor workflow. Follow both. If they conflict, stop
and report the conflict instead of guessing.

## Purpose

This repository currently contains a prototype-to-MVP attendee quiz experience:

- `apps/web` is the Vite + React frontend
- `apps/web/src/styles.scss` is the SCSS entrypoint, backed by focused partials in `apps/web/src/styles/`
- `shared/game-config.ts` is the shared quiz public entrypoint, backed by focused modules in `shared/game-config/`
- `supabase/functions` contains the trusted backend edge functions
- `supabase/migrations` contains the database schema and RPC logic
- `docs` explains the current system, tooling, and roadmap

Before making major architectural assumptions, read:

- `README.md`
- `docs/architecture.md`
- `docs/dev.md`
- `docs/open-questions.md`

Use `docs/product.md` and `docs/experience.md` as product and UX targets, not as proof that every planned feature already exists.
When the repo leaves a decision unresolved, capture that uncertainty in `docs/open-questions.md` instead of inventing an answer.

## Architecture Guardrails

Respect the current split of responsibilities:

- Put visual and interaction changes in `apps/web/src`
- Keep shared styling tokens, mixins, and page/component styles in `apps/web/src/styles.scss` and `apps/web/src/styles/`
- Put quiz definitions, catalog, validation, and scoring changes in `shared/game-config.ts` and `shared/game-config/`
- Put trust, session, persistence, and entitlement logic in `supabase/functions` and `supabase/migrations`

Do not casually duplicate business rules across frontend and backend.

If quiz correctness, scoring, or answer validation changes, make sure the shared source of truth still drives both the UI and the backend completion path.

Do not treat the local browser-only completion fallback as production backend behavior.
Do not default to the local browser-only completion fallback when a remote Supabase integration run is feasible.

### Styling Token Discipline

Use the SCSS token layer before adding new hard-coded visual values.

- prefer existing tokens from `apps/web/src/styles/_tokens.scss` for colors,
  spacing, radii, shadows, font weights, and shared component dimensions
- add a new semantic token when a value is repeated, represents a reusable
  surface, state, interaction, or layout role, or should change consistently
  across multiple components
- name tokens by UI role or intent, such as `$color-success-surface` or
  `$space-7`, rather than by vague appearance names
- keep one-off layout values local when a token would add indirection without
  improving readability or future change cost
- do not introduce broad token rewrites inside unrelated feature work; add a
  bounded checklist item when token cleanup is useful but not required for the
  feature
- for behavior-preserving token refactors, compare compiled CSS before and
  after when practical, in addition to running `npm run build:web`

## Expected Workflow

Work should follow the repo process even when the prompt only describes the end state.

Use the lightweight path only when the change is small and low-risk, for example:

- a single-file fix
- a narrow copy or style adjustment
- a small test update that does not change structure

Use the full structured path when the change is multi-file, architectural, refactor-heavy, or changes tests, validation, documentation, or workflow.

### Scope Guardrails

Treat broad checklist, cleanup, or refactor requests as a queue of PR-sized tasks, not as permission to work through everything in one thread.

- prefer one checklist item, one feature slice, or one tightly related file family per branch and handoff
- combine multiple items only when they share the same files, the same validation surface, and still produce a small reviewable diff
- if a user asks for many checklist items at once, record or confirm the sequence, then execute only the first bounded slice unless the user explicitly asks only for planning
- if the work grows beyond one clean PR, stop after updating the checklist or plan with smaller follow-up tasks
- stop and report instead of expanding scope when the task starts requiring behavior changes, unrelated production edits, mixed backend/frontend/UI work, or validation outside the originally relevant surface
- prefer a fresh thread or fresh branch for the next checklist item when the previous slice has been committed and handed off

When a prompt identifies a specific checklist item, issue, file family, feature
slice, or validation command, treat that as the active boundary. Do not work on
adjacent cleanup, nearby checklist items, opportunistic dependency upgrades, or
unrelated docs unless they are necessary to keep the requested change correct
and validated.

If the requested task is behavior-preserving, keep it behavior-preserving. Stop
and report instead of proceeding if the implementation appears to require
changing product behavior, public contracts, persistence semantics, authorization
rules, routing, generated artifacts, or unrelated production code.

### Feature-Time Cleanup And Refactor Debt Capture

Feature work should leave the touched code coherent, but it should not expand
into opportunistic refactors that are not required for the feature.

During implementation:

- prefer small local cleanup when it directly improves the feature diff, reduces
  immediate duplication, or prevents confusing ownership in the touched files
- do not restructure unrelated code just because nearby code could be cleaner
- do not block a feature on broad cleanup unless the existing structure makes
  the feature hard to implement safely
- if a file or module becomes noticeably harder to review because of the
  feature, decide whether a small extraction belongs in the same PR
- if the cleanup is useful but not necessary for the feature, record it as a
  bounded follow-up in `docs/code-refactor-checklist.md`

Before handoff, run a post-implementation structure review:

- identify any touched file that grew large, mixed responsibilities, duplicated
  logic, or became harder to test because of the change
- fix the issue in the same PR only when it is small, directly related, and does
  not obscure the feature being implemented
- otherwise add a checklist item with the specific file or module, the concrete
  responsibility problem, the desired target shape, and the minimum validation
  command
- do not add checklist items for cosmetic preferences, speculative abstraction,
  or general "clean up this area" work

### Pre-Edit Gate

Before editing for any non-trivial task:

- make sure the worktree does not contain unrelated uncommitted changes; if it
  does, stop and ask how to proceed
- make sure you are not doing substantial implementation work on `main`; create
  or switch to an appropriately named feature branch first
- read the relevant docs, tests, and neighboring implementation before deciding
  the target shape
- confirm the requested change is expected to be positive value for the codebase:
  it should reduce real risk, duplication, confusion, operational friction, or
  product/user pain enough to justify its diff and review cost
- stop and report instead of editing if the change appears needless, mostly
  cosmetic, or likely to introduce more noise than value
- run the task's specified baseline validation commands before editing when the
  prompt or checklist names them
- if a required baseline validation fails before edits, stop and report the
  failure instead of changing files
- if no baseline command is specified, identify the smallest relevant validation
  surface before editing and run it when practical

### Lightweight Path

1. Read the relevant code and matching docs before editing.
2. Make the smallest coherent change that solves the task.
3. Update any touched tests and docs in the same pass when they would otherwise drift.
4. Review the diff before finishing.
5. Run the relevant validation commands before handing off.

### Full Structured Path

1. Ground in the current code and docs before making structural decisions.
2. Check branch state before editing.
   If you are on `main`, create or switch to a feature branch before the first repo edit.
3. Write down the execution plan before editing.
   Use a local README, checklist, or equivalent in the relevant area when the work spans multiple files or steps.
4. Define the target structure and file responsibilities up front so the refactor is constraint-driven, not improvised file by file.
5. Define the intended commit boundaries up front.
   For multi-step work, note the planned commit slices before the first code change so implementation does not collapse into one large commit by accident.
6. Execute in small, reversible commits.
   Each commit should leave the repo working, keep tests aligned with code, and preserve a reviewable intermediate state.
7. Validate continuously, not just at the end.
   Run the relevant checks before each commit and after any risky structural step.
8. Keep documentation current as the work progresses.
   Do not save README or architecture updates for the very end if the structure is already changing underneath them.
9. Before handoff, delete temporary execution-plan/checklist docs or convert
   them into durable reference docs. Do not leave running-state planning docs in
   the repo after their phase has landed.
10. Self-review each commit-sized diff, then self-review the final branch as a whole before handing off or opening a PR.

If you discover that the current docs no longer describe the code accurately, fix the docs in the same change when practical.

## Execution Rules

Prefer constraint-driven execution over open-ended refactoring.

- decide the intended module boundaries before moving files around
- prefer extracting one seam at a time over broad rewrites
- keep code, tests, and docs moving together
- externalize plan state when the work spans multiple steps so later decisions do not depend on memory
- prefer adding focused tests for newly exposed pure seams instead of relying only on higher-level coverage

For multi-step work, do not batch everything into one large uncommitted transformation.

- create or maintain a local checklist in the relevant area when it helps track structure, responsibilities, or remaining work
- update that checklist or README as steps are completed
- remove or finalize that checklist before handoff so canonical docs, not
  stale running state, describe the implemented system
- keep intermediate states understandable to the next engineer or agent
- if the work started from `main`, do not leave implementation only in the working tree on `main`; move it onto a feature branch before substantial edits accumulate
- if the change spans backend, frontend, tests, and docs, assume it should land as multiple commits unless there is a specific reason not to

### Refactor Completion Proof

For checklist, cleanup, split, extraction, or other behavior-preserving refactor
tasks, passing tests is necessary but not sufficient. Before marking the task
complete, prove that the requested target shape was actually achieved.

- define the target shape before editing, including what responsibilities should
  remain in the original file or module and what responsibilities should move
- verify the final diff against every concrete clause in the checklist item or
  prompt, not just against the task title
- report the final responsibility split in the handoff for any split or
  extraction task
- include before/after size or ownership evidence when file size, reviewability,
  or local ownership is the reason for the task
- do not mark a checklist item complete merely because some helper was extracted
  or some code moved; the remaining code must match the requested shape
- if substantial duplicated logic, mixed responsibilities, or unclear ownership
  remains, either finish the refactor or leave the checklist item open and
  explain the blocker
- if validation passes but the target shape is not met, treat the task as
  incomplete
- if the refactor does not clearly improve reviewability, ownership, risk
  reduction, or future change cost, stop and report instead of marking it
  complete

### Stop-And-Report Conditions

Stop and report instead of continuing when any of these happen:

- the worktree has unrelated uncommitted changes that could be mixed into the
  task
- required baseline validation fails before edits
- the requested change appears needless, mostly cosmetic, or likely to introduce
  more noise than value after reviewing the current code and docs
- the requested bounded task starts expanding into unrelated frontend, backend,
  database, workflow, dependency, or documentation changes
- a behavior-preserving task appears to require behavior changes
- the change would alter public API contracts, status codes, response bodies,
  database schema or semantics, authentication or authorization rules, routing,
  or production platform configuration outside the stated scope
- preserving coverage would require deleting or weakening assertions instead of
  moving, updating, or adding equivalent coverage
- the task becomes larger than one clean reviewable PR
- the target shape cannot be met without a broader design decision

When stopping, leave the worktree clean when practical. If stopping after
partial edits, clearly identify the touched files, what remains incomplete, and
whether any validation was run.

### Versioning And Dependency Discipline

Choose versions deliberately when you add or update libraries, actions, CLIs, or other tooling that pulls in libraries.

- prefer current stable versions that are compatible with the repo's runtime and framework constraints
- do not use floating values such as `latest`, broad unpinned ranges, or moving tags when a reproducible pinned version is practical
- when an action or tool installs another dependency under the hood, verify the installed version is compatible with the repo and the surrounding runtime
- when Deno, npm, JSR, GitHub Actions, or other package systems interact, make sure their resolved versions do not drift silently across environments
- update lockfiles and any version-carrying config in the same change
- prefer upgrading intentionally with a clear validation pass over opportunistic version bumps mixed into unrelated work

## Documentation Expectations

Keep documentation synchronized with the implementation.

For structural or multi-file work, documentation is part of the execution loop, not a final polish pass.

- maintain or create a local README or equivalent in the relevant area when the change introduces or reorganizes module structure
- document file responsibilities and intended ownership when the structure is non-obvious
- update area docs as changes are made so the written structure never lags far behind the code
- if a repo plan doc tracks phased work, keep its phase status current as implementation lands
- when a tracked phase is complete in the branch, mark it complete in the relevant plan doc before handoff
- unless the work is explicitly exploratory, keep each completed phase in a PR-ready state that could merge to `main` without waiting for a later phase

Update `README.md` when:

- the current capabilities change
- setup or deployment steps change
- the platform responsibilities or repo structure change

Update `docs/architecture.md` when:

- code ownership or runtime flow changes
- trust boundaries or data ownership change
- new backend surfaces or major modules are added

Update `docs/dev.md` when:

- local workflow changes
- validation commands change
- tooling choices or deployment steps change

Update `docs/open-questions.md` when:

- you discover an unresolved product, UX, architecture, or operations decision that materially affects future work
- a previously open question has been answered in code, docs, or platform configuration

Update `docs/documentation-quality-checklist.md` when:

- a docs improvement pass completes a checklist item
- a new recurring docs debt pattern shows up in review or handoff

Update inline comments and function/type documentation when:

- behavior changes in a non-obvious way
- new logic would be hard to understand without context
- a documented function, type, or data structure changes meaningfully
- phase implementation adds new trust, persistence, migration, or workflow
  boundaries that a future maintainer would otherwise need to infer from tests

Do not add comments that merely restate the code.

## Commit Message Expectations

Use the Conventional Commits convention for commit messages in this repo.

## Validation Expectations

Run the checks relevant to the area you changed.

For frontend or shared TypeScript changes, run:

```bash
npm run lint
npm run build:web
```

For frontend style changes, also make sure the SCSS entrypoint still builds through the normal frontend build:

```bash
npm run build:web
```

For Supabase edge function changes, run:

```bash
deno check --no-lock supabase/functions/issue-session/index.ts
deno check --no-lock supabase/functions/complete-quiz/index.ts
```

If you changed both frontend/shared code and Supabase code, run both sets of checks.

If you could not run a relevant check, say so explicitly and explain why.

For pull requests into `main`, expect GitHub CI to run the same validation via `.github/workflows/ci.yml`.

### Validation Honesty

Do not overstate what was validated.

- Run the validation commands named by the task or checklist before handoff.
- If you added a new test command, validation surface, or workflow step, prefer to run it locally before opening or updating a PR.
- If you added a new top-level validation path, run the integrated repo command that is supposed to cover it, not just the new subcommand in isolation.
- If a validation command depends on local services or runners, exercise it from a clean start when practical, not only from a warm reused state.
- If a new validation step cannot be run locally, call out the exact blocker in the handoff and PR description.
- Do not describe a branch as fully validated if any newly introduced check has not been exercised end to end.
- If docs describe a test as covering the "real" backend or browser path, make sure the implementation actually does that. If the test runs in fallback or mocked mode, document that precisely.
- If baseline validation failed and the task was stopped before edits, report
  that as a baseline failure, not as a failed implementation.

### Continuous Validation

Do not wait until the end of a large change to discover that the branch drifted.

- for multi-file or non-trivial work, run the relevant checks before each commit, not only before handoff
- when code movement changes test layout, confirm the normal repo runners still pick up the affected tests
- when adding a new test file pattern or directory, make sure the configured runner includes it
- if a step cannot yet pass validation, shrink the step until it can

### PR Readiness

Treat pull requests as reviewable engineering work, not speculative drafts with known unverified edges hidden inside them.

- Before opening or updating a PR, make sure every new script or validation command added by the branch is runnable by a contributor following repo docs.
- In the PR description, explain why the change is worth merging: name the
  concrete maintainability, correctness, user, or operational value that
  outweighs the added diff and review cost.
- In the PR description, state the expected user-behavior difference from the branch in plain language.
- If the branch changes user behavior, describe what a user can now do differently or what flow now behaves differently.
- If the branch does not change current user behavior, say that explicitly and describe the groundwork laid for a later stage.
- For new test runners or test directories, confirm the existing runners do not accidentally pick them up or conflict with them.
- If a helper script depends on local tools such as Docker, Deno, Playwright, or the Supabase CLI, either make the script self-checking with clear failure messages or document the setup in the same change.
- For new helper scripts that start local services or background processes, validate teardown as well as setup so CI cannot hang after the assertions already passed.
- Prefer fixing local workflow blockers in the repo when reasonable instead of relying on CI to be the first real execution environment.
- If a PR is intentionally still exploratory, keep it clearly framed as draft work and do not present it as merge-ready.

### Regression Discipline

When a change touches testing infrastructure, validation commands, CI, or local setup, review it for operational regressions in addition to product regressions.

- make sure new validation commands do not silently depend on undeclared local state
- make sure new validation commands work from both fresh-start and warm-start local states when that distinction matters
- make sure browser tests are deterministic about which backend path they exercise
- make sure helper scripts are safe to rerun and fail with actionable guidance
- make sure helper scripts emit enough progress logging and bounded timeouts to debug CI stalls
- make sure CI does not pay heavyweight setup costs earlier than necessary
- make sure local validation steps do not mutate workspace state in ways that break later commands

## UI Review Runs

If you validate the UI by running the app locally and taking screenshots:

- use Playwright rather than code-only visual guesses whenever browser automation is feasible
- prefer a real browser pass over code-only visual guesses
- use a mobile viewport first because the attendee flow is mobile-first
- confirm direct route loading as well as the main click-through flow
- capture the key states you are reviewing, not just the landing page

If a change modifies UX, layout, interaction flow, or user-facing copy in a meaningful way:

- capture relevant before screenshots before editing when browser automation is feasible
- capture matching after screenshots after the implementation is complete
- use the same routes, states, viewport, and scroll context for the before/after pair whenever practical
- include a before/after comparison in the pull request description, not just a prose summary
- treat this as part of the expected review flow for UX-facing pull requests, not as an optional polish step

Prefer the reusable capture workflow already in the repo:

- keep reusable automation logic in `scripts/ui-review/`
- use `scripts/ui-review/capture-ui-review.cjs` as the default screenshot workflow
- extend that script when future verification needs new routes, states, or capture scenarios instead of creating one-off temp scripts unless the task is truly experimental

Expected setup and execution:

- start the web app locally, usually on `http://127.0.0.1:4173`
- make sure Playwright and its browser dependency are available
- if Chromium has not been installed yet, run `npx playwright install chromium`
- run `npm run ui:review:capture`

Backend nuance:

- prefer remote Supabase-backed UI review when the project env vars are configured locally
- the normal backend-backed review path is a configured remote Supabase project tested from a local frontend via `npm run dev:web` or `npm run dev:web:local`
- if you use remote Supabase from a local web app, make sure the project `ALLOWED_ORIGINS` secret includes the local origin you are using
- if `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` are not configured locally, run UI review against the Vite dev server, not a production preview build
- the browser-only completion fallback is development-only and should only be used when explicitly enabled with `VITE_ENABLE_LOCAL_PROTOTYPE_FALLBACK=true`
- when you need a fixed host and port for Playwright, prefer `npm run dev:web:local`

Deployment expectations:

- use pull requests plus GitHub CI before merging to `main`
- treat dashboard-only production edits as out of bounds unless they are immediately reconciled back into repo migrations or function source

The capture script supports future reuse:

- it writes screenshots into a timestamped folder under `tmp/ui-review/`
- it accepts `--base-url` when the local app is running on a different origin
- it accepts `--output-dir` when a task needs a specific artifact location

Recommended UX-change screenshot process:

1. Run the capture flow before making changes and save the images in a dedicated timestamped folder such as `tmp/ui-review/<timestamp>-before/`.
2. Make the UX change.
3. Run the same capture flow again and save the images in a separate folder such as `tmp/ui-review/<timestamp>-after/`.
4. Select the key comparison images for the PR, usually mobile-first screens and any important error, completion, or edge states touched by the change.
5. Keep the raw screenshots in `tmp/` only; do not move them into tracked repo paths.

Treat screenshot artifacts as temporary analysis output.

- write screenshots under `tmp/`
- do not commit generated screenshots
- make sure the output path is ignored by git before finishing

Do not let one screenshot run overwrite or mix with another accidentally.

The default expectation is one timestamped subfolder per run. Only reuse an existing output directory if the task explicitly benefits from overwriting a prior capture set.

Before finishing a UI-review task, make sure you do not leave behind ambiguous mixed runs that make later analysis harder.

## Pull Request Screenshot Process

When a PR should show screenshots, do not satisfy that by committing image artifacts into the repository.

Use this process instead:

1. Capture the images into `tmp/ui-review/` as described above.
2. Upload only the selected PR images to an external image host so the PR description can reference them by URL.
3. A working example used in this repo is:

```bash
curl -F "reqtype=fileupload" -F "fileToUpload=@tmp/ui-review/<run>/<image>.png" \
  https://catbox.moe/user/api.php
```

4. Paste the returned image URLs into the PR body with normal Markdown image syntax.
5. Keep the local screenshots untracked and temporary; do not add them to git, and do not create tracked docs-only image folders just to support the PR description.

This keeps the repo aligned with the rule that generated screenshots live under `tmp/` and are not committed, while still making before/after comparisons visible in review.

## Self-Review Checklist

Before finishing, review your own work for:

- correctness
- regressions in the existing attendee flow
- readability and maintainability
- duplicated logic
- stale comments or stale docs
- missing validation
- accessibility or usability regressions in the mobile flow
- whether the final change is still positive value for the codebase and should
  be merged, rather than being needless churn or adding noise that offsets its
  benefit

For any bounded checklist or refactor task, also confirm:

- the final diff stays inside the requested scope
- the checklist item or prompt can be mapped to concrete changed files
- any checklist status change is backed by target-shape evidence, not only by
  passing tests
- the handoff says whether behavior changed; for behavior-preserving tasks, the
  answer should be "no" or should explain why the task stopped
- the handoff lists validation actually run, files changed, follow-up tasks
  added, and any remaining risk or blocker

For UI changes, confirm:

- the flow still feels mobile-first and one-step-at-a-time
- direct route loading still works
- progress, answer selection, submission, and completion states still make sense
- browser tests still use realistic interactions unless there is a documented reason not to

For backend or trust-related changes, confirm:

- client input is still validated defensively
- shared quiz logic is still the source of truth where appropriate
- completion verification and entitlement behavior remain coherent

For testing and tooling changes, confirm:

- the new or changed commands work locally with the documented setup
- docs and PR descriptions accurately describe what the tests do and do not prove
- new validation paths are included in the self-review, not delegated entirely to CI

For multi-commit work, also review:

- whether each commit would make sense to a reviewer on its own
- whether a later commit silently fixed issues introduced by an earlier one
- whether any structural change remains undocumented

## Anti-Patterns

Avoid these unless the task explicitly requires them:

- large one-shot refactors with no written plan or intermediate checkpoints
- letting tests lag behind renamed, moved, or restructured code
- deferring all validation until the final step of a long change
- undocumented module splits, file moves, or ownership changes
- combining unrelated cleanup with the requested change
- using a final commit to clean up drift that should have been caught in earlier self-review
- treating a prompt as permission to skip the repo workflow

## Change Boundaries

Prefer targeted fixes over speculative refactors.

Do not introduce new frameworks, new backend services, or broad architecture rewrites unless the task clearly calls for that.

This repository is still in a focused MVP stage. Favor clarity, reliability, and maintainable incremental progress over premature platform expansion.
