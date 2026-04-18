import { featuredGameSlug } from "./constants.ts";
import type { GameConfig } from "./types.ts";

/**
 * Sample game fixtures for tests and explicit local-only prototype fallback.
 * Published runtime content should come from database rows mapped through
 * db-content.ts, not from this fixture file.
 */

/** Sample game that demonstrates a standard game with final score reveal. */
const firstSampleGame: GameConfig = {
  id: "madrona-music-2026",
  slug: featuredGameSlug,
  name: "Madrona Music in the Playfield",
  allowBackNavigation: true,
  allowRetake: true,
  location: "Seattle",
  estimatedMinutes: 2,
  entitlementLabel: "reward ticket",
  summary:
    "Move through the game with explicit submit on each question and see your score plus the correct answers at the end.",
  feedbackMode: "final_score_reveal",
  intro: "Answer 6 quick questions, support local sponsors, and earn a reward ticket.",
  questions: [
    {
      id: "q1",
      sponsor: "Hi Spot Cafe",
      prompt: "Which local spot is sponsoring this neighborhood music series question?",
      selectionMode: "single",
      correctAnswerIds: ["a"],
      sponsorFact:
        "Hi Spot Cafe has been a long-running Madrona neighborhood favorite for brunch and community meetups.",
      options: [
        { id: "a", label: "Hi Spot Cafe" },
        { id: "b", label: "Space Needle" },
        { id: "c", label: "Pike Place Fish Throwers" },
      ],
    },
    {
      id: "q2",
      sponsor: "Bottlehouse",
      prompt: "What kind of experience should this game feel like?",
      selectionMode: "single",
      correctAnswerIds: ["b"],
      explanation:
        "The best version feels like a quick neighborhood game, not a long form.",
      options: [
        { id: "a", label: "A long signup form" },
        { id: "b", label: "A quick neighborhood game" },
        { id: "c", label: "A coupon checkout flow" },
      ],
    },
    {
      id: "q3",
      sponsor: "Cafe Flora",
      prompt: "How many questions should the MVP generally ask attendees?",
      selectionMode: "single",
      correctAnswerIds: ["b"],
      explanation:
        "Five to seven questions keeps the experience short while still giving sponsors meaningful visibility.",
      options: [
        { id: "a", label: "1 or 2" },
        { id: "b", label: "5 to 7" },
        { id: "c", label: "15 to 20" },
      ],
    },
    {
      id: "q4",
      sponsor: "Creature Consignment",
      prompt: "What matters most for reward eligibility in the MVP?",
      selectionMode: "single",
      correctAnswerIds: ["a"],
      explanation:
        "Completion matters more than score in the MVP so the flow stays simple and easy to redeem.",
      options: [
        { id: "a", label: "Finishing the game" },
        { id: "b", label: "Sharing on social media" },
        { id: "c", label: "Creating an account" },
      ],
    },
    {
      id: "q5",
      sponsor: "Central Co-op",
      prompt: "How should questions appear in the experience?",
      selectionMode: "single",
      correctAnswerIds: ["b"],
      explanation:
        "One visible card at a time keeps the flow readable, fast, and game-like on phones.",
      options: [
        { id: "a", label: "All visible on one long page" },
        { id: "b", label: "One card at a time" },
        { id: "c", label: "Inside pop-up windows" },
      ],
    },
    {
      id: "q6",
      sponsor: "Glasswing",
      prompt: "What should the final screen make obvious?",
      selectionMode: "single",
      correctAnswerIds: ["a"],
      sponsorFact:
        "A strong final verification moment helps volunteers trust the completion without digging through answers.",
      options: [
        { id: "a", label: "That the attendee is officially done" },
        { id: "b", label: "That there are hidden bonus levels" },
        { id: "c", label: "That they must check their email first" },
      ],
    },
  ],
};

/** Sample game that requires correct answers before progression. */
const sponsorSpotlightGame: GameConfig = {
  id: "madrona-sponsor-spotlight-2026",
  slug: "sponsor-spotlight",
  name: "Sponsor Spotlight Challenge",
  allowBackNavigation: true,
  allowRetake: true,
  location: "Seattle",
  estimatedMinutes: 3,
  entitlementLabel: "bonus reward ticket",
  summary:
    "You must submit the correct answer to move on, and each right answer reveals a sponsor fact before the next question.",
  feedbackMode: "instant_feedback_required",
  intro:
    "Choose an answer, submit it, and get it right to unlock quick sponsor facts and finish the challenge.",
  questions: [
    {
      id: "q1",
      sponsor: "Bottlehouse",
      prompt:
        "Which answer best describes why sponsors appear inside the game experience?",
      selectionMode: "single",
      correctAnswerIds: ["c"],
      sponsorFact:
        "Bottlehouse benefits more from active participation in a community moment than from a passive logo placement.",
      options: [
        { id: "a", label: "To interrupt players with ads" },
        { id: "b", label: "To replace the reward entirely" },
        { id: "c", label: "To feel integrated into the neighborhood event" },
      ],
    },
    {
      id: "q2",
      sponsor: "Central Co-op",
      prompt: "What keeps the game feeling playable outdoors on a phone?",
      selectionMode: "single",
      correctAnswerIds: ["b"],
      sponsorFact:
        "Central Co-op's sponsor moment works better when the interface stays legible, large, and thumb-friendly.",
      options: [
        { id: "a", label: "Long paragraphs and tiny controls" },
        { id: "b", label: "Large tap targets and one clear choice at a time" },
        { id: "c", label: "Multiple popups per question" },
      ],
    },
    {
      id: "q3",
      sponsor: "Cafe Flora",
      prompt: "What should happen after a correct answer in this game mode?",
      selectionMode: "single",
      correctAnswerIds: ["a"],
      sponsorFact:
        "A short sponsor fact keeps the moment informative without derailing the pace of the game.",
      options: [
        {
          id: "a",
          label: "Show a quick confirmation and sponsor fact before continuing",
        },
        { id: "b", label: "Jump straight to the homepage" },
        { id: "c", label: "Require an email address before moving on" },
      ],
    },
    {
      id: "q4",
      sponsor: "Glasswing",
      prompt: "What should a wrong answer do in this mode?",
      selectionMode: "single",
      correctAnswerIds: ["b"],
      explanation:
        "The player should try again because this mode is designed around getting the answer right before progressing.",
      options: [
        { id: "a", label: "Move on anyway without feedback" },
        { id: "b", label: "Prompt the player to try again" },
        { id: "c", label: "End the game immediately" },
      ],
    },
  ],
};

/** Sample game that exercises multiple-selection behavior. */
const communityChecklistGame: GameConfig = {
  id: "community-checklist-2026",
  slug: "community-checklist",
  name: "Community Checklist Game",
  allowBackNavigation: true,
  allowRetake: true,
  location: "Seattle",
  estimatedMinutes: 3,
  entitlementLabel: "sample reward ticket",
  summary:
    "Includes select-all-that-apply questions so we can validate multiple selection with an explicit submit button.",
  feedbackMode: "final_score_reveal",
  intro:
    "Some questions ask you to select all that apply before submitting your answer.",
  questions: [
    {
      id: "q1",
      sponsor: "Madrona Farmers Market",
      prompt: "Which behaviors support a strong neighborhood-event game experience?",
      selectionMode: "multiple",
      correctAnswerIds: ["a", "c", "d"],
      explanation:
        "The strongest experience is clear, mobile-friendly, and easy to finish in the flow of an event.",
      options: [
        { id: "a", label: "Large tap targets" },
        { id: "b", label: "Tiny multi-column forms" },
        { id: "c", label: "Visible progress" },
        { id: "d", label: "Short completion time" },
      ],
    },
    {
      id: "q2",
      sponsor: "Hi Spot Cafe",
      prompt: "What should a single-answer question allow before submission?",
      selectionMode: "single",
      correctAnswerIds: ["b"],
      explanation:
        "The user should be able to switch their selected answer before they decide to submit.",
      options: [
        { id: "a", label: "Lock the first tap immediately" },
        { id: "b", label: "Change the selected answer before pressing submit" },
        { id: "c", label: "Force a page reload between choices" },
      ],
    },
    {
      id: "q3",
      sponsor: "Central Co-op",
      prompt: "Which answers fit a select-all-that-apply question model?",
      selectionMode: "multiple",
      correctAnswerIds: ["a", "b"],
      sponsorFact:
        "Select-all questions are useful when a sponsor wants a slightly richer educational moment without changing the overall site structure.",
      options: [
        { id: "a", label: "Allow multiple active selections" },
        { id: "b", label: "Use one explicit submit button" },
        { id: "c", label: "Advance instantly after every tap" },
      ],
    },
  ],
};

/** All sample games bundled with the prototype. */
export const games: GameConfig[] = [
  firstSampleGame,
  sponsorSpotlightGame,
  communityChecklistGame,
];
