# Operations Guide

## Purpose

This document tracks which platform settings should be treated as repo-managed source of truth and which settings should continue to be maintained manually in GitHub, Vercel, and Supabase.

Use it when:

- setting up a fresh deployment from a fork
- checking whether a dashboard edit should instead be a repo change
- reviewing what still has to be configured manually after merge-driven releases are in place

Contributor workflow details live in `dev.md`. Current system shape lives in `architecture.md`.

## Ownership Rule Of Thumb

Use this default:

- if a setting changes application behavior and can be represented safely in source control, prefer making it repo-managed
- if a setting is a secret, account-level control, billing/admin choice, or platform ownership detail, keep it manual and document it here

For this project today, that means:

- prefer repo changes for workflows, rewrites, migrations, functions, and function config
- keep secrets and platform-admin settings out of the repo
- avoid dashboard-only production hotfixes unless they are immediately reconciled back into source control

## Settings Ownership Matrix

| Platform | Repo-managed now | Manually maintained now |
| --- | --- | --- |
| GitHub | workflows, validation logic | branch protection, rulesets, required checks, reviewer policy, Actions secrets, environment approvals |
| Vercel | `vercel.json`, frontend build config | project creation, domains, env var values, deployment protection, team access |
| Supabase | `config.toml`, migrations, Edge Function source | project creation, runtime secret values, org membership, billing, dashboard-only admin settings |

## Repo-Managed Settings

### GitHub

- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)
  CI behavior and required validation logic
- [`.github/workflows/release.yml`](../.github/workflows/release.yml)
  production Supabase promotion flow after successful CI on `main`

### Vercel

- [`apps/web/vercel.json`](../apps/web/vercel.json)
  SPA route rewrites and other project behavior supported by `vercel.json`
- [`apps/web/package.json`](../apps/web/package.json)
  frontend build commands
- [`apps/web/vite.config.ts`](../apps/web/vite.config.ts)
  Vite build behavior that determines what Vercel builds and serves

### Supabase

- [`supabase/config.toml`](../supabase/config.toml)
  Edge Function config that belongs in Supabase CLI configuration
- [`supabase/migrations`](../supabase/migrations)
  database schema, RPCs, and backend hardening
- [`supabase/functions`](../supabase/functions)
  Edge Function runtime code

### Contributor Setup Contract

- [`apps/web/.env.example`](../apps/web/.env.example)
  local frontend env contract
- [`README.md`](../README.md)
  project entrypoint and quick-start guidance
- [`docs/dev.md`](./dev.md)
  workflow, validation, release, and troubleshooting guidance

## Manually Maintained Settings

### GitHub

- branch protection or rulesets for `main`
- required status checks
- required reviewers or conversation resolution settings
- repository merge policy
- GitHub Actions secrets:
  - `SUPABASE_ACCESS_TOKEN`
  - `SUPABASE_DB_PASSWORD`
  - `SUPABASE_PROJECT_REF`
- optional GitHub `production` environment approvals or reviewers

Why manual for now:

- workflows are repo-managed, but branch protection, environment approvals, and secret values still live in GitHub settings

### Vercel

- Vercel project creation and linking
- project root/build settings for the deployed app
- domains and DNS
- deployment protection settings
- environment variable values:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- access control, team membership, and billing settings

Why manual for now:

- `vercel.json` and frontend build config belong in the repo, but project linkage, secret values, domain ownership, and account-level controls do not

### Supabase

- Supabase project creation
- org/team membership and billing settings
- runtime secret values:
  - `SESSION_SIGNING_SECRET`
  - `ALLOWED_ORIGINS`
- any dashboard-managed settings not represented by migrations, functions, or `config.toml`

Why manual for now:

- migrations, functions, and function config are repo-friendly
- secret values and project/account administration are not appropriate to store in the repo

## Fresh Deployment Checklist

For a new deployment from a fork:

1. Create a new Supabase project.
2. Run the repo-backed Supabase bootstrap commands from [`dev.md`](./dev.md).
3. Create a new Vercel project for the `apps/web` app.
4. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` in Vercel.
5. Set `SESSION_SIGNING_SECRET` and `ALLOWED_ORIGINS` in Supabase.
6. Recreate the desired GitHub branch protection and Actions secret configuration.

## Current Operating Discipline

For this repo today:

- treat `supabase/migrations/`, `supabase/functions/`, and `supabase/config.toml` as the backend source of truth
- treat GitHub workflow files as the source of truth for CI and release automation
- treat Vercel environment variable values and Supabase secret values as platform-managed
- avoid manual production edits that do not get reconciled back into the repository

## Future Option

If the project grows into heavier operational complexity, consider a deliberate settings-as-code pass with Terraform or OpenTofu across GitHub, Vercel, and Supabase.

That should be treated as a separate infrastructure project, not as an ad hoc extension of the current MVP repo.
