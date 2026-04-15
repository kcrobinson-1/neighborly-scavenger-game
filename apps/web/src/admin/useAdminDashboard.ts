import { type FormEvent, useEffect, useState } from "react";
import {
  getQuizAdminStatus,
  listDraftEventSummaries,
  loadDraftEvent,
  publishDraftEvent,
  requestAdminMagicLink,
  saveDraftEvent,
  signOutAdmin,
  unpublishEvent,
  type DraftEventDetail,
  type DraftEventSummary,
  type PublishDraftResult,
} from "../lib/adminQuizApi";
import {
  createDuplicatedDraftContent,
  createStarterDraftContent,
} from "./draftCreation";
import {
  applyEventDetailsFormValues,
  type AdminEventDetailsFormValues,
} from "./eventDetails";
import {
  prepareQuestionContentForSave,
} from "./questionBuilder";
import { useAdminSession } from "./useAdminSession";

export type AdminDashboardState =
  | { status: "idle" }
  | { email: string | null; status: "loading" }
  | { email: string | null; message: string; status: "error" }
  | { email: string | null; status: "unauthorized" }
  | { drafts: DraftEventSummary[]; email: string | null; status: "ready" };

export type AdminMagicLinkState = {
  message: string | null;
  status: "idle" | "error" | "pending" | "success";
};

export type AdminDraftMutationState =
  | { message: null; status: "idle" }
  | { message: string; status: "creating" }
  | { eventId: string; message: string; status: "duplicating" }
  | { message: string; status: "error" | "success" };

export type AdminSelectedDraftState =
  | { status: "idle" }
  | { eventId: string; status: "loading" }
  | { eventId: string; message: string; status: "error" }
  | {
      draft: DraftEventDetail;
      message: null;
      status: "ready";
    }
  | {
      draft: DraftEventDetail;
      message: string;
      status: "saving" | "save_error" | "success";
    };

export type AdminQuestionSaveState =
  | { message: null; status: "idle" }
  | { message: string; status: "saving" }
  | { message: string; status: "save_error" | "success" };

export type AdminPublishState =
  | { status: "idle" }
  | { status: "publishing" }
  | { result: PublishDraftResult; status: "success" }
  | { message: string; status: "error" };

export type AdminUnpublishState =
  | { status: "idle" }
  | { status: "confirming" }
  | { status: "unpublishing" }
  | { status: "success" }
  | { message: string; status: "error" };

function getErrorMessage(error: unknown, fallbackMessage: string) {
  return error instanceof Error ? error.message : fallbackMessage;
}

function mergeDraftSummary(
  drafts: DraftEventSummary[],
  savedDraft: DraftEventSummary,
) {
  return [
    savedDraft,
    ...drafts.filter((draft) => draft.id !== savedDraft.id),
  ];
}

/** Coordinates /admin auth, allowlist, draft loading, and form actions. */
export function useAdminDashboard(selectedEventId?: string) {
  const sessionState = useAdminSession();
  const [emailInput, setEmailInput] = useState("");
  const [magicLinkState, setMagicLinkState] = useState<AdminMagicLinkState>({
    message: null,
    status: "idle",
  });
  const [dashboardState, setDashboardState] = useState<AdminDashboardState>({
    status: "idle",
  });
  const [reloadToken, setReloadToken] = useState(0);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [draftMutationState, setDraftMutationState] =
    useState<AdminDraftMutationState>({
      message: null,
      status: "idle",
    });
  const [selectedDraftState, setSelectedDraftState] =
    useState<AdminSelectedDraftState>({
      status: "idle",
    });
  const [focusedQuestionId, setFocusedQuestionId] = useState<string | null>(
    null,
  );
  const [questionSaveState, setQuestionSaveState] =
    useState<AdminQuestionSaveState>({
      message: null,
      status: "idle",
    });
  const [publishState, setPublishState] = useState<AdminPublishState>({
    status: "idle",
  });
  const [unpublishState, setUnpublishState] = useState<AdminUnpublishState>({
    status: "idle",
  });
  const [hasDraftChanges, setHasDraftChanges] = useState(false);
  const visibleDraftIds =
    dashboardState.status === "ready"
      ? dashboardState.drafts.map((draft) => draft.id).join("\0")
      : "";

  useEffect(() => {
    if (sessionState.status !== "signed_in") {
      setDashboardState({ status: "idle" });
      setDraftMutationState({ message: null, status: "idle" });
      setSelectedDraftState({ status: "idle" });
      setFocusedQuestionId(null);
      setQuestionSaveState({ message: null, status: "idle" });
      setPublishState({ status: "idle" });
      setUnpublishState({ status: "idle" });
      setHasDraftChanges(false);
      return;
    }

    let isCancelled = false;

    setDraftMutationState({ message: null, status: "idle" });
    setDashboardState({
      email: sessionState.email,
      status: "loading",
    });

    void getQuizAdminStatus()
      .then(async (isAdmin) => {
        if (isCancelled) {
          return;
        }

        if (!isAdmin) {
          setDashboardState({
            email: sessionState.email,
            status: "unauthorized",
          });
          return;
        }

        const drafts = await listDraftEventSummaries();

        if (!isCancelled) {
          setDashboardState({
            drafts,
            email: sessionState.email,
            status: "ready",
          });
        }
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          setDashboardState({
            email: sessionState.email,
            message:
              error instanceof Error
                ? error.message
                : "We couldn't load the admin dashboard right now.",
            status: "error",
          });
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [reloadToken, sessionState]);

  useEffect(() => {
    if (
      sessionState.status !== "signed_in" ||
      dashboardState.status !== "ready" ||
      !selectedEventId
    ) {
      setSelectedDraftState({ status: "idle" });
      setFocusedQuestionId(null);
      setQuestionSaveState({ message: null, status: "idle" });
      setPublishState({ status: "idle" });
      setUnpublishState({ status: "idle" });
      setHasDraftChanges(false);
      return;
    }

    const visibleDraftIdSet = new Set(
      visibleDraftIds ? visibleDraftIds.split("\0") : [],
    );

    if (!visibleDraftIdSet.has(selectedEventId)) {
      setSelectedDraftState({ status: "idle" });
      setFocusedQuestionId(null);
      setQuestionSaveState({ message: null, status: "idle" });
      setPublishState({ status: "idle" });
      setUnpublishState({ status: "idle" });
      setHasDraftChanges(false);
      return;
    }

    let isCancelled = false;

    setSelectedDraftState({
      eventId: selectedEventId,
      status: "loading",
    });
    setQuestionSaveState({ message: null, status: "idle" });

    void loadDraftEvent(selectedEventId)
      .then((draft) => {
        if (isCancelled) {
          return;
        }

        if (!draft) {
          setSelectedDraftState({
            eventId: selectedEventId,
            message: "We couldn't find that draft event.",
            status: "error",
          });
          return;
        }

        setSelectedDraftState({
          draft,
          message: null,
          status: "ready",
        });
        setFocusedQuestionId((currentQuestionId) => {
          if (
            currentQuestionId &&
            draft.content.questions.some(
              (question) => question.id === currentQuestionId,
            )
          ) {
            return currentQuestionId;
          }

          return draft.content.questions[0]?.id ?? null;
        });
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          setSelectedDraftState({
            eventId: selectedEventId,
            message: getErrorMessage(
              error,
              "We couldn't load the draft event right now.",
            ),
            status: "error",
          });
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [
    dashboardState.status,
    selectedEventId,
    sessionState.status,
    visibleDraftIds,
  ]);

  const retryDashboard = () => {
    setReloadToken((value) => value + 1);
  };

  const createDraft = async () => {
    if (dashboardState.status !== "ready") {
      return null;
    }

    setDraftMutationState({
      message: "Creating draft...",
      status: "creating",
    });

    try {
      const content = createStarterDraftContent(dashboardState.drafts);
      const savedDraft = await saveDraftEvent(content);

      setDashboardState((currentState) =>
        currentState.status === "ready"
          ? {
              ...currentState,
              drafts: mergeDraftSummary(currentState.drafts, savedDraft),
            }
          : currentState,
      );
      setDraftMutationState({
        message: `Created ${savedDraft.name}.`,
        status: "success",
      });

      return savedDraft;
    } catch (error: unknown) {
      setDraftMutationState({
        message: getErrorMessage(error, "We couldn't create the draft right now."),
        status: "error",
      });
      return null;
    }
  };

  const duplicateDraft = async (eventId: string) => {
    if (dashboardState.status !== "ready") {
      return null;
    }

    setDraftMutationState({
      eventId,
      message: "Duplicating draft...",
      status: "duplicating",
    });

    try {
      const sourceDraft = await loadDraftEvent(eventId);

      if (!sourceDraft) {
        throw new Error("We couldn't find that draft to duplicate.");
      }

      const content = createDuplicatedDraftContent(
        sourceDraft,
        dashboardState.drafts,
      );
      const savedDraft = await saveDraftEvent(content);

      setDashboardState((currentState) =>
        currentState.status === "ready"
          ? {
              ...currentState,
              drafts: mergeDraftSummary(currentState.drafts, savedDraft),
            }
          : currentState,
      );
      setDraftMutationState({
        message: `Duplicated ${sourceDraft.name}.`,
        status: "success",
      });

      return savedDraft;
    } catch (error: unknown) {
      setDraftMutationState({
        message: getErrorMessage(error, "We couldn't duplicate the draft right now."),
        status: "error",
      });
      return null;
    }
  };

  const saveSelectedEventDetails = async (
    values: AdminEventDetailsFormValues,
  ) => {
    if (
      selectedDraftState.status !== "ready" &&
      selectedDraftState.status !== "save_error" &&
      selectedDraftState.status !== "success"
    ) {
      return null;
    }

    const currentDraft = selectedDraftState.draft;

    setSelectedDraftState({
      draft: currentDraft,
      message: "Saving event details...",
      status: "saving",
    });

    try {
      const content = applyEventDetailsFormValues(currentDraft.content, values);
      const savedDraft = await saveDraftEvent(content);
      const nextDraft: DraftEventDetail = {
        ...currentDraft,
        ...savedDraft,
        content,
      };

      setDashboardState((currentState) =>
        currentState.status === "ready"
          ? {
              ...currentState,
              drafts: mergeDraftSummary(currentState.drafts, savedDraft),
            }
          : currentState,
      );
      setSelectedDraftState({
        draft: nextDraft,
        message: `Saved ${savedDraft.name}.`,
        status: "success",
      });

      if (currentDraft.liveVersionNumber !== null) {
        setHasDraftChanges(true);
      }

      return savedDraft;
    } catch (error: unknown) {
      setSelectedDraftState({
        draft: currentDraft,
        message: getErrorMessage(
          error,
          "We couldn't save the event details right now.",
        ),
        status: "save_error",
      });
      return null;
    }
  };

  const saveSelectedQuestionContent = async (
    content: DraftEventDetail["content"],
    questionId: string,
  ) => {
    if (
      selectedDraftState.status !== "ready" &&
      selectedDraftState.status !== "save_error" &&
      selectedDraftState.status !== "success"
    ) {
      return null;
    }

    const currentDraft = selectedDraftState.draft;

    setQuestionSaveState({
      message: "Saving question changes...",
      status: "saving",
    });

    try {
      const preparedContent = prepareQuestionContentForSave(content);
      const savedDraft = await saveDraftEvent(preparedContent);
      const nextDraft: DraftEventDetail = {
        ...currentDraft,
        ...savedDraft,
        content: preparedContent,
      };

      setDashboardState((currentState) =>
        currentState.status === "ready"
          ? {
              ...currentState,
              drafts: mergeDraftSummary(currentState.drafts, savedDraft),
            }
          : currentState,
      );
      setSelectedDraftState({
        draft: nextDraft,
        message: null,
        status: "ready",
      });
      setFocusedQuestionId(questionId);
      setQuestionSaveState({
        message: "Saved question changes.",
        status: "success",
      });

      if (currentDraft.liveVersionNumber !== null) {
        setHasDraftChanges(true);
      }

      return savedDraft;
    } catch (error: unknown) {
      setQuestionSaveState({
        message: getErrorMessage(
          error,
          "We couldn't save the question changes right now.",
        ),
        status: "save_error",
      });
      return null;
    }
  };

  const requestMagicLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!emailInput.trim()) {
      setMagicLinkState({
        message: "Enter the email address that should receive the sign-in link.",
        status: "error",
      });
      return;
    }

    setMagicLinkState({
      message: null,
      status: "pending",
    });

    try {
      await requestAdminMagicLink(emailInput);
      setMagicLinkState({
        message: "Check your email for the admin sign-in link.",
        status: "success",
      });
    } catch (error: unknown) {
      setMagicLinkState({
        message:
          error instanceof Error
            ? error.message
            : "We couldn't send the admin sign-in link.",
        status: "error",
      });
    }
  };

  const signOut = async () => {
    setSignOutError(null);
    setIsSigningOut(true);

    try {
      await signOutAdmin();
    } catch (error: unknown) {
      setSignOutError(
        error instanceof Error
          ? error.message
          : "We couldn't sign out right now.",
      );
    } finally {
      setIsSigningOut(false);
    }
  };

  const publishEvent = async () => {
    if (
      selectedDraftState.status !== "ready" &&
      selectedDraftState.status !== "save_error" &&
      selectedDraftState.status !== "success"
    ) {
      return;
    }

    const currentDraft = selectedDraftState.draft;

    setPublishState({ status: "publishing" });

    try {
      const result = await publishDraftEvent(currentDraft.id);

      setDashboardState((currentState) =>
        currentState.status === "ready"
          ? {
              ...currentState,
              drafts: currentState.drafts.map((draft) =>
                draft.id === currentDraft.id
                  ? { ...draft, liveVersionNumber: result.versionNumber }
                  : draft,
              ),
            }
          : currentState,
      );
      setPublishState({ result, status: "success" });
      setHasDraftChanges(false);
    } catch (error: unknown) {
      setPublishState({
        message: getErrorMessage(error, "We couldn't publish the draft right now."),
        status: "error",
      });
    }
  };

  const startUnpublish = () => {
    setUnpublishState({ status: "confirming" });
  };

  const confirmUnpublish = async () => {
    if (
      selectedDraftState.status !== "ready" &&
      selectedDraftState.status !== "save_error" &&
      selectedDraftState.status !== "success"
    ) {
      return;
    }

    const currentDraft = selectedDraftState.draft;

    setUnpublishState({ status: "unpublishing" });

    try {
      await unpublishEvent(currentDraft.id);

      setDashboardState((currentState) =>
        currentState.status === "ready"
          ? {
              ...currentState,
              drafts: currentState.drafts.map((draft) =>
                draft.id === currentDraft.id
                  ? { ...draft, liveVersionNumber: null }
                  : draft,
              ),
            }
          : currentState,
      );
      // Also clear liveVersionNumber on the loaded detail so the unpublish
      // section hides immediately without waiting for a re-fetch.
      setSelectedDraftState((currentState) =>
        currentState.status === "ready" ||
        currentState.status === "save_error" ||
        currentState.status === "success"
          ? {
              ...currentState,
              draft: { ...currentState.draft, liveVersionNumber: null },
            }
          : currentState,
      );
      setUnpublishState({ status: "idle" });
    } catch (error: unknown) {
      setUnpublishState({
        message: getErrorMessage(
          error,
          "We couldn't unpublish the event right now.",
        ),
        status: "error",
      });
    }
  };

  const cancelUnpublish = () => {
    setUnpublishState({ status: "idle" });
  };

  return {
    cancelUnpublish,
    confirmUnpublish,
    createDraft,
    dashboardState,
    draftMutationState,
    duplicateDraft,
    emailInput,
    hasDraftChanges,
    isSigningOut,
    magicLinkState,
    focusedQuestionId,
    publishEvent,
    publishState,
    questionSaveState,
    requestMagicLink,
    retryDashboard,
    saveSelectedEventDetails,
    saveSelectedQuestionContent,
    selectedDraftState,
    sessionState,
    setFocusedQuestionId,
    setEmailInput,
    signOut,
    signOutError,
    startUnpublish,
    unpublishState,
  };
}
