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

## Data Model Proposal (MVP)

Extend reward entitlement records with redemption metadata.

Current schema naming still uses `raffle_entitlements`; MVP implementation
should preserve compatibility short term while introducing neutral
"entitlement" language in product/UI/API contracts, then migrate naming later.

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
  - returns normalized statuses: `redeemed_now`, `already_redeemed`, `not_found`,
    `not_authorized`
  - supports a reversible action with statuses:
    `reversed_now`, `already_unredeemed`, `reverse_not_allowed`
  - requires organizer/root-admin authorization for reversal writes

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
  reason

### Attendee UI

- Redemption status panel on completion view
- Poll or refresh trigger for state updates
- Friendly copy when status cannot be refreshed

## Security + Trust Boundaries

- Redemption writes are trusted operations and must stay backend-only.
- Agent identity must use authenticated agent access, never attendee/public
  endpoints.
- Reversal writes must use authenticated organizer/root-admin access.
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
- Needs decision:
  - final enforcement shape (`RLS`, `SECURITY DEFINER` RPCs, or both)
  - canonical SQL permission-check helpers and naming
- Owner:
  - `TBD`

### 2) Trusted mutation boundary

- Decided:
  - redemption writes are backend-trusted operations
- Needs decision:
  - single write path: Edge Function wrapper over RPC vs direct RPC client calls
  - prohibition of alternate write paths once chosen
- Owner:
  - `TBD`

### 3) Idempotency and concurrency contract

- Decided:
  - redeem and reverse operations must be idempotent
- Needs decision:
  - lock/update strategy for concurrent writes
  - exact status contract for duplicate and racing requests
- Owner:
  - `TBD`

### 4) Audit data contract

- Decided:
  - include `redeemed_*` and `reversed_*` identity/timestamp metadata
  - no additional device/session logging in MVP
- Needs decision:
  - whether MVP also requires append-only audit history rows
  - whether reversal reason is required at DB-level constraint vs API-only check
- Owner:
  - `TBD`

### 5) Query model for `/event/:slug/redemptions`

- Decided:
  - mobile monitoring must support quick lookup, filtering, and recent-first scan
- Needs decision:
  - pagination strategy (cursor vs offset)
  - index plan for event/status/time/suffix query patterns
- Owner:
  - `TBD`

### 6) Code lookup and non-leakage behavior

- Decided:
  - use `<event-acronym>-<4-digit-code>` with event-scoped lookup
  - cross-event mismatches should not leak details
- Needs decision:
  - final normalization/canonicalization rules for lookup input
  - exact response contract for non-matching event context
- Owner:
  - `TBD`

### 7) Reversal policy enforcement

- Decided:
  - reversal is only available in `/event/:slug/redemptions`
  - reversal requires organizer/root-admin authorization
- Needs decision:
  - whether to enforce "reason required" in DB constraints or trusted API layer
  - reversal eligibility rules for already-reversed/recently-redeemed edge cases
- Owner:
  - `TBD`

### 8) Frontend data synchronization strategy

- Decided:
  - attendee status uses polling every 5 seconds; no realtime in MVP
- Needs decision:
  - exact cache invalidation/refresh strategy across `/redeem` and `/redemptions`
  - visibility/offline/error retry behavior contract for monitoring screens
- Owner:
  - `TBD`

### 9) Operational role-management path

- Decided:
  - role assignments are managed via direct SQL inserts in MVP
- Needs decision:
  - canonical SQL scripts/runbook shape and ownership
  - revocation and audit process for manual role changes
- Owner:
  - `TBD`

### 10) Migration and rollout sequence

- Decided:
  - MVP lands as backend + mobile redemption + monitoring + attendee status phases
- Needs decision:
  - backward-compatible migration order and deployment gates
  - rollback strategy for schema + RPC changes
- Owner:
  - `TBD`

## Suggested Next Step

Convert this design into a scoped implementation plan with:

- final data contract decisions
- route/API decisions
- SQL migration plan
- explicit validation commands and test additions
