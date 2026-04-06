import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameConfig } from "../../../apps/web/src/data/games.ts";
import type { QuizCompletionResult } from "../../../apps/web/src/types/quiz.ts";

const { mockEnsureServerSession, mockUseQuizSession } = vi.hoisted(() => ({
  mockEnsureServerSession: vi.fn(),
  mockUseQuizSession: vi.fn(),
}));

vi.mock("../../../apps/web/src/lib/quizApi.ts", () => ({
  ensureServerSession: mockEnsureServerSession,
}));

vi.mock("../../../apps/web/src/game/useQuizSession.ts", () => ({
  useQuizSession: mockUseQuizSession,
}));

import { GamePage } from "../../../apps/web/src/pages/GamePage.tsx";

function createGame(overrides: Partial<GameConfig> = {}): GameConfig {
  return {
    id: "test-game",
    slug: "test-game",
    name: "Test Game",
    location: "Seattle",
    estimatedMinutes: 2,
    raffleLabel: "raffle ticket",
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
        explanation: "Explanation one.",
        options: [
          { id: "a", label: "Option A" },
          { id: "b", label: "Option B" },
        ],
      },
    ],
    ...overrides,
  };
}

function createCompletionResult(
  overrides: Partial<QuizCompletionResult> = {},
): QuizCompletionResult {
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
    score: 1,
    ...overrides,
  };
}

function createSessionState(game: GameConfig, overrides = {}) {
  return {
    answers: {},
    allowRetake: true,
    canGoBack: false,
    canSubmit: false,
    completionError: null,
    continueFromCorrectFeedback: vi.fn(),
    currentIndex: 0,
    currentQuestion: game.questions[0],
    feedbackKind: null,
    feedbackMessage: null,
    goBack: vi.fn(),
    isComplete: false,
    isShowingCorrectFeedback: false,
    isShowingQuestion: false,
    isStarted: false,
    isSubmittingCompletion: false,
    latestCompletion: null,
    pendingSelection: [],
    progressValue: 100,
    reset: vi.fn(),
    resetForRetake: vi.fn(),
    retryCompletionSubmission: vi.fn(),
    score: 0,
    selectOption: vi.fn(),
    start: vi.fn(),
    submit: vi.fn(),
    ...overrides,
  };
}

describe("GamePage", () => {
  beforeEach(() => {
    mockEnsureServerSession.mockReset();
    mockUseQuizSession.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the intro state and starts the server session before gameplay", async () => {
    const game = createGame();
    const sessionState = createSessionState(game);
    mockEnsureServerSession.mockResolvedValue(undefined);
    mockUseQuizSession.mockReturnValue(sessionState);

    render(<GamePage game={game} onNavigate={() => {}} />);

    expect(screen.getByText(`Finish to earn your ${game.raffleLabel}`)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Start quiz" }));

    await waitFor(() => {
      expect(mockEnsureServerSession).toHaveBeenCalledTimes(1);
    });
    expect(sessionState.start).toHaveBeenCalledTimes(1);
  });

  it("shows the start-screen error when the backend session bootstrap fails", async () => {
    const game = createGame();
    const sessionState = createSessionState(game);
    mockEnsureServerSession.mockRejectedValue(new Error("Backend is unavailable."));
    mockUseQuizSession.mockReturnValue(sessionState);

    render(<GamePage game={game} onNavigate={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Start quiz" }));

    expect(await screen.findByText("Backend is unavailable.")).toBeTruthy();
    expect(sessionState.start).not.toHaveBeenCalled();
  });

  it("renders the active question state and forwards question actions to the hook", () => {
    const game = createGame();
    const sessionState = createSessionState(game, {
      canSubmit: true,
      isShowingQuestion: true,
      isStarted: true,
      pendingSelection: ["a"],
      progressValue: 100,
    });
    mockUseQuizSession.mockReturnValue(sessionState);

    render(<GamePage game={game} onNavigate={() => {}} />);

    fireEvent.click(screen.getByRole("radio", { name: "Option B" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit answer" }));

    expect(screen.getAllByText("Question 1 of 1")).toHaveLength(2);
    expect(
      screen.getByRole("heading", { name: game.questions[0].prompt }),
    ).toBeTruthy();
    expect(sessionState.selectOption).toHaveBeenCalledWith("b");
    expect(sessionState.submit).toHaveBeenCalledTimes(1);
  });

  it("renders the completion state and forwards completion actions to the hook", () => {
    const game = createGame();
    const sessionState = createSessionState(game, {
      answers: { q1: ["a"] },
      currentQuestion: undefined,
      isComplete: true,
      isStarted: true,
      latestCompletion: createCompletionResult(),
      score: 1,
    });
    mockUseQuizSession.mockReturnValue(sessionState);

    render(<GamePage game={game} onNavigate={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Play again" }));
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));

    expect(screen.getByText("MMP-1234ABCD")).toBeTruthy();
    expect(sessionState.resetForRetake).toHaveBeenCalledTimes(1);
    expect(sessionState.reset).toHaveBeenCalledTimes(1);
  });
});
