# Documentation Guide

This repo uses a small set of docs with intentionally different roles.

Use this page when you are deciding where to start reading or where a future doc change belongs.

## Folder Layout

The docs are organized by how each file is used, not by topic:

- `docs/` (flat): canonical evergreen docs that describe the current system.
  These are the files readers reach for most often and that `AGENTS.md` links to
  directly.
- `docs/plans/`: forward-looking design, strategy, and roadmap docs for bounded
  work that has not yet fully shipped. Includes feature plans, cross-cutting
  migrations, and release-readiness methodology.
- `docs/plans/archive/`: plans whose work has landed. Kept for historical
  context, not for active tracking.
- `docs/tracking/`: running-state checklists, audits, and trackers. These files
  grow and get items checked off as work happens.

When a new doc is added, place it by role: if it describes "what is", it is
flat; if it describes "what we will build next", it is a plan; if it is a
checklist or a running tracker, it is in `tracking/`.

## Start Here

If you want:

- a quick project overview and setup entrypoint, start with [../README.md](../README.md)
- the problem, users, goals, and success criteria, read [product.md](./product.md)
- the intended attendee and organizer experience, read [experience.md](./experience.md)
- the current system shape and trust boundaries, read [architecture.md](./architecture.md)
- the published-content milestone details and tradeoffs, read [plans/archive/database-backed-quiz-content.md](./plans/archive/database-backed-quiz-content.md)
- the historical quiz authoring plan, read [plans/archive/quiz-authoring-plan.md](./plans/archive/quiz-authoring-plan.md)
- the local workflow, validation commands, release flow, or troubleshooting steps, read [dev.md](./dev.md)
- proposed improvements to local validation, screenshot, PR, and agent workflow,
  read [tracking/dev-workflow-improvements.md](./tracking/dev-workflow-improvements.md)
- the testing strategy, current coverage snapshot, command-selection matrix, and rollout plan, read [testing.md](./testing.md)
- the platform ownership model and live monitoring runbook for GitHub, Vercel, and Supabase, read [operations.md](./operations.md)
- the analytics strategy, tool recommendations, and dashboard goals, read [plans/analytics-strategy.md](./plans/analytics-strategy.md)
- the unresolved product, UX, and workflow decisions, read [open-questions.md](./open-questions.md)
- the documentation maintenance plan, read [tracking/documentation-quality-checklist.md](./tracking/documentation-quality-checklist.md)
- the living release readiness plan and quality-check methodology, read [plans/release-readiness.md](./plans/release-readiness.md)

## Doc Ownership

Use these boundaries to keep the docs tidy:

- `README.md`
  repo overview, current milestone snapshot, quick-start entrypoint, and links to deeper docs
- `docs/product.md`
  why the product exists, who it serves, what success looks like, and what stays out of scope
- `docs/experience.md`
  UX goals, interaction rules, attendee flow, volunteer flow, and visual direction
- `docs/architecture.md`
  current implementation shape, runtime flow, data ownership, and trust boundaries
- `docs/plans/archive/database-backed-quiz-content.md`
  durable implementation reference for the published-content milestone, including
  schema decisions, tradeoffs, and deferred follow-up work
- `docs/plans/archive/quiz-authoring-plan.md`
  product, UX, and engineering plan plus current phase status for
  organizer/admin quiz creation, editing, preview, and publish workflows
- `docs/dev.md`
  how engineers work in the repo today: setup, validation, release flow, and troubleshooting
- `docs/tracking/dev-workflow-improvements.md`
  concrete follow-up tasks for improving local validation, screenshot capture,
  PR evidence, and agent workflow
- `docs/testing.md`
  what to test, where tests should run, what to mock, and what is intentionally overkill right now
- `docs/operations.md`
  what is repo-managed versus manually maintained across platforms, plus the
  current live monitoring and log-triage runbook
- `docs/open-questions.md`
  unresolved decisions that should stay explicit instead of being guessed in canonical docs
- `docs/plans/analytics-strategy.md`
  end goal of analytics, approaches, evaluation criteria, third-party tool guidance, and dashboard goals
- `docs/tracking/documentation-quality-checklist.md`
  recurring documentation maintenance checklist and quality-improvement plan
- `docs/tracking/code-refactor-checklist.md`
  small behavior-preserving refactor tasks for oversized files that have clear
  split points
- `docs/plans/release-readiness.md`
  living release readiness plan and senior-engineer quality-check methodology;
  coordinates with the other trackers rather than duplicating them

## Editing Rule Of Thumb

When two docs seem likely to overlap:

- put the deeper explanation in the doc that owns the topic
- keep the other doc short and link to the owner
- prefer one canonical setup or release procedure instead of repeating the same steps in multiple places

That keeps the docs easier to scan at the end of a milestone and easier to trust at the start of the next one.
