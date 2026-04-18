import { useEffect, useRef } from "react";
import type { DraftEventDetail } from "../lib/adminGameApi";
import { routes } from "../routes";
import { computePublishChecklist, isPublishReady } from "./publishChecklist";
import type { AdminPublishState, AdminUnpublishState } from "./useAdminDashboard";

type AdminPublishPanelProps = {
  disabled: boolean;
  draft: DraftEventDetail;
  onCancelUnpublish: () => void;
  onConfirmUnpublish: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  publishState: AdminPublishState;
  unpublishState: AdminUnpublishState;
};

/** Publish checklist and publish/unpublish action panel for a draft event. */
export function AdminPublishPanel({
  disabled,
  draft,
  onCancelUnpublish,
  onConfirmUnpublish,
  onPublish,
  onUnpublish,
  publishState,
  unpublishState,
}: AdminPublishPanelProps) {
  const checklist = computePublishChecklist(draft.content);
  const canPublish = isPublishReady(checklist);
  const isPublishing = publishState.status === "publishing";
  const isUnpublishing = unpublishState.status === "unpublishing";
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // Move focus to the Confirm button when the inline confirmation appears so
  // keyboard and screen-reader users are aware the UI has changed.
  useEffect(() => {
    if (unpublishState.status === "confirming") {
      confirmButtonRef.current?.focus();
    }
  }, [unpublishState.status]);

  return (
    <section className="admin-publish-panel" aria-label="Publish">
      <div className="admin-workspace-heading">
        <div>
          <p className="eyebrow">Publish</p>
          <h3>Publish draft</h3>
        </div>
      </div>
      <ul className="admin-checklist" aria-label="Publish checklist">
        {checklist.map((item) => (
          <li
            aria-label={`${item.passed ? "Pass" : "Fail"}: ${item.label}${item.detail ? ` — ${item.detail}` : ""}`}
            className="admin-checklist-item"
            key={item.id}
          >
            <span
              aria-hidden="true"
              className={
                item.passed
                  ? "admin-checklist-indicator admin-checklist-indicator--pass"
                  : "admin-checklist-indicator admin-checklist-indicator--fail"
              }
            />
            <span>
              {item.label}
              {!item.passed && item.detail ? (
                <span className="admin-checklist-detail"> — {item.detail}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      <div className="admin-action-row">
        <button
          className="primary-button"
          disabled={!canPublish || disabled || isPublishing}
          onClick={onPublish}
          type="button"
        >
          {isPublishing ? "Publishing..." : "Publish draft"}
        </button>
      </div>
      {publishState.status === "success" ? (
        <div className="admin-publish-result">
          <p className="admin-message admin-message-success">
            Published as version {publishState.result.versionNumber}.{" "}
            <a href={routes.game(publishState.result.slug)}>
              View live game
            </a>
          </p>
        </div>
      ) : null}
      {publishState.status === "error" ? (
        <p className="admin-message admin-message-error">
          {publishState.message}
        </p>
      ) : null}
      {draft.liveVersionNumber !== null ? (
        <div className="admin-unpublish-section">
          {unpublishState.status === "idle" ||
          unpublishState.status === "error" ? (
            <div className="admin-action-row">
              <button
                className="secondary-button"
                disabled={disabled || isUnpublishing}
                onClick={onUnpublish}
                type="button"
              >
                Unpublish
              </button>
            </div>
          ) : null}
          {unpublishState.status === "confirming" ? (
            <div className="admin-unpublish-confirm admin-action-row">
              <span className="admin-dirty-state">Are you sure?</span>
              <button
                aria-label="Confirm unpublish"
                className="secondary-button"
                disabled={disabled}
                onClick={onConfirmUnpublish}
                ref={confirmButtonRef}
                type="button"
              >
                Confirm
              </button>
              <button
                aria-label="Cancel unpublish"
                className="secondary-button"
                disabled={disabled}
                onClick={onCancelUnpublish}
                type="button"
              >
                Cancel
              </button>
            </div>
          ) : null}
          {unpublishState.status === "unpublishing" ? (
            <div className="admin-action-row">
              <button className="secondary-button" disabled type="button">
                Unpublishing...
              </button>
            </div>
          ) : null}
          {unpublishState.status === "error" ? (
            <p className="admin-message admin-message-error">
              {unpublishState.message}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
