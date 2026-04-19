# Security And Abuse Plan

## Document Role

This document is the tracker of record for trust-boundary and abuse-control
planning.

Use it to track:

- how the system can be attacked technically (hacking/system abuse)
- how the game can be exploited behaviorally (entitlement farming/game abuse)
- what is explicitly accepted risk in MVP
- what controls are planned next and when

This is not a penetration-test report. It is a living plan that should be
updated as new abuse patterns are observed.

## Scope And Threat Model

Two attack classes are in scope:

- **System integrity attacks**:
  unauthorized writes, authz bypass, replay, endpoint abuse, data tampering
- **Game integrity attacks**:
  attempts to obtain extra entitlements without legitimate unique participation
  (for example by clearing browser state or switching browsers/devices)

Out of scope for MVP:

- strong identity proofing/KYC
- anti-cheat that requires heavy device fingerprinting
- complex fraud platforms and third-party risk engines

## Current Trust Boundary (MVP)

Current enforcement baseline:

- backend validation determines completion correctness
- entitlement award is server-side and idempotent per event/session pair
- redemption writes are backend-trusted and role-scoped
- role checks are DB-enforced (`admin`/`organizer`/`agent` model)

Current known limitation:

- no person-level dedupe for attendee participation
- clearing browser state or switching browsers/devices can still create
  additional session identities and therefore additional entitlements

This limitation is an explicit MVP tradeoff and is tracked here.

## Prioritized Goals

### Priority 1 (MVP): Prevent cheap high-impact abuse

- preserve backend trust invariants (no arbitrary client-side award path)
- prevent duplicate write effects via idempotency
- make abuse visible quickly through basic monitoring signals
- reduce high-volume endpoint hammering with pragmatic rate limits

### Priority 2 (post-MVP): Raise identity strength for entitlement claim

- add an identity checkpoint before final entitlement claim, starting with
  verified email collection and verification
- bind claim rights to a verified identity key, not only browser session state

### Priority 3 (later): Improve fraud detection and operator tooling

- suspicious-pattern dashboards/alerts
- explicit operator playbooks for abuse response during live events

## MVP Abuse Register

### A) Browser-state reset / browser swap for extra entitlements

- Attack: clear storage/cookies or switch browser/device to obtain new sessions.
- Impact: multiple entitlements for one person.
- Current controls:
  - one entitlement per event/session pair (not per person)
  - redemption operations require authenticated event staff
- MVP risk status: **accepted risk with monitoring**
- MVP mitigation plan:
  - monitor high-frequency starts/completions from the same origin patterns
  - monitor unusual entitlement-per-minute spikes per event
  - keep local prototype fallback disabled in production
- Post-MVP target mitigation:
  - verified email required to finalize entitlement claim

### B) Completion replay/tampering attempts

- Attack: replay completion requests or modify client payloads.
- Impact: duplicate awards or score manipulation.
- Current controls:
  - backend re-validates answers and scoring
  - idempotent completion semantics and constrained entitlement award path
- MVP risk status: **mitigated by current trust path**
- Follow-up:
  - keep DB-level uniqueness and idempotency tests in CI/local validation

### C) Redemption code guessing / lookup abuse

- Attack: brute force code suffixes or spam lookup endpoints.
- Impact: false positive lookups, operator slowdown, potential abuse attempts.
- Current controls:
  - authenticated role-gated redemption routes
  - event-scoped lookup behavior with non-leaking `not_found` handling
- MVP risk status: **partially mitigated**
- MVP mitigation plan:
  - add pragmatic request rate limits for redeem/reverse endpoints
  - log and review repeated failed lookup bursts

### D) Role abuse or privilege escalation

- Attack: non-authorized users attempt organizer/agent operations.
- Impact: unauthorized redemption/reversal or content changes.
- Current controls:
  - DB-enforced role checks and scoped permissions
  - trusted write path through Edge Functions + RPCs
- MVP risk status: **mitigated by architecture; needs ongoing verification**
- Follow-up:
  - keep role-management changes auditable
  - keep permission checks centralized and tested

## MVP Control Plan (Pragmatic)

Minimum controls to add/verify during MVP hardening:

1. endpoint-level rate limits on issue-session, complete-game, redeem, reverse
2. abuse-observability queries/runbook for entitlement spikes and repeated
   failed lookup bursts
3. explicit incident response notes for live event operators (who checks what,
   where, and when)
4. regression coverage for idempotency and one-entitlement invariants

## Post-MVP Identity Hardening Direction

Planned direction:

- collect and verify an email address before final entitlement claim
- use verified email identity as an additional dedupe/control dimension
- keep privacy scope proportional to product scale; avoid over-collection

Open design questions for post-MVP implementation:

- when in the flow verification is required (pre-claim vs claim-time)
- whether unverified users can still complete gameplay but not claim entitlement
- recovery flow for users who cannot access email immediately at event time

## What To Avoid For Now

- deploying anti-fraud controls that add high friction to normal attendees
- relying on frontend-only checks for security decisions
- introducing heavy infrastructure or paid tooling before MVP abuse patterns are
  observed
- collecting extra PII without a clear abuse-reduction benefit

## Ownership And Tracking

- Open-question ownership:
  [`open-questions.md` — Trust Boundary And Abuse Controls](../open-questions.md)
- Backlog tracking:
  [`backlog.md` — Security notes baseline doc](../backlog.md)

## External References (Best-Practice Inputs)

- OWASP Threat Modeling Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Threat_Modeling_Cheat_Sheet.html
- OWASP REST Security Cheat Sheet (rate limiting, API protections):
  https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html
- OWASP API Security Top 10:
  https://owasp.org/API-Security/
- Supabase Auth general configuration (email confirmation):
  https://supabase.com/docs/guides/auth/general-configuration
- Supabase passwordless email/OTP behavior:
  https://supabase.com/docs/guides/auth/auth-email-passwordless
