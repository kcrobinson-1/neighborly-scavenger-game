import type { GameConfig } from "../../../shared/game-config/types.ts";

/** Creates a small test game that exercises both single and multiple selection logic. */
export function createTestGame(): GameConfig {
  return {
    id: "test-game",
    slug: "test-game",
    name: "Test Game",
    location: "Seattle",
    estimatedMinutes: 2,
    raffleLabel: "test raffle",
    intro: "Test intro",
    summary: "Test summary",
    feedbackMode: "final_score_reveal",
    questions: [
      {
        id: "q1",
        sponsor: "Sponsor One",
        prompt: "Question one?",
        selectionMode: "single",
        correctAnswerIds: ["b"],
        options: [
          { id: "a", label: "Option A" },
          { id: "b", label: "Option B" },
        ],
      },
      {
        id: "q2",
        sponsor: "Sponsor Two",
        prompt: "Question two?",
        selectionMode: "multiple",
        correctAnswerIds: ["a", "c"],
        options: [
          { id: "a", label: "Option A" },
          { id: "b", label: "Option B" },
          { id: "c", label: "Option C" },
        ],
      },
    ],
  };
}
