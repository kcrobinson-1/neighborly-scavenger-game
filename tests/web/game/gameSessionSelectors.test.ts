import { describe, expect, it } from "vitest";
import type { GameConfig } from "../../../apps/web/src/data/games.ts";
import type { GameCompletionResult } from "../../../apps/web/src/types/game.ts";
import {
  getGameSessionScore,
  getGameSessionViewState,
} from "../../../apps/web/src/game/gameSessionSelectors.ts";
import { createGameState } from "../../../apps/web/src/game/gameSessionState.ts";

function createGame(
  overrides: Partial<GameConfig> = {},
): GameConfig {
  return {
    id: "test-game",
    slug: "test-game",
    name: "Test Game",
    location: "Seattle",
    estimatedMinutes: 2,
    entitlementLabel: "reward ticket",
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
    ...overrides,
  };
}

function createCompletionResult(
  overrides: Partial<GameCompletionResult> = {},
): GameCompletionResult {
  return {
    attemptNumber: 1,
    completionId: "cmp-123",
    entitlement: {
      createdAt: "2026-04-05T12:00:00.000Z",
      status: "new",
      verificationCode: "MMP-1234ABCD",
    },
    message: "You're checked in for the reward.",
    entitlementEligible: true,
    score: 2,
    ...overrides,
  };
}

describe("gameSessionSelectors", () => {
  it("derives the active question state for an in-progress game", () => {
    const game = createGame();
    const state = {
      ...createGameState("question", 100),
      currentIndex: 1,
      pendingSelection: ["a"],
    };

    expect(getGameSessionViewState(game, state)).toEqual({
      allowRetake: true,
      canGoBack: true,
      canSubmit: true,
      currentQuestion: game.questions[1],
      isComplete: false,
      isShowingCorrectFeedback: false,
      isShowingQuestion: true,
      isStarted: true,
      isSubmittingCompletion: false,
      progressValue: 100,
    });
  });

  it("keeps progress full for completion phases and respects disabled retakes", () => {
    const game = createGame({
      allowRetake: false,
      questions: [],
    });
    const state = createGameState("complete", 100);

    expect(getGameSessionViewState(game, state)).toEqual({
      allowRetake: false,
      canGoBack: false,
      canSubmit: false,
      currentQuestion: undefined,
      isComplete: true,
      isShowingCorrectFeedback: false,
      isShowingQuestion: false,
      isStarted: true,
      isSubmittingCompletion: false,
      progressValue: 100,
    });
  });

  it("prefers the trusted backend score over the local fallback score", () => {
    expect(getGameSessionScore(null, 1)).toBe(1);
    expect(getGameSessionScore(createCompletionResult({ score: 4 }), 1)).toBe(4);
  });
});
