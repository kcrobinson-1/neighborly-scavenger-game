# Neighborhood Game — Product Overview

## Document Role

This doc explains why the product should exist, who it serves, what success looks like, and what stays out of scope.

Related docs:

- `experience.md` covers the attendee, volunteer, and organizer experience
- `architecture.md` covers system shape, data, and backend responsibilities
- `dev.md` covers implementation choices, tooling, and milestone sequencing
- `open-questions.md` tracks unresolved product and operating decisions that the repo should not guess

## Purpose
A mobile-first neighborhood game designed for local events (concerts, fairs, markets) that drives sponsor engagement and reward participation through a short, interactive game experience. Organizers control all content and sponsorships, enabling lightweight fundraising without adding operational complexity.

## Problem
Neighborhood associations have limited, low-friction ways to:
- Generate meaningful sponsor revenue beyond logos and banners
- Engage attendees during events in a way that feels fun and optional
- Connect local businesses to the community in a measurable way

Existing tools (forms, generic trivia platforms) are not designed for in-person, mobile, event-based engagement.

## Solution
Provide a fast, mobile-native game experience that:
- Feels like a lightweight game, not a form
- Takes under 2 minutes to complete
- Rewards completion with a reward entry
- Embeds sponsor visibility directly into questions

Organizers configure the game, sell sponsored questions to local businesses, and use the game as both an engagement and fundraising tool.

## Current Implemented Slice

Today the repo implements:

- a demo-overview landing page at `/`
- published attendee game routes at `/event/:slug/game`
- backend-verified completion with one entitlement per event/session pair
- shared game correctness, validation, and scoring logic
- an organizer-facing admin workspace at `/admin` for drafting, editing, publishing, and unpublishing events
- `game_starts` table and session-issuance write so analytics has the funnel denominator (starts → completions → entitlements) before the first live event

What remains as future product work:

- admin draft preview (let an organizer see the attendee experience before publishing)
- organizer-visible reporting surface for post-event metrics
- richer live-event operations (slug expiry, scheduled publish, multi-game events)

## Target Users

### Primary (Buyer / Operator)
- Neighborhood association organizers
- Event coordinators for local community events

### End Users
- Event attendees (families, individuals at concerts/fairs)

### Indirect Stakeholders
- Local business sponsors

## Core Value Proposition

### For Organizers
- New, simple fundraising mechanism tied to engagement
- Minimal setup and operational overhead
- Reusable year over year

### For Attendees
- Quick, fun activity during the event
- Chance to win a reward prize
- Discover local businesses in a low-pressure way

### For Sponsors
- Active engagement (not passive logo placement)
- Association with a community experience
- Potential for recall and foot traffic

## Product Principles
1. Mobile-first, outdoor-ready  
2. Zero friction  
3. Short and engaging  
4. Feels like a game, not a form  
5. Operationally simple  

## Non-Goals (MVP)
- Building a generalized SaaS platform  
- Complex analytics dashboards  
- Strong anti-fraud systems  
- Payments or billing infrastructure  

## Context of First Use
Initial deployment: Madrona Music in the Playfield (Seattle neighborhood concert series)

This event will serve as the primary validation environment for:
- Participation rate
- Sponsor willingness to pay
- Operational simplicity
- Real-world UX performance

## Definition of Success (Initial Event)
- Attendees can discover, complete, and redeem the game without assistance  
- Volunteers can verify completion easily  
- Organizers can set up the experience in under 1 hour  
- At least one sponsor expresses willingness to pay for inclusion in future events  

---

# Success Criteria

## Event-Level KPIs
- ≥30% of estimated attendees start the game  
- ≥70% of participants complete the game  
- At least 1–3 sponsors express willingness to pay for inclusion in a future event  

## UX KPIs
- Median completion time ≤ 2 minutes  
- Page load / transition time feels instantaneous (<500ms perceived delay)  
- After the last answer, the app immediately shows a stable verification-in-progress state with explicit wait guidance until official proof is ready  
- No critical errors during event usage  

## Operational KPIs
- Organizer setup time ≤ 1 hour  
- Volunteers can be trained in ≤ 2 minutes  
- No real-time technical intervention required during event
