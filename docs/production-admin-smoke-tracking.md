# Production Admin Smoke Tracking

## Purpose

This document is the source of truth for the production admin smoke workflow:

- why the workflow exists
- what it validates
- what it intentionally does not validate
- which settings and secrets must exist outside the repo
- how rollout and promotion gates are handled
- how to triage failures

This workflow complements local admin e2e (`npm run test:e2e:admin`). It does not replace local deterministic validation.

## Problem Statement

Local admin e2e proves the shipped admin workflow against a local Supabase stack, but it cannot prove deployed production behavior for:

- real Supabase Auth redirect behavior on the deployed web origin
- production `public.quiz_admin_users` allowlist enforcement
- deployed `save-draft`, `publish-draft`, and `unpublish-event` function path wiring
- release-time timing and integration behavior between Vercel deployment and Supabase promotion

Without a production smoke run, a release can pass local and CI checks but still ship a broken admin surface.

## Scope

### In Scope

The production smoke workflow verifies all of the following against a dedicated production smoke admin and smoke event:

1. Admin magic-link auth/session setup to `/admin`
2. Allowlisted admin can access drafts and workspace
3. Draft save path succeeds and persists expected state
4. Publish path succeeds and makes `/game/:slug` live
5. Unpublish path succeeds and returns `/game/:slug` to unavailable state
6. A signed-in non-allowlisted account is denied admin authoring access

### Out Of Scope

The first production smoke version intentionally excludes:

- broad role matrix testing
- cross-browser matrix testing
- visual snapshot baselines
- broad production data mutation outside the dedicated smoke event
- PR CI execution against shared production infrastructure

## Environment And Secret Contract

The workflow runs in the GitHub `production` environment.

### GitHub Environment Variables

- `PRODUCTION_SMOKE_BASE_URL`
  deployed web origin for smoke browser checks, such as `https://neighborly.example`
- `PRODUCTION_SMOKE_SUPABASE_URL`
  production Supabase URL
- `PRODUCTION_SMOKE_PUBLISHABLE_DEFAULT_KEY`
  production publishable key used by the admin app
- `PRODUCTION_SMOKE_ADMIN_EMAIL`
  dedicated allowlisted smoke admin account email
- `PRODUCTION_SMOKE_DENIED_ADMIN_EMAIL`
  dedicated non-allowlisted smoke account email
- `PRODUCTION_SMOKE_EVENT_ID`
  dedicated smoke event id
- `PRODUCTION_SMOKE_EVENT_SLUG`
  dedicated smoke event slug
- `PRODUCTION_SMOKE_EVENT_NAME`
  dedicated smoke event name
- `PRODUCTION_SMOKE_ADMIN_REDIRECT_URL` (optional)
  defaults to `<PRODUCTION_SMOKE_BASE_URL>/admin` when omitted

### GitHub Environment Secrets

- `PRODUCTION_SMOKE_SUPABASE_SERVICE_ROLE_KEY`
  service-role key used only for smoke fixture setup/readback assertions

### Supabase Runtime Requirements

- Auth Site URL and redirect URL must include the deployed `/admin` origin used by smoke
- `public.quiz_admin_users` allowlist must permit the smoke admin and deny the smoke denied user
- `ALLOWED_ORIGINS` must allow the deployed web origin used by smoke
- `save-draft`, `publish-draft`, and `unpublish-event` must be deployed and healthy

## Dedicated Smoke Fixture Ownership

The smoke workflow mutates only dedicated smoke identities and one dedicated smoke event.

Ownership model:

- release owner: confirms production smoke settings and manually reruns when needed
- repo maintainers: keep workflow/scripts/docs in sync with current admin behavior
- operations owner: rotates smoke accounts/keys and maintains environment vars/secrets

Rules:

- never point smoke env vars at organizer-owned live events
- keep smoke event slug clearly namespaced and non-user-facing
- treat smoke identities as operational test users, not contributor personal accounts

## Risk Register And Mitigations

| Risk | Why it matters | Mitigation in current implementation | Deferred follow-up |
| --- | --- | --- | --- |
| Release timing false failures | Smoke can start before deployment is fully ready | Readiness polling with bounded timeout before Playwright run | Add richer deployment-state signal if needed |
| Overlapping runs | Manual + automatic runs could race and fight over publish state | Workflow concurrency lock and single worker | Separate smoke events for parallel lanes if needed |
| Secret leakage in logs | Magic links include one-time auth tokens | Mask generated magic-link URLs and avoid trace/video capture | Add stricter artifact scrubbing if new attachments are introduced |
| Production mutation churn | Smoke changes publish status and draft state | Mutate only dedicated smoke event and reset state idempotently at run start | Add rotation/retention automation |
| Flaky remote checks | Network/auth timing can make remote checks noisy | Deterministic selectors, bounded retries, explicit failure categories | Add automated issue routing or retries policy |

## Rollout Phases And Promotion Gates

### Phase 1 (Docs)

Status: complete in repo.

- tracking doc created
- references added in backlog/testing/operations

### Phase 2 (Manual foundation)

Status: complete in repo.

- production-capable smoke harness added
- manual `workflow_dispatch` path added
- concurrency lock, readiness polling, masking, idempotent fixture setup, and single-worker execution added
- contributor docs updated with manual run and triage flow

Promotion gate to Phase 3:

- multiple successful manual production runs
- failures, when forced, map clearly to actionable categories

### Phase 3 (Post-release automation)

Status: enabled in repo.

- automatic post-release trigger enabled after successful `Release`
- manual `workflow_dispatch` rerun path retained
- backlog item closed and docs aligned

## Failure Triage Runbook

Start in GitHub Actions job logs for `Production Admin Smoke`.

1. **Readiness failure before Playwright starts**
   - likely deployment propagation or base URL misconfiguration
   - validate `PRODUCTION_SMOKE_BASE_URL` and deployed route health
2. **Auth redirect or session setup failure**
   - likely Supabase Auth Site URL/redirect mismatch
   - validate Auth URL settings and `PRODUCTION_SMOKE_ADMIN_REDIRECT_URL`
3. **Allowlist failure for smoke admin**
   - likely allowlist row drift or RLS/policy regression
   - inspect `public.quiz_admin_users` for smoke admin
4. **Expected deny check fails for denied user**
   - denied user may be accidentally allowlisted
   - ensure denied account remains inactive or absent in allowlist
5. **Save/publish/unpublish failure**
   - likely function deploy/config issue, RLS regression, or RPC failure
   - inspect Edge Function logs and recent release changes
6. **Public route state mismatch after publish/unpublish**
   - likely publish transaction drift or frontend route/data loading regression
   - verify event row state and slug mapping

Escalation owner order:

1. release owner on duty
2. repo maintainer for workflow/test harness
3. Supabase ops owner for project-level auth/secrets/runtime settings

## Residual Backlog Candidates

- auto-open issue or alert routing on smoke failure
- analytics/reporting exclusion for smoke event activity
- fixture rotation and retention automation for smoke identities/event
- broader remote smoke matrix only if operationally justified

## Related Files

- workflow: `.github/workflows/production-admin-smoke.yml`
- runner: `scripts/testing/run-production-admin-smoke.cjs`
- config: `playwright.production-admin-smoke.config.ts`
- spec: `tests/e2e/admin-production-smoke.spec.ts`
- fixture helper: `tests/e2e/admin-auth-fixture.ts`
