# Agent Instructions

This file gives repository-specific guidance to AI coding agents working in this project.

Use it as a practical checklist for making changes that stay aligned with the current architecture, documentation, and product stage.

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

Use `docs/product.md` and `docs/experience.md` as product and UX targets, not as proof that every planned feature already exists.

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

## Expected Workflow

When asked to make a change:

1. Read the relevant code and the matching docs before editing.
2. Make the smallest coherent change that solves the task cleanly.
3. Review your own diff before finishing.
4. Update comments and documentation if the change affects behavior, architecture, setup, or workflow.
5. Run the relevant validation commands before handing off.

If you discover that the current docs no longer describe the code accurately, fix the docs in the same change when practical.

## Documentation Expectations

Keep documentation synchronized with the implementation.

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

Update inline comments and function/type documentation when:

- behavior changes in a non-obvious way
- new logic would be hard to understand without context
- a documented function, type, or data structure changes meaningfully

Do not add comments that merely restate the code.

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

## UI Review Runs

If you validate the UI by running the app locally and taking screenshots:

- use Playwright rather than code-only visual guesses whenever browser automation is feasible
- prefer a real browser pass over code-only visual guesses
- use a mobile viewport first because the attendee flow is mobile-first
- confirm direct route loading as well as the main click-through flow
- capture the key states you are reviewing, not just the landing page

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
- the normal backend-backed path is remote Supabase plus `npm run dev:web`, or `npm run dev:web:local` when a fixed origin helps browser automation
- if you use remote Supabase from a local web app, make sure the project `ALLOWED_ORIGINS` secret includes the local origin you are using
- if `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` are not configured locally, run UI review against the Vite dev server, not a production preview build
- the browser-only completion fallback is development-only and should only be used when explicitly enabled with `VITE_ENABLE_LOCAL_PROTOTYPE_FALLBACK=true`
- when you need a fixed host and port for Playwright, prefer `npm run dev:web:local`

The capture script supports future reuse:

- it writes screenshots into a timestamped folder under `tmp/ui-review/`
- it accepts `--base-url` when the local app is running on a different origin
- it accepts `--output-dir` when a task needs a specific artifact location

Treat screenshot artifacts as temporary analysis output.

- write screenshots under `tmp/`
- do not commit generated screenshots
- make sure the output path is ignored by git before finishing

Do not let one screenshot run overwrite or mix with another accidentally.

The default expectation is one timestamped subfolder per run. Only reuse an existing output directory if the task explicitly benefits from overwriting a prior capture set.

Before finishing a UI-review task, make sure you do not leave behind ambiguous mixed runs that make later analysis harder.

## Self-Review Checklist

Before finishing, review your own work for:

- correctness
- regressions in the existing attendee flow
- readability and maintainability
- duplicated logic
- stale comments or stale docs
- missing validation
- accessibility or usability regressions in the mobile flow

For UI changes, confirm:

- the flow still feels mobile-first and one-step-at-a-time
- direct route loading still works
- progress, answer selection, submission, and completion states still make sense

For backend or trust-related changes, confirm:

- client input is still validated defensively
- shared quiz logic is still the source of truth where appropriate
- completion verification and entitlement behavior remain coherent

## Change Boundaries

Prefer targeted fixes over speculative refactors.

Do not introduce new frameworks, new backend services, or broad architecture rewrites unless the task clearly calls for that.

This repository is still in a focused MVP stage. Favor clarity, reliability, and maintainable incremental progress over premature platform expansion.
