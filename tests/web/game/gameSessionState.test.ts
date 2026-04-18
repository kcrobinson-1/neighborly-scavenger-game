import { describe, expect, it, vi } from "vitest";
import type { GameConfig } from "../../../apps/web/src/data/games.ts";
import type { GameCompletionResult } from "../../../apps/web/src/types/game.ts";
import {
  createCompletionRequestId,
  createGameState,
  gameReducer,
} from "../../../apps/web/src/game/gameSessionState.ts";

const { mockCreateRequestId } = vi.hoisted(() => ({
  mockCreateRequestId: vi.fn(),
}));

vi.mock("../../../apps/web/src/lib/session.ts", () => ({
  createRequestId: mockCreateRequestId,
}));

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

function createQuestion(
  overrides: Partial<GameConfig["questions"][number]> = {},
): GameConfig["questions"][number] {
  return {
    id: "q1",
    sponsor: "Sponsor One",
    prompt: "Question one?",
    selectionMode: "single",
    correctAnswerIds: ["b"],
    options: [
      { id: "a", label: "Option A" },
      { id: "b", label: "Option B" },
    ],
    ...overrides,
  };
}

describe("gameSessionState", () => {
  it("creates a fresh intro state by default", () => {
    expect(createGameState()).toEqual({
      answers: {},
      completionError: null,
      completionRequestId: null,
      currentIndex: 0,
      feedbackKind: null,
      feedbackMessage: null,
      latestCompletion: null,
      pendingSelection: [],
      phase: "intro",
      startedAt: null,
    });
  });

  it("creates a completion request id only for the last question", () => {
    mockCreateRequestId.mockReturnValue("req-123");

    expect(createCompletionRequestId(0, 2)).toBeNull();
    expect(createCompletionRequestId(1, 2)).toBe("req-123");
  });

  it("moves a final-score game into completion submission on the last question", () => {
    const state = {
      ...createGameState("question", 100),
      answers: { q0: ["a"] },
      currentIndex: 1,
      pendingSelection: ["c", "a"],
    };
    const question = createQuestion({
      id: "q2",
      selectionMode: "multiple",
      correctAnswerIds: ["a", "c"],
      options: [
        { id: "a", label: "Option A" },
        { id: "b", label: "Option B" },
        { id: "c", label: "Option C" },
      ],
    });

    expect(
      gameReducer(state, {
        type: "submitFinalScore",
        completionRequestId: "req-123",
        nextQuestionId: null,
        question,
        questionCount: 2,
      }),
    ).toEqual({
      ...state,
      answers: {
        q0: ["a"],
        q2: ["a", "c"],
      },
      completionError: null,
      completionRequestId: "req-123",
      currentIndex: 1,
      feedbackKind: null,
      feedbackMessage: null,
      pendingSelection: [],
      phase: "submitting_completion",
    });
  });

  it("keeps instant-feedback games on the same question until the answer is correct", () => {
    const question = createQuestion({
      explanation: "Choose the right answer to move on.",
    });
    const questionState = {
      ...createGameState("question", 100),
      pendingSelection: ["a"],
    };

    expect(
      gameReducer(questionState, {
        type: "submitRequired",
        question,
      }),
    ).toEqual({
      ...questionState,
      completionError: null,
      feedbackKind: "incorrect",
      feedbackMessage: "Choose the right answer to move on.",
    });

    expect(
      gameReducer(
        {
          ...questionState,
          pendingSelection: ["b"],
        },
        {
          type: "submitRequired",
          question: createQuestion({
            sponsorFact: "Sponsor fact for the first answer.",
            explanation: "Choose the right answer to move on.",
          }),
        },
      ),
    ).toEqual({
      ...questionState,
      answers: { q1: ["b"] },
      completionError: null,
      feedbackKind: "correct",
      feedbackMessage: "Sponsor fact for the first answer.",
      pendingSelection: ["b"],
      phase: "correct_feedback",
    });
  });

  it("restores the saved answer when going back to a previous question", () => {
    const state = {
      ...createGameState("question", 100),
      answers: {
        q1: ["b"],
      },
      currentIndex: 1,
      pendingSelection: [],
    };

    expect(
      gameReducer(state, {
        type: "goBack",
        previousQuestionId: "q1",
      }),
    ).toEqual({
      ...state,
      completionError: null,
      currentIndex: 0,
      feedbackKind: null,
      feedbackMessage: null,
      pendingSelection: ["b"],
    });
  });

  it("allows a failed completion to retry with the same request id", () => {
    const failedState = gameReducer(
      {
        ...createGameState("submitting_completion", 100),
        completionRequestId: "req-123",
      },
      {
        type: "failCompletionSubmit",
        message: "Temporary backend problem.",
      },
    );

    expect(
      gameReducer(failedState, {
        type: "beginCompletionSubmit",
        completionRequestId: "req-123",
      }),
    ).toEqual({
      ...failedState,
      completionError: null,
      completionRequestId: "req-123",
      phase: "submitting_completion",
    });
  });

  it("resets the reducer into an active run for retakes", () => {
    expect(
      gameReducer(
        {
          ...createGameState("complete", 100),
          latestCompletion: createCompletionResult(),
        },
        {
          type: "resetForRetake",
          startedAt: 500,
        },
      ),
    ).toEqual(createGameState("question", 500));
  });
});
