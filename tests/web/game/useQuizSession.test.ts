import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameConfig } from "../../../apps/web/src/data/games.ts";
import type { QuizCompletionResult } from "../../../apps/web/src/types/quiz.ts";

const { mockCreateRequestId, mockSubmitQuizCompletion } = vi.hoisted(() => {
  return {
    mockCreateRequestId: vi.fn(),
    mockSubmitQuizCompletion: vi.fn(),
  };
});

// The reducer and side-effect orchestration are the behavior under test here,
// so we mock only the API boundary and request-id generator.
vi.mock("../../../apps/web/src/lib/quizApi.ts", () => ({
  submitQuizCompletion: mockSubmitQuizCompletion,
}));

vi.mock("../../../apps/web/src/lib/session.ts", () => ({
  createRequestId: mockCreateRequestId,
}));

import { useQuizSession } from "../../../apps/web/src/game/useQuizSession.ts";

function createCompletionResult(overrides: Partial<QuizCompletionResult> = {}): QuizCompletionResult {
  return {
    attemptNumber: 1,
    completionId: "cmp-123",
    entitlement: {
      createdAt: "2026-04-05T12:00:00.000Z",
      status: "new",
      verificationCode: "MMP-1234ABCD",
    },
    message: "You're checked in for the raffle.",
    raffleEligible: true,
    score: 2,
    ...overrides,
  };
}

// These fixtures are intentionally tiny so the tests can read like state-machine
// examples instead of repeating the full sample catalog.
function createFinalScoreGame(questionCount = 2): GameConfig {
  const questions = [
    {
      id: "q1",
      sponsor: "Sponsor One",
      prompt: "Question one?",
      selectionMode: "single" as const,
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
      selectionMode: "multiple" as const,
      correctAnswerIds: ["a", "c"],
      options: [
        { id: "a", label: "Option A" },
        { id: "b", label: "Option B" },
        { id: "c", label: "Option C" },
      ],
    },
  ];

  return {
    id: "test-final-score",
    slug: "test-final-score",
    name: "Test Final Score",
    location: "Seattle",
    estimatedMinutes: 2,
    raffleLabel: "raffle ticket",
    intro: "Test intro",
    summary: "Test summary",
    feedbackMode: "final_score_reveal",
    questions: questions.slice(0, questionCount),
  };
}

function createInstantFeedbackGame(): GameConfig {
  return {
    id: "test-instant-feedback",
    slug: "test-instant-feedback",
    name: "Test Instant Feedback",
    location: "Seattle",
    estimatedMinutes: 2,
    raffleLabel: "raffle ticket",
    intro: "Test intro",
    summary: "Test summary",
    feedbackMode: "instant_feedback_required",
    questions: [
      {
        id: "q1",
        sponsor: "Sponsor One",
        prompt: "Question one?",
        selectionMode: "single",
        correctAnswerIds: ["b"],
        sponsorFact: "Sponsor fact for the first answer.",
        explanation: "Choose the right answer to move on.",
        options: [
          { id: "a", label: "Option A" },
          { id: "b", label: "Option B" },
        ],
      },
      {
        id: "q2",
        sponsor: "Sponsor Two",
        prompt: "Question two?",
        selectionMode: "single",
        correctAnswerIds: ["a"],
        options: [
          { id: "a", label: "Option A" },
          { id: "b", label: "Option B" },
        ],
      },
    ],
  };
}

describe("useQuizSession", () => {
  beforeEach(() => {
    mockCreateRequestId.mockReset();
    mockSubmitQuizCompletion.mockReset();
    // A stable id makes the retry/idempotency assertions readable and matches
    // the product requirement that the same completion attempt reuses its key.
    mockCreateRequestId.mockReturnValue("req-123");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("submits the final-score flow and exposes the trusted completion result", async () => {
    const game = createFinalScoreGame();
    const completion = createCompletionResult();
    mockSubmitQuizCompletion.mockResolvedValue(completion);

    const { result } = renderHook(() => useQuizSession(game));

    act(() => {
      result.current.start();
      result.current.selectOption("b");
      result.current.submit();
    });

    expect(result.current.currentIndex).toBe(1);
    expect(result.current.answers).toEqual({ q1: ["b"] });

    act(() => {
      result.current.selectOption("c");
      result.current.selectOption("a");
      result.current.submit();
    });

    expect(result.current.isSubmittingCompletion).toBe(true);

    await waitFor(() => {
      expect(result.current.isComplete).toBe(true);
    });

    expect(result.current.latestCompletion).toEqual(completion);
    expect(result.current.score).toBe(completion.score);
    expect(mockSubmitQuizCompletion).toHaveBeenCalledTimes(1);

    const submission = mockSubmitQuizCompletion.mock.calls[0]?.[0];
    // The hook should submit canonical answer ordering because the backend and
    // persistence layer treat the shared config as the source of truth.
    expect(submission).toMatchObject({
      answers: {
        q1: ["b"],
        q2: ["a", "c"],
      },
      eventId: game.id,
      requestId: "req-123",
    });
    expect(submission?.durationMs).toEqual(expect.any(Number));
    expect(submission?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("keeps instant-feedback questions on the same step until the correct answer is submitted", () => {
    const { result } = renderHook(() => useQuizSession(createInstantFeedbackGame()));

    act(() => {
      result.current.start();
      result.current.selectOption("a");
      result.current.submit();
    });

    expect(result.current.currentIndex).toBe(0);
    expect(result.current.isShowingQuestion).toBe(true);
    expect(result.current.feedbackKind).toBe("incorrect");
    expect(result.current.feedbackMessage).toBe("Choose the right answer to move on.");
    expect(result.current.answers).toEqual({});

    act(() => {
      result.current.selectOption("b");
      result.current.submit();
    });

    expect(result.current.isShowingCorrectFeedback).toBe(true);
    expect(result.current.feedbackKind).toBe("correct");
    expect(result.current.feedbackMessage).toBe("Sponsor fact for the first answer.");
    expect(result.current.answers).toEqual({ q1: ["b"] });

    act(() => {
      result.current.continueFromCorrectFeedback();
    });

    expect(result.current.currentIndex).toBe(1);
    expect(result.current.isShowingQuestion).toBe(true);
    expect(result.current.feedbackKind).toBeNull();
  });

  it("restores the saved answer when navigating back to a previous question", () => {
    const { result } = renderHook(() => useQuizSession(createFinalScoreGame()));

    act(() => {
      result.current.start();
      result.current.selectOption("b");
      result.current.submit();
    });

    expect(result.current.currentIndex).toBe(1);
    expect(result.current.pendingSelection).toEqual([]);

    act(() => {
      result.current.goBack();
    });

    expect(result.current.currentIndex).toBe(0);
    expect(result.current.pendingSelection).toEqual(["b"]);
    expect(result.current.canSubmit).toBe(true);
  });

  it("retries completion with the same request id after a failed submission", async () => {
    const game = createFinalScoreGame(1);
    const completion = createCompletionResult({ score: 1 });

    mockSubmitQuizCompletion
      .mockRejectedValueOnce(new Error("Temporary backend problem."))
      .mockResolvedValueOnce(completion);

    const { result } = renderHook(() => useQuizSession(game));

    act(() => {
      result.current.start();
      result.current.selectOption("b");
      result.current.submit();
    });

    await waitFor(() => {
      expect(result.current.completionError).toBe("Temporary backend problem.");
    });

    expect(result.current.isComplete).toBe(true);
    expect(result.current.latestCompletion).toBeNull();

    act(() => {
      result.current.retryCompletionSubmission();
    });

    await waitFor(() => {
      expect(result.current.latestCompletion).toEqual(completion);
    });

    expect(mockSubmitQuizCompletion).toHaveBeenCalledTimes(2);
    // This is one of the key trust-boundary behaviors from the testing strategy:
    // a retry should preserve idempotency rather than mint a new completion id.
    expect(mockSubmitQuizCompletion.mock.calls[0]?.[0]).toMatchObject({
      requestId: "req-123",
    });
    expect(mockSubmitQuizCompletion.mock.calls[1]?.[0]).toMatchObject({
      requestId: "req-123",
    });
  });

  it("resets state for a retake without leaving the active question flow", async () => {
    const game = createFinalScoreGame(1);
    const completion = createCompletionResult({ score: 1 });
    mockSubmitQuizCompletion.mockResolvedValue(completion);

    const { result } = renderHook(() => useQuizSession(game));

    act(() => {
      result.current.start();
      result.current.selectOption("b");
      result.current.submit();
    });

    await waitFor(() => {
      expect(result.current.latestCompletion).toEqual(completion);
    });

    act(() => {
      result.current.resetForRetake();
    });

    expect(result.current.isStarted).toBe(true);
    expect(result.current.isShowingQuestion).toBe(true);
    expect(result.current.isComplete).toBe(false);
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.answers).toEqual({});
    expect(result.current.latestCompletion).toBeNull();
    expect(result.current.pendingSelection).toEqual([]);
  });
});
