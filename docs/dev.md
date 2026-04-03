# Development Direction

## Purpose

This document captures the main technical decisions that need to be made for the MVP, along with recommended defaults based on the current product and UX docs.

## Document Role

This doc is for implementation planning.

It should answer:

- which frameworks and tools we should use
- which technical defaults we should lock in for MVP
- which questions remain open before building
- what order we should build the product in

System shape and data ownership live in `architecture.md`. UX behavior and visual rules live in `experience.md`.

The goal is not to choose the most sophisticated architecture. The goal is to choose the lightest implementation that still supports:

- a fast mobile-first event experience
- a trustworthy completion state for raffle redemption
- simple organizer operations
- low engineering overhead

## Recommended MVP Stack

If we want to make the key decisions now and move into implementation quickly, the recommended starting stack is:

- Frontend: React + TypeScript + Vite
- Experience model: SPA with one visible question card at a time
- Backend: minimal API
- Database: simple hosted database
- Hosting: static frontend hosting plus lightweight backend/data hosting
- Verification: backend-issued completion token on the success screen
- Anti-abuse: browser storage plus lightweight backend dedupe

## Repository Strategy

Recommendation:

Use one repo for the MVP.

Why:

- the product is still small and tightly coupled
- frontend, backend, and infrastructure decisions will evolve together
- one repo keeps changes, docs, and deployment context in one place
- multiple repos would add coordination cost before they add real value

Recommended structure:

- `apps/web` for the React frontend
- `apps/api` for a custom backend if one exists
- `infra/` only if infrastructure-as-code is actually needed
- `docs/` for product, UX, architecture, and development planning

Important nuance:

If the MVP uses a managed backend platform such as Supabase, we may not need a substantial `apps/api` service or a dedicated infrastructure code layer at first.

Do not start the MVP with:

- one repo for the frontend
- one repo for the backend
- one repo for CDK or infrastructure

That split is more appropriate later if:

- multiple teams need independent ownership
- release cycles diverge significantly
- infrastructure becomes shared across multiple products
- security or operational boundaries require separation

## First Engineering Deliverable

Recommendation:

The first thing to build should be the attendee-facing React app.

Specifically, start with:

- a React + TypeScript + Vite app in `apps/web`
- static local event/question data
- the entry screen
- the one-question-at-a-time quiz flow
- the completion screen

Why this should come first:

- it validates the most important product risk, which is whether the experience actually feels fast and game-like
- it lets us test the mobile interaction model before backend work adds complexity
- it gives us something real to review on phones and at an event-like pace
- it keeps the first implementation milestone tightly aligned with the UX docs

Recommended sequence:

1. Scaffold the attendee app.
2. Build the full quiz flow against static data.
3. Test on real phones and refine the experience.
4. Add backend-backed completion verification.
5. Add organizer/admin and analytics capabilities after the attendee flow feels solid.

## Core Technical Decisions

### 1. Frontend Framework

Decision to make:

- React
- Angular
- Vue
- Svelte
- plain HTML/CSS/JS

Recommendation:

Use React with TypeScript.

Why:

- It fits the SPA card-based experience already described in the UX docs.
- It is lightweight enough for a small MVP.
- It has a large ecosystem and low hiring/onboarding risk.
- It avoids Angular's extra structure for a very small app.

Why not Angular for MVP:

- It is more opinionated and heavier than this project needs.
- The product is currently small and flow-based, not enterprise-dashboard-shaped.

### 2. Build Tool

Recommendation:

Use Vite.

What Vite is:

Vite is a frontend build tool and local development server.

In practice, it gives us:

- a fast local dev server
- hot reload during development
- a production build step that outputs deployable frontend files

Important distinction:

- React is the UI library
- TypeScript is the language layer
- Vite is the tool that runs and builds the app

Why Vite is a good fit here:

- faster and simpler than older React starter setups
- very low configuration for a small app
- excellent default developer experience

### 3. Rendering Model

Decision to make:

- multi-page app
- SPA
- hybrid app with client routing

Recommendation:

Use a SPA.

More specifically:

- one application shell
- one visible question card at a time
- client-side transitions between steps

Why:

- it supports the "instant, game-like" UX
- it reduces dependency on network round-trips between questions
- it keeps the quiz feeling like one uninterrupted flow

### 4. Where Quiz Content Lives

Decision to make:

- hardcoded in code
- local JSON/content files in the repo
- database-backed content

Recommendation:

- Prototype: static JSON or local content files
- Event-ready MVP: database-backed content

Why:

- static content is fastest for early prototyping
- database-backed content is better if organizers need to update events, sponsors, or questions without code changes

### 5. Whether the Quiz Is 100% Frontend

Decision to make:

- fully frontend-only
- frontend flow with backend submission on completion
- server-driven quiz

Recommendation:

Do not make the event-ready MVP 100% frontend.

Best MVP split:

- frontend handles the quiz experience, local progress, and transitions
- backend records the completion and generates the official verification state

Why:

- a purely frontend completion screen is easy to spoof
- raffle redemption works better if the completion proof comes from the backend
- the frontend can still feel instant while the backend provides trust

### 6. Where Answers Are Stored and Checked

Decision to make:

- answers only in client memory
- answers submitted only at the end
- answers submitted question-by-question

Recommendation:

For MVP, store the in-progress quiz locally and submit the final answers or final completion payload to the backend at the end.

Why:

- fewer network dependencies during the quiz
- simpler backend
- better resilience in outdoor connectivity conditions

Open question:

Do correct answers matter operationally, or is completion the only thing that matters?

Recommended answer for MVP:

- completion matters more than scoring
- correctness can still exist in the content model, but raffle qualification should probably be based on completion, not score

### 7. Verification Model

Decision to make:

- simple static completion screen
- client-generated completion code
- backend-issued token or signed proof

Recommendation:

Use a backend-issued completion token and a visually distinctive success screen.

Suggested completion proof:

- short human-readable code
- timestamp or event marker
- distinctive success layout/color treatment

Why:

- volunteers need something quick to trust
- a plain "finished" message is easy to fake

### 8. Anti-Abuse Level

Decision to make:

- no controls
- browser-only controls
- lightweight backend dedupe
- stronger fraud prevention

Recommendation:

Use lightweight anti-abuse only for MVP:

- local storage or cookie to discourage repeat entries
- backend dedupe keyed by event plus a lightweight device/session identifier

Why:

- strong anti-fraud is explicitly out of scope for MVP
- some minimum protection is still needed for raffle trust

### 9. Organizer Editing Workflow

Decision to make:

- edit JSON manually
- internal admin page
- external CMS
- database console only

Recommendation:

For the first prototype, JSON editing is acceptable.
For a usable MVP, add a minimal organizer/admin workflow.

That admin workflow does not need to be elaborate. It just needs to support:

- creating an event
- adding questions
- attaching sponsor information
- publishing the event

### 10. Backend / Data Platform

Decision to make:

- custom Node backend + Postgres
- Supabase
- Firebase
- Cloudflare Workers + D1
- another hosted backend

Recommendation:

Supabase is the most practical MVP default.

Why:

- gives us a hosted database quickly
- supports simple APIs and auth if needed later
- reduces custom backend setup work

Alternative:

- a tiny custom Node backend is also viable if we want more direct control

### 11. Hosting

Decision to make:

- one platform for everything
- static frontend host + separate backend/data host

Recommendation:

Use simple static hosting for the frontend and a managed backend/data provider.

Example setup:

- Vercel or Netlify for frontend
- Supabase for database/backend

Why:

- fast deploys
- low ops overhead
- easy iteration during prototype and MVP stages

### 12. Progress Persistence

Decision to make:

- no persistence
- session storage
- local storage
- backend draft progress

Recommendation:

Persist in-progress state locally in the browser.

Why:

- refreshes should not wipe progress during an event
- local persistence is simpler than backend draft state

### 13. Analytics

Decision to make:

- no analytics
- basic event counters
- detailed question-level analytics

Recommendation:

Track the minimum metrics needed to validate the product:

- quiz starts
- quiz completions
- completion rate
- completion time
- drop-off by question

Nice to have:

- sponsor exposure reporting

### 14. Accessibility and Outdoor Readability

Decision to make:

- informal best effort
- explicit standards

Recommendation:

Treat these as engineering requirements, not just design preferences.

At minimum:

- strong contrast
- large tap targets
- readable font sizes
- reduced motion support where appropriate
- no hover-dependent functionality

### 15. Testing Strategy

Decision to make:

- manual testing only
- unit tests only
- unit + end-to-end tests

Recommendation:

Use a lightweight but real testing strategy:

- unit tests for completion and verification logic
- end-to-end test for full quiz completion flow
- manual testing on actual phones

## Open Product-to-Engineering Questions

These still need explicit answers because they affect implementation:

1. Is raffle eligibility based on completion only, or on correctness?
2. Does each attendee get only one entry per device/browser, or can they replay?
3. Do organizers need a true non-technical admin interface for MVP?
4. Should sponsor logos/images be supported in MVP, or text only?
5. Does the volunteer need a separate verification tool, or is the success screen enough?
6. Do we need analytics visible to organizers, or only stored internally?

## Milestones

1. Prototype
Build a static-content version of the quiz flow with the intended UX and completion screen.

2. MVP
Add backend-backed completions, event content management, and basic analytics.

3. Event Ready
Validate performance, reliability, and volunteer redemption flow for live use.

4. Review
Assess participation, completion rate, sponsor value, and operational simplicity after the first event.
