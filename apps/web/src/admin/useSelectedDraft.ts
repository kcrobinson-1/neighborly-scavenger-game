import { useEffect, useState } from "react";
import {
  loadDraftEvent,
  publishDraftEvent,
  saveDraftEvent,
  unpublishEvent,
  type DraftEventDetail,
  type DraftEventSummary,
  type PublishDraftResult,
} from "../lib/adminQuizApi";
import {
  applyEventDetailsFormValues,
  type AdminEventDetailsFormValues,
} from "./eventDetails";
import { prepareQuestionContentForSave } from "./questionFormMapping";
import type { useAdminSession } from "./useAdminSession";

// Structural subset of AdminDashboardState — only the fields useSelectedDraft
// needs, so this file does not create a circular import with useAdminDashboard.
type SelectedDraftDashboardState =
  | { status: "idle" | "loading" | "error" | "unauthorized" }
  | { drafts: DraftEventSummary[]; email: string | null; status: "ready" };

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

type UseSelectedDraftOptions = {
  dashboardState: SelectedDraftDashboardState;
  /** Called with a list updater whenever a save/publish/unpublish changes the summary list. */
  onUpdateDraftsList: (
    updater: (drafts: DraftEventSummary[]) => DraftEventSummary[],
  ) => void;
  selectedEventId: string | undefined;
  sessionState: ReturnType<typeof useAdminSession>;
};

/** Manages the selected draft's load, edit, save, and publish lifecycle. */
export function useSelectedDraft({
  dashboardState,
  onUpdateDraftsList,
  selectedEventId,
  sessionState,
}: UseSelectedDraftOptions) {
  const [selectedDraftState, setSelectedDraftState] =
    useState<AdminSelectedDraftState>({ status: "idle" });
  const [focusedQuestionId, setFocusedQuestionId] = useState<string | null>(
    null,
  );
  const [questionSaveState, setQuestionSaveState] =
    useState<AdminQuestionSaveState>({ message: null, status: "idle" });
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
    if (
      sessionState.status !== "signed_in" ||
      dashboardState.status !== "ready" ||
      !selectedEventId
    ) {
      // These resets mirror the pattern that existed in useAdminDashboard.ts
      // before extraction. All six belong to the same selected-draft concern and
      // reset as a unit. React 18 batches synchronous setState calls inside
      // effects, so there is no cascade in practice.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
        setFocusedQuestionId((currentQuestionId: string | null) => {
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

      onUpdateDraftsList((drafts) => mergeDraftSummary(drafts, savedDraft));
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

      onUpdateDraftsList((drafts) => mergeDraftSummary(drafts, savedDraft));
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

      onUpdateDraftsList((drafts) =>
        drafts.map((draft) =>
          draft.id === currentDraft.id
            ? {
                ...draft,
                hasBeenPublished: true,
                liveVersionNumber: result.versionNumber,
              }
            : draft,
        ),
      );
      // Also update the loaded draft detail so the unpublish section appears
      // immediately and hasDraftChanges tracking works for first-time
      // publishes where liveVersionNumber starts as null.
      setSelectedDraftState((currentState: AdminSelectedDraftState) =>
        currentState.status === "ready" ||
        currentState.status === "save_error" ||
        currentState.status === "success"
          ? {
              ...currentState,
              draft: {
                ...currentState.draft,
                hasBeenPublished: true,
                liveVersionNumber: result.versionNumber,
              },
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

      onUpdateDraftsList((drafts) =>
        drafts.map((draft) =>
          draft.id === currentDraft.id
            ? { ...draft, liveVersionNumber: null }
            : draft,
        ),
      );
      // Also clear liveVersionNumber on the loaded detail so the unpublish
      // section hides immediately without waiting for a re-fetch.
      setSelectedDraftState((currentState: AdminSelectedDraftState) =>
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
      // Clear the publish success banner so "Published as version N" is not
      // shown after the event has been unpublished.
      setPublishState({ status: "idle" });
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
    focusedQuestionId,
    hasDraftChanges,
    publishEvent,
    publishState,
    questionSaveState,
    saveSelectedEventDetails,
    saveSelectedQuestionContent,
    selectedDraftState,
    setFocusedQuestionId,
    startUnpublish,
    unpublishState,
  };
}
