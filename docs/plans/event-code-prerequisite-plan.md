# Event Code Prerequisite Plan

**Status:** Phase 1 PR 1 implemented in branch; PR 2 and Phase 2 pending
**Blocks:** Reward Redemption MVP (`docs/plans/reward-redemption-mvp-design.md`)
**Sequencing note:** The Tier 1 terminology migration (`docs/plans/archive/terminology-migration-strategy.md`)
has completed its Phase 2 database rename in this branch. This plan now uses
the post-migration database names directly. Immutable historical artifact names
are cited verbatim only when referring to existing migration filenames.

## Summary

Introduce a new `event_code` attribute on every game event: a 3-letter prefix that the system generates at event creation and that an admin or organizer can override before publish. Rewrite entitlement code generation from `MMP-XXXXXXXX` to `<event_code>-NNNN` (4 numeric digits), producing codes shaped like `ABC-1234` — short enough for an attendee to read aloud and an agent to type on a keypad in seconds, with the prefix acting as inline event validation.

This prerequisite must land before the reward redemption MVP because the MVP design assumes a per-event prefix in the entitlement code string and hands per-event uniqueness enforcement to this feature rather than re-owning it.

## Goals

- Every `game_event_drafts` row and every `game_events` row has a non-null `event_code` matching `^[A-Z]{3}$` (exactly 3 uppercase letters).
- `event_code` is generated server-side at draft creation from the 17,576-code space with retry on collision. An admin or organizer can override it before publish by editing the field on the event details form.
- Once a draft has been published (i.e. `live_version_number is not null`), `event_code` is immutable — enforced both in the UI and at the database layer.
- Entitlement codes produced by `complete_game_and_award_entitlement` take the form `<event_code>-NNNN` where `NNNN` is exactly 4 numeric digits (0000–9999). Numeric was chosen over hex so an agent redeeming the code at an event can type it on a number pad without mode-switching. The 3-letter prefix acts as inline event validation — the full `ABC-1234` string is what the attendee reads and the agent hears.
- Verification codes are unique per event (`unique (event_id, verification_code)` on `game_entitlements`); the RPC retries on collision.
- Existing (testing-only) data is deterministically backfilled as `AAA`, `AAB`, `AAC`, … so no production-like data is disturbed.

## Non-Goals

- Redemption lookup, reversal, or dashboard surfaces — owned by the redemption MVP feature that builds on this.
- Rewriting already-issued `MMP-…` entitlements on testing data; they remain as historical records. Only codes issued after this feature ships adopt the new format.
- Case-insensitive entry, fuzzy match, or international alphabets in `event_code` — Latin uppercase only for MVP.
- Deriving the suggested `event_code` from the event name or slug. The system rolls a uniformly random 3-letter code; if the admin wants something semantically meaningful, they override.
- Normalized storage of the verification code (separate `event_code` and `token` columns joined at display). Rejected because the lock-after-publish invariant eliminates the propagation benefit, while the cost (extra join on every display, transformation on every export) is real.

## Target Shape

### Data

- New column on `game_event_drafts`: `event_code text` with check constraint `event_code ~ '^[A-Z]{3}$'`. `NOT NULL` after backfill.
- New column on `game_events` (published projection): `event_code text`, same constraint, `NOT NULL`.
- Unique index on `game_event_drafts(event_code)`.
- Unique index on `game_events(event_code)`.
- Rationale for two uniqueness scopes: drafts and published events each need to be unique on their own, mirroring the existing treatment of `slug`.
- New unique constraint on `game_entitlements(event_id, verification_code)`. This is the per-event uniqueness invariant the redemption MVP previously deferred to this prerequisite, and it is what makes the 4-digit numeric token safe to reuse across events while remaining unambiguous within an event.

### Locking

- New DB trigger `enforce_game_event_draft_event_code_lock` on `game_event_drafts`, modelled after `enforce_game_event_draft_slug_lock` (historical migration filename: `20260415000000_add_quiz_event_draft_slug_lock_trigger.sql`). Raises exception `event_code_locked` if `OLD.event_code IS DISTINCT FROM NEW.event_code` when `OLD.live_version_number is not null`.
- Admin UI disables the `event_code` input when `draft.hasBeenPublished` is true, mirroring the existing slug behavior in `AdminEventDetailsForm.tsx` (current line ~110).

### Code Generation

- `generate_neighborly_verification_code(p_event_code text)` returns `p_event_code || '-' || lpad((('x' || encode(gen_random_bytes(2), 'hex'))::bit(16)::int % 10000)::text, 4, '0')`.
  - Produces a 4-digit numeric token in `[0000, 9999]` using cryptographically strong randomness from `pgcrypto` (16 bits of entropy mod 10,000; the small bias of mod over 16,384/10,000 is acceptable for entitlement token generation).
  - The token space is only 10,000 per event, so collisions are likely well before an event hits its 500-redemption MVP ceiling (birthday-paradox: ~50% chance of at least one collision by ~118 codes). Collision safety is therefore handled by the new `unique (event_id, verification_code)` constraint plus a retry loop in the RPC, not by the size of the token space alone.
- `complete_game_and_award_entitlement` fetches `event_code` from `game_events` by `event_id` and passes it to `generate_neighborly_verification_code`. The insert into `game_entitlements` happens inside a bounded retry loop (up to 10 attempts) that catches the `unique_violation` on `(event_id, verification_code)` and tries a fresh token. If all 10 attempts collide (vanishingly unlikely below ~9,000 issued codes), the RPC raises `entitlement_code_exhausted`, which the edge function maps to a 503 `{ outcome: "error", result: { code: "entitlement_code_exhausted" } }` so the operator can decide whether to widen the token or rotate the event_code. If the event is missing or has no code (should be impossible after backfill + NOT NULL), the RPC raises `event_code_missing`, which the edge function maps to a 500 `{ outcome: "error", result: { code: "server_error" } }`.
- Frontend mock `createVerificationCode()` in `apps/web/src/lib/gameApi.ts` is rewritten to accept `eventCode` and return `${eventCode}-${fourDigits}`, where `fourDigits` is a zero-padded random integer in `[0, 9999]`.

### Admin UI

New field in `AdminEventDetailsForm.tsx`, rendered next to (or immediately after) the slug input since the two fields behave identically:

- Label: "Event code"
- Helper: "3-letter prefix used in entitlement codes (e.g. `ABC-1234`). Auto-generated — change it if you want a more memorable prefix. Cannot be changed after the event is published."
- Input: `<input pattern="[A-Z]{3}" maxLength={3}>` with a blur handler that uppercases.
- A small "Regenerate" button next to the input that asks the server for a fresh random code (useful when the admin dislikes the initial roll but has nothing specific in mind).
- Disabled (both input and Regenerate button) when `draft.hasBeenPublished`.
- Authorization: both admin and organizer roles can edit `event_code` while the draft is unpublished, matching the existing pattern for slug and other event-details fields.
- Surfaces server errors returned by `save-draft`:
  - `event_code_taken` → "That code is already used by another event. Try a different one."
  - `event_code_locked` → "Event code can't change after the event is published."
  - `event_code_invalid` → "Event codes are exactly 3 uppercase letters."

No live uniqueness check. The admin submits the form, and the `save-draft` edge function returns the verdict. This matches the answer captured during planning ("Admin types, validation only on save"), and aligns with how slug already works operationally — we just add explicit handling for the new error codes.

Because the 3-letter code lives inside the entitlement code (`ABC-1234`), it does **not** need to be surfaced as a separate badge on the game-runner or post-completion screens — the prefix is already visible to the user as part of the code they'll read aloud, which is exactly the "am I at the right event?" cue we wanted. Surfacing it a second time would be redundant.

### Save-Draft Edge Function

`supabase/functions/save-draft/index.ts` is extended to:

- Accept `eventCode` in the payload. If null/empty (initial draft creation, or a "Regenerate" request), the function generates a random 3-letter code server-side and retries on collision (bounded loop, see Migration B for the algorithm shared with backfill).
- If `eventCode` is provided, validate against `^[A-Z]{3}$` before touching the DB and return the current authoring error envelope with HTTP 422, `{ error: "Event codes are exactly 3 uppercase letters.", details: "event_code_invalid" }`, if it fails.
- Map unique-violation on `event_code` → 409 `event_code_taken`.
- Map `event_code_locked` exception from the trigger → 422 `event_code_locked`.

A new endpoint or `save-draft` action is **not** required for "Regenerate" — the admin UI calls a small `generate-event-code` edge function that returns `{ eventCode: "XYZ" }` and the admin form fills the field with the suggestion. Save still happens through the same `save-draft` path.

## Implementation Phases And PR Slicing

The plan has a clean release seam between the server-side foundation and the
admin control surface. Phase 1 is independently deployable: the system does not
break without the UI because new drafts still get auto-generated codes, publish
carries the code through, and entitlements issue as `ABC-1234`. Phase 2 builds
the admin affordances on top of those server-side invariants. A single larger
phase would work, but the seam is clear enough that the split earns its
coordination overhead.

This sequence also unblocks the reward redemption MVP's backend work as soon as
Phase 1 lands, because the database and RPC invariants it depends on are already
in place before admins can view or customize codes.

### Phase 1 — Server-Side Foundation

**Releasable state:** event codes exist, flow through the publish path, and are
enforced automatically. New drafts get auto-generated codes, publish carries the
code through to `game_events`, and entitlements issue in `ABC-1234` format.
Admins cannot see or override codes yet, but the data layer is stable.

Scope:

- Migrations A, B, C, and D: schema, backfill, lock trigger, RPC rewrite, and
  entitlement code uniqueness.
- `save-draft` edge function update to generate and validate `event_code` when
  omitted or supplied.
- `generate-event-code` edge function.
- pgTAP tests plus Vitest coverage for edge function and RPC behavior.

#### PR 1 — Event Code Data Model

Scope:

- Migrations A, B, and C: schema, backfill, `NOT NULL`, indexes, and lock
  trigger.
- Minimal `publish_game_event_draft` compatibility update so publish carries
  `event_code` into the new non-null `game_events.event_code` column.
- `save-draft` edge function update to generate and validate `event_code`.
- `generate-event-code` edge function.
- pgTAP coverage for constraint checks, unique violations, lock trigger
  behavior, and `generate_random_event_code()`.

Why together: Migration B makes `event_code` `NOT NULL`, so `save-draft` must
ship in the same PR or draft creation breaks. The publish RPC must also carry
the code into `game_events` in this PR; otherwise first publish after the
schema change would fail the new `NOT NULL` constraint. Migrations A through C
plus the compatibility publish update are sequential and small. This PR tells a
complete story: event codes exist, are enforced, and draft creation handles
them. The intermediate state after this PR is stable and safe: event codes
exist in the database while old `MMP-XXXXXXXX` entitlements still issue.

#### PR 2 — Entitlement Code Format

Scope:

- Migration D: new `generate_neighborly_verification_code`, rewrite of
  `complete_game_and_award_entitlement`, and unique constraint on
  `game_entitlements`.
- pgTAP coverage for the new code generator format plus RPC retry and
  exhaustion behavior.
- Vitest coverage for `save-draft` handler error codes and the
  `generate-event-code` handler.

Why separate: Migration D is the most complex piece. It includes the retry loop,
two new error codes, and idempotency preservation. Isolating it lets a reviewer
focus on behavioral correctness of the RPC without the schema noise from PR 1.

### Phase 2 — Admin Control Surface

**Releasable state:** admins can view and customize event codes before publish.

#### PR 3 — Admin Control Surface

Scope:

- `AdminEventDetailsForm.tsx`: event-code input, Regenerate button,
  disabled-after-publish state, and error surfaces.
- `draftCreation.ts`: omit `eventCode` on initial save so the server generates
  it.
- Frontend mock `createVerificationCode()` rewrite plus call-site updates.
- Vitest coverage for form component behavior.
- `complete-game.test.ts` expectation updates.

Why one PR: this is a unified frontend/mock story ("admins can now see and
customize event codes") with no internal coupling hazard that requires another
split. The diff should be reviewable in one sitting once Phase 1 has landed.

## Rollout Sequence

### Migration A — `20260418030000_add_event_code_columns.sql`
1. `alter table game_event_drafts add column event_code text` (nullable).
2. `alter table game_events add column event_code text` (nullable).
3. Add `check (event_code is null or event_code ~ '^[A-Z]{3}$')` to both tables.

### Migration B — `20260418040000_backfill_event_code.sql`
1. Backfill `game_event_drafts` deterministically by `created_at asc, id asc`: the Nth row gets the Nth 3-letter sequence starting from `AAA` (`AAA`, `AAB`, …, `AAZ`, `ABA`, …, `ZZZ`). The conversion from row number to 3-letter code is a small PL/pgSQL helper that treats the row number as a base-26 integer with digits in `A-Z`.
2. Mirror the values into `game_events` for already-published rows by joining on `id`.
3. `alter table game_event_drafts alter column event_code set not null`.
4. `alter table game_events alter column event_code set not null`.
5. `create unique index game_event_drafts_event_code_key on game_event_drafts(event_code)`.
6. `create unique index game_events_event_code_key on game_events(event_code)`.
7. Define a shared helper `generate_random_event_code()` that returns a uniformly random 3-letter uppercase string, usable by the server-side auto-generate path in `save-draft` and the `generate-event-code` edge function.
8. Migration aborts with a descriptive error if the testing dataset has more than 17,576 rows (the 3-letter space is exhausted). Not expected at any realistic scale but guarded anyway.

The deterministic `AAA…` sequence keeps the testing snapshot reproducible and easy to inspect in early manual testing. New admin-created events get a server-generated random 3-letter code from the same 17,576-code space, so over time the `AAA…` cluster gets diluted by random codes; that's fine — the deterministic codes are not semantically meaningful, just stable for the migration.

### Migration C — `20260418050000_lock_event_code_after_publish.sql`
1. Create trigger function `enforce_game_event_draft_event_code_lock` mirroring the slug-lock trigger.
2. Attach to `game_event_drafts` for `before update`.

### Migration C2 — `20260418060000_project_event_code_on_publish.sql`
1. Update `publish_game_event_draft` so the upsert into `game_events` carries
   `event_code` over from the draft. This belongs in PR 1 because
   `game_events.event_code` is already `NOT NULL`.

### Migration D — `20260418070000_rewrite_verification_code_generator.sql`
1. `drop function public.generate_neighborly_verification_code();` (old zero-arg version).
2. Recreate `generate_neighborly_verification_code(p_event_code text)` per Target Shape (returns `<event_code>-NNNN` with a 4-digit numeric token).
3. Add `alter table game_entitlements add constraint game_entitlements_event_code_unique unique (event_id, verification_code)`.
4. Replace the body of `complete_game_and_award_entitlement` so that:
   - It looks up `event_code` from `game_events` by `p_event_id`. Raise `event_code_missing` if null.
   - The insert into `game_entitlements` runs inside a bounded retry loop (up to 10 attempts): generate a new token, attempt insert, catch `unique_violation` on the new `(event_id, verification_code)` constraint, loop. If all 10 attempts collide, raise `entitlement_code_exhausted`.
   - Idempotency by `request_id` still short-circuits the retry loop so a replayed request returns the original code, not a newly-generated one.

### Edge Function + Frontend
1. Update `save-draft` edge function to accept, validate, and (when missing) generate `eventCode`, including error-code mapping. PR 1 preserves the current authoring response envelope (`{ error, details }` on failures).
2. Add a tiny `generate-event-code` edge function that returns a server-generated random 3-letter code as `{ eventCode: "XYZ" }` for the future "Regenerate" button. It does not persist anything; the admin UI applies the suggestion to the form locally and then saves through `save-draft`.
3. Update `AdminEventDetailsForm.tsx` and `eventDetails.ts` to render the event-code input, the Regenerate button, and the disabled state, and to persist `eventCode`.
4. Update `draftCreation.ts::createStarterDraftContent()` to call `generate-event-code` (or omit `eventCode` from the initial save and let `save-draft` generate it server-side — pick the simpler path, likely the latter).
5. Update the frontend mock `createVerificationCode()` signature and every call site to take a 3-letter `eventCode`.

### Tests
1. pgTAP additions under `supabase/tests/`:
   - `event_code` check-constraint rejects invalid values on insert/update (too short, too long, lowercase, digits, contains hyphen, contains whitespace).
   - Unique-violation surfaces on both `game_event_drafts` and `game_events`.
   - Lock trigger blocks mutation of `event_code` after publish; allows mutation before publish.
   - `generate_random_event_code()` returns a string matching `^[A-Z]{3}$`.
   - `generate_neighborly_verification_code('ABC')` returns a string matching `^ABC-[0-9]{4}$`.
   - `complete_game_and_award_entitlement` returns `verification_code` of the form `^<event_code>-[0-9]{4}$`.
   - Per-event uniqueness on `verification_code` enforced: pre-seed `game_entitlements` with rows occupying every code in `[0000, 9999]` for a given event, call the RPC, and assert it raises `entitlement_code_exhausted` (after 10 retries). With one slot free, the RPC succeeds.
2. Vitest additions:
   - `AdminEventDetailsForm` renders event-code input and Regenerate button; disables both when `hasBeenPublished`; uppercases on blur; surfaces all three server error codes.
   - `save-draft` handler accepts empty `eventCode` on create (generates server-side), validates a supplied `eventCode` against the 3-letter pattern, and maps invalid pattern → 422 `event_code_invalid`, unique violation → 409 `event_code_taken`, lock-trigger error → 422 `event_code_locked`.
   - `generate-event-code` handler returns a string matching `^[A-Z]{3}$`.
   - `createVerificationCode('ABC')` returns a string matching `^ABC-[0-9]{4}$`.
3. Update `tests/supabase/functions/complete-game.test.ts` expectations (format assertions on `verification_code`, including the new retry-on-collision behavior).

## Backfill Strategy (Detail)

- Only safe because the user has declared existing data is testing-only. This plan would not be acceptable against production data — a production backfill would require system-generated codes with the same retry-on-collision path that online creation uses.
- Deterministic ordering by `created_at asc, id asc` so re-running the migration against the same snapshot produces the same assignments.
- If two events share a `created_at` with no `id` tiebreak (won't happen with `text` primary keys but guarded anyway), the secondary sort by `id` keeps results stable.
- Codes are assigned in base-26 order starting from `AAA`: row 1 → `AAA`, row 26 → `AAZ`, row 27 → `ABA`, row 676 → `AZZ`, row 677 → `BAA`, up to row 17,576 → `ZZZ`. The migration aborts with a descriptive error if the dataset exceeds 17,576 rows (the full space), which is not expected at any realistic scale.

## Validation Expectations

- `npm run lint` — docs + TS changes.
- `npm test` — vitest (admin form, save-draft handler, createVerificationCode).
- `npm run test:functions` — pgTAP (event_code constraints, trigger, code generator, complete-game RPC).
- `npm run build:web` — make sure the new admin form wiring compiles.
- Manual: create a draft, assign a code, publish, confirm the code input is disabled; complete a game and confirm the issued verification code starts with the event code.

## Risks and Mitigations

- **Starter draft flow needs a code at creation.** Since the field is `NOT NULL` server-side, the starter-draft path must either pass an auto-generated `eventCode` or omit it and let `save-draft` generate one. The plan defaults to the latter: `save-draft` generates when the payload is null/empty, avoiding a second network round-trip from the admin UI.
- **Event-code space exhaustion.** 17,576 total codes. At 10–50 events/year that's centuries of runway before even 10% of the space is ever seen. If the user changes product direction and event codes become sticky (never reused), the space would tighten at ~20-year time horizons; revisit then.
- **Event-code collision at creation.** System-generated codes collide probabilistically — at 500 existing codes, 1 new code has a ~2.8% chance of collision. The server-side generator retries up to 20 attempts; the probability of 20 consecutive collisions at 500 existing codes is about 10⁻³², which we can treat as impossible. If the space actually fills up (thousands of codes), retries start compounding; raise `event_code_exhausted` after 20 attempts and surface a 503 in the edge function.
- **Token-space exhaustion per event.** The 4-digit numeric token gives 10,000 slots per event. The new `unique (event_id, verification_code)` constraint guarantees no in-event duplicates, and the RPC retries up to 10 times on collision. As an event fills up the token space, retry frequency grows: with 1,000 issued codes the collision rate is ~10% per attempt, so 2–3 retries for the unlucky draw are plausible but 10 consecutive collisions are still improbable (~10⁻¹⁰). Beyond ~5,000 issued codes retries start compounding; beyond ~9,000 the RPC will begin raising `entitlement_code_exhausted`. MVP event sizes are expected to stay well under 500 completions, so this is a known but distant ceiling. Documented escape hatches: widen to 5 digits (10× more space, one more character to read aloud) or rotate the event_code for a follow-up event.
- **Retry loop starvation.** Each retry runs inside the same advisory-lock-holding transaction as the existing `complete_game_and_award_entitlement` serialization. 10 attempts at the expected retry rate add milliseconds, not seconds, so holding the lock during retries is acceptable.
- **Published rows losing their code during rollback.** Addressed in Rollback.
- **Trigger can't see `live_version_number` for newly-published rows in the same transaction as the publish RPC.** The slug trigger already navigates this; the event-code trigger will be a near-clone, so the same invariants carry over.

## Rollback Plan

Reverse of the forward sequence, in order:

1. Revert frontend + edge function changes (admin form, save-draft handler, mock code generator).
2. Revert Migration D: restore the zero-arg `generate_neighborly_verification_code`, the pre-feature body of `complete_game_and_award_entitlement`, the pre-feature `publish_game_event_draft` body (dropping the `event_code` copy-over step), and drop the `game_entitlements_event_code_unique` constraint.
3. Revert Migration C: drop the trigger.
4. Revert Migration B: drop the unique indexes on `game_event_drafts.event_code` and `game_events.event_code`, drop `not null`, leave the `event_code` columns populated for forensic inspection.
5. Revert Migration A: drop the `event_code` columns and the check constraint.

Because migration D changes the RPC signature and body, a partial rollback (reverting the RPC without reverting the columns) is acceptable and non-destructive — new completions would just continue to work as pre-feature `MMP-XXXXXXXX`.

## Resolved Decisions

The following were left open in earlier drafts and have since been confirmed:

- **Reusability of an `event_code` after an event is deleted.** Confirmed: freed for reuse. Safety rests on redemption being event-scoped — an agent at Event B looks up `(event_id = B, verification_code = …)`, so an Event A entitlement under the same code string is invisible. The only residual risk is cosmetic confusion in cross-time historical reports, which matches the existing slug-reuse risk class. Acceptable trade-off.
- **Audit entry on `event_code` change.** Confirmed: out of scope. The lock-after-publish invariant means changes can only happen during draft iteration, before any entitlement is issued; nothing downstream can be invalidated by a change in that window.
- **Surfacing `event_code` separately in the runner / post-completion UI for cross-event validation.** Confirmed: not needed. The 3-letter prefix is already inline in the `ABC-1234` code the attendee reads, so it serves as the at-a-glance "am I at the right event?" cue without a second display element. A separate badge would be cognitive duplication.
- **Storage shape: normalized (separate token + event_code columns) vs string-concatenated.** Confirmed: string-concatenated. The lock-after-publish invariant eliminates the propagation benefit normalization usually provides, while every downstream consumer (logs, exports, agent lookup) gets simpler code paths from storing the literal string. Captured in Non-Goals.

No remaining open questions block implementation.
