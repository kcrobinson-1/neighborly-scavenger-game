import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetQuizAdminStatus,
  mockListDraftEventSummaries,
  mockRequestAdminMagicLink,
  mockSignOutAdmin,
  mockUseAdminSession,
} = vi.hoisted(() => ({
  mockGetQuizAdminStatus: vi.fn(),
  mockListDraftEventSummaries: vi.fn(),
  mockRequestAdminMagicLink: vi.fn(),
  mockSignOutAdmin: vi.fn(),
  mockUseAdminSession: vi.fn(),
}));

vi.mock("../../../apps/web/src/admin/useAdminSession.ts", () => ({
  useAdminSession: mockUseAdminSession,
}));

vi.mock("../../../apps/web/src/lib/adminQuizApi.ts", () => ({
  getQuizAdminStatus: mockGetQuizAdminStatus,
  listDraftEventSummaries: mockListDraftEventSummaries,
  requestAdminMagicLink: mockRequestAdminMagicLink,
  signOutAdmin: mockSignOutAdmin,
}));

import { AdminPage } from "../../../apps/web/src/pages/AdminPage.tsx";

describe("AdminPage", () => {
  beforeEach(() => {
    mockGetQuizAdminStatus.mockReset();
    mockListDraftEventSummaries.mockReset();
    mockRequestAdminMagicLink.mockReset();
    mockSignOutAdmin.mockReset();
    mockUseAdminSession.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the sign-in form when no admin session exists", () => {
    mockUseAdminSession.mockReturnValue({
      status: "signed_out",
    });

    render(<AdminPage onNavigate={() => {}} />);

    expect(
      screen.getByRole("heading", {
        name: "Send a sign-in link to an admin email.",
      }),
    ).toBeTruthy();
    expect(screen.getByLabelText("Admin email")).toBeTruthy();
  });

  it("shows a success message after requesting a magic link", async () => {
    mockUseAdminSession.mockReturnValue({
      status: "signed_out",
    });
    mockRequestAdminMagicLink.mockResolvedValue(undefined);

    render(<AdminPage onNavigate={() => {}} />);

    fireEvent.change(screen.getByLabelText("Admin email"), {
      target: { value: "admin@example.com" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Email sign-in link" }));

    await waitFor(() => {
      expect(mockRequestAdminMagicLink).toHaveBeenCalledWith("admin@example.com");
    });
    expect(
      await screen.findByText("Check your email for the admin sign-in link."),
    ).toBeTruthy();
  });

  it("shows the request error when magic-link delivery fails", async () => {
    mockUseAdminSession.mockReturnValue({
      status: "signed_out",
    });
    mockRequestAdminMagicLink.mockRejectedValue(
      new Error("Email delivery is unavailable."),
    );

    render(<AdminPage onNavigate={() => {}} />);

    fireEvent.change(screen.getByLabelText("Admin email"), {
      target: { value: "admin@example.com" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Email sign-in link" }));

    expect(await screen.findByText("Email delivery is unavailable.")).toBeTruthy();
  });

  it("shows access denied for an authenticated non-admin session", async () => {
    mockUseAdminSession.mockReturnValue({
      email: "viewer@example.com",
      session: { access_token: "viewer-token" },
      status: "signed_in",
    });
    mockGetQuizAdminStatus.mockResolvedValue(false);

    render(<AdminPage onNavigate={() => {}} />);

    expect(
      await screen.findByRole("heading", {
        name: "This account is not allowlisted for quiz authoring.",
      }),
    ).toBeTruthy();
    expect(mockListDraftEventSummaries).not.toHaveBeenCalled();
  });

  it("shows the draft list for an authenticated admin session", async () => {
    mockUseAdminSession.mockReturnValue({
      email: "admin@example.com",
      session: { access_token: "admin-token" },
      status: "signed_in",
    });
    mockGetQuizAdminStatus.mockResolvedValue(true);
    mockListDraftEventSummaries.mockResolvedValue([
      {
        id: "madrona-music-2026",
        liveVersionNumber: 1,
        name: "Madrona Music in the Playfield",
        slug: "first-sample",
        updatedAt: "2026-04-07T16:15:00.000Z",
      },
    ]);

    render(<AdminPage onNavigate={() => {}} />);

    expect(
      await screen.findByRole("heading", { name: "Private draft events" }),
    ).toBeTruthy();
    expect(screen.getByText("Madrona Music in the Playfield")).toBeTruthy();
    expect(screen.getByText("Live v1")).toBeTruthy();
  });

  it("returns to the signed-out shell after sign-out completes", async () => {
    mockUseAdminSession.mockReturnValue({
      email: "admin@example.com",
      session: { access_token: "admin-token" },
      status: "signed_in",
    });
    mockGetQuizAdminStatus.mockResolvedValue(true);
    mockListDraftEventSummaries.mockResolvedValue([
      {
        id: "madrona-music-2026",
        liveVersionNumber: 1,
        name: "Madrona Music in the Playfield",
        slug: "first-sample",
        updatedAt: "2026-04-07T16:15:00.000Z",
      },
    ]);
    mockSignOutAdmin.mockImplementation(async () => {
      mockUseAdminSession.mockReturnValue({
        status: "signed_out",
      });
    });

    render(<AdminPage onNavigate={() => {}} />);

    await screen.findByRole("heading", { name: "Private draft events" });

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => {
      expect(mockSignOutAdmin).toHaveBeenCalledTimes(1);
    });
    expect(
      await screen.findByRole("heading", {
        name: "Send a sign-in link to an admin email.",
      }),
    ).toBeTruthy();
  });
});
