# Neighborhood Game Quiz — UX Philosophy and Experience

## Document Role

This doc describes how the product should feel and behave for users.

It should answer questions like:

- What should the experience feel like?
- What should the user flow look like?
- How should the interface be laid out on mobile?
- How should sponsors appear in the experience?
- What should the completion moment communicate?

Implementation details such as backend structure, data ownership, and stack choice belong in `architecture.md` and `dev.md`.

## UX Philosophy

The product should feel like a neighborhood game booth that happens to live on a phone, not a survey that happens to offer a prize.

That philosophy leads to six core decisions:

1. Real-world first  
The experience must work for distracted people standing outdoors, often one-handed, in bright light, with inconsistent connectivity.

2. Game energy, not game complexity  
The interaction should feel playful, fast, and rewarding without introducing rules, instructions, or mechanics that need explanation.

3. One decision at a time  
Each screen should ask for exactly one meaningful action. Reading, selecting, and continuing should feel obvious at a glance.

4. Momentum over browsing  
The product should pull users forward with progress, pacing, and visual confidence. It should never feel like a long form or a website to explore.

5. Sponsor presence without sponsor drag  
Sponsors should feel like part of the event experience, not an interruption. Their presence should add local character, not friction.

6. Completion must feel official  
The final state has to be unmistakable so a volunteer can verify it in seconds and hand over the raffle ticket with confidence.

## Product UX Principles

- Mobile-first is not a responsive afterthought. The phone experience is the product.
- Fast beats clever. Anything that adds interpretation cost should be removed.
- Short beats rich. Five to seven questions is enough.
- Legibility beats decoration. Outdoor readability matters more than visual density.
- Progress should always be visible.
- Error states should be rare, plain-language, and recoverable in one tap.

## Experience Structure

The attendee-facing experience should be extremely short and linear:

1. Entry screen
2. Question sequence
3. Completion / raffle verification screen

There should not be a traditional marketing-style homepage in front of the game. The QR code should open directly into the event quiz experience, with only a minimal entry screen that confirms:

- event name
- short value proposition
- estimated time to complete
- raffle reward
- primary CTA

Example entry promise: "Answer 6 quick questions, support local sponsors, and get a raffle ticket in under 2 minutes."

## Should Each Question Be Its Own Page?

No. Each question should be a single visible card inside a lightweight SPA flow, not a separate hard-loaded page.

Why:

- It supports the product principle that the experience should feel instant.
- It avoids network-dependent page reloads at an outdoor event.
- It feels more like a game sequence and less like a form wizard.
- It keeps the user anchored in one consistent interface with visible progress.
- It aligns with the current architecture direction of a SPA frontend with a single fetch.

Important nuance: each question should still behave like its own step.

That means:

- only one question visible at a time
- clear progress indicator
- transition forward after an explicit submit action
- allow a back action so attendees can revisit and change previously submitted answers before finishing
- local state persistence so refreshes do not reset progress unnecessarily

So the right model is: one application shell, one card at a time, one step per view.

## Recommended User Flow

### A) Attendee Flow
1. Sees QR code or short link at the event
2. Lands on a simple entry screen with event title, time-to-complete, and raffle CTA
3. Starts the game with one tap
4. Answers 5-7 questions, one card at a time
5. Can move backward during the quiz to review or change submitted answers
6. Sees a clear completion state with verification token or visual pattern
7. Shows the completion screen to a volunteer
8. Receives raffle ticket
9. May optionally retake the quiz for fun or score improvement without earning another raffle entry

### B) Volunteer Flow
1. Sees attendee completion screen
2. Confirms visual proof quickly
3. Gives raffle ticket

The volunteer should never need to navigate a dashboard or inspect answers.

### C) Organizer Flow
1. Creates event
2. Adds questions and sponsor attributions
3. Publishes the quiz
4. Shares QR code
5. Runs event with little or no live intervention

## Visual Direction

The visual system should feel local, warm, civic, and festive. It should not feel corporate, arcade-neon, or like generic startup SaaS.

### Color Approach

Use a small, high-contrast palette that reads well outdoors:

- Background: warm paper / cream `#F6F1E7`
- Primary text: deep evergreen `#1F3A32`
- Primary action: sunset orange `#D96B2B`
- Secondary accent: lake blue `#2F6F8F`
- Highlight / progress accent: marigold `#E3B23C`
- Success / completion: fresh green `#3F8F5A`

Rules:

- Keep the background light for daylight readability.
- Use dark text instead of light gray text.
- Use saturated accents sparingly so CTAs feel obvious.
- Allow event theming through a single accent override, but keep core contrast intact.

### Typography

Typography should feel friendly and event-like, not bureaucratic.

- Display or heading font: something with character and warmth
- Body font: highly legible sans serif
- Large type sizes by default
- Short line lengths on mobile

The tone should say "community event" rather than "application form."

## Layout System

### Mobile Layout

The default layout should be a vertically stacked, single-column flow sized for small phones.

Recommended structure:

- top area: event name + progress
- center: question card
- bottom: answer options and CTA

Layout rules:

- generous horizontal padding
- large tap targets
- plenty of spacing between options
- no dense header/navigation chrome
- no tiny footer links competing for attention
- no multi-column layouts on phones

Each question card should feel focused and self-contained, with:

- one short question prompt
- optional sponsor line or logo treatment
- 2-4 large answer buttons
- obvious next state

### Desktop / Large Screen Layout

Desktop should not become a wide dashboard. It should preserve the focused mobile rhythm.

Recommended behavior:

- center the experience in a narrow column or phone-frame canvas
- optionally place lightweight event context beside it on very large screens
- keep answer interactions and reading width similar to mobile

The experience should feel consistent across devices, not redesigned.

## Mobile Responsiveness Requirements

- All primary actions must be thumb-friendly.
- Minimum tap targets should feel comfortably large in motion.
- Text must remain readable in bright outdoor conditions.
- Progress, buttons, and completion proof must stay above the fold on common phone sizes.
- Animations should be subtle and fast, never blocking.
- The UI should tolerate slow or unstable connections after initial load.

Avoid:

- long scrolling pages
- multi-step forms with tiny inputs
- modal stacks
- hover-dependent interactions
- carousels or hidden gestures

## Interaction Design

The quiz should feel brisk and reassuring.

### Question Behavior

- Show one question at a time
- Favor tap-to-select interactions over typing
- Let the user change their selection before submitting
- Use an explicit submit CTA for each question
- For single-answer questions, allow only one selected answer at a time
- For multiple-answer questions, allow multiple selected answers before submit
- Allow the user to go back to earlier questions and resubmit before the quiz is complete
- Keep transitions quick and directional so users feel progress

## Quiz Feedback Modes

Different quizzes may need different answer-feedback behavior. The product should support this as a game-level configuration rather than assuming every quiz behaves the same way.

Recommended modes:

- `final_score_reveal`
- `instant_feedback_required`
- optional later: `instant_feedback_non_blocking`

Important requirement:

Any quiz using these modes needs a defined correct answer for each scored question.

### Final Score Reveal

In this mode, the attendee moves through the full quiz without interruption and sees the results at the end.

Recommended end state:

- final score
- correct answers
- the attendee's answers
- optional sponsor facts or explanations

This should be the default mode for most event quizzes because it is the fastest and lowest-friction.

For this mode to work, each scored question must include a correct answer in the quiz configuration.

### Instant Feedback Required

In this mode, the attendee must answer correctly before moving on.

Recommended sequence:

1. attendee selects an answer
2. if the answer is wrong, the interface prompts them to try again
3. if the answer is correct, show a short confirmation such as "Correct"
4. optionally show a sponsor fact or company detail
5. continue to the next question

This mode makes the quiz feel more game-like and gives sponsors a natural educational moment, but it adds friction and should be used intentionally.

This mode depends on each question having a correct answer available at runtime.

### Recommended UX Rules

- Keep one feedback mode consistent for an entire quiz.
- Do not mix required-correct and end-of-quiz scoring within the same MVP experience.
- Keep sponsor facts short and immediately relevant.
- If raffle entry is based on completion, make that clear even when score is shown.
- Treat score as fun feedback unless the product intentionally changes its prize rules later.

### Progress

Progress should always be visible and concrete, such as:

- "Question 3 of 6"
- progress bar with clear step count

Users should never wonder how much is left.

### Sponsor Presentation

Sponsors should appear as part of the card, not as competing ad units.

Good patterns:

- "Sponsored by [Local Business]"
- small sponsor badge or logo lockup
- question copy connected naturally to the sponsor

Bad patterns:

- popups
- interstitial ads
- autoplay media
- multiple sponsor messages on one screen

## Completion Screen

The completion screen is one of the most important moments in the product.

It should:

- feel celebratory but clear
- confirm that the user is done
- provide a simple visual signal for volunteers
- explain the final action in one sentence

Recommended elements:

- strong success headline
- raffle-entry confirmation
- large verification token, badge, or timestamped proof state
- instruction such as "Show this screen to the volunteer table"

Before that official proof arrives, the app should show a dedicated completion-pending state immediately after the last answer is submitted.

Recommended pending-state rules:

- keep the completion screen visually distinct from quiz cards even while proof is still loading
- reserve the same proof area that will later show the verification token so the official state does not pop in late and shove the layout downward
- use one clear instruction such as "Keep this screen open while we generate your verification code"
- avoid showing retake, restart, or answer-review actions until the trusted completion response is ready
- if verification fails, replace the waiting state with a plain-language retry state and a single obvious retry action

If retakes are allowed, the completion state should also make the reward rule explicit:

- the attendee has already earned their raffle entry
- retaking the quiz is allowed for fun, learning, or a better score
- retaking the quiz does not create an additional raffle ticket

This screen should look materially different from the quiz cards so nobody mistakes it for another step.

## Content Guidelines

- Questions should be short enough to scan in a few seconds.
- Avoid paragraph-length setup text.
- Keep answer choices concise.
- Use plain language over clever copy.
- If a sponsor wants more brand presence, give it through tasteful framing, not more words.

## UX Constraints

- No account creation
- No typing required for MVP
- No explanation required to start
- Redemption must be obvious
- Confusion equals failure

## UX Hand-Off to Engineering

The experience requirements that engineering must preserve are:

- the attendee flow should feel like one uninterrupted game sequence
- only one question should be visible at a time
- progress should always be visible
- the interface should remain usable in bright outdoor conditions on small phones
- refreshes and brief connectivity problems should not destroy confidence
- the final completion state should feel official and easy for volunteers to verify

The exact technical implementation of those requirements belongs in `architecture.md` and `dev.md`.
