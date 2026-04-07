# Documentation Guide

This repo uses a small set of docs with intentionally different roles.

Use this page when you are deciding where to start reading or where a future doc change belongs.

## Start Here

If you want:

- a quick project overview and setup entrypoint, start with [../README.md](../README.md)
- the problem, users, goals, and success criteria, read [product.md](./product.md)
- the intended attendee and organizer experience, read [experience.md](./experience.md)
- the current system shape and trust boundaries, read [architecture.md](./architecture.md)
- the published-content milestone details and tradeoffs, read [database-backed-quiz-content.md](./database-backed-quiz-content.md)
- the proposed plan for organizer quiz creation and editing, read [quiz-authoring-plan.md](./quiz-authoring-plan.md)
- the local workflow, validation commands, release flow, or troubleshooting steps, read [dev.md](./dev.md)
- the testing strategy, coverage priorities, and rollout plan, read [testing.md](./testing.md)
- the platform ownership model for GitHub, Vercel, and Supabase settings, read [operations.md](./operations.md)

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
- `docs/database-backed-quiz-content.md`
  durable implementation reference for the published-content milestone, including
  schema decisions, tradeoffs, and deferred follow-up work
- `docs/quiz-authoring-plan.md`
  proposed product, UX, and engineering plan for organizer/admin quiz creation,
  editing, preview, and publish workflows
- `docs/dev.md`
  how engineers work in the repo today: setup, validation, release flow, and troubleshooting
- `docs/testing.md`
  what to test, where tests should run, what to mock, and what is intentionally overkill right now
- `docs/operations.md`
  what is repo-managed versus manually maintained across platforms

## Editing Rule Of Thumb

When two docs seem likely to overlap:

- put the deeper explanation in the doc that owns the topic
- keep the other doc short and link to the owner
- prefer one canonical setup or release procedure instead of repeating the same steps in multiple places

That keeps the docs easier to scan at the end of a milestone and easier to trust at the start of the next one.
