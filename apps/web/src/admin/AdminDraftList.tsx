import type { DraftEventSummary } from "../lib/adminQuizApi";

type AdminDraftListProps = {
  drafts: DraftEventSummary[];
};

function formatSavedAt(timestamp: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

/** Presents private draft summaries for an allowlisted admin. */
export function AdminDraftList({ drafts }: AdminDraftListProps) {
  return (
    <div className="draft-list">
      {drafts.map((draft) => (
        <article className="draft-row" key={draft.id}>
          <div className="draft-row-copy">
            <div className="draft-row-header">
              <h3>{draft.name}</h3>
              <span className="chip">
                {draft.liveVersionNumber
                  ? `Live v${draft.liveVersionNumber}`
                  : "Draft only"}
              </span>
            </div>
            <p className="draft-row-meta">
              <strong>Slug:</strong> {draft.slug}
            </p>
            <p className="draft-row-meta">
              <strong>Last saved:</strong> {formatSavedAt(draft.updatedAt)}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}
