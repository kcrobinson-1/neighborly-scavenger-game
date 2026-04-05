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
          Back to product overview
        </button>
        <span className="chip">
          {game.slug === featuredGameSlug ? "Featured sample" : "Sample game"}
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
      ? "Pick an answer, submit it, and get it right to unlock a sponsor fact before the next question."
      : "Pick your answer, submit it, and review your score at the end.";

  return (
    <section className="panel intro-panel">
      <span className="chip">Under {game.estimatedMinutes} minutes</span>
      <h2>Win a {game.raffleLabel}</h2>
      <p>{game.intro}</p>
      <ul className="intro-list">
        <li>No login</li>
        <li>One question at a time</li>
        <li>{modeDescription}</li>
      </ul>
      {startError ? (
        <div className="feedback-banner feedback-banner-error" role="status">
          <strong>Session unavailable.</strong>
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
        {isStartingSession ? "Preparing session..." : "Start the game"}
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
            <strong>Not quite.</strong>
            <p>{feedbackMessage}</p>
          </div>
        ) : null}
        <div className="question-actions">
          {canGoBack ? (
            <button className="text-link question-back-link" onClick={onGoBack} type="button">
              Back to previous question
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
        {isLastQuestion ? "See results" : "Next question"}
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

  return (
    <section className="panel completion-panel">
      <span
        className={`chip${completion ? " chip-success" : completionError ? " chip-error" : ""}`}
      >
        {completion
          ? isEntitlementNew
            ? "Officially complete"
            : "Retake complete"
          : isSubmitting
            ? "Generating proof"
            : "Needs retry"}
      </span>
      <h2>
        {completion
          ? "Show this screen to the volunteer table"
          : isSubmitting
            ? "Generating your verification code"
            : "We couldn't finish your verification code"}
      </h2>
      <p>
        {completion
          ? completion.message
          : isSubmitting
            ? "Keep this screen open while we save your completion and issue the volunteer verification code."
            : completionError ??
              "Try the completion step again to retrieve your verification code."}
      </p>

      {shouldShowVerification ? (
        <div
          aria-busy={isSubmitting}
          className={`token-block${isSubmitting ? " token-block-pending" : ""}`}
          role="status"
        >
          <div className="token-status">
            {isSubmitting ? <span aria-hidden="true" className="token-spinner" /> : null}
            <span className="token-label">Verification code</span>
          </div>
          <strong>{verificationCode ?? "Generating..."}</strong>
          <p className="token-instruction">
            {completion
              ? "Show this code first at the volunteer table, then scroll for the answer review if needed."
              : "Please wait here. We will show the volunteer code in this spot as soon as verification is complete."}
          </p>
          <span className="token-meta">
            {completion
              ? isEntitlementNew
                ? "This session just earned the raffle entry."
                : "This session already earned the raffle entry on an earlier attempt."
              : "This usually takes just a moment, even on slower service."}
          </span>
        </div>
      ) : null}

      {shouldShowAnswerReview ? (
        <div className="results-block">
          <div className="score-card">
            <span className="token-label">Score</span>
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
                    {isCorrect ? "Correct" : "Needs review"}
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
              Retry completion
            </button>
          ) : null}
          {completion && showRetake ? (
            <button className="primary-button" onClick={onRetake} type="button">
              Retake quiz
            </button>
          ) : null}
          <button className="secondary-button" onClick={onReset} type="button">
            Restart from intro
          </button>
        </div>
      ) : null}
    </section>
  );
}
