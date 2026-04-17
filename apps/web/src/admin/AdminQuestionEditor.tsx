import {
  type ChangeEvent,
  type FormEvent,
  useMemo,
  useState,
} from "react";
import type { DraftEventDetail, DraftEventSummary } from "../lib/adminQuizApi";
import {
  createQuestionFormValues,
  updateQuestionFormValues,
  type AdminQuestionFormValues,
} from "./questionFormMapping";
import {
  addOption,
  addQuestion,
  deleteOption,
  deleteQuestion,
  duplicateQuestion,
  moveQuestion,
  updateQuestionSelectionMode,
} from "./questionStructure";

/**
 * Question-editor workspace for one selected draft event.
 * Owns local question-content buffering, structural edits, and save handoff.
 * Does not own canonical content validation or persistence contracts; those are
 * delegated to question mapping/structure helpers and admin authoring APIs.
 */
type AdminQuestionEditorProps = {
  disabled: boolean;
  draft: DraftEventDetail;
  focusedQuestionId: string;
  isSaving: boolean;
  message: string | null;
  messageKind: "error" | "info" | "success";
  onFocusQuestion: (questionId: string) => void;
  onSave: (
    content: DraftEventDetail["content"],
    questionId: string,
  ) => Promise<DraftEventSummary | null>;
};

function serializeContent(content: DraftEventDetail["content"]) {
  return JSON.stringify(content);
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
  const [editableContent, setEditableContent] = useState(draft.content);
  const [localMessage, setLocalMessage] = useState<string | null>(null);
  const [pendingDeleteQuestionId, setPendingDeleteQuestionId] = useState<
    string | null
  >(null);
  const focusedQuestion = editableContent.questions.find(
    (question) => question.id === focusedQuestionId,
  );
  const focusedQuestionIndex = editableContent.questions.findIndex(
    (question) => question.id === focusedQuestionId,
  );
  const baselineSerializedContent = useMemo(
    () => serializeContent(draft.content),
    [draft.content],
  );
  const isDirty =
    serializeContent(editableContent) !== baselineSerializedContent;
  const values = useMemo(
    () => createQuestionFormValues(editableContent, focusedQuestionId),
    [editableContent, focusedQuestionId],
  );
  const saveMessage = localMessage ?? message;
  const saveMessageKind = localMessage ? "error" : messageKind;

  const applyContentChange = (
    updater: (
      content: DraftEventDetail["content"],
    ) => DraftEventDetail["content"],
  ) => {
    setEditableContent((currentContent) => updater(currentContent));
    setLocalMessage(null);
  };

  const updateValues = (nextValues: AdminQuestionFormValues) => {
    applyContentChange((currentContent) =>
      updateQuestionFormValues(currentContent, focusedQuestionId, nextValues));
  };

  const updateTextValue =
    (field: keyof Pick<
      AdminQuestionFormValues,
      "explanation" | "prompt" | "sponsor" | "sponsorFact"
    >) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      updateValues({
        ...values,
        [field]: event.target.value,
      });
    };

  const updateSelectionMode = (event: ChangeEvent<HTMLSelectElement>) => {
    applyContentChange((currentContent) =>
      updateQuestionSelectionMode(
        updateQuestionFormValues(currentContent, focusedQuestionId, values),
        focusedQuestionId,
        event.target.value as AdminQuestionFormValues["selectionMode"],
      ));
  };

  const updateOptionLabel =
    (optionId: string) => (event: ChangeEvent<HTMLInputElement>) => {
      updateValues({
        ...values,
        options: values.options.map((option) =>
          option.id === optionId
            ? { ...option, label: event.target.value }
            : option,
        ),
      });
    };

  const updateCorrectAnswer =
    (optionId: string) => (event: ChangeEvent<HTMLInputElement>) => {
      updateValues({
        ...values,
        options: values.options.map((option) => {
          if (values.selectionMode === "single") {
            return {
              ...option,
              isCorrect: option.id === optionId,
            };
          }

          return option.id === optionId
            ? { ...option, isCorrect: event.target.checked }
            : option;
        }),
      });
    };

  const applyStructureResult = (
    result: {
      content: DraftEventDetail["content"];
      focusedQuestionId: string;
    },
  ) => {
    setEditableContent(result.content);
    onFocusQuestion(result.focusedQuestionId);
    setLocalMessage(null);
    setPendingDeleteQuestionId(null);
  };

  const handleAddQuestion = () => {
    applyStructureResult(addQuestion(editableContent));
  };

  const handleDuplicateQuestion = () => {
    applyStructureResult(duplicateQuestion(editableContent, focusedQuestionId));
  };

  const handleMoveQuestion = (direction: "down" | "up") => {
    applyStructureResult(
      moveQuestion(editableContent, focusedQuestionId, direction),
    );
  };

  const handleDeleteQuestion = () => {
    try {
      applyStructureResult(deleteQuestion(editableContent, focusedQuestionId));
    } catch (error: unknown) {
      setLocalMessage(
        error instanceof Error ? error.message : "We couldn't delete the question.",
      );
    }
  };

  const handleAddOption = () => {
    applyContentChange((currentContent) =>
      addOption(currentContent, focusedQuestionId));
  };

  const handleDeleteOption = (optionId: string) => {
    try {
      applyContentChange((currentContent) =>
        deleteOption(currentContent, focusedQuestionId, optionId));
    } catch (error: unknown) {
      setLocalMessage(
        error instanceof Error ? error.message : "We couldn't delete the option.",
      );
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onSave(
      updateQuestionFormValues(editableContent, focusedQuestionId, values),
      focusedQuestionId,
    );
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
        <span className="chip">
          {editableContent.questions.length} questions
        </span>
      </div>
      <div className="admin-toolbar">
        <button
          className="primary-button"
          disabled={disabled}
          onClick={handleAddQuestion}
          type="button"
        >
          Add question
        </button>
      </div>
      <div className="admin-question-layout">
        <div className="admin-question-list" aria-label="Question list">
          {editableContent.questions.map((question, index) => (
            <button
              aria-pressed={question.id === focusedQuestionId}
              className="secondary-button admin-question-list-button"
              disabled={disabled}
              key={question.id}
              onClick={() => {
                onFocusQuestion(question.id);
                setPendingDeleteQuestionId(null);
              }}
              type="button"
            >
              Question {index + 1}: {question.prompt || "Untitled question"}
            </button>
          ))}
        </div>
        <form className="admin-form admin-question-form" onSubmit={handleSubmit}>
          <div className="admin-action-row">
            <button
              className="secondary-button"
              disabled={disabled || focusedQuestionIndex <= 0}
              onClick={() => handleMoveQuestion("up")}
              type="button"
            >
              Move up
            </button>
            <button
              className="secondary-button"
              disabled={
                disabled ||
                focusedQuestionIndex < 0 ||
                focusedQuestionIndex >= editableContent.questions.length - 1
              }
              onClick={() => handleMoveQuestion("down")}
              type="button"
            >
              Move down
            </button>
            <button
              className="secondary-button"
              disabled={disabled}
              onClick={handleDuplicateQuestion}
              type="button"
            >
              Duplicate question
            </button>
            <button
              className="secondary-button"
              disabled={disabled || editableContent.questions.length <= 1}
              onClick={() => setPendingDeleteQuestionId(focusedQuestionId)}
              type="button"
            >
              Delete question
            </button>
          </div>
          {editableContent.questions.length <= 1 ? (
            <p className="draft-row-meta">Keep at least one question.</p>
          ) : null}
          {pendingDeleteQuestionId === focusedQuestionId ? (
            <div className="admin-delete-confirmation">
              <p>Delete this question from the draft?</p>
              <div className="admin-action-row">
                <button
                  className="secondary-button"
                  disabled={disabled}
                  onClick={handleDeleteQuestion}
                  type="button"
                >
                  Confirm delete
                </button>
                <button
                  className="secondary-button"
                  disabled={disabled}
                  onClick={() => setPendingDeleteQuestionId(null)}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
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
            <legend>Answer options</legend>
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
                <button
                  className="secondary-button"
                  disabled={disabled || values.options.length <= 1}
                  onClick={() => handleDeleteOption(option.id)}
                  type="button"
                >
                  Delete option
                </button>
              </div>
            ))}
            {values.options.length <= 1 ? (
              <p className="draft-row-meta">Keep at least one answer option.</p>
            ) : null}
            <button
              className="secondary-button admin-inline-button"
              disabled={disabled}
              onClick={handleAddOption}
              type="button"
            >
              Add option
            </button>
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
          {saveMessage ? (
            <p className={`admin-message admin-message-${saveMessageKind}`}>
              {saveMessage}
            </p>
          ) : null}
        </form>
      </div>
    </section>
  );
}
