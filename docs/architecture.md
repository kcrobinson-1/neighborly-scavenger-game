# Neighborhood Game Quiz — Architecture

## Purpose

This document should answer the practical architecture questions needed to build and run the MVP.

## Document Role

This doc defines the system shape:

- what components exist
- what responsibilities each component owns
- where data lives
- how frontend and backend interact
- what the core data model looks like

Specific framework and tool choices belong in `dev.md`. Product goals belong in `product.md`. UX intent belongs in `experience.md`.

For this product, the architecture doc should answer:

1. What are the major system components?
2. Where does quiz content live?
3. How does the attendee experience load and run?
4. What data is stored on the client versus the backend?
5. How is quiz completion verified for raffle redemption?
6. What backend endpoints or services are required?
7. What should the core data model look like?
8. How should performance and offline resilience be handled?
9. What is the MVP anti-abuse strategy?
10. What admin or organizer tooling is required?
11. How should deployment be structured?
12. What is intentionally out of scope for MVP?

This doc answers those questions with recommended MVP defaults.

## Architecture Summary

The recommended MVP architecture is:

- a SPA frontend
- a minimal backend API
- a simple hosted database
- local browser state during quiz play
- backend-issued completion verification at the end

The core principle is:

Keep the quiz experience fast and mostly client-driven, while making the final completion state backend-backed and trustworthy.

## Key Design Decisions

These are the main architectural decisions currently embodied in the codebase.

### One shared game configuration source

The quiz definitions currently live in a shared TypeScript module rather than only in the frontend.

Why:

- the same question definitions need to drive both rendering and server-side scoring
- correctness logic should not be duplicated across client and backend
- this keeps the frontend review UI, backend scoring, and sample content aligned while the product is still in its prototype-to-MVP phase

Tradeoff:

- content is not yet organizer-editable without a code change

Intent:

- move event content into the database later, but keep one trusted source of truth for correctness and scoring

### Browser-session trust instead of user accounts

The current MVP does not use login-based identity.

Instead:

- the browser requests a server-issued session
- the backend sets a signed HTTP-only cookie
- raffle entitlement is tied to that server-controlled browser session

Why:

- it preserves the low-friction QR-code event flow
- it is materially stronger than trusting a client-generated session id
- it is enough for MVP while person-level fraud prevention remains out of scope

Important limitation:

- this is not person identity
- a new browser profile, private window, or device can still create a new entitlement

### One entitlement, many completion attempts

The system treats `quiz_completions` and `raffle_entitlements` as separate concepts.

Why:

- users should be able to retake the quiz for fun or score improvement
- raffle eligibility should be granted once per event/session, not once per attempt
- this keeps the UX flexible without weakening the reward model

### Client-driven quiz, server-owned completion

The attendee experience runs locally during play, but the backend owns the official completion result.

Why:

- local interaction keeps the quiz fast and resilient during an outdoor event
- backend completion gives volunteers something more trustworthy than a purely client-rendered success screen
- the final verification code becomes stable across retakes for the same entitled session

## 1. What Are the Major System Components?

The MVP should have four major parts:

### Attendee Frontend

The mobile web app opened from a QR code.

Responsibilities:

- load the event and question set
- render one question card at a time
- track in-progress answers locally
- submit the final completion payload
- display the completion verification screen

### Backend API

A thin service that supports the live event flow.

Responsibilities:

- return event/question/sponsor content
- accept quiz completion submissions
- create a completion record
- return a verification token or proof state
- provide lightweight analytics events if needed

### Database

The source of truth for event content and completion records.

Responsibilities:

- store events
- store questions and answer options
- store sponsor metadata
- store completion records
- support basic reporting

### Organizer/Admin Tooling

A minimal way to manage event content.

Responsibilities:

- create and edit events
- add questions
- attach sponsors
- publish or unpublish an event

## 2. Where Should Quiz Content Live?

### Prototype Answer

For the earliest prototype, quiz content can live in local JSON or code.

### MVP Answer

For an event-ready MVP, quiz content should live in the database.

Why:

- organizers may need to update questions without a code deploy
- sponsor content is operational data, not hardcoded product logic
- event reuse becomes easier over time

The frontend should fetch published event content once at startup and then run the quiz locally.

## 3. How Should the Attendee Experience Load and Run?

The attendee experience should be a SPA with one visible question card at a time.

Recommended flow:

1. User scans QR code
2. Frontend loads the published event payload
3. Frontend stores quiz state locally
4. User answers questions without page reloads
5. Frontend submits completion at the end
6. Backend returns official completion proof
7. Frontend renders the final verification screen

Important architectural choice:

The experience should feel uninterrupted even if routing exists internally. The user should not experience separate hard-loaded pages between questions.

The frontend should also support configurable quiz feedback behavior at the game level, such as:

- move straight through and reveal score at the end
- require the correct answer before continuing

## 4. What Data Lives on the Client vs the Backend?

### Client-Side Data

The frontend should temporarily store:

- current question index
- selected answers
- progress state
- event content cache
- local anti-repeat marker

This data should survive a refresh when possible.

### Backend Data

The backend should persist:

- event records
- question records
- answer option records
- sponsor data
- completion records
- verification tokens
- timestamps and lightweight analytics data

Recommended rule:

The client owns quiz interaction state.
The backend owns official completion state.

## 5. How Should Completion Be Verified?

Completion should not be trusted purely from the frontend.

Recommended MVP approach:

- frontend submits the completion payload
- backend creates a completion record
- backend returns a token or proof object
- frontend displays a distinctive success screen using that proof

Recommended proof elements:

- short human-readable code
- timestamp
- event-specific visual confirmation

Why:

- volunteers need quick confidence
- a purely client-rendered "success" screen is too easy to fake

## 6. What Backend Endpoints or Services Are Required?

The MVP backend should stay small.

Recommended minimum capabilities:

### Event Content Read

Purpose:

- return the published event and its questions for attendee play

### Completion Submit

Purpose:

- accept a completed quiz payload
- validate that the event is active
- create a completion record
- return completion proof

### Admin Content Management

Purpose:

- create and update event data
- manage questions and sponsors
- publish and unpublish events

### Analytics Read

Purpose:

- support basic reporting for starts, completions, and timing

These can exist as separate endpoints, serverless functions, or a small managed backend layer.

## 7. What Should the Core Data Model Be?

The architecture doc should define the MVP entities clearly enough that implementation and admin tooling can follow from them.

## Recommended Content Model

### Event

- id
- slug or shareable identifier
- name
- feedbackMode
- status
- start/end or active window
- theme color or theme configuration
- intro copy
- raffle instructions
- createdAt
- updatedAt

### Sponsor

- id
- eventId
- name
- logoUrl
- sponsorLabel
- websiteUrl
- displayOrder

### Question

- id
- eventId
- sponsorId nullable
- prompt
- selectionMode
- displayOrder
- correctAnswerIds
- explanation nullable
- sponsorFact nullable

### AnswerOption

- id
- questionId
- label
- value
- displayOrder

### Completion

- id
- eventId
- token
- createdAt
- submittedAnswers
- completionDuration
- verificationStatus
- clientSessionId

### RedemptionEntitlement

- id
- eventId
- clientSessionId or participant key
- firstCompletionId
- raffleGrantedAt
- status

This separates "a completed run through the quiz" from "the single raffle entitlement earned for that event." A participant may have multiple completion records over time, but only one redemption entitlement.

### QuizSession Optional for MVP

- id
- eventId
- startedAt
- completedAt nullable
- clientSessionId

If we want the lightest MVP possible, `QuizSession` can be skipped at first and inferred from frontend or analytics events.

## 8. How Should Quiz Feedback Modes Be Modeled?

The system should support a game-level feedback mode instead of hardcoding one quiz behavior.

Recommended MVP values:

- `final_score_reveal`
- `instant_feedback_required`

Optional later:

- `instant_feedback_non_blocking`

Modeling requirement:

- any game using scored or correctness-based feedback modes should require `correctAnswerIds` on every scored question
- `correctAnswerIds` should only be optional for non-scored or informational quiz variants

Why model this at the game level:

- it keeps the attendee experience consistent within a single quiz
- it avoids question-by-question rule confusion
- it gives organizers a simple, understandable choice

Behavioral implications:

- `final_score_reveal` needs score calculation and end-of-quiz answer review support
- `instant_feedback_required` needs correct-answer checking during the quiz plus an optional sponsor-fact interstitial
- both modes can share the same question and answer data model as long as `selectionMode`, `correctAnswerIds`, and `explanation` or `sponsorFact` are available when needed
- the frontend should support back navigation to previously submitted questions before completion
- the frontend may allow retakes after completion, but backend reward logic should treat retakes as additional sessions, not additional raffle entitlements

## 9. How Should Performance and Resilience Work?

The product has outdoor, mobile, event-based constraints, so architecture should optimize for perceived speed and survivability.

Recommended performance approach:

- fetch event content once at the start
- cache it in memory for the session
- avoid server round-trips between questions
- keep assets small, especially sponsor logos
- preload the completion experience if practical

Recommended resilience approach:

- persist progress locally
- tolerate refreshes
- make completion submission retryable
- handle intermittent connectivity gracefully near the final step

The architecture should optimize for:

- low latency
- low data usage
- minimal moving parts during the live event

## 10. What Is the MVP Anti-Abuse Strategy?

Strong anti-fraud is explicitly out of scope, but some minimum architecture is still needed.

Recommended MVP anti-abuse:

- local storage or cookie to discourage repeated entries
- lightweight backend dedupe using event plus a client/session identifier
- optionally reject duplicate completion submissions within a short window

Not recommended for MVP:

- heavy identity verification
- account creation
- complex device fingerprinting
- manual moderation flows

## 11. What Admin Tooling Is Required?

At minimum, someone needs to manage content without breaking the live event.

Recommended MVP admin capabilities:

- create an event
- edit event details
- create and reorder questions
- attach sponsor metadata
- choose a feedback mode
- mark an event as published

Admin tooling can begin as:

- a simple protected internal interface
- or a direct database/admin console for the earliest phase

But long-term, the architecture should assume a lightweight organizer-facing admin flow exists.

## 12. How Should Deployment Be Structured?

Recommended deployment model:

- static or edge-hosted frontend
- managed backend/data platform

Example stack:

- frontend on Vercel or Netlify
- backend/data on Supabase

Why this is a good fit:

- low ops overhead
- quick deployment cycles
- enough flexibility for MVP and first event validation

Specific tool and framework recommendations live in `dev.md`.

## 13. What Is Out of Scope for MVP?

The architecture should explicitly avoid overbuilding.

Out of scope:

- multi-tenant SaaS architecture
- advanced permissions systems
- strong anti-fraud infrastructure
- payments and billing
- complex sponsor analytics dashboards
- native mobile apps
- real-time multiplayer or live leaderboard mechanics

## Recommended MVP Request Flow

### Attendee Flow

1. QR code opens the attendee frontend
2. Frontend requests published event data
3. Frontend runs the quiz locally
4. Frontend submits completion to backend
5. Backend stores completion and returns verification data
6. Frontend renders the success screen

### Organizer Flow

1. Organizer creates event content
2. System stores event, sponsors, and questions in the database
3. Organizer publishes the event
4. QR code points attendees to the published frontend route

## Final Recommendation

The architecture should be deliberately small:

- client-heavy during quiz play
- backend-backed at completion
- database-backed for content and reporting
- minimal admin functionality

That balance best matches the product goals:

- fast mobile experience
- operational simplicity
- trustworthy raffle redemption
- low implementation overhead
