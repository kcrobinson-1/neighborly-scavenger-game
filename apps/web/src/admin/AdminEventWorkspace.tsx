import type { DraftEventSummary } from "../lib/adminQuizApi";
import { routes } from "../routes";
import type { AdminDraftMutationState } from "./useAdminDashboard";

type AdminEventWorkspaceProps = {
  draftMutationState: AdminDraftMutationState;
  drafts: DraftEventSummary[];
  onCreateDraft: () => Promise<DraftEventSummary | null>;
  onDuplicateDraft: (eventId: string) => Promise<DraftEventSummary | null>;
  onNavigate: (path: string) => void;
  onRefresh: () => void;
  selectedEventId?: string;
};

function formatSavedAt(timestamp: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function getStatusLabel(draft: DraftEventSummary) {
  return draft.liveVersionNumber
    ? `Live v${draft.liveVersionNumber}`
    : "Draft only";
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

function getMutationMessageClass(state: AdminDraftMutationState) {
  return state.status === "error"
    ? "admin-message admin-message-error"
    : "admin-message admin-message-info";
}

/** Event workspace for draft orientation plus create and duplicate actions. */
export function AdminEventWorkspace({
  draftMutationState,
  drafts,
  onCreateDraft,
  onDuplicateDraft,
  onNavigate,
  onRefresh,
  selectedEventId,
}: AdminEventWorkspaceProps) {
  const selectedDraft = selectedEventId
    ? drafts.find((draft) => draft.id === selectedEventId)
    : null;
  const counts = getEventCounts(drafts);
  const isMutationPending = isDraftMutationPending(draftMutationState);

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
        <p>Status: {getStatusLabel(selectedDraft)}</p>
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
              disabled={isMutationPending}
              onClick={() => onNavigate(routes.game(selectedDraft.slug))}
              type="button"
            >
              Open live quiz
            </button>
          ) : null}
          <button
            className="secondary-button"
            disabled={isMutationPending}
            onClick={() => void handleDuplicateDraft(selectedDraft.id)}
            type="button"
          >
            {isDuplicatingSelectedDraft ? "Duplicating..." : "Duplicate draft"}
          </button>
        </div>
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
          disabled={isMutationPending}
          onClick={() => void handleCreateDraft()}
          type="button"
        >
          {draftMutationState.status === "creating"
            ? "Creating draft..."
            : "Create draft"}
        </button>
        <button
          className="secondary-button admin-refresh-button"
          disabled={isMutationPending}
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
                    disabled={isMutationPending}
                    onClick={() => onNavigate(routes.game(draft.slug))}
                    type="button"
                  >
                    Open live quiz
                  </button>
                ) : null}
                <button
                  className="secondary-button"
                  disabled={isMutationPending}
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
