import { type FormEvent, useState } from "react";
import { answersMatch } from "../../../../shared/game-config";
import type { GameConfig, Question } from "../data/games";
import { featuredGameSlug } from "../data/games";
import { useQuizSession } from "../game/useQuizSession";
import {
  getOptionLabels,
  getSelectionLabel,
} from "../game/quizUtils";
import { ensureServerSession } from "../lib/quizApi";
import { routes } from "../routes";
import type { Answers, QuizCompletionResult } from "../types/quiz";

/** Props for the top-level game route. */
type GamePageProps = {
  game: GameConfig;
  onNavigate: (path: string) => void;
};

/** Orchestrates the full player-facing quiz flow for a single game. */
export function GamePage({ game, onNavigate }: GamePageProps) {
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const {
    answers,
    allowRetake,
    canGoBack,
    canSubmit,
    completionError,
    continueFromCorrectFeedback,
    currentIndex,
    currentQuestion,
    feedbackKind,
    feedbackMessage,
    goBack,
    isComplete,
    isShowingCorrectFeedback,
    isShowingQuestion,
    isStarted,
    isSubmittingCompletion,
    latestCompletion,
    pendingSelection,
    progressValue,
    reset,
    resetForRetake,
    retryCompletionSubmission,
    score,
    selectOption,
    start,
    submit,
  } = useQuizSession(game);

  const questionCount = game.questions.length;
  const isQuizActive = isStarted && !isComplete && !isSubmittingCompletion;
  const handleStart = async () => {
    setIsStartingSession(true);
    setStartError(null);

    try {
      await ensureServerSession();
      start();
    } catch (error: unknown) {
      setStartError(
        error instanceof Error
          ? error.message
          : "We couldn't prepare your quiz session right now.",
      );
    } finally {
      setIsStartingSession(false);
    }
  };

  return (
    <section className="game-layout">
      <nav className="sample-nav">
        <button
          className="text-link"
          onClick={() => onNavigate(routes.home)}
          type="button"
        >
          Back to demo overview
        </button>
        <span className="chip">
          {game.slug === featuredGameSlug ? "Featured demo" : "Demo flow"}
        </span>
      </nav>

      <section className="app-card">
        <header className={`topbar${isQuizActive ? " topbar-compact" : ""}`}>
          <div>
            {!isQuizActive ? (
              <p className="eyebrow">{game.location} neighborhood event</p>
            ) : null}
            <h1 className={isQuizActive ? "topbar-title-compact" : undefined}>
              {game.name}
            </h1>
          </div>
          {isQuizActive ? (
            <div className="progress-copy progress-pill" aria-live="polite">
              Question {currentIndex + 1} of {questionCount}
            </div>
          ) : null}
        </header>

        {!isStarted ? (
          <GameIntroPanel
            game={game}
            isStartingSession={isStartingSession}
            onStart={handleStart}
            startError={startError}
          />
        ) : null}

        {isStarted && !isComplete && !isSubmittingCompletion && currentQuestion ? (
          <>
            <div className="progress-track" aria-hidden="true">
              <div className="progress-fill" style={{ width: `${progressValue}%` }} />
            </div>
            {isShowingCorrectFeedback && feedbackMessage ? (
              <CorrectAnswerPanel
                feedbackMessage={feedbackMessage}
                isLastQuestion={currentIndex === questionCount - 1}
                onContinue={continueFromCorrectFeedback}
                question={currentQuestion}
              />
            ) : null}
            {isShowingQuestion ? (
              <CurrentQuestionPanel
                canGoBack={canGoBack}
                canSubmit={canSubmit}
                currentIndex={currentIndex}
                feedbackKind={feedbackKind}
                feedbackMessage={feedbackMessage}
                onGoBack={goBack}
                onOptionSelect={selectOption}
                onSubmit={submit}
                pendingSelection={pendingSelection}
                question={currentQuestion}
                questionCount={questionCount}
              />
            ) : null}
          </>
        ) : null}

        {isSubmittingCompletion || isComplete ? (
          <GameCompletionPanel
            answers={answers}
            completion={latestCompletion}
            completionError={completionError}
            game={game}
            isSubmitting={isSubmittingCompletion}
            onReset={reset}
            onRetake={resetForRetake}
            onRetrySubmission={retryCompletionSubmission}
            score={score}
            showRetake={allowRetake}
          />
        ) : null}
      </section>
    </section>
  );
}

/** Props for the pre-quiz intro panel. */
type GameIntroPanelProps = {
  game: GameConfig;
  isStartingSession: boolean;
  onStart: () => void | Promise<void>;
  startError: string | null;
};

/** Intro panel shown before the player starts a quiz attempt. */
function GameIntroPanel({
  game,
  isStartingSession,
  onStart,
  startError,
}: GameIntroPanelProps) {
  const modeDescription =
    game.feedbackMode === "instant_feedback_required"
      ? "Answer correctly to unlock the next question and a quick sponsor fact."
      : "See your score after the last question.";

  return (
    <section className="panel intro-panel">
      <span className="chip">About {game.estimatedMinutes} minutes</span>
      <h2>Finish to earn your {game.raffleLabel}</h2>
      <p>{game.intro}</p>
      <ul className="intro-list">
        <li>No sign-in</li>
        <li>One question on screen at a time</li>
        <li>{modeDescription}</li>
      </ul>
      {startError ? (
        <div className="feedback-banner feedback-banner-error" role="status">
          <strong>Can't start the quiz right now.</strong>
          <p>{startError}</p>
        </div>
      ) : null}
      <button
        className="primary-button"
        disabled={isStartingSession}
        onClick={() => {
          void onStart();
        }}
        type="button"
      >
        {isStartingSession ? "Getting your quiz ready..." : "Start quiz"}
      </button>
    </section>
  );
}

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
function CurrentQuestionPanel({
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

/** Props for the instant-feedback success panel. */
type CorrectAnswerPanelProps = {
  feedbackMessage: string;
  isLastQuestion: boolean;
  onContinue: () => void;
  question: Question;
};

/** Success panel shown in the instant-feedback quiz mode. */
function CorrectAnswerPanel({
  feedbackMessage,
  isLastQuestion,
  onContinue,
  question,
}: CorrectAnswerPanelProps) {
  return (
    <section className="panel completion-panel">
      <span className="chip chip-success">Correct</span>
      <h2>{question.sponsor}</h2>
      <p>{feedbackMessage}</p>
      <button className="primary-button" onClick={onContinue} type="button">
        {isLastQuestion ? "See your results" : "Continue"}
      </button>
    </section>
  );
}

/** Props for the quiz completion screen. */
type GameCompletionPanelProps = {
  answers: Answers;
  completion: QuizCompletionResult | null;
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
function GameCompletionPanel({
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
      ? "You're checked in for the raffle."
      : "You're still checked in for the raffle. Playing again does not add another ticket."
    : null;

  return (
    <section className="panel completion-panel">
      <span
        className={`chip${completion ? " chip-success" : completionError ? " chip-error" : ""}`}
      >
        {completion
          ? isEntitlementNew
            ? "Raffle entry ready"
            : "Already checked in"
          : isSubmitting
            ? "Generating proof"
            : "Try again"}
      </span>
      <h2>
        {completion
          ? "Show this screen at the raffle table"
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
              "Try again to finish your raffle check-in."}
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
                ? "Your raffle entry is now recorded."
                : "Your earlier raffle entry still counts. This replay does not add another one."
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
                  <p className="sponsor-label">Sponsored by {question.sponsor}</p>
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
