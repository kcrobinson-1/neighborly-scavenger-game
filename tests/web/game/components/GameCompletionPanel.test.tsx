import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameCompletionPanel } from "../../../../apps/web/src/game/components/GameCompletionPanel.tsx";
import type { GameConfig } from "../../../../apps/web/src/data/games.ts";
import type { GameCompletionResult } from "../../../../apps/web/src/types/game.ts";

function createGame(overrides: Partial<GameConfig> = {}): GameConfig {
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
        explanation: "Sponsor note one.",
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
    score: 1,
    ...overrides,
  };
}

describe("GameCompletionPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the verification code and answer review for completed final-score games", () => {
    render(
      <GameCompletionPanel
        answers={{ q1: ["a"] }}
        completion={createCompletionResult()}
        completionError={null}
        game={createGame()}
        isSubmitting={false}
        onReset={() => {}}
        onRetake={() => {}}
        onRetrySubmission={() => {}}
        score={1}
        showRetake={true}
      />,
    );

    expect(screen.getByText("Reward entry ready")).toBeTruthy();
    expect(screen.getByText("MMP-1234ABCD")).toBeTruthy();
    expect(screen.getByText("Final score")).toBeTruthy();
    expect(screen.getByText("Your answer:", { exact: false })).toBeTruthy();
    expect(screen.getByText("Correct answer:", { exact: false })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Play again" })).toBeTruthy();
  });

  it("shows retry actions when completion failed", () => {
    const onReset = vi.fn();
    const onRetrySubmission = vi.fn();

    render(
      <GameCompletionPanel
        answers={{}}
        completion={null}
        completionError="Temporary backend problem."
        game={createGame()}
        isSubmitting={false}
        onReset={onReset}
        onRetake={() => {}}
        onRetrySubmission={onRetrySubmission}
        score={0}
        showRetake={true}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));

    expect(onRetrySubmission).toHaveBeenCalledTimes(1);
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.getByText("We couldn't load your check-in code")).toBeTruthy();
  });
});
