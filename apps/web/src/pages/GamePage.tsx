import { useState } from "react";
import type { GameConfig } from "../data/games";
import { featuredGameSlug } from "../data/games";
import { CorrectAnswerPanel } from "../game/components/CorrectAnswerPanel";
import { CurrentQuestionPanel } from "../game/components/CurrentQuestionPanel";
import { GameCompletionPanel } from "../game/components/GameCompletionPanel";
import { GameIntroPanel } from "../game/components/GameIntroPanel";
import { useQuizSession } from "../game/useQuizSession";
import { ensureServerSession } from "../lib/quizApi";
import { routes } from "../routes";

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
