import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockUsePathnameNavigation } = vi.hoisted(() => ({
  mockUsePathnameNavigation: vi.fn(),
}));

vi.mock("../../apps/web/src/usePathnameNavigation.ts", () => ({
  usePathnameNavigation: mockUsePathnameNavigation,
}));

vi.mock("../../apps/web/src/pages/LandingPage.tsx", () => ({
  LandingPage: () => <div>Landing Page</div>,
}));

vi.mock("../../apps/web/src/pages/AdminPage.tsx", () => ({
  AdminPage: ({ selectedEventId }: { selectedEventId?: string }) => (
    <div>Admin Page{selectedEventId ? `: ${selectedEventId}` : ""}</div>
  ),
}));

vi.mock("../../apps/web/src/pages/GameRoutePage.tsx", () => ({
  GameRoutePage: () => <div>Game Route Page</div>,
}));

vi.mock("../../apps/web/src/pages/NotFoundPage.tsx", () => ({
  NotFoundPage: () => <div>Not Found Page</div>,
}));

import App from "../../apps/web/src/App.tsx";

describe("App", () => {
  beforeEach(() => {
    mockUsePathnameNavigation.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the admin route when the pathname is /admin", () => {
    mockUsePathnameNavigation.mockReturnValue({
      navigate: vi.fn(),
      pathname: "/admin",
    });

    render(<App />);

    expect(screen.getByText("Admin Page")).toBeTruthy();
  });

  it("renders the admin event route with the selected event id", () => {
    mockUsePathnameNavigation.mockReturnValue({
      navigate: vi.fn(),
      pathname: "/admin/events/madrona-music-2026",
    });

    render(<App />);

    expect(screen.getByText("Admin Page: madrona-music-2026")).toBeTruthy();
  });
});
