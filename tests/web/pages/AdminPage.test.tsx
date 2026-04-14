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
  mockLoadDraftEvent,
  mockRequestAdminMagicLink,
  mockSaveDraftEvent,
  mockSignOutAdmin,
  mockUseAdminSession,
} = vi.hoisted(() => ({
  mockGetQuizAdminStatus: vi.fn(),
  mockListDraftEventSummaries: vi.fn(),
  mockLoadDraftEvent: vi.fn(),
  mockRequestAdminMagicLink: vi.fn(),
  mockSaveDraftEvent: vi.fn(),
  mockSignOutAdmin: vi.fn(),
  mockUseAdminSession: vi.fn(),
}));

vi.mock("../../../apps/web/src/admin/useAdminSession.ts", () => ({
  useAdminSession: mockUseAdminSession,
}));

vi.mock("../../../apps/web/src/lib/adminQuizApi.ts", () => ({
  getQuizAdminStatus: mockGetQuizAdminStatus,
  listDraftEventSummaries: mockListDraftEventSummaries,
  loadDraftEvent: mockLoadDraftEvent,
  requestAdminMagicLink: mockRequestAdminMagicLink,
  saveDraftEvent: mockSaveDraftEvent,
  signOutAdmin: mockSignOutAdmin,
}));

import { AdminPage } from "../../../apps/web/src/pages/AdminPage.tsx";
import { getGameById } from "../../../shared/game-config/sample-fixtures.ts";

const sampleDraft = getGameById("madrona-music-2026");

if (!sampleDraft) {
  throw new Error("Expected the Madrona sample draft to exist.");
}

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

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return {
    promise,
    reject,
    resolve,
  };
}

describe("AdminPage", () => {
  beforeEach(() => {
    mockGetQuizAdminStatus.mockReset();
    mockListDraftEventSummaries.mockReset();
    mockLoadDraftEvent.mockReset();
    mockRequestAdminMagicLink.mockReset();
    mockSaveDraftEvent.mockReset();
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
    expect(screen.queryByRole("button", { name: "Create draft" })).toBeNull();
    expect(mockListDraftEventSummaries).not.toHaveBeenCalled();
    expect(mockSaveDraftEvent).not.toHaveBeenCalled();
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
    expect(screen.queryByRole("button", { name: "Create draft" })).toBeNull();
    expect(mockGetQuizAdminStatus).not.toHaveBeenCalled();
    expect(mockListDraftEventSummaries).not.toHaveBeenCalled();
    expect(mockSaveDraftEvent).not.toHaveBeenCalled();
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
    expect(screen.getByRole("button", { name: "Create draft" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Duplicate draft" })).toHaveLength(2);
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

  it("creates a starter draft, updates the list, and opens the new workspace", async () => {
    const navigate = vi.fn();
    mockUseAdminSession.mockReturnValue({
      email: "admin@example.com",
      session: { access_token: "admin-token" },
      status: "signed_in",
    });
    mockGetQuizAdminStatus.mockResolvedValue(true);
    mockListDraftEventSummaries.mockResolvedValue(draftSummaries);
    mockSaveDraftEvent.mockResolvedValue({
      id: "untitled-event-created",
      liveVersionNumber: null,
      name: "Untitled event created",
      slug: "untitled-event-created",
      updatedAt: "2026-04-12T12:00:00.000Z",
    });

    render(<AdminPage onNavigate={navigate} />);

    fireEvent.click(await screen.findByRole("button", { name: "Create draft" }));

    await waitFor(() => {
      expect(mockSaveDraftEvent).toHaveBeenCalledTimes(1);
    });

    const savedContent = mockSaveDraftEvent.mock.calls[0]?.[0];
    expect(savedContent).toMatchObject({
      feedbackMode: "final_score_reveal",
      name: expect.stringMatching(/^Untitled event /),
    });
    expect(savedContent.questions).toHaveLength(1);
    expect(screen.getByText("Untitled event created")).toBeTruthy();
    expect(navigate).toHaveBeenCalledWith("/admin/events/untitled-event-created");
  });

  it("surfaces create failures without changing the list or navigating", async () => {
    const navigate = vi.fn();
    mockUseAdminSession.mockReturnValue({
      email: "admin@example.com",
      session: { access_token: "admin-token" },
      status: "signed_in",
    });
    mockGetQuizAdminStatus.mockResolvedValue(true);
    mockListDraftEventSummaries.mockResolvedValue(draftSummaries);
    mockSaveDraftEvent.mockRejectedValue(
      new Error("A quiz event already uses that slug."),
    );

    render(<AdminPage onNavigate={navigate} />);

    fireEvent.click(await screen.findByRole("button", { name: "Create draft" }));

    expect(
      await screen.findByText("A quiz event already uses that slug."),
    ).toBeTruthy();
    expect(screen.queryByText("Untitled event created")).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("disables workspace actions while a draft is being created", async () => {
    const saveDraft = createDeferred<unknown>();
    mockUseAdminSession.mockReturnValue({
      email: "admin@example.com",
      session: { access_token: "admin-token" },
      status: "signed_in",
    });
    mockGetQuizAdminStatus.mockResolvedValue(true);
    mockListDraftEventSummaries.mockResolvedValue(draftSummaries);
    mockSaveDraftEvent.mockReturnValue(saveDraft.promise);

    render(<AdminPage onNavigate={() => {}} />);

    fireEvent.click(await screen.findByRole("button", { name: "Create draft" }));

    expect(
      (await screen.findByRole("button", { name: "Creating draft..." }))
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(screen.getByRole("button", { name: "Refresh events" }).hasAttribute("disabled"))
      .toBe(true);
    for (const button of screen.getAllByRole("button", { name: "Duplicate draft" })) {
      expect(button.hasAttribute("disabled")).toBe(true);
    }

    saveDraft.resolve({
      id: "untitled-event-created",
      liveVersionNumber: null,
      name: "Untitled event created",
      slug: "untitled-event-created",
      updatedAt: "2026-04-12T12:00:00.000Z",
    });
    expect(await screen.findByText("Untitled event created")).toBeTruthy();
  });

  it("duplicates an existing draft, updates the list, and opens the duplicate", async () => {
    const navigate = vi.fn();
    mockUseAdminSession.mockReturnValue({
      email: "admin@example.com",
      session: { access_token: "admin-token" },
      status: "signed_in",
    });
    mockGetQuizAdminStatus.mockResolvedValue(true);
    mockListDraftEventSummaries.mockResolvedValue(draftSummaries);
    mockLoadDraftEvent.mockResolvedValue({
      content: sampleDraft,
      createdAt: "2026-04-07T12:00:00.000Z",
      id: sampleDraft.id,
      lastSavedBy: "22222222-2222-4222-8222-222222222222",
      liveVersionNumber: 1,
      name: sampleDraft.name,
      slug: sampleDraft.slug,
      updatedAt: "2026-04-08T12:00:00.000Z",
    });
    mockSaveDraftEvent.mockResolvedValue({
      id: "madrona-copy",
      liveVersionNumber: null,
      name: "Madrona Music in the Playfield Copy",
      slug: "madrona-copy",
      updatedAt: "2026-04-12T12:00:00.000Z",
    });

    render(<AdminPage onNavigate={navigate} />);

    const liveEventCard = await screen.findByLabelText(
      "Madrona Music in the Playfield event",
    );
    fireEvent.click(
      within(liveEventCard).getByRole("button", { name: "Duplicate draft" }),
    );

    await waitFor(() => {
      expect(mockLoadDraftEvent).toHaveBeenCalledWith("madrona-music-2026");
      expect(mockSaveDraftEvent).toHaveBeenCalledTimes(1);
    });

    const savedContent = mockSaveDraftEvent.mock.calls[0]?.[0];
    expect(savedContent.name).toBe("Madrona Music in the Playfield Copy");
    expect(savedContent.id).not.toBe(sampleDraft.id);
    expect(savedContent.slug).not.toBe(sampleDraft.slug);
    expect(savedContent.questions).toEqual(sampleDraft.questions);
    expect(screen.getByText("Madrona Music in the Playfield Copy")).toBeTruthy();
    expect(navigate).toHaveBeenCalledWith("/admin/events/madrona-copy");
  });

  it("surfaces duplicate load failures without saving or navigating", async () => {
    const navigate = vi.fn();
    mockUseAdminSession.mockReturnValue({
      email: "admin@example.com",
      session: { access_token: "admin-token" },
      status: "signed_in",
    });
    mockGetQuizAdminStatus.mockResolvedValue(true);
    mockListDraftEventSummaries.mockResolvedValue(draftSummaries);
    mockLoadDraftEvent.mockRejectedValue(new Error("Draft load failed."));

    render(<AdminPage onNavigate={navigate} />);

    const liveEventCard = await screen.findByLabelText(
      "Madrona Music in the Playfield event",
    );
    fireEvent.click(
      within(liveEventCard).getByRole("button", { name: "Duplicate draft" }),
    );

    expect(await screen.findByText("Draft load failed.")).toBeTruthy();
    expect(mockSaveDraftEvent).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("surfaces duplicate save failures without changing the list or navigating", async () => {
    const navigate = vi.fn();
    mockUseAdminSession.mockReturnValue({
      email: "admin@example.com",
      session: { access_token: "admin-token" },
      status: "signed_in",
    });
    mockGetQuizAdminStatus.mockResolvedValue(true);
    mockListDraftEventSummaries.mockResolvedValue(draftSummaries);
    mockLoadDraftEvent.mockResolvedValue({
      content: sampleDraft,
      createdAt: "2026-04-07T12:00:00.000Z",
      id: sampleDraft.id,
      lastSavedBy: "22222222-2222-4222-8222-222222222222",
      liveVersionNumber: 1,
      name: sampleDraft.name,
      slug: sampleDraft.slug,
      updatedAt: "2026-04-08T12:00:00.000Z",
    });
    mockSaveDraftEvent.mockRejectedValue(new Error("Draft save failed."));

    render(<AdminPage onNavigate={navigate} />);

    const liveEventCard = await screen.findByLabelText(
      "Madrona Music in the Playfield event",
    );
    fireEvent.click(
      within(liveEventCard).getByRole("button", { name: "Duplicate draft" }),
    );

    expect(await screen.findByText("Draft save failed.")).toBeTruthy();
    expect(screen.queryByText("Madrona Music in the Playfield Copy")).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("disables workspace actions while a draft is being duplicated", async () => {
    const saveDraft = createDeferred<unknown>();
    mockUseAdminSession.mockReturnValue({
      email: "admin@example.com",
      session: { access_token: "admin-token" },
      status: "signed_in",
    });
    mockGetQuizAdminStatus.mockResolvedValue(true);
    mockListDraftEventSummaries.mockResolvedValue(draftSummaries);
    mockLoadDraftEvent.mockResolvedValue({
      content: sampleDraft,
      createdAt: "2026-04-07T12:00:00.000Z",
      id: sampleDraft.id,
      lastSavedBy: "22222222-2222-4222-8222-222222222222",
      liveVersionNumber: 1,
      name: sampleDraft.name,
      slug: sampleDraft.slug,
      updatedAt: "2026-04-08T12:00:00.000Z",
    });
    mockSaveDraftEvent.mockReturnValue(saveDraft.promise);

    render(<AdminPage onNavigate={() => {}} />);

    const liveEventCard = await screen.findByLabelText(
      "Madrona Music in the Playfield event",
    );
    fireEvent.click(
      within(liveEventCard).getByRole("button", { name: "Duplicate draft" }),
    );

    expect(
      (await within(liveEventCard).findByRole("button", { name: "Duplicating..." }))
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(screen.getByRole("button", { name: "Create draft" }).hasAttribute("disabled"))
      .toBe(true);
    expect(screen.getByRole("button", { name: "Refresh events" }).hasAttribute("disabled"))
      .toBe(true);

    saveDraft.resolve({
      id: "madrona-copy",
      liveVersionNumber: null,
      name: "Madrona Music in the Playfield Copy",
      slug: "madrona-copy",
      updatedAt: "2026-04-12T12:00:00.000Z",
    });
    expect(await screen.findByText("Madrona Music in the Playfield Copy")).toBeTruthy();
  });

  it("shows selected event workspace actions", async () => {
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
    expect(screen.getByText("Draft actions")).toBeTruthy();
    expect(screen.getByText("Slug: first-sample")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back to all events" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Duplicate draft" })).toBeTruthy();
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
