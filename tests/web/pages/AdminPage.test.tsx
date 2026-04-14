import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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

const draftSummaries = [
  {
    id: "madrona-music-2026",
    liveVersionNumber: 1,
    name: "Madrona Music in the Playfield",
    slug: "first-sample",
    updatedAt: "2026-04-07T16:15:00.000Z",
  },
  {
    id: "draft-market-2026",
    liveVersionNumber: null,
    name: "Draft Market Day",
    slug: "draft-market",
    updatedAt: "2026-04-08T16:15:00.000Z",
  },
];

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

  it("does not load drafts when admin configuration is missing", () => {
    mockUseAdminSession.mockReturnValue({
      message: "Supabase env vars are missing.",
      status: "missing_config",
    });

    render(<AdminPage onNavigate={() => {}} />);

    expect(
      screen.getByRole("heading", {
        name: "Admin auth needs Supabase configuration.",
      }),
    ).toBeTruthy();
    expect(mockGetQuizAdminStatus).not.toHaveBeenCalled();
    expect(mockListDraftEventSummaries).not.toHaveBeenCalled();
  });

  it("shows the event workspace for an authenticated admin session", async () => {
    mockUseAdminSession.mockReturnValue({
      email: "admin@example.com",
      session: { access_token: "admin-token" },
      status: "signed_in",
    });
    mockGetQuizAdminStatus.mockResolvedValue(true);
    mockListDraftEventSummaries.mockResolvedValue(draftSummaries);

    render(<AdminPage onNavigate={() => {}} />);

    expect(
      await screen.findByRole("heading", { name: "Event workspace" }),
    ).toBeTruthy();
    expect(screen.getByText("2 events")).toBeTruthy();
    expect(screen.getByText("1 live")).toBeTruthy();
    expect(screen.getByText("1 draft only")).toBeTruthy();
    expect(screen.getByText("Madrona Music in the Playfield")).toBeTruthy();
    expect(screen.getByText("Draft Market Day")).toBeTruthy();
    expect(screen.getByText("Live v1")).toBeTruthy();
    expect(screen.getByText("Draft only")).toBeTruthy();
  });

  it("uses singular event count copy for one draft", async () => {
    mockUseAdminSession.mockReturnValue({
      email: "admin@example.com",
      session: { access_token: "admin-token" },
      status: "signed_in",
    });
    mockGetQuizAdminStatus.mockResolvedValue(true);
    mockListDraftEventSummaries.mockResolvedValue([draftSummaries[0]]);

    render(<AdminPage onNavigate={() => {}} />);

    expect(await screen.findByText("1 event")).toBeTruthy();
    expect(screen.getByText("1 live")).toBeTruthy();
    expect(screen.getByText("0 draft only")).toBeTruthy();
  });

  it("navigates from event cards to workspaces and live quiz routes", async () => {
    const navigate = vi.fn();
    mockUseAdminSession.mockReturnValue({
      email: "admin@example.com",
      session: { access_token: "admin-token" },
      status: "signed_in",
    });
    mockGetQuizAdminStatus.mockResolvedValue(true);
    mockListDraftEventSummaries.mockResolvedValue(draftSummaries);

    render(<AdminPage onNavigate={navigate} />);

    const liveEventCard = await screen.findByLabelText(
      "Madrona Music in the Playfield event",
    );
    fireEvent.click(
      within(liveEventCard).getByRole("button", { name: "Open workspace" }),
    );
    fireEvent.click(
      within(liveEventCard).getByRole("button", { name: "Open live quiz" }),
    );

    expect(navigate).toHaveBeenCalledWith("/admin/events/madrona-music-2026");
    expect(navigate).toHaveBeenCalledWith("/game/first-sample");
    expect(screen.getAllByRole("button", { name: "Open live quiz" })).toHaveLength(1);
  });

  it("shows a read-only selected event workspace", async () => {
    mockUseAdminSession.mockReturnValue({
      email: "admin@example.com",
      session: { access_token: "admin-token" },
      status: "signed_in",
    });
    mockGetQuizAdminStatus.mockResolvedValue(true);
    mockListDraftEventSummaries.mockResolvedValue(draftSummaries);

    render(
      <AdminPage
        onNavigate={() => {}}
        selectedEventId="madrona-music-2026"
      />,
    );

    expect(
      await screen.findByRole("heading", {
        name: "Madrona Music in the Playfield",
      }),
    ).toBeTruthy();
    expect(screen.getByText("Read-only workspace")).toBeTruthy();
    expect(screen.getByText("Slug: first-sample")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back to all events" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Publish" })).toBeNull();
  });

  it("shows an admin-only not-found state for an unknown selected event", async () => {
    const navigate = vi.fn();
    mockUseAdminSession.mockReturnValue({
      email: "admin@example.com",
      session: { access_token: "admin-token" },
      status: "signed_in",
    });
    mockGetQuizAdminStatus.mockResolvedValue(true);
    mockListDraftEventSummaries.mockResolvedValue(draftSummaries);

    render(
      <AdminPage
        onNavigate={navigate}
        selectedEventId="missing-event"
      />,
    );

    expect(
      await screen.findByRole("heading", {
        name: "Event workspace not found",
      }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Back to all events" }));

    expect(navigate).toHaveBeenCalledWith("/admin");
  });

  it("returns to the signed-out shell after sign-out completes", async () => {
    mockUseAdminSession.mockReturnValue({
      email: "admin@example.com",
      session: { access_token: "admin-token" },
      status: "signed_in",
    });
    mockGetQuizAdminStatus.mockResolvedValue(true);
    mockListDraftEventSummaries.mockResolvedValue(draftSummaries);
    mockSignOutAdmin.mockImplementation(async () => {
      mockUseAdminSession.mockReturnValue({
        status: "signed_out",
      });
    });

    render(<AdminPage onNavigate={() => {}} />);

    await screen.findByRole("heading", { name: "Event workspace" });

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
