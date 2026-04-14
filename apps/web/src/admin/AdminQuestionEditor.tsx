import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { DraftEventDetail, DraftEventSummary } from "../lib/adminQuizApi";
import {
  createQuestionFormValues,
  type AdminQuestionFormValues,
} from "./questionBuilder";

type AdminQuestionEditorProps = {
  disabled: boolean;
  draft: DraftEventDetail;
  focusedQuestionId: string;
  isSaving: boolean;
  message: string | null;
  messageKind: "error" | "info" | "success";
  onFocusQuestion: (questionId: string) => void;
  onSave: (
    questionId: string,
    values: AdminQuestionFormValues,
  ) => Promise<DraftEventSummary | null>;
};

function serializeValues(values: AdminQuestionFormValues) {
  return JSON.stringify(values);
}

export function AdminQuestionEditor({
  disabled,
  draft,
  focusedQuestionId,
  isSaving,
  message,
  messageKind,
  onFocusQuestion,
  onSave,
}: AdminQuestionEditorProps) {
  const focusedQuestion = draft.content.questions.find(
    (question) => question.id === focusedQuestionId,
  );
  const baselineValues = useMemo(
    () => createQuestionFormValues(draft.content, focusedQuestionId),
    [draft.content, focusedQuestionId],
  );
  const [values, setValues] =
    useState<AdminQuestionFormValues>(baselineValues);
  const isDirty = serializeValues(values) !== serializeValues(baselineValues);

  useEffect(() => {
    setValues(baselineValues);
  }, [baselineValues]);

  const updateTextValue =
    (field: keyof Pick<
      AdminQuestionFormValues,
      "explanation" | "prompt" | "sponsor" | "sponsorFact"
    >) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValues((currentValues) => ({
        ...currentValues,
        [field]: event.target.value,
      }));
    };

  const updateSelectionMode = (event: ChangeEvent<HTMLSelectElement>) => {
    setValues((currentValues) => ({
      ...currentValues,
      selectionMode: event.target.value as AdminQuestionFormValues["selectionMode"],
    }));
  };

  const updateOptionLabel =
    (optionId: string) => (event: ChangeEvent<HTMLInputElement>) => {
      setValues((currentValues) => ({
        ...currentValues,
        options: currentValues.options.map((option) =>
          option.id === optionId
            ? { ...option, label: event.target.value }
            : option,
        ),
      }));
    };

  const updateCorrectAnswer =
    (optionId: string) => (event: ChangeEvent<HTMLInputElement>) => {
      setValues((currentValues) => ({
        ...currentValues,
        options: currentValues.options.map((option) => {
          if (currentValues.selectionMode === "single") {
            return {
              ...option,
              isCorrect: option.id === optionId,
            };
          }

          return option.id === optionId
            ? { ...option, isCorrect: event.target.checked }
            : option;
        }),
      }));
    };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onSave(focusedQuestionId, values);
  };

  if (!focusedQuestion) {
    return (
      <section className="admin-question-editor" aria-label="Question editor">
        <p className="admin-message admin-message-error">
          This question is no longer available.
        </p>
      </section>
    );
  }

  return (
    <section className="admin-question-builder" aria-label="Question builder">
      <div className="admin-workspace-heading">
        <div>
          <p className="eyebrow">Questions</p>
          <h3>Edit existing questions</h3>
        </div>
        <span className="chip">{draft.content.questions.length} questions</span>
      </div>
      <div className="admin-question-layout">
        <div className="admin-question-list" aria-label="Question list">
          {draft.content.questions.map((question, index) => (
            <button
              aria-pressed={question.id === focusedQuestionId}
              className="secondary-button admin-question-list-button"
              disabled={disabled}
              key={question.id}
              onClick={() => onFocusQuestion(question.id)}
              type="button"
            >
              Question {index + 1}: {question.prompt}
            </button>
          ))}
        </div>
        <form className="admin-form admin-question-form" onSubmit={handleSubmit}>
          <label className="admin-field">
            <span className="admin-field-label">Question prompt</span>
            <textarea
              className="admin-input admin-textarea"
              disabled={disabled}
              onChange={updateTextValue("prompt")}
              value={values.prompt}
            />
          </label>
          <div className="admin-details-grid">
            <label className="admin-field">
              <span className="admin-field-label">Question sponsor</span>
              <input
                className="admin-input"
                disabled={disabled}
                onChange={updateTextValue("sponsor")}
                type="text"
                value={values.sponsor}
              />
            </label>
            <label className="admin-field">
              <span className="admin-field-label">Selection mode</span>
              <select
                className="admin-input"
                disabled={disabled}
                onChange={updateSelectionMode}
                value={values.selectionMode}
              >
                <option value="single">Single correct answer</option>
                <option value="multiple">Multiple correct answers</option>
              </select>
            </label>
          </div>
          <label className="admin-field">
            <span className="admin-field-label">Explanation</span>
            <textarea
              className="admin-input admin-textarea"
              disabled={disabled}
              onChange={updateTextValue("explanation")}
              value={values.explanation}
            />
          </label>
          <label className="admin-field">
            <span className="admin-field-label">Sponsor fact</span>
            <textarea
              className="admin-input admin-textarea"
              disabled={disabled}
              onChange={updateTextValue("sponsorFact")}
              value={values.sponsorFact}
            />
          </label>
          <fieldset className="admin-option-fieldset">
            <legend>Existing answer options</legend>
            {values.options.map((option, index) => (
              <div className="admin-option-row" key={option.id}>
                <label className="admin-correct-answer">
                  <input
                    checked={option.isCorrect}
                    disabled={disabled}
                    name={
                      values.selectionMode === "single"
                        ? `correct-answer-${focusedQuestionId}`
                        : undefined
                    }
                    onChange={updateCorrectAnswer(option.id)}
                    type={values.selectionMode === "single" ? "radio" : "checkbox"}
                  />{" "}
                  Correct
                </label>
                <label className="admin-field">
                  <span className="admin-field-label">
                    Option {index + 1} label
                  </span>
                  <input
                    className="admin-input"
                    disabled={disabled}
                    onChange={updateOptionLabel(option.id)}
                    type="text"
                    value={option.label}
                  />
                </label>
              </div>
            ))}
          </fieldset>
          <div className="admin-action-row">
            <button
              className="primary-button"
              disabled={disabled || !isDirty}
              type="submit"
            >
              {isSaving ? "Saving question changes..." : "Save question changes"}
            </button>
            {isDirty ? (
              <span className="admin-dirty-state">
                Unsaved question changes.
              </span>
            ) : null}
          </div>
          {message ? (
            <p className={`admin-message admin-message-${messageKind}`}>
              {message}
            </p>
          ) : null}
        </form>
      </div>
    </section>
  );
}
