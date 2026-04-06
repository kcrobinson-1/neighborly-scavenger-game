/** Active-question panel and answer field rendering for quiz gameplay. */
import { type FormEvent } from "react";
import type { GameConfig, Question } from "../../data/games";
import { getSelectionLabel } from "../quizUtils";

/** Props for the active question card. */
type CurrentQuestionPanelProps = {
  canGoBack: boolean;
  canSubmit: boolean;
  currentIndex: number;
  feedbackKind: "correct" | "incorrect" | null;
  feedbackMessage: string | null;
  onGoBack: () => void;
  onOptionSelect: (optionId: string) => void;
  onSubmit: () => void;
  pendingSelection: string[];
  question: GameConfig["questions"][number];
  questionCount: number;
};

/** Question card with answer selection and submit controls. */
export function CurrentQuestionPanel({
  canGoBack,
  canSubmit,
  currentIndex,
  feedbackKind,
  feedbackMessage,
  onGoBack,
  onOptionSelect,
  onSubmit,
  pendingSelection,
  question,
  questionCount,
}: CurrentQuestionPanelProps) {
  const selectionHintId = `${question.id}-selection-hint`;
  const submitLabel =
    question.selectionMode === "multiple" ? "Submit answers" : "Submit answer";

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <section className="panel question-panel">
      <p className="sponsor-label">Sponsored by {question.sponsor}</p>
      <h2>{question.prompt}</h2>
      <p className="selection-hint" id={selectionHintId}>
        {getSelectionLabel(question)}
      </p>
      <form className="question-form" onSubmit={handleSubmit}>
        <OptionField
          onOptionSelect={onOptionSelect}
          pendingSelection={pendingSelection}
          question={question}
          selectionHintId={selectionHintId}
        />
        {feedbackKind === "incorrect" && feedbackMessage ? (
          <div className="feedback-banner feedback-banner-error" role="status">
            <strong>Try again.</strong>
            <p>{feedbackMessage}</p>
          </div>
        ) : null}
        <div className="question-actions">
          {canGoBack ? (
            <button className="text-link question-back-link" onClick={onGoBack} type="button">
              Back to the previous question
            </button>
          ) : null}
          <button
            className="primary-button submit-button"
            disabled={!canSubmit}
            type="submit"
          >
            {submitLabel}
          </button>
        </div>
        <p className="sr-only">
          Question {currentIndex + 1} of {questionCount}
        </p>
      </form>
    </section>
  );
}

/** Props for the answer choice fieldset. */
type OptionFieldProps = {
  onOptionSelect: (optionId: string) => void;
  pendingSelection: string[];
  question: Question;
  selectionHintId: string;
};

/** Renders the answer input group for a single question. */
function OptionField({
  onOptionSelect,
  pendingSelection,
  question,
  selectionHintId,
}: OptionFieldProps) {
  const inputType =
    question.selectionMode === "multiple" ? "checkbox" : "radio";

  return (
    <fieldset className="option-fieldset">
      <legend className="sr-only">{question.prompt}</legend>
      <div
        aria-describedby={selectionHintId}
        aria-label={`${question.prompt} answer options`}
        className="options"
      >
        {question.options.map((option) => {
          const checked = pendingSelection.includes(option.id);
          const inputId = `${question.id}-${option.id}`;

          return (
            <label
              className={`option-choice${checked ? " option-choice-selected" : ""}`}
              htmlFor={inputId}
              key={option.id}
            >
              <input
                checked={checked}
                className="option-input"
                id={inputId}
                name={`question-${question.id}`}
                onChange={() => onOptionSelect(option.id)}
                type={inputType}
              />
              <span className="option-button">{option.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
