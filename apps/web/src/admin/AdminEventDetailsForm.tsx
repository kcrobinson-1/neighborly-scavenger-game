import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { DraftEventDetail, DraftEventSummary } from "../lib/adminGameApi";
import {
  createEventDetailsFormValues,
  type AdminEventDetailsFormValues,
} from "./eventDetails";

/**
 * Event-details form UI for one selected draft event.
 * Owns local field buffering and submit handoff.
 * Does not own canonical validation/persistence rules, which stay in
 * eventDetails.ts and admin save APIs.
 */
type AdminEventDetailsFormProps = {
  disabled: boolean;
  draft: DraftEventDetail;
  isSaving: boolean;
  message: string | null;
  messageKind: "error" | "info" | "success";
  onSave: (values: AdminEventDetailsFormValues) => Promise<DraftEventSummary | null>;
};

type TextFieldName = Exclude<
  keyof AdminEventDetailsFormValues,
  "allowBackNavigation" | "allowRetake"
>;

function serializeValues(values: AdminEventDetailsFormValues) {
  return JSON.stringify(values);
}

export function AdminEventDetailsForm({
  disabled,
  draft,
  isSaving,
  message,
  messageKind,
  onSave,
}: AdminEventDetailsFormProps) {
  const baselineValues = useMemo(
    () => createEventDetailsFormValues(draft.content),
    [draft.content],
  );
  const [values, setValues] =
    useState<AdminEventDetailsFormValues>(baselineValues);
  const isDirty = serializeValues(values) !== serializeValues(baselineValues);

  useEffect(() => {
    setValues(baselineValues);
  }, [baselineValues]);

  // When publish transitions the slug to locked, discard any unsaved slug edit.
  // Without this, a stale edit in form state would be sent on the next save and
  // rejected by the backend with 422, leaving no way to correct it.
  const prevHasBeenPublished = useRef(draft.hasBeenPublished);
  useEffect(() => {
    if (draft.hasBeenPublished && !prevHasBeenPublished.current) {
      setValues((currentValues) => ({ ...currentValues, slug: baselineValues.slug }));
    }
    prevHasBeenPublished.current = draft.hasBeenPublished;
  }, [draft.hasBeenPublished, baselineValues.slug]);

  const updateTextValue =
    (field: TextFieldName) =>
    (
      event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
    ) => {
      setValues((currentValues) => ({
        ...currentValues,
        [field]: event.target.value,
      }));
    };

  const updateBooleanValue =
    (field: keyof Pick<
      AdminEventDetailsFormValues,
      "allowBackNavigation" | "allowRetake"
    >) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setValues((currentValues) => ({
        ...currentValues,
        [field]: event.target.checked,
      }));
    };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onSave(values);
  };

  return (
    <form className="admin-form admin-details-form" onSubmit={handleSubmit}>
      <div className="admin-details-grid">
        <label className="admin-field">
          <span className="admin-field-label">Event name</span>
          <input
            className="admin-input"
            disabled={disabled}
            onChange={updateTextValue("name")}
            type="text"
            value={values.name}
          />
        </label>
        <div className="admin-field">
          <label htmlFor="admin-event-slug">
            <span className="admin-field-label">Slug</span>
          </label>
          <input
            className="admin-input"
            disabled={disabled || draft.hasBeenPublished}
            id="admin-event-slug"
            onChange={updateTextValue("slug")}
            title={
              draft.hasBeenPublished
                ? "Slug is locked after publishing — printed QR codes and URLs depend on it."
                : undefined
            }
            type="text"
            value={values.slug}
          />
          {draft.hasBeenPublished ? (
            <span className="admin-field-hint">
              Locked after publishing — printed QR codes and URLs depend on
              this.
            </span>
          ) : null}
        </div>
        <label className="admin-field">
          <span className="admin-field-label">Location</span>
          <input
            className="admin-input"
            disabled={disabled}
            onChange={updateTextValue("location")}
            type="text"
            value={values.location}
          />
        </label>
        <label className="admin-field">
          <span className="admin-field-label">Estimated minutes</span>
          <input
            className="admin-input"
            disabled={disabled}
            inputMode="numeric"
            min="1"
            onChange={updateTextValue("estimatedMinutes")}
            type="number"
            value={values.estimatedMinutes}
          />
        </label>
        <label className="admin-field">
          <span className="admin-field-label">Reward label</span>
          <input
            className="admin-input"
            disabled={disabled}
            onChange={updateTextValue("entitlementLabel")}
            type="text"
            value={values.entitlementLabel}
          />
        </label>
        <label className="admin-field">
          <span className="admin-field-label">Feedback mode</span>
          <select
            className="admin-input"
            disabled={disabled}
            onChange={updateTextValue("feedbackMode")}
            value={values.feedbackMode}
          >
            <option value="final_score_reveal">Final score reveal</option>
            <option value="instant_feedback_required">
              Instant feedback required
            </option>
          </select>
        </label>
      </div>
      <label className="admin-field">
        <span className="admin-field-label">Intro</span>
        <textarea
          className="admin-input admin-textarea"
          disabled={disabled}
          onChange={updateTextValue("intro")}
          value={values.intro}
        />
      </label>
      <label className="admin-field">
        <span className="admin-field-label">Summary</span>
        <textarea
          className="admin-input admin-textarea"
          disabled={disabled}
          onChange={updateTextValue("summary")}
          value={values.summary}
        />
      </label>
      <div className="admin-checkbox-row">
        <label>
          <input
            checked={values.allowBackNavigation}
            disabled={disabled}
            onChange={updateBooleanValue("allowBackNavigation")}
            type="checkbox"
          />{" "}
          Allow back navigation
        </label>
        <label>
          <input
            checked={values.allowRetake}
            disabled={disabled}
            onChange={updateBooleanValue("allowRetake")}
            type="checkbox"
          />{" "}
          Allow retake
        </label>
      </div>
      <div className="admin-action-row">
        <button
          className="primary-button"
          disabled={disabled || !isDirty}
          type="submit"
        >
          {isSaving ? "Saving changes..." : "Save changes"}
        </button>
        {isDirty ? (
          <span className="admin-dirty-state">Unsaved event detail changes.</span>
        ) : null}
      </div>
      {message ? (
        <p className={`admin-message admin-message-${messageKind}`}>{message}</p>
      ) : null}
    </form>
  );
}
