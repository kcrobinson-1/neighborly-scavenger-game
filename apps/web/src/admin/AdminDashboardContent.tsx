import type { FormEvent } from "react";
import type { AdminSessionState } from "./useAdminSession";
import type {
  AdminDashboardState,
  AdminDraftMutationState,
  AdminMagicLinkState,
  AdminQuestionSaveState,
  AdminSelectedDraftState,
} from "./useAdminDashboard";
import type { AdminEventDetailsFormValues } from "./eventDetails";
import type { AdminQuestionFormValues } from "./questionBuilder";
import type { DraftEventSummary } from "../lib/adminQuizApi";
import { AdminEventWorkspace } from "./AdminEventWorkspace";
import { AdminSignInForm } from "./AdminSignInForm";

type AdminDashboardContentProps = {
  dashboardState: AdminDashboardState;
  draftMutationState: AdminDraftMutationState;
  emailInput: string;
  magicLinkState: AdminMagicLinkState;
  focusedQuestionId: string | null;
  onCreateDraft: () => Promise<DraftEventSummary | null>;
  onDuplicateDraft: (eventId: string) => Promise<DraftEventSummary | null>;
  onEmailInputChange: (value: string) => void;
  onNavigate: (path: string) => void;
  onRetryDashboard: () => void;
  onSaveSelectedEventDetails: (
    values: AdminEventDetailsFormValues,
  ) => Promise<DraftEventSummary | null>;
  onSaveSelectedQuestion: (
    questionId: string,
    values: AdminQuestionFormValues,
  ) => Promise<DraftEventSummary | null>;
  onSubmitMagicLink: (event: FormEvent<HTMLFormElement>) => void;
  questionSaveState: AdminQuestionSaveState;
  selectedDraftState: AdminSelectedDraftState;
  selectedEventId?: string;
  sessionState: AdminSessionState;
  onFocusQuestion: (questionId: string) => void;
};

function SignedInAs({ email }: { email: string | null }) {
  return (
    <p className="admin-signed-in-as">
      Signed in as <strong>{email ?? "unknown email"}</strong>
    </p>
  );
}

/** Renders the active admin auth, authorization, and event-workspace state. */
export function AdminDashboardContent({
  dashboardState,
  draftMutationState,
  emailInput,
  focusedQuestionId,
  magicLinkState,
  onCreateDraft,
  onDuplicateDraft,
  onEmailInputChange,
  onNavigate,
  onRetryDashboard,
  onSaveSelectedEventDetails,
  onSaveSelectedQuestion,
  onSubmitMagicLink,
  questionSaveState,
  selectedDraftState,
  selectedEventId,
  sessionState,
  onFocusQuestion,
}: AdminDashboardContentProps) {
  if (sessionState.status === "missing_config") {
    return (
      <div className="admin-state-stack">
        <h2>Admin auth needs Supabase configuration.</h2>
        <p>{sessionState.message}</p>
      </div>
    );
  }

  if (sessionState.status === "loading") {
    return (
      <div className="admin-state-stack">
        <h2>Restoring admin session</h2>
        <button className="secondary-button" disabled type="button">
          Checking session...
        </button>
      </div>
    );
  }

  if (sessionState.status === "signed_out") {
    return (
      <AdminSignInForm
        emailInput={emailInput}
        magicLinkState={magicLinkState}
        onEmailInputChange={onEmailInputChange}
        onSubmit={onSubmitMagicLink}
      />
    );
  }

  if (dashboardState.status === "loading") {
    return (
      <div className="admin-state-stack">
        <h2>Loading admin access</h2>
        <SignedInAs email={dashboardState.email} />
        <button className="secondary-button" disabled type="button">
          Loading drafts...
        </button>
      </div>
    );
  }

  if (dashboardState.status === "unauthorized") {
    return (
      <div className="admin-state-stack">
        <h2>This account is not allowlisted for quiz authoring.</h2>
        <SignedInAs email={dashboardState.email} />
        <p>
          The auth link worked, but this email does not currently have admin
          access to private quiz drafts.
        </p>
      </div>
    );
  }

  if (dashboardState.status === "error") {
    return (
      <div className="admin-state-stack">
        <h2>Admin access couldn&apos;t load right now.</h2>
        <SignedInAs email={dashboardState.email} />
        <p>{dashboardState.message}</p>
        <button
          className="secondary-button"
          onClick={onRetryDashboard}
          type="button"
        >
          Retry loading drafts
        </button>
      </div>
    );
  }

  if (dashboardState.status === "ready") {
    return (
      <div className="admin-state-stack">
        <div className="section-heading">
          <p className="eyebrow">Authenticated admin</p>
          <h2>Event workspace</h2>
        </div>
        <SignedInAs email={dashboardState.email} />
        <AdminEventWorkspace
          draftMutationState={draftMutationState}
          drafts={dashboardState.drafts}
          onCreateDraft={onCreateDraft}
          onDuplicateDraft={onDuplicateDraft}
          onNavigate={onNavigate}
          onRefresh={onRetryDashboard}
          focusedQuestionId={focusedQuestionId}
          onFocusQuestion={onFocusQuestion}
          onSaveSelectedEventDetails={onSaveSelectedEventDetails}
          onSaveSelectedQuestion={onSaveSelectedQuestion}
          questionSaveState={questionSaveState}
          selectedDraftState={selectedDraftState}
          selectedEventId={selectedEventId}
        />
      </div>
    );
  }

  return null;
}
