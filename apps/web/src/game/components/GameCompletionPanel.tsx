/** Completion-state panel for verification, retries, retakes, and answer review. */
import { answersMatch } from "../../../../../shared/game-config";
import type { GameConfig } from "../../data/games";
import { getOptionLabels } from "../gameUtils";
import type { Answers, GameCompletionResult } from "../../types/game";

/** Props for the game completion screen. */
type GameCompletionPanelProps = {
  answers: Answers;
  completion: GameCompletionResult | null;
  completionError: string | null;
  game: GameConfig;
  isSubmitting: boolean;
  onReset: () => void;
  onRetake: () => void;
  onRetrySubmission: () => void;
  score: number;
  showRetake: boolean;
};

/** Completion screen that shows verification and optional answer review. */
export function GameCompletionPanel({
  answers,
  completion,
  completionError,
  game,
  isSubmitting,
  onReset,
  onRetake,
  onRetrySubmission,
  score,
  showRetake,
}: GameCompletionPanelProps) {
  const isEntitlementNew = completion?.entitlement.status === "new";
  const verificationCode = completion?.entitlement.verificationCode ?? null;
  const shouldShowVerification = isSubmitting || Boolean(completion);
  const shouldShowAnswerReview =
    Boolean(completion) && game.feedbackMode === "final_score_reveal";
  const completionMessage = completion
    ? isEntitlementNew
      ? "You're checked in for the reward."
      : "You're still checked in for the reward. Playing again does not add another reward entry."
    : null;

  return (
    <section className="panel completion-panel">
      <span
        className={`chip${completion ? " chip-success" : completionError ? " chip-error" : ""}`}
      >
        {completion
          ? isEntitlementNew
            ? "Reward entry ready"
            : "Already checked in"
          : isSubmitting
            ? "Generating proof"
            : "Try again"}
      </span>
      <h2>
        {completion
          ? "Show this screen at the volunteer table"
          : isSubmitting
            ? "Generating your check-in code"
            : "We couldn't load your check-in code"}
      </h2>
      <p>
        {completion
          ? completionMessage
          : isSubmitting
            ? "Keep this screen open while we save your completion and create the volunteer check-in code."
            : completionError ??
              "Try again to finish your reward check-in."}
      </p>

      {shouldShowVerification ? (
        <div
          aria-busy={isSubmitting}
          className={`token-block${isSubmitting ? " token-block-pending" : ""}`}
          role="status"
        >
          <div className="token-status">
            {isSubmitting ? <span aria-hidden="true" className="token-spinner" /> : null}
            <span className="token-label">Check-in code</span>
          </div>
          <strong>{verificationCode ?? "Loading..."}</strong>
          <p className="token-instruction">
            {completion
              ? "Show this code to the volunteer before you scroll down to review your answers."
              : "Please wait here. The volunteer code will appear in this spot as soon as check-in is complete."}
          </p>
          <span className="token-meta">
            {completion
              ? isEntitlementNew
                ? "Your reward entry is now recorded."
                : "Your earlier reward entry still counts. This replay does not add another one."
              : "This usually takes just a moment, even on slower service."}
          </span>
        </div>
      ) : null}

      {shouldShowAnswerReview ? (
        <div className="results-block">
          <div className="score-card">
            <span className="token-label">Final score</span>
            <strong>
              {score} / {game.questions.length}
            </strong>
          </div>
          <div className="answer-review-list">
            {game.questions.map((question) => {
              const selectedAnswerIds = answers[question.id] ?? [];
              const selectedLabels = getOptionLabels(question, selectedAnswerIds);
              const correctLabels = getOptionLabels(
                question,
                question.correctAnswerIds,
              );
              const isCorrect = answersMatch(
                selectedAnswerIds,
                question.correctAnswerIds,
              );

              return (
                <article className="answer-review-card" key={question.id}>
                  {question.sponsor ? (
                    <p className="sponsor-label">Sponsored by {question.sponsor}</p>
                  ) : null}
                  <h3>{question.prompt}</h3>
                  <p>
                    <strong>Your answer:</strong>{" "}
                    {selectedLabels.length > 0
                      ? selectedLabels.join(", ")
                      : "No answer recorded"}
                  </p>
                  <p>
                    <strong>Correct answer:</strong> {correctLabels.join(", ")}
                  </p>
                  <p
                    className={
                      isCorrect
                        ? "review-status review-status-correct"
                        : "review-status review-status-incorrect"
                    }
                  >
                    {isCorrect ? "Correct" : "Not correct"}
                  </p>
                  {question.sponsorFact ?? question.explanation ? (
                    <p className="answer-review-note">
                      {question.sponsorFact ?? question.explanation}
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      ) : null}

      {!isSubmitting ? (
        <div className="completion-actions">
          {completionError ? (
            <button
              className="primary-button"
              onClick={onRetrySubmission}
              type="button"
            >
              Try again
            </button>
          ) : null}
          {completion && showRetake ? (
            <button className="primary-button" onClick={onRetake} type="button">
              Play again
            </button>
          ) : null}
          <button className="secondary-button" onClick={onReset} type="button">
            Start over
          </button>
        </div>
      ) : null}
    </section>
  );
}
