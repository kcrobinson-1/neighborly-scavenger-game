/** Pure selectors for the React-facing game session view state. */
import type { GameConfig } from "../data/games";
import type { GameCompletionResult } from "../types/game";
import type { GameState } from "./gameSessionState";

/** Read-only game state derived from the reducer plus game configuration. */
export type GameSessionViewState = {
  allowRetake: boolean;
  canGoBack: boolean;
  canSubmit: boolean;
  currentQuestion: GameConfig["questions"][number] | undefined;
  isComplete: boolean;
  isShowingCorrectFeedback: boolean;
  isShowingQuestion: boolean;
  isStarted: boolean;
  isSubmittingCompletion: boolean;
  progressValue: number;
};

/** Resolves the effective score, preferring the trusted backend value when present. */
export function getGameSessionScore(
  latestCompletion: GameCompletionResult | null,
  localScore: number,
) {
  return latestCompletion?.score ?? localScore;
}

/** Derives the view-facing session state the page and game panels consume. */
export function getGameSessionViewState(
  game: GameConfig,
  state: GameState,
): GameSessionViewState {
  const currentQuestion = game.questions[state.currentIndex];
  const isComplete = state.phase === "complete";
  const isStarted = state.phase !== "intro";
  const isShowingCorrectFeedback = state.phase === "correct_feedback";
  const isShowingQuestion = state.phase === "question";
  const isSubmittingCompletion = state.phase === "submitting_completion";
  const allowBackNavigation = game.allowBackNavigation ?? true;

  return {
    allowRetake: game.allowRetake ?? true,
    canGoBack:
      allowBackNavigation && state.phase === "question" && state.currentIndex > 0,
    canSubmit: state.pendingSelection.length > 0,
    currentQuestion,
    isComplete,
    isShowingCorrectFeedback,
    isShowingQuestion,
    isStarted,
    isSubmittingCompletion,
    progressValue: getProgressValue(
      state.currentIndex,
      game.questions.length,
      isComplete,
      isSubmittingCompletion,
    ),
  };
}

/** Converts reducer progress into a UI-friendly progress bar percentage. */
function getProgressValue(
  currentIndex: number,
  questionCount: number,
  isComplete: boolean,
  isSubmittingCompletion: boolean,
) {
  if (questionCount === 0 || isComplete || isSubmittingCompletion) {
    return 100;
  }

  return ((currentIndex + 1) / questionCount) * 100;
}
