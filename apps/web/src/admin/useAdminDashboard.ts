import { type FormEvent, useEffect, useState } from "react";
import {
  getQuizAdminStatus,
  listDraftEventSummaries,
  loadDraftEvent,
  requestAdminMagicLink,
  saveDraftEvent,
  signOutAdmin,
  type DraftEventSummary,
} from "../lib/adminQuizApi";
import {
  createDuplicatedDraftContent,
  createStarterDraftContent,
} from "./draftCreation";
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
export function useAdminDashboard() {
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

  useEffect(() => {
    if (sessionState.status !== "signed_in") {
      setDashboardState({ status: "idle" });
      setDraftMutationState({ message: null, status: "idle" });
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

  return {
    createDraft,
    dashboardState,
    draftMutationState,
    duplicateDraft,
    emailInput,
    isSigningOut,
    magicLinkState,
    requestMagicLink,
    retryDashboard,
    sessionState,
    setEmailInput,
    signOut,
    signOutError,
  };
}
