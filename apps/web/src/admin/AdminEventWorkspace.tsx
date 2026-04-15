import type { DraftEventDetail, DraftEventSummary } from "../lib/adminQuizApi";
import { routes } from "../routes";
import { AdminEventDetailsForm } from "./AdminEventDetailsForm";
import { AdminPublishPanel } from "./AdminPublishPanel";
import { AdminQuestionEditor } from "./AdminQuestionEditor";
import type {
  AdminDraftMutationState,
  AdminPublishState,
  AdminQuestionSaveState,
  AdminSelectedDraftState,
  AdminUnpublishState,
} from "./useAdminDashboard";
import type { AdminEventDetailsFormValues } from "./eventDetails";

type AdminEventWorkspaceProps = {
  draftMutationState: AdminDraftMutationState;
  drafts: DraftEventSummary[];
  focusedQuestionId: string | null;
  hasDraftChanges: boolean;
  onCancelUnpublish: () => void;
  onConfirmUnpublish: () => void;
  onCreateDraft: () => Promise<DraftEventSummary | null>;
  onDuplicateDraft: (eventId: string) => Promise<DraftEventSummary | null>;
  onFocusQuestion: (questionId: string) => void;
  onNavigate: (path: string) => void;
  onPublish: () => void;
  onRefresh: () => void;
  onSaveSelectedEventDetails: (
    values: AdminEventDetailsFormValues,
  ) => Promise<DraftEventSummary | null>;
  onSaveSelectedQuestionContent: (
    content: DraftEventDetail["content"],
    questionId: string,
  ) => Promise<DraftEventSummary | null>;
  onUnpublish: () => void;
  publishState: AdminPublishState;
  questionSaveState: AdminQuestionSaveState;
  selectedDraftState: AdminSelectedDraftState;
  selectedEventId?: string;
  unpublishState: AdminUnpublishState;
};

function formatSavedAt(timestamp: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function getStatusLabel(draft: DraftEventSummary, hasDraftChanges = false) {
  if (!draft.liveVersionNumber) {
    return "Draft only";
  }

  if (hasDraftChanges) {
    return "Draft changes not published";
  }

  return `Live v${draft.liveVersionNumber}`;
}

function getEventCounts(drafts: DraftEventSummary[]) {
  const liveCount = drafts.filter((draft) => draft.liveVersionNumber).length;

  return {
    draftOnlyCount: drafts.length - liveCount,
    liveCount,
    totalCount: drafts.length,
  };
}

function formatCount(count: number, singularLabel: string, pluralLabel = `${singularLabel}s`) {
  const label = count === 1 ? singularLabel : pluralLabel;

  return `${count} ${label}`;
}

function isDraftMutationPending(state: AdminDraftMutationState) {
  return state.status === "creating" || state.status === "duplicating";
}

function isSelectedDraftSaving(state: AdminSelectedDraftState) {
  return state.status === "saving";
}

function isQuestionSaving(state: AdminQuestionSaveState) {
  return state.status === "saving";
}

function getMutationMessageClass(state: AdminDraftMutationState) {
  return state.status === "error"
    ? "admin-message admin-message-error"
    : "admin-message admin-message-info";
}

function getSelectedDraftMessageKind(
  state: AdminSelectedDraftState,
): "error" | "info" | "success" {
  if (state.status === "save_error") {
    return "error";
  }

  if (state.status === "success") {
    return "success";
  }

  return "info";
}

function getQuestionMessageKind(
  state: AdminQuestionSaveState,
): "error" | "info" | "success" {
  if (state.status === "save_error") {
    return "error";
  }

  if (state.status === "success") {
    return "success";
  }

  return "info";
}

/** Event workspace for draft orientation plus create and duplicate actions. */
export function AdminEventWorkspace({
  draftMutationState,
  drafts,
  focusedQuestionId,
  hasDraftChanges,
  onCancelUnpublish,
  onConfirmUnpublish,
  onCreateDraft,
  onDuplicateDraft,
  onFocusQuestion,
  onNavigate,
  onPublish,
  onRefresh,
  onSaveSelectedEventDetails,
  onSaveSelectedQuestionContent,
  onUnpublish,
  publishState,
  questionSaveState,
  selectedDraftState,
  selectedEventId,
  unpublishState,
}: AdminEventWorkspaceProps) {
  const selectedDraft = selectedEventId
    ? drafts.find((draft) => draft.id === selectedEventId)
    : null;
  const counts = getEventCounts(drafts);
  const isMutationPending = isDraftMutationPending(draftMutationState);
  const isSelectedSaving = isSelectedDraftSaving(selectedDraftState);
  const isQuestionSavePending = isQuestionSaving(questionSaveState);
  const isWorkspaceBusy =
    isMutationPending ||
    isSelectedSaving ||
    isQuestionSavePending ||
    publishState.status === "publishing" ||
    unpublishState.status === "unpublishing";

  const handleCreateDraft = async () => {
    const savedDraft = await onCreateDraft();

    if (savedDraft) {
      onNavigate(routes.adminEvent(savedDraft.id));
    }
  };

  const handleDuplicateDraft = async (eventId: string) => {
    const savedDraft = await onDuplicateDraft(eventId);

    if (savedDraft) {
      onNavigate(routes.adminEvent(savedDraft.id));
    }
  };

  if (selectedEventId && !selectedDraft) {
    return (
      <div className="admin-workspace-detail">
        <p className="eyebrow">Selected event</p>
        <h3>Event workspace not found</h3>
        <p>
          This event is not visible in the private draft list for the current
          admin session.
        </p>
        <button
          className="secondary-button admin-inline-button"
          onClick={() => onNavigate(routes.admin)}
          type="button"
        >
          Back to all events
        </button>
      </div>
    );
  }

  if (selectedDraft) {
    const isDuplicatingSelectedDraft =
      draftMutationState.status === "duplicating" &&
      draftMutationState.eventId === selectedDraft.id;

    return (
      <div className="admin-workspace-detail">
        <div className="admin-workspace-heading">
          <div>
            <p className="eyebrow">Selected event</p>
            <h3>{selectedDraft.name}</h3>
          </div>
          <span className="chip">Draft actions</span>
        </div>
        <p>Status: {getStatusLabel(selectedDraft, hasDraftChanges)}</p>
        <p>Slug: {selectedDraft.slug}</p>
        <p>Last saved: {formatSavedAt(selectedDraft.updatedAt)}</p>
        <div className="admin-action-row">
          <button
            className="secondary-button"
            onClick={() => onNavigate(routes.admin)}
            type="button"
          >
            Back to all events
          </button>
          {selectedDraft.liveVersionNumber ? (
            <button
              className="secondary-button"
              disabled={isWorkspaceBusy}
              onClick={() => onNavigate(routes.game(selectedDraft.slug))}
              type="button"
            >
              Open live quiz
            </button>
          ) : null}
          <button
            className="secondary-button"
            disabled={isWorkspaceBusy}
            onClick={() => void handleDuplicateDraft(selectedDraft.id)}
            type="button"
          >
            {isDuplicatingSelectedDraft ? "Duplicating..." : "Duplicate draft"}
          </button>
        </div>
        {selectedDraftState.status === "loading" ? (
          <p className="admin-message admin-message-info">
            Loading event details...
          </p>
        ) : null}
        {selectedDraftState.status === "error" ? (
          <p className="admin-message admin-message-error">
            {selectedDraftState.message}
          </p>
        ) : null}
        {selectedDraftState.status === "ready" ||
        selectedDraftState.status === "saving" ||
        selectedDraftState.status === "save_error" ||
        selectedDraftState.status === "success" ? (
          <AdminEventDetailsForm
            disabled={isWorkspaceBusy}
            draft={selectedDraftState.draft}
            isSaving={isSelectedSaving}
            message={selectedDraftState.message}
            messageKind={getSelectedDraftMessageKind(selectedDraftState)}
            onSave={onSaveSelectedEventDetails}
          />
        ) : null}
        {focusedQuestionId &&
        (selectedDraftState.status === "ready" ||
          selectedDraftState.status === "saving" ||
          selectedDraftState.status === "save_error" ||
          selectedDraftState.status === "success") ? (
          <AdminQuestionEditor
            disabled={isWorkspaceBusy}
            draft={selectedDraftState.draft}
            focusedQuestionId={focusedQuestionId}
            isSaving={isQuestionSavePending}
            key={`${selectedDraftState.draft.id}-${selectedDraftState.draft.updatedAt}`}
            message={questionSaveState.message}
            messageKind={getQuestionMessageKind(questionSaveState)}
            onFocusQuestion={onFocusQuestion}
            onSave={onSaveSelectedQuestionContent}
          />
        ) : null}
        {selectedDraftState.status === "ready" ||
        selectedDraftState.status === "saving" ||
        selectedDraftState.status === "save_error" ||
        selectedDraftState.status === "success" ? (
          <AdminPublishPanel
            disabled={isWorkspaceBusy}
            draft={selectedDraftState.draft}
            onCancelUnpublish={onCancelUnpublish}
            onConfirmUnpublish={onConfirmUnpublish}
            onPublish={onPublish}
            onUnpublish={onUnpublish}
            publishState={publishState}
            unpublishState={unpublishState}
          />
        ) : null}
        {draftMutationState.status !== "idle" ? (
          <p className={getMutationMessageClass(draftMutationState)}>
            {draftMutationState.message}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div className="admin-summary-grid" aria-label="Event workspace summary">
        <div className="admin-summary-item">{formatCount(counts.totalCount, "event")}</div>
        <div className="admin-summary-item">
          {formatCount(counts.liveCount, "live", "live")}
        </div>
        <div className="admin-summary-item">
          {formatCount(counts.draftOnlyCount, "draft only", "draft only")}
        </div>
      </div>
      <div className="admin-toolbar">
        <button
          className="primary-button"
          disabled={isWorkspaceBusy}
          onClick={() => void handleCreateDraft()}
          type="button"
        >
          {draftMutationState.status === "creating"
            ? "Creating draft..."
            : "Create draft"}
        </button>
        <button
          className="secondary-button admin-refresh-button"
          disabled={isWorkspaceBusy}
          onClick={onRefresh}
          type="button"
        >
          Refresh events
        </button>
      </div>
      {draftMutationState.status !== "idle" ? (
        <p className={getMutationMessageClass(draftMutationState)}>
          {draftMutationState.message}
        </p>
      ) : null}
      <div className="draft-list">
        {drafts.length ? (
          drafts.map((draft) => (
            <article
              aria-label={`${draft.name} event`}
              className="draft-row"
              key={draft.id}
            >
              <div className="draft-row-copy">
                <div className="draft-row-header">
                  <h3>{draft.name}</h3>
                  <span className="chip">{getStatusLabel(draft)}</span>
                </div>
                <p className="draft-row-meta">Slug: {draft.slug}</p>
                <p className="draft-row-meta">
                  Last saved: {formatSavedAt(draft.updatedAt)}
                </p>
              </div>
              <div className="admin-action-row">
                <button
                  className="secondary-button"
                  onClick={() => onNavigate(routes.adminEvent(draft.id))}
                  type="button"
                >
                  Open workspace
                </button>
                {draft.liveVersionNumber ? (
                  <button
                    className="secondary-button"
                    disabled={isWorkspaceBusy}
                    onClick={() => onNavigate(routes.game(draft.slug))}
                    type="button"
                  >
                    Open live quiz
                  </button>
                ) : null}
                <button
                  className="secondary-button"
                  disabled={isWorkspaceBusy}
                  onClick={() => void handleDuplicateDraft(draft.id)}
                  type="button"
                >
                  {draftMutationState.status === "duplicating" &&
                  draftMutationState.eventId === draft.id
                    ? "Duplicating..."
                    : "Duplicate draft"}
                </button>
              </div>
            </article>
          ))
        ) : (
          <p className="draft-row-meta">No draft events are visible yet.</p>
        )}
      </div>
    </>
  );
}
