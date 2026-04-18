import { useEffect, useMemo, useReducer, useRef } from "react";
import { scoreAnswers } from "../../../../shared/game-config";
import type { GameConfig } from "../data/games";
import { submitGameCompletion } from "../lib/gameApi";
import { createRequestId } from "../lib/session";
import {
  getGameSessionScore,
  getGameSessionViewState,
} from "./gameSessionSelectors";
import {
  createCompletionRequestId,
  createGameState,
  gameReducer,
} from "./gameSessionState";

/** Manages the complete game session lifecycle for a single game instance. */
export function useGameSession(game: GameConfig) {
  const [state, dispatch] = useReducer(gameReducer, undefined, () => createGameState());
  const handledSubmissionRequestId = useRef<string | null>(null);

  useEffect(() => {
    dispatch({ type: "reset" });
    handledSubmissionRequestId.current = null;
  }, [game.id]);

  const questions = game.questions;
  const localScore = useMemo(() => scoreAnswers(game, state.answers), [game, state.answers]);
  const score = getGameSessionScore(state.latestCompletion, localScore);
  const viewState = getGameSessionViewState(game, state);
  const {
    allowRetake,
    canGoBack,
    canSubmit,
    currentQuestion,
    isComplete,
    isShowingCorrectFeedback,
    isShowingQuestion,
    isStarted,
    isSubmittingCompletion,
    progressValue,
  } = viewState;

  useEffect(() => {
    if (state.phase !== "submitting_completion" || !state.completionRequestId) {
      return;
    }

    // We intentionally guard this side effect by request id so React re-renders
    // or local state changes cannot accidentally create duplicate completion
    // submissions for the same attempt.
    if (handledSubmissionRequestId.current === state.completionRequestId) {
      return;
    }

    handledSubmissionRequestId.current = state.completionRequestId;

    const durationMs =
      state.startedAt === null ? 0 : Math.max(0, Date.now() - state.startedAt);
    let isCancelled = false;

    void submitGameCompletion({
      answers: state.answers,
      durationMs,
      eventId: game.id,
      requestId: state.completionRequestId,
    })
      .then((completion) => {
        if (!isCancelled) {
          dispatch({ type: "completeCompletionSubmit", completion });
        }
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          dispatch({
            type: "failCompletionSubmit",
            message:
              error instanceof Error
                ? error.message
                : "We couldn't finish your reward check-in right now.",
          });
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [
    game.id,
    state.answers,
    state.completionRequestId,
    state.phase,
    state.startedAt,
  ]);

  const start = () => {
    dispatch({ type: "start", startedAt: Date.now() });
  };

  const reset = () => {
    dispatch({ type: "reset" });
  };

  const selectOption = (optionId: string) => {
    if (!currentQuestion) {
      return;
    }

    dispatch({
      type: "selectOption",
      optionId,
      selectionMode: currentQuestion.selectionMode,
    });
  };

  const submit = () => {
    if (!currentQuestion) {
      return;
    }

    const nextQuestion = questions[state.currentIndex + 1];
    const completionRequestId = createCompletionRequestId(
      state.currentIndex,
      questions.length,
    );

    dispatch(
      game.feedbackMode === "final_score_reveal"
        ? {
            type: "submitFinalScore",
            completionRequestId,
            nextQuestionId: nextQuestion?.id ?? null,
            question: currentQuestion,
            questionCount: questions.length,
          }
        : {
            type: "submitRequired",
            question: currentQuestion,
          },
    );
  };

  const continueFromCorrectFeedback = () => {
    const nextQuestion = questions[state.currentIndex + 1];
    const completionRequestId = createCompletionRequestId(
      state.currentIndex,
      questions.length,
    );

    dispatch({
      type: "goForwardAfterFeedback",
      completionRequestId,
      nextQuestionId: nextQuestion?.id ?? null,
      questionCount: questions.length,
    });
  };

  const goBack = () => {
    const previousQuestion = questions[state.currentIndex - 1];

    if (!previousQuestion) {
      return;
    }

    dispatch({
      type: "goBack",
      previousQuestionId: previousQuestion.id,
    });
  };

  const resetForRetake = () => {
    handledSubmissionRequestId.current = null;
    dispatch({
      type: "resetForRetake",
      startedAt: Date.now(),
    });
  };

  const retryCompletionSubmission = () => {
    // Retrying must reuse the same request id when we have one. That preserves
    // backend idempotency in the common case where the first submission may
    // have succeeded but the response was interrupted.
    const retryRequestId = state.completionRequestId ?? createRequestId();
    handledSubmissionRequestId.current = null;
    dispatch({
      type: "beginCompletionSubmit",
      completionRequestId: retryRequestId,
    });
  };

  return {
    answers: state.answers,
    allowRetake,
    canGoBack,
    canSubmit,
    completionError: state.completionError,
    currentIndex: state.currentIndex,
    currentQuestion,
    feedbackKind: state.feedbackKind,
    feedbackMessage: state.feedbackMessage,
    goBack,
    isComplete,
    isShowingCorrectFeedback,
    isShowingQuestion,
    isStarted,
    isSubmittingCompletion,
    latestCompletion: state.latestCompletion,
    pendingSelection: state.pendingSelection,
    progressValue,
    reset,
    resetForRetake,
    retryCompletionSubmission,
    score,
    selectOption,
    start,
    submit,
    continueFromCorrectFeedback,
  };
}
