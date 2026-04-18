/** Success panel shown between questions in instant-feedback game mode. */
import type { Question } from "../../data/games";

/** Props for the instant-feedback success panel. */
type CorrectAnswerPanelProps = {
  feedbackMessage: string;
  isLastQuestion: boolean;
  onContinue: () => void;
  question: Question;
};

/** Success panel shown in the instant-feedback game mode. */
export function CorrectAnswerPanel({
  feedbackMessage,
  isLastQuestion,
  onContinue,
  question,
}: CorrectAnswerPanelProps) {
  return (
    <section className="panel completion-panel">
      <span className="chip chip-success">Correct</span>
      {question.sponsor ? <h2>{question.sponsor}</h2> : null}
      <p>{feedbackMessage}</p>
      <button className="primary-button" onClick={onContinue} type="button">
        {isLastQuestion ? "See your results" : "Continue"}
      </button>
    </section>
  );
}
