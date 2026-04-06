import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameConfig } from "../../../apps/web/src/data/games.ts";

const { mockLoadPublishedGameBySlug } = vi.hoisted(() => ({
  mockLoadPublishedGameBySlug: vi.fn(),
}));

vi.mock("../../../apps/web/src/lib/quizContentApi.ts", () => ({
  loadPublishedGameBySlug: mockLoadPublishedGameBySlug,
}));

vi.mock("../../../apps/web/src/pages/GamePage.tsx", () => ({
  GamePage: ({ game }: { game: GameConfig }) => <div>Loaded game: {game.name}</div>,
}));

import { GameRoutePage } from "../../../apps/web/src/pages/GameRoutePage.tsx";

function createGame(overrides: Partial<GameConfig> = {}): GameConfig {
  return {
    allowBackNavigation: true,
    allowRetake: true,
    estimatedMinutes: 2,
    feedbackMode: "final_score_reveal",
    id: "test-game",
    intro: "Test intro",
    location: "Seattle",
    name: "Test Game",
    raffleLabel: "raffle ticket",
    slug: "test-game",
    summary: "Test summary",
    questions: [
      {
        correctAnswerIds: ["a"],
        id: "q1",
        options: [{ id: "a", label: "Option A" }],
        prompt: "Question one?",
        selectionMode: "single",
        sponsor: "Sponsor One",
      },
    ],
    ...overrides,
  };
}

describe("GameRoutePage", () => {
  beforeEach(() => {
    mockLoadPublishedGameBySlug.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("loads a published slug and renders the quiz page", async () => {
    mockLoadPublishedGameBySlug.mockResolvedValue(createGame({ name: "Loaded Event" }));

    render(<GameRoutePage onNavigate={() => {}} slug="loaded-event" />);

    expect(await screen.findByText("Loaded game: Loaded Event")).toBeTruthy();
    expect(mockLoadPublishedGameBySlug).toHaveBeenCalledWith("loaded-event");
  });

  it("shows an unavailable state when the slug has no published event", async () => {
    const onNavigate = vi.fn();
    mockLoadPublishedGameBySlug.mockResolvedValue(null);

    render(<GameRoutePage onNavigate={onNavigate} slug="missing-event" />);

    expect(
      await screen.findByRole("heading", {
        name: "This quiz isn't available right now.",
      }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Go to demo overview" }));
    expect(onNavigate).toHaveBeenCalledWith("/");
  });

  it("shows a retryable load error when the published read fails", async () => {
    mockLoadPublishedGameBySlug.mockRejectedValueOnce(new Error("Quiz read failed."));
    mockLoadPublishedGameBySlug.mockResolvedValueOnce(createGame({ name: "Recovered Event" }));

    render(<GameRoutePage onNavigate={() => {}} slug="broken-event" />);

    expect(await screen.findByText("Quiz read failed.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Retry loading quiz" }));

    await waitFor(() => {
      expect(mockLoadPublishedGameBySlug).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText("Loaded game: Recovered Event")).toBeTruthy();
  });
});
