# Analytics Strategy

## Document Role

This document plans the analytics approach for the Neighborly Scavenger Game. It covers the end goal of analytics in this project, the approaches to consider, how to evaluate them, best practices at this scale, guidance on third-party tools versus custom solutions, and the goal of an analytics dashboard.

Related docs:

- `product.md` — success criteria and KPIs that analytics must serve
- `architecture.md` — current system shape and the post-MVP analytics roadmap item
- `open-questions.md` — unresolved reporting questions about which metrics come first
- `backlog.md` — tracked work items for the analytics milestone

---

## End Goal of Analytics in This Project

Analytics in Neighborly Scavenger Game exists to answer three distinct questions for three distinct audiences.

**For organizers:** Did the event succeed, and is the product worth using again? Organizers need to know how many attendees participated, whether the quiz ran smoothly without technical issues, and whether their setup investment paid off. After Madrona Music in the Playfield, the first concrete deliverable is a simple post-event summary they can share internally or with their board.

**For sponsors:** Is this worth paying for? Local businesses need evidence that their sponsorship generated real engagement — not just impressions, but active attention during play. The minimum viable proof is completion counts per event and, eventually, per-question data showing how many people engaged with sponsor-attributed questions.

**For the product team:** What should improve? Funnel drop-off rates, per-question answer distributions, and completion time distributions reveal whether the quiz is too long, whether a question is confusing, or whether a particular feedback mode causes users to quit. This data drives iteration, not vanity metrics.

The overarching analytics goal is: **produce actionable evidence that the product works at live events**, while keeping the analytics investment proportional to the current community scale of hundreds of attendees per event rather than millions.

This is explicitly not a goal: building a complex, always-on analytics platform. The `product.md` non-goals section calls this out directly. Analytics should be a behind-the-scenes proof layer, not a featured product surface.

---

## What Data Already Exists

Before adding anything, the current schema provides a meaningful foundation.

The `quiz_completions` table records `event_id`, `client_session_id`, `score`, `duration_ms`, `submitted_answers` (as JSONB), `attempt_number`, `entitlement_awarded`, and `completed_at`. This is enough to compute completion counts, score distributions, median completion times, and retake rates per event.

The `submitted_answers` JSONB column stores a `Record<string, string[]>` — an object keyed by question ID with sorted arrays of selected option IDs (e.g., `{"q1": ["a"], "q2": ["b", "c"]}`). Because the keys match `quiz_questions.id` directly, per-question answer distributions are queryable via `jsonb_each` without a schema change. These queries are non-trivial and should be written and tested against the existing demo data before the first live event, not after.

The `raffle_entitlements` table records one entry per unique session, with `created_at` on the first entitlement. Counting distinct entitlements per event gives unique participant counts.

The `quiz_events`, `quiz_questions`, and `quiz_question_options` tables contain the published content structure — sponsor attribution, question count, and answer options — needed to join behavioral data back to the authored experience.

**What is currently missing:** There is no record of session starts — how many people called `issue-session` but never completed the quiz. This is the only analytics gap that is unrecoverable after the fact. Everything else (scores, times, answer distributions, retake rates) is already captured at completion. Start tracking must be in place before the first live event.

---

## Known Schema Dependencies

Two schema issues had to be resolved before the analytics views can be written correctly. Both are now landed.

**`quiz_starts` table** — Added via `20260416000000_add_quiz_starts.sql`. The table exists; `issue-session` inserts into it when `event_id` is provided. Must be applied to production before the first live event.

**`sponsor` nullable on `quiz_questions`** — Resolved via `20260415010000_make_sponsor_nullable.sql`. Analytics queries can now correctly distinguish sponsored from unsponsored questions.

---

## Approaches

### Approach 1 — SQL Views on Existing Data (Zero New Infrastructure)

Write SQL views or RPC functions against the existing Supabase schema to compute the core post-event metrics: unique participants, completion count, completion rate, median score, median duration, and score distribution. Expose those to the admin surface or to Supabase Studio directly.

This is the right first move because the data already exists. No new instrumentation, no third-party dependency, no privacy policy change. The main limitation is that it cannot answer drop-off or funnel questions because session starts are not tracked yet.

### Approach 2 — Session Start Tracking (One Migration, Pre-Event Requirement)

Add a `quiz_starts` table and insert a row from the `issue-session` edge function each time a session is issued. This creates the denominator for a true funnel: starts → completions → raffle entries. The table needs only `event_id`, `client_session_id`, and `issued_at`.

This is the most impactful single addition relative to its implementation cost, and it is the only analytics item that is a hard pre-event dependency rather than a post-MVP enhancement. It is tracked as a Tier 1 backlog item for that reason.

**Note on the fuller attempt model:** A more complete design would have `issue-session` create a first-class attempt record that `complete-quiz` then closes, giving the completion a natural parent and enabling server-side timing. That model is architecturally cleaner but requires the completion flow to change (the client would need to carry an attempt ID, and retakes would need a new attempt row rather than reusing the session). The simple `quiz_starts` table delivers the funnel denominator with no changes to the completion path. The fuller model is the right direction for a future iteration if server-side timing, progress recovery, or richer per-attempt metadata becomes a need.

### Approach 3 — Frontend Event Instrumentation

Instrument the React quiz flow to emit browser-side events: quiz started, question viewed, answer selected, quiz submitted. Route those through a lightweight analytics SDK to a third-party tool or a custom Supabase-backed event table.

This approach enables funnel visualization and drop-off analysis at the individual question level. It is higher complexity, requires a privacy consideration (SDK loading, potential cookie consent), and benefits from a third-party tool that can visualize funnels without custom charting work. It is appropriate as a follow-on once the SQL-layer approach is established and the product has been validated at real events.

### Approach 4 — Answer Distribution Normalization

Write a migration that either normalizes `submitted_answers` JSONB into per-question rows at completion time, or adds a background view that unpacks the blob. This enables per-question analytics: which answer was most popular, which questions were consistently missed, which sponsor questions had the highest engagement.

This is valuable for quiz design iteration but not urgent for the first event. The data is already captured in the JSONB column; normalization can happen in a view without a schema change if performance allows. The JSONB structure is well-defined and joinable, so a view-based approach is viable before committing to a normalized table.

---

## Counting Conventions

The SQL views need to make explicit, documented choices about what they are counting. Two distinct counts are useful and mean different things.

**Unique participants** — the count of distinct `client_session_id` values per event in `raffle_entitlements`, or equivalently in `quiz_starts`. This represents how many people engaged with the quiz, regardless of retakes. It is the right number for organizer reporting and sponsor engagement claims.

**Total plays** — the count of rows in `quiz_completions` per event. This is higher than unique participants on any event where retakes occurred. It is useful for product health signals (is the retake rate normal?) but should not be presented to sponsors as the participation count.

Any view that computes sponsor engagement should use unique participants, not total plays. A sponsor's question was engaged by the person, not by each of their attempts.

---

## Sponsor Engagement Is Completion Count

Because the `complete-quiz` validation requires an answer to every question before the completion is accepted, every completion necessarily includes every question. This means sponsor question engagement always equals completion count for the current quiz model — it is not an independent or richer signal.

For the first sponsor conversation, this is fine and is the honest thing to report: "X people completed the quiz and therefore saw and answered your question." The dashboard should not imply question-level engagement is a deeper funnel stage than it actually is.

This will change if the quiz ever supports optional questions, early-exit paths, or a question-skip affordance. Until then, per-question engagement metrics are per-question answer distributions (which answer did most people select?) rather than reach counts.

---

## How to Evaluate These Approaches

Evaluate each approach against four criteria.

**Value per stakeholder.** Does this approach produce something an organizer, sponsor, or the product team can act on? SQL views on existing data immediately answer the organizer's "did it work" question. Session start tracking immediately answers the funnel question. Frontend instrumentation answers the design iteration question but is lower priority for the first event.

**Implementation cost.** Prefer approaches that build on what already exists. SQL views cost almost nothing. A `quiz_starts` table and one insert call in `issue-session` costs an afternoon. A full frontend instrumentation pipeline with a third-party SDK costs a week or more.

**Privacy footprint.** The product currently has no user logins for attendees and sends no personally identifiable data to third parties. Any analytics approach that changes this needs to be evaluated against the product's zero-friction principle and may require a cookie or privacy notice on the QR-code-entry path — which is a user experience cost at live events.

**Maintainability.** At community scale, analytics infrastructure that requires active maintenance is a liability. Favor approaches that are passive (SQL against existing tables, occasional view updates) over approaches that require a separate analytics pipeline to stay healthy.

---

## Best Practices at This Scale

**Start with the questions, not the tools.** Before writing any code, document the three or four specific questions organizers will ask after an event. "How many people completed the quiz?" and "What was the median score?" are answerable today. "Why did some people drop off?" requires instrumentation. Instrument for the second question only after the first is answered.

**Keep analytics data in Supabase as long as it fits.** At hundreds of events per year with hundreds of attendees per event, the data volume is small. Postgres handles it trivially. There is no need to introduce a separate data warehouse or event streaming system. The boundary to reconsider is if event volume grows to thousands of concurrent attendees or if cross-event historical reporting becomes complex enough to slow down production queries.

**Write SQL views before building UI.** Create named views like `event_completion_summary` and `event_funnel_summary` in Supabase before building any reporting UI. These views become the stable contract between the data layer and whatever surface consumes them — whether that is a custom admin page, Supabase Studio used directly, or a third-party tool connected via the Postgres connection string.

**Test JSONB queries against demo data before the event.** The per-question answer distribution queries use `jsonb_each` and `jsonb_array_elements_text` against `submitted_answers`. These are non-trivial and should be validated against the existing demo event completions before the first live event, not discovered to be wrong afterward.

**Separate behavioral data from content data.** Do not mix analytics rows into the published content tables. Keep `quiz_completions`, `quiz_starts`, and any future behavioral tables as a distinct analytics schema layer. This makes it easy to query, prune, or export analytics data independently.

**Be explicit about what is measured and what is not.** Document what the analytics layer does not capture. If mid-quiz abandonment is not tracked, say so. This prevents the team from over-interpreting completion rate data that is actually missing the drop-off numerator.

**Design for organizer self-service eventually, not immediately.** For the first event, it is fine for analytics output to be a Supabase Studio query result or a CSV export that someone on the team produces manually. Organizer-facing reporting UI is worth building after the product is validated, not before.

---

## Third-Party Tools vs. Custom Solution

### When a Custom Solution (SQL + Admin Page) is Right

Given the current scale and architecture, the default recommendation is to build a custom solution using SQL views in Supabase and a reporting section in the existing admin workspace. The data is already in Postgres, the admin route already exists, and the privacy footprint stays zero.

This is the right choice for:

- Post-event summary metrics (completions, scores, timing)
- Per-event organizer reports
- Sponsor engagement counts per question
- Anything that can be computed from `quiz_completions`, `quiz_starts`, and `quiz_events`

### When PostHog is the Right Third-Party Tool

PostHog is the most appropriate third-party tool if funnel visualization becomes a priority. It is open source, has a generous free cloud tier (up to one million events per month), and provides first-class React SDKs. It handles funnel analysis, session recording, and feature flags if those become relevant.

Concretely: if the team wants to understand what percentage of attendees who started the quiz reached question 3, PostHog can visualize that funnel from browser-side events without requiring custom charting code. The tradeoff is that the PostHog SDK loads on the attendee page, which adds a small network dependency and requires a decision about cookie consent.

PostHog is appropriate when: the team wants question-level funnel analysis beyond what SQL views can provide, the event volume justifies the integration effort, and the product team is prepared to interpret and act on funnel data.

### When Metabase is Appropriate

Metabase is a SQL-based business intelligence tool that can connect directly to the Supabase Postgres database. It is appropriate when organizers or non-technical stakeholders need to explore data themselves without SQL knowledge, or when the team wants to build shareable dashboards that update automatically.

Metabase makes sense as the event count grows and the team wants to compare multiple events side by side over time. It is not worth the operational overhead (hosting, managing a Metabase instance) for a single initial event.

### Tools to Avoid for This Project

**Google Analytics / GA4** is optimized for web page views and sessions. It can track custom events but is not designed for domain-specific quiz funnel analysis, does not integrate with the Supabase-backed completion data, and introduces the standard Google tracking privacy implications. It is appropriate only for the marketing landing page if traffic analysis there ever becomes important.

**Mixpanel** is well-suited for SaaS product analytics but is paid at meaningful scale and better suited to products with registered users. The attendee flow is anonymous and session-scoped, which limits Mixpanel's identity stitching value.

**A custom event streaming pipeline** (Kafka, Segment, Snowflake, etc.) is premature for this scale. Supabase Postgres is sufficient. Introduce streaming infrastructure only if query performance on the analytics tables degrades production reads, which is unlikely until the event count is in the thousands.

---

## What an Analytics Dashboard Should Accomplish

The analytics dashboard — whether it is a page in the admin workspace or an external tool — should do one primary thing: give an organizer a self-contained, honest summary of a single event that they can share with sponsors and use to plan the next event.

The dashboard should answer:

**Participation.** How many unique sessions were started? How many completed the quiz? What was the completion rate? These are the headline numbers organizers report to sponsors and to their board. Both figures use the unique participant count, not total plays.

**Performance.** What was the median completion time? What was the median score? What was the score distribution? These tell organizers whether the quiz felt appropriately challenging and whether the completion UX held up under real conditions. Where retakes exist, these figures should reflect first-attempt data to avoid skewing by motivated retakers.

**Sponsor question engagement.** For each sponsor-attributed question, how many unique participants answered it? In the current model this equals the unique completion count, which is the honest number to present. Per-question answer distributions (which option did most people choose, and did most people get it right?) are the richer signal that helps sponsors understand how their question performed.

**Operational health.** Were there retake patterns that suggest confusion at a particular question? How did completion timing distribute across the event window? These are the quality-assurance signals the product team uses to improve the next event.

The dashboard should not try to surface raw individual records, enable real-time monitoring during the event, or produce cross-event aggregates in the first version. Those are appropriate follow-on additions after the core post-event summary proves useful.

The design principle for the dashboard is the same as the design principle for the quiz itself: **fast, simple, and complete enough to act on without assistance**.

---

## Recommended Sequencing

Two phases are the right structure. They cannot be collapsed into one because they have a hard deadline difference: Phase 1 must land before the first live event or the data is gone permanently, while Phase 2 can only be built meaningfully after real event data exists. They cannot be split further without creating phases that deliver nothing demonstrable on their own — SQL views without a reporting UI are not a meaningful organizer-facing improvement, and the starts table without views is not either. Each phase delivers one complete, verifiable outcome.

### Phase 1 — Data Collection (Pre-Event) ✓ Complete

`quiz_starts` table added via migration `20260416000000_add_quiz_starts.sql`.
`issue-session` now accepts an optional `event_id` in the POST body and fires
a best-effort upsert (idempotent via unique constraint) into `quiz_starts`.
`GamePage` passes `game.id` to `ensureServerSession` at the call site.
The `sponsor` nullable migration (`20260415010000_make_sponsor_nullable.sql`)
landed in the preceding PR.

Both migrations must be applied to the production Supabase project before the
first live event. The `quiz_starts` migration is a hard pre-event dependency:
start data is permanently unrecoverable for any event that runs without it.

**Demonstrable outcome:** After the first live event runs, a Supabase Studio query returns a complete funnel row — starts, completions, and raffle entries — for that event. The data exists and is correct. Engineering can verify this immediately after the event closes.

### Phase 2 — Organizer Reporting Surface (Post-First-Event)

Write SQL views (`event_funnel_summary`, `event_completion_summary`, `event_question_summary`) against the complete data set and build an organizer-facing reporting section in the admin workspace that surfaces them for a selected event. Write and validate the JSONB per-question queries as part of this work rather than before the event — post-event data is richer for testing than demo fixtures.

**Demonstrable outcome:** An organizer opens the admin workspace, selects an event, and sees a post-event summary — participation funnel, score distribution, timing, and per-question answer breakdowns — without needing Supabase Studio access or a manual export.

### Future Consideration — Cross-Event and Question-Level Funnel Analysis

After the product is validated at multiple events, evaluate whether question-level drop-off analysis (requires browser-side instrumentation) or cross-event comparison (SQL views are sufficient) justifies additional tooling such as PostHog or Metabase. Make that decision based on the actual questions organizers and sponsors are asking at that point, not on speculation now.

---

## Phase 1 Implementation Plan

Phase 1 is two pull requests. They cannot be combined because they require different reviewer mental contexts and touch completely different parts of the system. PR 1 is a type-system and data model fix whose changes ripple through UI rendering and shared validation. PR 2 is new infrastructure — a new table, edge function changes, and a client API update — where the reviewer needs to hold "does start tracking work correctly and fail gracefully" as the focus. They share no files.

### PR 1 — Make `sponsor` nullable

**Why:** The `quiz_questions.sponsor` column is currently `NOT NULL`, which prevents modeling unsponsored house questions. This is a prerequisite for analytics views that need to correctly distinguish sponsored from unsponsored questions. It is also a standalone data model correctness fix.

**Files:**

- `supabase/migrations/` — new migration: `ALTER TABLE public.quiz_questions ALTER COLUMN sponsor DROP NOT NULL`
- `shared/game-config/types.ts` — change `sponsor: string` to `sponsor: string | null` on the `Question` type; the TypeScript compiler will surface every downstream call site that needs updating
- `shared/game-config/db-content.ts` — update the sponsor type annotation in the DB row type
- `shared/game-config/draft-content.ts` — update the sponsor field validation to accept null/undefined in addition to a string; update the type annotation
- `apps/web/src/game/components/CurrentQuestionPanel.tsx` — wrap the "Sponsored by" label in a null guard so it only renders when `question.sponsor` is set
- `apps/web/src/game/components/GameIntroPanel.tsx` — null guard on the sponsor heading
- `apps/web/src/game/components/CorrectAnswerPanel.tsx` — the fallback feedback message references `question.sponsor`; needs null-safe handling
- `apps/web/src/game/components/GameCompletionPanel.tsx` — null guard on any sponsor label
- `supabase/functions/_shared/published-game-loader.ts` — the sponsor field is selected and mapped; update the type to allow null

**Validation:** `npm run lint`, `npm test`, `npm run test:functions`, `deno check` on `issue-session` and `complete-quiz`, `npm run build:web`. The type change on `Question.sponsor` will cause compiler errors at every unguarded call site, so the build itself enforces completeness.

---

### PR 2 — Add quiz start tracking

**Why:** `issue-session` currently mints a signed session credential but writes nothing to the database. Adding a single INSERT into a new `quiz_starts` table provides the funnel denominator — how many people started the quiz — which is permanently unrecoverable for any event that runs without this in place.

**Files:**

- `supabase/migrations/` — new migration adding a `quiz_starts` table with columns `id uuid`, `event_id text`, `client_session_id text not null`, `issued_at timestamptz not null default now()`, and a unique constraint on `(event_id, client_session_id)`. RLS enabled; no public read policy needed at this stage since the table is analytics-only.
- `supabase/functions/issue-session/index.ts` — accept an optional `event_id` field in the POST body. After a session is confirmed (new or existing), if `event_id` is present, INSERT into `quiz_starts` with `ON CONFLICT DO NOTHING` for idempotency. The INSERT must be best-effort: a database failure must not prevent the session response from returning. The function gains `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as new runtime dependencies; add them to `IssueSessionHandlerDependencies` following the same pattern as `complete-quiz`.
- `apps/web/src/lib/quizApi.ts` — update `ensureServerSession()` to accept an optional `eventId` parameter and include it in the POST body when provided.
- `apps/web/src/pages/GamePage.tsx` — pass `game.id` to `ensureServerSession(game.id)` at the existing call site.
- `tests/supabase/functions/issue-session.test.ts` — add cases covering: start row is inserted when `event_id` is provided, a second call for the same event/session pair is idempotent, and a missing `event_id` leaves the starts table untouched.

**Key design decisions:**
- `event_id` is optional in the request body so the function continues to work in backward-compatible and non-event contexts.
- `ON CONFLICT DO NOTHING` means a page refresh or session retry does not create duplicate start rows. The `issued_at` timestamp reflects the first start for that session/event pair.
- The INSERT failing does not fail the response. Start tracking is observability infrastructure; session issuance is the trust boundary. These have different failure priorities.

**Validation:** `npm run lint`, `npm test`, `npm run test:functions`, `npm run test:supabase`, `deno check` on `issue-session`, `npm run build:web`.

---

- **Which event metrics are required first:** starts and completions, with completion rate as the primary derived metric. Timing and score distribution are secondary. Sponsor question engagement is the key third-party-facing metric.
- **What proof of value sponsors need:** unique completion count for the event plus the answer distribution for their attributed question. A simple post-event summary satisfies the first sponsor conversation.
- **Simple starts table vs. fuller attempt model:** Use the simple `quiz_starts` table now. The fuller model where `issue-session` creates a first-class attempt record that `complete-quiz` closes is the right long-term direction but is deferred until server-side timing or progress recovery becomes a real need.
- **Whether a post-hoc SQL query is sufficient for Madrona:** Yes, for the views. No, for starts tracking. The SQL views can be written and run after the event against completion data. The `quiz_starts` table must exist before the event or that data is gone permanently.
