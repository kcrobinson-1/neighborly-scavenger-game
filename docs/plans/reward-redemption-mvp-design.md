# Reward Redemption MVP Design

## Purpose

Define an MVP feature that lets an event agent validate a quiz completion code
and mark the associated reward entitlement as redeemed.

This document focuses on:

- mobile-friendly in-person redemption operations
- minimal trusted backend changes to support entitlement redemption state
- attendee confirmation after redemption
- explicit MVP role boundaries for agent, organizer, and root-admin operations

## Why This Feature

Today attendees can finish the quiz and receive a verification code, but the
handoff still depends on manual human judgment. A redemption workflow should:

- reduce duplicate/manual claims during busy event traffic
- give volunteers a fast queue of unredeemed codes
- provide a trustworthy redeemed/not-redeemed state for operators and attendees
- keep the no-login attendee experience intact while adding operator controls

## MVP Goals

1. **Fast volunteer flow on mobile**
   A volunteer can find and redeem an attendee code in a few taps on a phone.
2. **Single source of truth for redemption**
   Redemption status is persisted in Supabase and enforced as idempotent.
3. **Attendee-visible confirmation**
   The attendee completion screen updates to show redeemed state after successful
   check-in.
4. **Operationally lightweight**
   Introduce event-scoped `agent` and `organizer` roles without expanding full
   root-admin access.

## Non-Goals (MVP)

- Full prize inventory management
- Multi-step claim workflows (e.g., pending, approved, fulfilled, canceled)
- Offline-first redemption sync
- Public attendee self-service redemption checks by URL
- Fraud-proof identity verification beyond possession of completion code

## Actors

- **Attendee**: completes quiz and presents completion code.
- **Agent**: validates/redeems completion codes for assigned event(s).
- **Organizer**: manages non-redemption event operations for assigned event(s)
  with a constrained MVP permission set.
- **Root admin**: has global operational oversight and manages role assignment.

## Role And Access Model (MVP Decision)

The MVP redemption workflow **must not** reuse full root-admin access.

- create a distinct authenticated **agent** role for redemption operations
- create a distinct authenticated **organizer** role for non-redemption event
  operations
- scope both roles to one or more explicitly assigned events
- allow redemption lookup/redeem writes only for assigned `agent` users
- allow redemption reversal only for assigned `organizer` users via
  `/event/:slug/redemptions` (not visible from the agent redemption route)
- keep root-admin-only controls (global user/role management and cross-event
  operations) unavailable to agents and organizers

### Authorization architecture decision (MVP)

- use a hybrid enforcement model:
  - `SECURITY DEFINER` RPCs are the only allowed write path for redeem/reverse
  - RLS policies provide read scoping and defense-in-depth protections
- use Edge Functions as the mutation invocation boundary for client write calls;
  Edge Functions call the write RPCs and normalize response contracts
- do not rely on frontend route/button visibility as a security boundary

### Canonical SQL permission-helper contract (MVP decision)

- keep permission helpers in schema `public` for consistent use by RPCs and RLS
- use event-id based helpers (not slug based) to avoid lookup ambiguity inside
  policy/mutation paths
- helper signatures:
  - `public.is_agent_for_event(target_event_id uuid) returns boolean`
  - `public.is_organizer_for_event(target_event_id uuid) returns boolean`
  - `public.is_root_admin() returns boolean`
- read and write enforcement should call the same helpers so role logic does not
  drift between policy and RPC layers
- `redeem` authorization contract: `is_agent_for_event(...) OR is_root_admin()`
- `reverse` authorization contract:
  `is_organizer_for_event(...) OR is_root_admin()`

### MVP role-management decision

- manage agent/organizer assignments by direct SQL inserts in the database for
  MVP
- do not add role-management UI in this phase
- revisit self-serve role management and broader role expansion post-MVP

## Proposed UX Surfaces (MVP)

## 1) Agent Redemption Workspace (mobile first)

Route decisions (MVP):

- redemption should live on a **non-admin path**
- use event-scoped entry route: `/event/:slug/redeem`
- use separate monitoring route: `/event/:slug/redemptions`
- do not place this flow under `/admin` or behind admin UI navigation
- agent authentication and authorization gates should protect this route

### Considered route alternatives (not selected)

Alternative A:

- `/redeem/:slug`
  - pros: shorter URL, still event-scoped
  - cons: less consistent with existing `/event/:slug/...` hierarchy if adopted

Alternative B:

- `/agent/redeem?event=:slug`
  - pros: flexible single route shell
  - cons: query-param event context is easier to tamper with and harder to scan
    operationally than path-based context; requires stricter server-side scope
    validation messaging

Alternative C (least preferred for MVP):

- `/agent/redeem` + in-app event picker
  - pros: one bookmark for multi-event operators
  - cons: extra taps in the common single-event volunteer flow; increases
    wrong-event redemption risk without strong guardrails

Core interactions:

- select from assigned event(s) only (or auto-select when exactly one assignment
  exists)
- enter code suffix as exact 4-digit match
- optional recent/unredeemed list for quick lookup
- redeem action with explicit confirmation
- immediate success/failure feedback and duplicate-redeem messaging

### UX philosophy for `/event/:slug/redeem`

Treat the redeem screen as an operational check-in tool, not a consumer quiz
surface. UX priorities are:

- speed under pressure (short lines, noisy booth environment, one-handed use)
- accuracy and event-scope safety (avoid wrong-event/wrong-code mistakes)
- high operator confidence (clear state transitions and outcome certainty)

Mobile-first layout decision:

- use a split-screen interaction model on mobile:
  - top half = context and result panel
  - bottom half = persistent numeric keypad
- avoid relying on the OS keyboard for primary entry to reduce focus/scroll
  issues and accidental context loss during rapid use

Top-half content should consistently show:

- current event context badge (locked)
- code input preview and validation state
- result/status card for lookup/redeem outcome
- primary action state (`Lookup`, `Redeem`, `Redeem Next Code`)

Bottom-half keypad should provide:

- 0-9 large tap targets
- backspace and clear actions
- submit/confirm action with explicit disabled/loading states

#### Key view states and goals

1. **Before state (ready to enter code)**
   Goals:
   - confirm the agent is in the correct event
   - make code entry fast and unambiguous
   - make the next action obvious
   Required cues:
   - locked event badge
   - visible 4-digit entry slots/mask
   - clear primary action (`Lookup`) and secondary reset (`Clear`)

2. **Success state (redeemed or already redeemed)**
   Goals:
   - establish immediate trust for agent and attendee
   - prevent unnecessary duplicate actions
   - accelerate transition to the next attendee
   Required cues:
   - strong success status treatment
   - explicit outcome copy (`Redeemed` or `Already redeemed`)
   - timestamp and actor metadata
   - next-step CTA (`Redeem Next Code`)

3. **Rejected/error state (not redeemable now)**
   Goals:
   - explain failure without leaking sensitive cross-event details
   - provide a direct recovery path
   - keep operator pace and confidence
   Required cues:
   - distinct handling for `not_found`, `not_authorized`, and transient
     connectivity failures
   - generic invalid/not-found wording for non-matching event contexts
   - immediate recovery actions (`Try again`, `Clear`, `Retry`)

#### Tone and branding decision

- visual tone should be professional, calm, and operational (not playful)
- microcopy should be concise, direct, and low-ambiguity
- apply light brand alignment (typography/color tokens) so it feels part of the
  same product, but prioritize legibility, contrast, and state clarity over
  campaign-style branding

### 2) Agent Monitoring Workspace (separate from entry flow)

Agents need a separate monitoring view for operations/disputes.

- show redeemed and unredeemed entries in separate tabs (or filtered segments)
- support time-sorted list, quick lookup, and status filters
- keep this out of the primary code-entry screen to preserve rapid throughput

Suggested route shapes:

- `/event/:slug/redeem` -> fast code entry + redeem actions (primary)
- `/event/:slug/redemptions` -> monitoring/dispute list (secondary)

Considered alternative (not selected):

- `/event/:slug/redeem` with top tabs (`Enter`, `Monitor`) if product prefers a
  single route shell with segmented views

### UX philosophy for `/event/:slug/redemptions`

Treat the redemptions screen as a mobile dispute-resolution and audit surface.
It should optimize for fast verification and safe reversal under live-event
pressure.

Primary UX goals:

- find specific redemption records quickly on mobile
- verify redeemed/not-redeemed state with high operator confidence
- allow reversal safely for organizer/root-admin users only
- keep event context and filter state stable during rapid repeated checks

#### Mobile information architecture

- keep event context locked and visible at the top
- use a sticky search/filter bar under the event context
- default list sort should be newest first
- open record details in a bottom sheet so users do not lose list/search context

Suggested filter chips:

- `Last 15m`
- `Redeemed`
- `Reversed`
- `By me`

#### List-row requirements

Each row should show:

- code suffix (and full event-prefixed code where space allows)
- status badge (`redeemed`, `reversed`, `unredeemed`)
- timestamp (`redeemed_at` or `reversed_at`)
- actor hint (`redeemed_by` or `reversed_by`)

Row actions:

- `View details` for all users
- `Reverse` only when user role and record state allow it

#### Key view states and goals

1. **Before/search state**
   Goals:
   - make lookup intent obvious
   - support quick scan of recent activity
   Required cues:
   - suffix-first search affordance
   - sticky filters
   - empty-state guidance for no active filters/results

2. **Match found / verification state**
   Goals:
   - confirm status, time, and actor quickly
   - support booth dispute handling without navigation churn
   Required cues:
   - high-contrast status treatment
   - consistent metadata ordering (status -> time -> actor)
   - stable bottom-sheet detail view with close/return to same list position

3. **Reversal state**
   Goals:
   - prevent accidental high-risk writes
   - leave an auditable operator trail
   Required cues:
   - reversal only from detail sheet (not accidental one-tap from list row)
   - explicit confirmation step with code + event + prior status summary
   - required reason input before confirm
   - immediate post-action success/error feedback and refreshed status

#### Performance and scale expectations

Design for event-scale usage (hundreds to low-thousands of records) by:

- using paginated or cursor-based list loading
- debouncing search input and preserving filter state between refreshes
- showing last-updated/freshness timestamp in the monitoring header
- handling transient network errors with clear retry actions

#### Tone and branding decision

- use the same professional operational tone as `/event/:slug/redeem`
- keep branding light and consistent with attendee/admin surfaces
- prioritize readability, contrast, and state clarity over decorative treatment

### 3) Completion Screen Status (attendee)

On attendee completion screen:

- show current redemption status (`unredeemed` vs `redeemed`)
- when redeemed, show timestamped confirmation copy (e.g., "Redeemed at 2:14 PM")
- auto-refresh every 5 seconds while the screen is visible
- include a manual "Refresh status" action

## End-to-End MVP Flow

1. Attendee completes quiz and sees completion code.
2. Volunteer opens agent redemption workspace on mobile.
3. Volunteer enters the 4-digit code suffix and sees matching entitlement details.
4. Volunteer taps **Redeem**.
5. Backend validates agent auth and event scope, then atomically marks
   entitlement redeemed (idempotent).
6. Agent UI shows redeemed confirmation.
7. Attendee screen reflects redeemed state on next status refresh/poll.

## Completion Code Format (MVP Decision)

Use event-prefixed code format:

- `<event-acronym>-<4-digit-code>`
- examples: `MAD-0427`, `FALLFEST-9182`

Operational implications:

- on `/event/:slug/redeem`, the agent already has event context so the UI should
  prefill and lock the acronym prefix
- the agent only types the 4-digit suffix
- backend still validates full-code uniqueness and event matching

### Implementation prerequisite

The event-prefixed code format is delivered by a separate prerequisite feature
that must land before the redemption MVP implementation begins. At a minimum
that feature:

- adds an `event_code` column to `public.game_events`, authored at event
  creation, with a `UNIQUE` constraint, a `CHECK`-constrained shape
  (case-normalized, dash-free, bounded length), and an immutability lock once
  any entitlement references the event (following the existing slug lock
  trigger precedent)
- rewrites the verification-code generator to emit `<event_code>-<NNNN>` with
  a bounded retry loop on per-event suffix collisions, and adds
  `UNIQUE (event_id, verification_code)` on `game_entitlements` so per-event
  4-digit suffix uniqueness is DB-enforced rather than relying on entropy
- updates `publish-draft` / `public.publish_game_event_draft(...)` to refuse
  to publish an event that lacks a valid `event_code`
- coordinates the corresponding updates to the completion response shape,
  frontend completion screen copy, test fixtures, and Playwright expectations

Because the repo currently holds no production redemption data, this
prerequisite can backfill existing test events with dummy event codes rather
than designing a legacy-code migration path. The prerequisite feature owns its
own design doc, migration sequence, and rollback plan; the redemption MVP
inherits the resulting single-column, single-equality lookup contract.

## Data Model Proposal (MVP)

Extend reward entitlement records with redemption metadata.

The entitlement table is named `game_entitlements` (renamed from `game_entitlements` in the terminology migration Phase 2).

- `redeemed_at timestamptz null`
- `redeemed_by uuid null` (references authenticated agent identity)
- `redeemed_by_role text not null default 'agent'`
- `redeemed_event_id text not null` (must match entitlement event)
- `redemption_status text not null default 'unredeemed'` (`unredeemed`,
  `redeemed`)
- `redemption_reversed_at timestamptz null`
- `redemption_reversed_by uuid null`
- `redemption_reversed_by_role text null` (`organizer` or `root_admin`)
- `redemption_note text null` (optional, likely defer unless needed)

Constraints:

- one entitlement can transition from unredeemed -> redeemed
- reverse action can transition from redeemed -> unredeemed with audit trail
- repeated redeem requests are idempotent and return existing redeemed state
- repeated reverse requests are idempotent and return existing unredeemed state
- only authorized agent/root-admin service paths can redeem
- only authorized organizer/root-admin service paths can reverse redemption
- mutating identity must be scoped to the entitlement's event

If row-level mutation complexity increases, provide an RPC such as:

- `public.redeem_entitlement_by_code(event_slug text, code_suffix text)`
- `public.reverse_entitlement_redemption(event_slug text, code_suffix text, reason text)`

with DB-level enforcement and deterministic response shape.

## Backend Capability Proposal (MVP)

- Add a trusted redemption endpoint (Edge Function or RPC wrapper) that:
  - validates auth and agent event assignment
  - verifies event assignment scope
  - resolves event + code suffix to a single entitlement
  - performs atomic redeem update
  - treats cross-event lookups as `not_found` to avoid event-data leakage
  - returns a normalized response envelope: `{ outcome, result }`
  - redeem result codes:
    `redeemed_now`, `already_redeemed`, `not_found`, `not_authorized`,
    `internal_error`
  - reverse result codes:
    `reversed_now`, `already_unredeemed`, `not_found`, `not_authorized`,
    `internal_error`
  - note: no `event_mismatch` result for redeem in MVP (cross-event is
    intentionally mapped to `not_found`)
  - note: no `reason_required` or `reverse_not_allowed` result in MVP
  - requires organizer/root-admin authorization for reversal writes
  - executes writes through `SECURITY DEFINER` RPC paths only
  - is invoked through Edge Functions for all client-originated mutation calls

- Add a read endpoint/query for agent workspace:
  - exact 4-digit lookup within current event scope
  - paginated lists for both redeemed and unredeemed entries
  - filters/sorting for dispute handling

- Add attendee status read path:
  - returns redemption status for current completion code/session

## Frontend Capability Proposal (MVP)

### Agent UI

- Mobile-optimized form controls (large tap targets, numeric/uppercase-friendly
  code input)
- State badges for unredeemed/redeemed
- Error states for invalid code/not-found and already redeemed
- Guardrails for accidental double taps
- no reversal action available from the agent workspace

### Organizer UI

- Event-scoped operational workspace with constrained MVP controls
- Reversal action in `/event/:slug/redemptions` only, with confirmation and
  optional reason

### Attendee UI

- Redemption status panel on completion view
- Poll or refresh trigger for state updates
- Friendly copy when status cannot be refreshed

## Security + Trust Boundaries

- Redemption writes are trusted operations and must stay backend-only.
- Agent identity must use authenticated agent access, never attendee/public
  endpoints.
- Reversal writes must use authenticated organizer/root-admin access.
- Mutation authorization is enforced through RPC logic; RLS remains enabled for
  scoped reads and defense-in-depth.
- DB constraints/RPC semantics should enforce one-way state transitions,
  preventing race-condition double redemption.
- Auditability should capture who redeemed/reversed, from which role, and for
  which event.
- Additional device/session logging is out of scope for MVP.

## Attendee Status Update Strategy: Realtime vs Polling

### Option A: polling interval

Complexity: **low to medium**.

- implementation: completion page requests status every N seconds while visible
- backend load: predictable repeated reads
- operational fit: simple and robust during event Wi-Fi variance

Pros:

- straightforward to implement and debug
- no subscription lifecycle edge cases
- graceful degradation in constrained mobile networks

Cons:

- status freshness is bounded by poll interval
- more read traffic when many attendees keep screens open
- can feel delayed unless interval is aggressive (which increases load)

### Option B: realtime subscription

Complexity: **medium to high**.

- implementation: completion page subscribes to entitlement status changes
- backend/project setup: requires reliable realtime channel configuration and
  security policies
- operational fit: best freshness when connectivity is stable

Pros:

- near-immediate attendee updates after redeem/reverse actions
- lower unnecessary polling reads if channels remain healthy

Cons:

- more moving parts (subscription lifecycle, reconnect logic, stale clients)
- harder event-day troubleshooting when mobile connectivity is spotty
- requires careful auth + row-filtering design to avoid data leakage

### MVP decision

- start with **polling** every 5 seconds while completion screen is active
- add manual "Refresh status" control as fallback
- do not use realtime subscriptions in MVP
- keep realtime as post-MVP enhancement once event telemetry validates need

## MVP Validation Signals

Operational success at event:

- median volunteer redeem time <= 10 seconds once code is presented
- <2% of redemption attempts result in ambiguous/error outcomes requiring manual
  fallback
- attendees consistently see redeemed state within 5 seconds while the
  completion screen is open

## Rollout Suggestion

1. **Phase A**: backend schema + redeem/reverse RPC + seed agent manual path
2. **Phase B**: mobile agent workspace for lookup/redeem
3. **Phase C**: attendee completion status updates for redeemed state
4. **Phase D**: event dry run with volunteers and script

## Post-MVP Role Evolution (deferred)

- long-term direction may converge on organizers inheriting agent capabilities
  plus broader event controls, with root admins acting as global organizers plus
  cross-event/platform authorities
- keep this out of MVP implementation scope; revisit after event validation data

## Pre-Implementation Architecture Decision Checklist

Use this as an execution gate before writing the implementation plan.
Each item should be explicitly marked with a concrete decision (or intentional
deferral) and an owner.

### 1) Authorization model in the database

- Decided:
  - separate event-scoped `agent` and `organizer` roles
  - `agent` can redeem; `organizer`/`root_admin` can reverse
  - hybrid model: `SECURITY DEFINER` RPCs for writes + RLS for scoped reads
- Needs decision:
  - none
- Owner:
  - `@kcrobinson`

### 2) Trusted mutation boundary

- Decided:
  - redemption writes are backend-trusted operations
  - write path is RPC-only for redeem/reverse mutations
  - invocation boundary: Edge Function wrapper over write RPCs
  - client apps do not call write RPCs directly
- Needs decision:
  - none
- Owner:
  - `@kcrobinson`

### 3) Idempotency and concurrency contract

- Decided:
  - redeem and reverse operations must be idempotent
  - response contract uses `{ outcome, result }` envelope
  - `already_redeemed` and `already_unredeemed` are idempotent outcomes with
    `outcome=success` and distinct non-terminal `result` values
  - no `event_mismatch`, `reason_required`, or `reverse_not_allowed` in MVP
  - concurrent writes are resolved in a single transaction with row-level lock
    semantics before state transition checks
- Needs decision:
  - none
- Owner:
  - `@kcrobinson`

### 4) Audit data contract

- Decided:
  - include `redeemed_*` and `reversed_*` identity/timestamp metadata
  - no additional device/session logging in MVP
  - reversal reason is optional in MVP (no required-field enforcement)
  - no append-only redemption audit history table in MVP; the inline
    `redeemed_*` and `reversed_*` columns capture identity, role, and timestamp
    for the single legal transition cycle
    (`unredeemed -> redeemed -> unredeemed`), which is sufficient for MVP
    dispute handling
  - revisit as a post-MVP follow-up if live event data shows a need for
    attempt-level history (including failed or repeated cycles beyond the
    current inline fields)
- Needs decision:
  - none
- Owner:
  - `@kcrobinson`

### 5) Query model for `/event/:slug/redemptions`

- Decided:
  - mobile monitoring must support quick lookup, filtering, and recent-first scan
  - per-event 4-digit suffix uniqueness is delivered by the prerequisite
    feature described in the
    [Completion Code Format](#completion-code-format-mvp-decision) section:
    that feature rewrites `verification_code` to the event-prefixed format
    and adds `UNIQUE (event_id, verification_code)` on `game_entitlements`,
    so the redemption feature inherits a single-column equality lookup on the
    agent redeem path and on dispute lookup in the monitoring screen
  - pagination strategy: MVP uses a bounded single fetch of the most recent
    N redemption records per event (default `N = 500`, to be validated
    against anticipated pilot-event volume before first use and tunable by
    configuration). Filter chips (`Last 15m`, `Redeemed`, `Reversed`,
    `By me`) and suffix-first search operate client-side against that
    cached slice, so filter changes are instant and do not round-trip to
    the server. When the cap is hit, the UI shows a visible
    "showing most recent N" affordance and prompts the operator to narrow
    the time or status window for older records.
  - post-MVP upgrade path for pagination: cursor (keyset) pagination on
    `(redeemed_at DESC, id DESC)` with a matching index, triggered when
    real event data approaches the cap (for example, multiple pilot events
    producing more than ~400 redemptions each) or when the
    "showing most recent N" affordance is regularly hit. Named here so the
    handoff to post-MVP is explicit and the MVP doesn't quietly become the
    long-term shape.
  - index plan: minimalist. The redemption MVP migration adds exactly one
    new B-tree index, `(event_id, redeemed_at DESC NULLS LAST)` on
    `game_entitlements`, which covers the default recent-first list,
    the `Last 15m` filter, and the `Redeemed` filter. The `Reversed`,
    `By me`, and suffix-search query patterns are intentionally served by
    event-scoped scans in MVP — at the stated scale of hundreds to
    low-thousands of records these scans run in milliseconds and do not
    justify extra write amplification. Add partial or functional indexes
    for those patterns post-MVP only when EXPLAIN plans against real
    event data show they are needed.
- Needs decision:
  - none
- Owner:
  - `@kcrobinson`

### 6) Code lookup and non-leakage behavior

- Decided:
  - use `<event-acronym>-<4-digit-code>` with event-scoped lookup
  - cross-event mismatches should not leak details
  - normalization/canonicalization rules for lookup input:
    - the event-acronym prefix is derived from the event record on
      `/event/:slug/redeem` and is not user-entered; only the 4-digit suffix
      crosses the trust boundary on the redeem path
    - the suffix is trimmed of leading/trailing whitespace before validation
    - the suffix must match `^\d{4}$`; any other shape is rejected client-side
      and server-side with the same `not_found` result envelope (never with a
      distinct "invalid format" leak)
    - on `/event/:slug/redemptions`, a full-code dispute lookup accepts an
      optional dash between acronym and suffix, uppercases the acronym, trims
      surrounding whitespace, and then splits on the final 4-digit group; any
      prefix that does not match the locked event acronym is treated as a
      cross-event mismatch (see below) rather than as an error
  - exact response contract for non-matching event context:
    - redeem: `{ outcome: "failure", result: "not_found" }`, identical to an
      unknown code in the current event
    - reverse: `{ outcome: "failure", result: "not_found" }`, identical to an
      unknown code in the current event
    - no acronym, slug, or existence hint about the other event is ever
      returned, logged to the client, or surfaced in error copy
    - server-side telemetry may distinguish cross-event attempts internally for
      fraud investigation, but that distinction must not reach the client
      response body or HTTP status
- Needs decision:
  - none
- Owner:
  - `@kcrobinson`

### 7) Reversal policy enforcement

- Decided:
  - reversal is only available in `/event/:slug/redemptions`
  - reversal requires organizer/root-admin authorization
  - reversal reason is not required anywhere in MVP: the
    `redemption_note`/reason field remains nullable in the schema, neither the
    DB constraint layer nor the trusted RPC/API layer rejects missing reasons,
    and the UI encourages but does not block entry of a reason
  - reversal eligibility rules:
    - an entitlement is reversible if and only if its current
      `redemption_status` is `redeemed`
    - a reverse request against an entitlement already in `unredeemed` is
      idempotent and returns
      `{ outcome: "success", result: "already_unredeemed" }`
    - no time-window restriction in MVP: a reversal is permitted at any time
      the entitlement is in `redeemed`, regardless of how long ago
      `redeemed_at` was; this matches the dispute-handling goal of the
      monitoring screen and keeps the RPC to a single idempotent state check
    - after a reversal, the entitlement is eligible for a new redemption
      through the normal redeem path; the inline `redeemed_*` and `reversed_*`
      columns capture only the most recent cycle, consistent with item 4
- Needs decision:
  - none
- Owner:
  - `@kcrobinson`

### 8) Frontend data synchronization strategy

- Decided:
  - attendee status uses polling every 5 seconds; no realtime in MVP
  - cache invalidation/refresh strategy across `/redeem` and `/redemptions`:
    - `/event/:slug/redeem` holds no persistent lookup cache between codes; on
      a successful redeem or a `not_found`/`not_authorized` result, the local
      input and lookup state are cleared so the next attendee starts from a
      clean state
    - `/event/:slug/redemptions` refetches the active filter/page on: initial
      mount, filter change, explicit pull-to-refresh or retry action, and
      after a successful reversal from the detail bottom sheet
    - after a reversal, the detail bottom sheet re-reads the single record by
      id so the status badge, actor, and timestamp reflect the new state
      before the list refetch resolves
    - the two screens do not share cache invalidation across tabs or devices:
      agents and organizers typically operate on separate devices, and
      redemption writes always go through the Edge Function RPC boundary, so
      cross-screen reconciliation is handled by the next refetch on each
      surface rather than by a shared client cache
    - the attendee completion screen replaces its redemption snapshot on each
      5-second poll tick; it does not accumulate or merge prior snapshots
  - visibility/offline/error retry behavior contract:
    - polling respects the Page Visibility API: the attendee 5-second poll is
      paused when the tab becomes hidden and resumes with one immediate
      refresh on the next `visibilitychange` to `visible`
    - `/event/:slug/redemptions` does not auto-poll; it is operator-driven and
      refreshes only on explicit user actions and after mutations
    - transient network errors (5xx, network failure) on redeem, reverse,
      list, or status reads show a non-dismissive inline banner with an
      explicit `Retry` action; one automatic retry with ~2s backoff is
      allowed before the banner persists
    - offline detection (`navigator.onLine === false` or repeated failures)
      puts primary actions into a disabled state with an "You are offline"
      explanation; on reconnect, a single reconcile fetch is fired before
      re-enabling actions
    - the monitoring header shows a "last updated at" timestamp so operators
      can see freshness at a glance; the attendee completion screen shows the
      equivalent via its own `Refresh status` affordance
- Needs decision:
  - none
- Owner:
  - `@kcrobinson`

### 9) Operational role-management path

- Decided:
  - role assignments are managed via direct SQL inserts in MVP
  - canonical SQL scripts/runbook shape and ownership:
    - canonical location is a tracked directory at
      `supabase/role-management/` containing:
      - a `README.md` that documents the role model, required inputs
        (user id or email, event slug/id, role), and the execution process
      - versioned, parameterized SQL snippet files (e.g.
        `assign-agent.sql`, `assign-organizer.sql`, `revoke-assignment.sql`)
        that use `INSERT ... ON CONFLICT DO NOTHING` for idempotency and
        explicit `DELETE ... RETURNING` for revocation
    - every role change lands through a reviewed pull request so the commit
      history is the audit trail; no role change is applied from a local-only
      script
    - the runbook names `@kcrobinson` as the reviewer/executor for MVP
  - revocation and audit process for manual role changes:
    - revocation deletes by `(user_id, event_id, role)` from the role
      assignment table, in the same PR-reviewed flow as assignment
    - the PR description is required to state who requested the change, which
      event, and why; this is the MVP audit record
    - there is no self-serve revocation path and no automated review cadence
      in MVP; a post-MVP follow-up can add a role-change log table or a
      dedicated admin UI if manual volume grows
- Needs decision:
  - none
- Owner:
  - `@kcrobinson`

### 10) Migration and rollout sequence

- Decided:
  - MVP lands as backend + mobile redemption + monitoring + attendee status phases
  - backward-compatible migration order and deployment gates:
    1. schema additions: all new columns on `game_entitlements`
       (`redeemed_at`, `redeemed_by`, `redeemed_by_role`, `redeemed_event_id`,
       `redemption_status default 'unredeemed'`,
       `redemption_reversed_at`, `redemption_reversed_by`,
       `redemption_reversed_by_role`, `redemption_note`) land as nullable
       or defaulted columns, plus the new monitoring B-tree index
       `(event_id, redeemed_at DESC NULLS LAST)` from item 5; the
       role-assignment table(s) are created empty. The per-event 4-digit
       uniqueness constraint on `game_entitlements.verification_code` is
       provided by the prerequisite feature described in the
       [Completion Code Format](#completion-code-format-mvp-decision)
       section and is not part of this MVP migration sequence
    2. permission helpers: `public.is_agent_for_event(uuid)`,
       `public.is_organizer_for_event(uuid)`, and `public.is_root_admin()` are
       added before any policy or RPC references them
    3. write RPCs: `public.redeem_entitlement_by_code(...)` and
       `public.reverse_entitlement_redemption(...)` ship as
       `SECURITY DEFINER` with row-level locking and the
       `{ outcome, result }` envelope
    4. RLS policies: scoped read policies on `game_entitlements` and the
       role-assignment table(s) are enabled; existing attendee/public flows
       remain behaviorally unchanged
    5. Edge Functions: redeem and reverse wrappers plus the attendee
       redemption-status read path deploy, calling the RPCs added in step 3
    6. frontend: `/event/:slug/redeem` and `/event/:slug/redemptions` routes
       deploy behind an unadvertised entry (no nav links, not linked from
       `/admin`) so they are inert until roles are seeded
    7. role seeding: the runbook from item 9 seeds a single pilot event's
       agent/organizer assignments via a reviewed PR
    8. dry run: a volunteer dress rehearsal exercises redeem and reverse on
       the pilot event before general rollout
  - deployment gates between phases:
    - steps 1-3 (schema + helpers + RPCs): `npm test`,
      `npm run test:functions`, and `deno check --no-lock` on any touched
      function file must pass; a migration-reversal dry run against a
      Supabase branch project must succeed before merge to `main`
    - step 5 (Edge Functions): `deno check --no-lock` on each new handler
      must pass; the new RPC paths must be exercised by function tests
      against the branch project
    - step 6 (frontend): `npm run lint`, `npm run build:web`, and a
      Playwright mobile-viewport smoke covering agent lookup, redeem,
      reverse, and attendee status must pass
    - step 7 (role seeding): the runbook PR must be reviewed by `@kcrobinson`
      before apply
  - rollback strategy for schema + RPC changes:
    - schema: all redemption columns are nullable/defaulted additions, so a
      rollback leaves existing `game_entitlements` rows valid; if the
      columns must be removed, a follow-up migration drops them in the
      reverse order and drops the `(event_id, redeemed_at DESC NULLS LAST)`
      monitoring index added in step 1. The per-event 4-digit uniqueness
      constraint is owned by the prerequisite feature and is out of scope
      for this rollback plan
    - RPCs: rollback replaces the `redeem_*` and `reverse_*` RPC bodies with
      a safe-error no-op (`raise exception 'redemption not enabled'`) rather
      than dropping them, so the Edge Functions never 500 on a missing
      function; once clients have been redeployed off the redemption paths,
      a final drop migration may remove them
    - role-assignment tables: on rollback, truncate the assignment rows
      first so no role is silently left active; keep the table definitions
      unless a follow-up explicitly drops them
    - Edge Functions: redeploy the prior version from git history; the
      wrapper functions are additive and do not alter existing function
      contracts
    - frontend: revert the route components or hide them behind the same
      unadvertised entry used in step 6; direct navigation to
      `/event/:slug/redeem` and `/event/:slug/redemptions` should render a
      not-available state rather than a broken page during rollback
    - no destructive data migration: redemption history captured in the
      inline columns is preserved across both rollout and rollback
- Needs decision:
  - none
- Owner:
  - `@kcrobinson`

## Suggested Next Step

Convert this design into a scoped implementation plan with:

- final data contract decisions
- route/API decisions
- SQL migration plan
- explicit validation commands and test additions
