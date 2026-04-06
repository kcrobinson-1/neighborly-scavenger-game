import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockListPublishedGameSummaries } = vi.hoisted(() => ({
  mockListPublishedGameSummaries: vi.fn(),
}));

vi.mock("../../../apps/web/src/lib/quizContentApi.ts", async () => {
  const actual = await vi.importActual<typeof import("../../../apps/web/src/lib/quizContentApi.ts")>(
    "../../../apps/web/src/lib/quizContentApi.ts",
  );

  return {
    ...actual,
    listPublishedGameSummaries: mockListPublishedGameSummaries,
  };
});

import { LandingPage } from "../../../apps/web/src/pages/LandingPage.tsx";

describe("LandingPage", () => {
  beforeEach(() => {
    mockListPublishedGameSummaries.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the published demo summaries after they load", async () => {
    mockListPublishedGameSummaries.mockResolvedValue([
      {
        feedbackMode: "final_score_reveal",
        id: "featured",
        name: "Featured Event",
        slug: "first-sample",
        summary: "Featured summary",
      },
      {
        feedbackMode: "instant_feedback_required",
        id: "secondary",
        name: "Secondary Event",
        slug: "secondary-event",
        summary: "Secondary summary",
      },
    ]);

    const onNavigate = vi.fn();
    render(<LandingPage onNavigate={onNavigate} />);

    expect(
      (screen.getByRole("button", {
        name: "Loading attendee demo...",
      }) as HTMLButtonElement).disabled,
    ).toBe(true);

    await screen.findByText("Featured summary");
    expect(screen.getByText("Secondary summary")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Try featured demo" }));
    expect(onNavigate).toHaveBeenCalledWith("/game/first-sample");
  });

  it("shows a retryable load error when published demos fail to load", async () => {
    mockListPublishedGameSummaries.mockRejectedValueOnce(
      new Error("Published read failed."),
    );
    mockListPublishedGameSummaries.mockResolvedValueOnce([
      {
        feedbackMode: "final_score_reveal",
        id: "featured",
        name: "Featured Event",
        slug: "first-sample",
        summary: "Featured summary",
      },
    ]);

    render(<LandingPage onNavigate={() => {}} />);

    expect(await screen.findByText("Published read failed.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Retry loading demos" }));

    await waitFor(() => {
      expect(mockListPublishedGameSummaries).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText("Featured summary")).toBeTruthy();
  });

  it("shows an explicit empty state when no published demos exist", async () => {
    mockListPublishedGameSummaries.mockResolvedValue([]);

    render(<LandingPage onNavigate={() => {}} />);

    expect(
      await screen.findByText("No published demo events are available right now."),
    ).toBeTruthy();
  });
});
