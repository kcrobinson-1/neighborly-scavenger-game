import { type FormEvent, useState } from "react";
import type { GameConfig, Question } from "../data/games";
import { featuredGameSlug } from "../data/games";
import { useQuizSession } from "../game/useQuizSession";
import { ensureServerSession } from "../lib/quizApi";
import { answersMatch, getOptionLabels, getSelectionLabel } from "../game/quizUtils";
import { routes } from "../routes";
import type { Answers, QuizCompletionResult } from "../types/quiz";

type GamePageProps = {
  game: GameConfig;
  onNavigate: (path: string) => void;
};

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
        <header className="topbar">
          <div>
            <p className="eyebrow">{game.location} neighborhood event</p>
            <h1>{game.name}</h1>
          </div>
          {isStarted && !isComplete && !isSubmittingCompletion ? (
            <div className="progress-copy" aria-live="polite">
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
                game={game}
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

type GameIntroPanelProps = {
  game: GameConfig;
  isStartingSession: boolean;
  onStart: () => void | Promise<void>;
  startError: string | null;
};

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

type CurrentQuestionPanelProps = {
  canGoBack: boolean;
  canSubmit: boolean;
  currentIndex: number;
  feedbackKind: "correct" | "incorrect" | null;
  feedbackMessage: string | null;
  game: GameConfig;
  onGoBack: () => void;
  onOptionSelect: (optionId: string) => void;
  onSubmit: () => void;
  pendingSelection: string[];
  question: GameConfig["questions"][number];
  questionCount: number;
};

function CurrentQuestionPanel({
  canGoBack,
  canSubmit,
  currentIndex,
  feedbackKind,
  feedbackMessage,
  game,
  onGoBack,
  onOptionSelect,
  onSubmit,
  pendingSelection,
  question,
  questionCount,
}: CurrentQuestionPanelProps) {
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
      <p className="selection-hint">{getSelectionLabel(question)}</p>
      <form className="question-form" onSubmit={handleSubmit}>
        <OptionField
          gameName={game.name}
          onOptionSelect={onOptionSelect}
          pendingSelection={pendingSelection}
          question={question}
        />
        {feedbackKind === "incorrect" && feedbackMessage ? (
          <div className="feedback-banner feedback-banner-error" role="status">
            <strong>Not quite.</strong>
            <p>{feedbackMessage}</p>
          </div>
        ) : null}
        <div className="question-actions">
          {canGoBack ? (
            <button
              className="secondary-button question-secondary-action"
              onClick={onGoBack}
              type="button"
            >
              Back
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

type OptionFieldProps = {
  gameName: string;
  onOptionSelect: (optionId: string) => void;
  pendingSelection: string[];
  question: Question;
};

function OptionField({
  gameName,
  onOptionSelect,
  pendingSelection,
  question,
}: OptionFieldProps) {
  const inputType =
    question.selectionMode === "multiple" ? "checkbox" : "radio";

  return (
    <fieldset className="option-fieldset">
      <legend className="sr-only">{question.prompt}</legend>
      <div className="options" aria-label={`${gameName} answer options`}>
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

type CorrectAnswerPanelProps = {
  feedbackMessage: string;
  onContinue: () => void;
  question: Question;
};

function CorrectAnswerPanel({
  feedbackMessage,
  onContinue,
  question,
}: CorrectAnswerPanelProps) {
  return (
    <section className="panel completion-panel">
      <span className="chip chip-success">Correct</span>
      <h2>{question.sponsor}</h2>
      <p>{feedbackMessage}</p>
      <button className="primary-button" onClick={onContinue} type="button">
        Next question
      </button>
    </section>
  );
}

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

  return (
    <section className="panel completion-panel">
      <span className="chip chip-success">
        {completion
          ? isEntitlementNew
            ? "Officially complete"
            : "Retake complete"
          : isSubmitting
            ? "Finishing up"
            : "Needs retry"}
      </span>
      <h2>
        {completion
          ? "Show this screen to the volunteer table"
          : isSubmitting
            ? "Locking in your raffle entry"
            : "We couldn't finalize your raffle entry"}
      </h2>
      <p>
        {completion
          ? completion.message
          : isSubmitting
            ? "We are saving your completion and checking whether this session already earned the raffle entry."
            : completionError ??
              "Try the completion step again to retrieve your verification code."}
      </p>

      {game.feedbackMode === "final_score_reveal" ? (
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

      {completion ? (
        <div className="token-block">
          <span className="token-label">Verification code</span>
          <strong>{completion.entitlement.verificationCode}</strong>
          <span className="token-meta">
            {isEntitlementNew
              ? "This session just earned the raffle entry."
              : "This session already earned the raffle entry on an earlier attempt."}
          </span>
        </div>
      ) : null}

      <div className="completion-actions">
        {completionError && !isSubmitting ? (
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
    </section>
  );
}
