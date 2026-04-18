# Operations Guide

## Purpose

This document tracks which platform settings should be treated as repo-managed source of truth and which settings should continue to be maintained manually in GitHub, Vercel, and Supabase.

Use it when:

- setting up a fresh deployment from a fork
- checking whether a dashboard edit should instead be a repo change
- monitoring or triaging a live event
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
| Supabase | `config.toml`, migrations, Edge Function source | project creation, runtime secret values, Auth URL settings, admin allowlist membership, org membership, billing, dashboard-only admin settings |

## Repo-Managed Settings

### GitHub

- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)
  CI behavior and required validation logic
- [`.github/workflows/release.yml`](../.github/workflows/release.yml)
  production Supabase promotion flow after successful CI on `main`
- [`.github/workflows/production-admin-smoke.yml`](../.github/workflows/production-admin-smoke.yml)
  production admin smoke validation after successful release, with manual reruns

### Vercel

- [`apps/web/vercel.json`](../apps/web/vercel.json)
  SPA route rewrites for `/admin` and `/event/:slug/game`, plus other supported project behavior
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
- [`docs/production-admin-smoke-tracking.md`](./production-admin-smoke-tracking.md)
  production admin smoke rollout policy, fixture ownership, and triage runbook

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
- GitHub `production` environment vars and secrets for production admin smoke:
  - required vars:
    - `PRODUCTION_SMOKE_BASE_URL`
    - `PRODUCTION_SMOKE_SUPABASE_URL`
    - `PRODUCTION_SMOKE_PUBLISHABLE_DEFAULT_KEY`
  - optional fixture override vars:
    - `PRODUCTION_SMOKE_ADMIN_EMAIL`
    - `PRODUCTION_SMOKE_DENIED_ADMIN_EMAIL`
    - `PRODUCTION_SMOKE_EVENT_ID`
    - `PRODUCTION_SMOKE_EVENT_SLUG`
    - `PRODUCTION_SMOKE_EVENT_NAME`
    - `PRODUCTION_SMOKE_ADMIN_REDIRECT_URL`
  - optional readiness tuning vars:
    - `PRODUCTION_SMOKE_READY_TIMEOUT_MS`
    - `PRODUCTION_SMOKE_READY_POLL_MS`
  - secrets:
    - `PRODUCTION_SMOKE_SUPABASE_SERVICE_ROLE_KEY`
- optional GitHub `production` environment approvals or reviewers

Why manual for now:

- workflows are repo-managed, but branch protection, environment approvals, and secret values still live in GitHub settings

Beta baseline settings for this repo's solo-operator workflow:

- keep pull requests optional on `main`
- do not require reviewer approvals
- allow force pushes for repository owner use cases such as docs-history cleanup
- block branch deletion on `main`
- require this status check on `main`:
  - `Lint, Tests, Build, and Supabase Checks / Lint, Tests, Build, and Supabase Checks`
- monitor `Release / Sync Supabase Production` as the post-CI production
  deployment gate; it runs after successful CI on `main` and should not be a
  pre-merge required branch check
- treat `Production Admin Smoke / Smoke Admin On Production` as post-release
  operational confidence, not a pre-merge required check

CI docs-only trigger policy:

- `.github/workflows/ci.yml` ignores markdown/docs-only diffs at the workflow
  trigger level
- docs-only pushes to `main` do not run CI and do not trigger the production
  Supabase release workflow
- any non-doc change continues to run full CI validation before release

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
- Auth URL configuration for magic-link sign-in:
  - deployed web origin as the Supabase Auth Site URL
  - local `/admin` redirect URLs
  - deployed `/admin` redirect URLs
- operational allowlist membership in `public.admin_users`
- any dashboard-managed settings not represented by migrations, functions, or `config.toml`

Why manual for now:

- migrations, functions, and function config are repo-friendly
- secret values, Auth URL settings, and environment-specific admin membership are not appropriate to store in the repo

## Fresh Deployment Checklist

For a new deployment from a fork:

1. Create a new Supabase project.
2. Run the repo-backed Supabase bootstrap commands from [`dev.md`](./dev.md).
3. Create a new Vercel project for the `apps/web` app.
4. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` in Vercel.
5. Set `SESSION_SIGNING_SECRET` and `ALLOWED_ORIGINS` in Supabase.
6. Set the Supabase Auth Site URL to the deployed web origin and add redirect
   URLs for your local and deployed `/admin` origins.
7. Insert at least one normalized admin email into `public.admin_users`.
8. Recreate the desired GitHub branch protection and Actions secret
   configuration, including the `SUPABASE_ACCESS_TOKEN`,
   `SUPABASE_DB_PASSWORD`, and `SUPABASE_PROJECT_REF` release secrets.

## Live Monitoring And Log Triage

Current pre-launch posture:

- there is no dedicated live monitoring dashboard, uptime monitor, alerting
  service, or third-party error tracking SDK configured in the repo
- the release operator monitors manually through GitHub Actions, Vercel, and
  Supabase
- the `Production Admin Smoke` workflow is the strongest deployed-path signal
  currently available, but it runs after release or by manual dispatch; it is
  not continuous monitoring

Use this runbook during a live event or final pre-event check when someone
reports that the site, quiz start, completion flow, or admin publishing is not
working.

### First Signal: Production Smoke

Start with GitHub Actions:

1. Open the `Production Admin Smoke` workflow.
2. Check the latest run for the release candidate or `main`.
3. If needed, run it manually with `workflow_dispatch`.
4. Read the failing step before changing platform settings.

Interpretation:

- readiness failures usually point at Vercel deployment propagation, a bad
  `PRODUCTION_SMOKE_BASE_URL`, or route availability
- auth/session failures usually point at Supabase Auth Site URL, redirect URLs,
  or session setup
- save/publish/unpublish failures usually point at Supabase Edge Functions,
  database policies, RPCs, or function secrets
- public route state failures usually point at frontend data loading, published
  event state, or slug mapping

Detailed smoke-specific triage lives in
[`production-admin-smoke-tracking.md`](./production-admin-smoke-tracking.md).

### Site And Frontend Checks: Vercel

Use Vercel for deployment and frontend availability questions:

1. Open the Vercel project for the web app.
2. Confirm the latest production deployment points at the expected Git commit.
3. Inspect deployment build logs if the site did not deploy.
4. Inspect runtime or project logs if a route loads incorrectly or returns an
   unexpected status.
5. Confirm the production URL from `PRODUCTION_SMOKE_BASE_URL` loads:

```bash
curl -I "$PRODUCTION_SMOKE_BASE_URL"
curl -I "${PRODUCTION_SMOKE_BASE_URL%/}/admin"
curl -I "${PRODUCTION_SMOKE_BASE_URL%/}/event/production-smoke-event/game"
```

Notes:

- this app is a Vite SPA, so most attendee/admin behavior runs in the browser
  and will not produce rich Vercel server logs
- Vercel logs are still useful for deployment state, build errors, route
  rewrites, and static asset availability
- browser console/network errors on an affected device are useful evidence when
  Vercel says the deployment is healthy

### Backend Checks: Supabase

Use Supabase for backend behavior, auth, function errors, and persisted event
activity.

Open the production Supabase project and inspect:

- Edge Function logs for:
  - `issue-session`
  - `complete-game`
  - `save-draft`
  - `publish-draft`
  - `unpublish-event`
- Auth configuration:
  - Site URL is the deployed web origin
  - redirect URLs include the deployed `/admin` origin
- project secrets:
  - `SESSION_SIGNING_SECRET`
  - `ALLOWED_ORIGINS`
- database logs when Edge Function logs indicate an RPC, policy, or migration
  failure

Function-specific interpretation:

- `issue-session` failures affect game start and usually involve origin
  allowlisting, event availability, request validation, or the best-effort
  `game_starts` write
- `complete-game` failures affect final verification and usually involve a
  missing/invalid session, answer validation, or completion/entitlement writes
- `save-draft`, `publish-draft`, and `unpublish-event` failures affect admin
  authoring and usually involve Supabase Auth, admin allowlist policy, draft
  persistence, or publish-state RPCs

### Database Activity Queries

Run these in the production Supabase SQL editor when you need to confirm
whether users are reaching the backend. Replace placeholders before running.

Recent game starts:

```sql
select
  event_id,
  count(*) as starts,
  max(issued_at) as latest_start
from public.game_starts
group by event_id
order by latest_start desc;
```

Recent completions:

```sql
select
  event_id,
  count(*) as completions,
  max(completed_at) as latest_completion
from public.game_completions
group by event_id
order by latest_completion desc;
```

Active entitlements:

```sql
select
  event_id,
  count(*) as active_entitlements
from public.game_entitlements
where status = 'active'
group by event_id
order by active_entitlements desc;
```

Event funnel by slug:

```sql
select
  e.id,
  e.slug,
  count(distinct s.client_session_id) as starts,
  count(distinct c.client_session_id) as completed_sessions,
  count(distinct r.client_session_id) filter (where r.status = 'active') as active_entitlements
from public.game_events e
left join public.game_starts s on s.event_id = e.id
left join public.game_completions c on c.event_id = e.id
left join public.game_entitlements r on r.event_id = e.id
where e.slug = '<event-slug>'
group by e.id, e.slug;
```

Smoke fixture state:

```sql
select
  id,
  slug,
  case when published_at is null then 'unpublished' else 'published' end as publish_state,
  published_at,
  updated_at
from public.game_events
where slug = 'production-smoke-event';
```

### Minute-Five Triage Path

If attendees report that the event is broken:

1. Check whether the production URL and event route load in a browser.
2. Check the latest `Production Admin Smoke` run.
3. If the site does not load, inspect Vercel deployment/build/runtime logs.
4. If the quiz loads but cannot start, inspect `issue-session` logs and query
   `game_starts`.
5. If the game starts but cannot complete, inspect `complete-game` logs and
   query `game_completions` plus `game_entitlements`.
6. If admin save/publish/unpublish is broken, inspect the admin Edge Function
   logs and Auth/allowlist configuration.
7. Record whether the failure is a deployment issue, frontend route issue,
   Supabase Auth/config issue, Edge Function issue, database/RPC issue, or data
   issue before changing settings.

If the event needs stronger operational coverage after this pre-launch
milestone, the next step is a separate observability project: uptime checks,
alert routing, browser error capture, and lightweight event reporting.

## Current Operating Discipline

For this repo today:

- treat `supabase/migrations/`, `supabase/functions/`, and `supabase/config.toml` as the backend source of truth
- treat GitHub workflow files as the source of truth for CI and release automation
- treat Vercel environment variable values and Supabase secret values as platform-managed
- treat production smoke fixture settings as manually managed production-environment configuration described in [`production-admin-smoke-tracking.md`](./production-admin-smoke-tracking.md)
- avoid manual production edits that do not get reconciled back into the repository

## Future Option

If the project grows into heavier operational complexity, consider a deliberate settings-as-code pass with Terraform or OpenTofu across GitHub, Vercel, and Supabase.

That should be treated as a separate infrastructure project, not as an ad hoc extension of the current MVP repo.
