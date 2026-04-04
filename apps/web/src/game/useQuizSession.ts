import { useEffect, useMemo, useReducer, useRef } from "react";
import { scoreAnswers } from "../../../../shared/game-config";
import type { GameConfig, Question } from "../data/games";
import { submitQuizCompletion } from "../lib/quizApi";
import { createRequestId } from "../lib/session";
import type { Answers, QuizCompletionResult } from "../types/quiz";
import {
  answersMatch,
  getNextSelection,
  getQuestionFeedbackMessage,
  normalizeOptionIds,
} from "./quizUtils";

type QuizPhase =
  | "intro"
  | "question"
  | "correct_feedback"
  | "submitting_completion"
  | "complete";

type QuizState = {
  answers: Answers;
  completionError: string | null;
  completionRequestId: string | null;
  currentIndex: number;
  feedbackKind: "correct" | "incorrect" | null;
  feedbackMessage: string | null;
  latestCompletion: QuizCompletionResult | null;
  pendingSelection: string[];
  phase: QuizPhase;
  startedAt: number | null;
};

type QuizAction =
  | { type: "completeCompletionSubmit"; completion: QuizCompletionResult }
  | { type: "failCompletionSubmit"; message: string }
  | { type: "goBack"; previousQuestionId: string }
  | { type: "reset" }
  | { type: "resetForRetake"; startedAt: number }
  | {
      type: "selectOption";
      optionId: string;
      selectionMode: Question["selectionMode"];
    }
  | { type: "start"; startedAt: number }
  | {
      type: "submitFinalScore";
      completionRequestId: string | null;
      nextQuestionId: string | null;
      question: Question;
      questionCount: number;
    }
  | { type: "submitRequired"; question: Question }
  | {
      type: "goForwardAfterFeedback";
      completionRequestId: string | null;
      nextQuestionId: string | null;
      questionCount: number;
    }
  | { type: "beginCompletionSubmit"; completionRequestId: string };

function getStoredSelection(answers: Answers, questionId: string | null) {
  if (!questionId) {
    return [];
  }

  return answers[questionId] ?? [];
}

function createQuizState(phase: QuizPhase = "intro", startedAt: number | null = null) {
  return {
    answers: {},
    completionError: null,
    completionRequestId: null,
    currentIndex: 0,
    feedbackKind: null,
    feedbackMessage: null,
    latestCompletion: null,
    pendingSelection: [],
    phase,
    startedAt,
  } satisfies QuizState;
}

function createCompletionSubmissionState(
  state: QuizState,
  completionRequestId: string,
  answers: Answers,
) {
  return {
    ...state,
    answers,
    completionError: null,
    completionRequestId,
    feedbackKind: null,
    feedbackMessage: null,
    pendingSelection: [],
    phase: "submitting_completion" as const,
  };
}

function quizReducer(state: QuizState, action: QuizAction): QuizState {
  switch (action.type) {
    case "start":
      return createQuizState("question", action.startedAt);
    case "reset":
      return createQuizState();
    case "resetForRetake":
      return createQuizState("question", action.startedAt);
    case "selectOption":
      if (state.phase !== "question") {
        return state;
      }

      return {
        ...state,
        feedbackKind: null,
        feedbackMessage: null,
        pendingSelection: getNextSelection(
          state.pendingSelection,
          action.optionId,
          action.selectionMode,
        ),
      };
    case "goBack":
      if (state.phase !== "question" || state.currentIndex === 0) {
        return state;
      }

      return {
        ...state,
        completionError: null,
        currentIndex: state.currentIndex - 1,
        feedbackKind: null,
        feedbackMessage: null,
        pendingSelection: getStoredSelection(state.answers, action.previousQuestionId),
      };
    case "submitFinalScore": {
      if (state.phase !== "question" || state.pendingSelection.length === 0) {
        return state;
      }

      const submittedSelection = normalizeOptionIds(state.pendingSelection);
      const nextAnswers = {
        ...state.answers,
        [action.question.id]: submittedSelection,
      };
      const nextIndex = state.currentIndex + 1;
      const isComplete = nextIndex >= action.questionCount;

      if (isComplete && action.completionRequestId) {
        return createCompletionSubmissionState(
          {
            ...state,
            currentIndex: action.questionCount - 1,
          },
          action.completionRequestId,
          nextAnswers,
        );
      }

      return {
        ...state,
        answers: nextAnswers,
        completionError: null,
        currentIndex: nextIndex,
        feedbackKind: null,
        feedbackMessage: null,
        pendingSelection: getStoredSelection(nextAnswers, action.nextQuestionId),
      };
    }
    case "submitRequired": {
      if (state.phase !== "question" || state.pendingSelection.length === 0) {
        return state;
      }

      const submittedSelection = normalizeOptionIds(state.pendingSelection);

      if (!answersMatch(submittedSelection, action.question.correctAnswerIds)) {
        return {
          ...state,
          completionError: null,
          feedbackKind: "incorrect",
          feedbackMessage:
            action.question.explanation ??
            "Not quite. Adjust your selection and try again.",
        };
      }

      return {
        ...state,
        answers: {
          ...state.answers,
          [action.question.id]: submittedSelection,
        },
        completionError: null,
        feedbackKind: "correct",
        feedbackMessage: getQuestionFeedbackMessage(action.question),
        pendingSelection: submittedSelection,
        phase: "correct_feedback",
      };
    }
    case "goForwardAfterFeedback": {
      if (state.phase !== "correct_feedback") {
        return state;
      }

      const nextIndex = state.currentIndex + 1;
      const isComplete = nextIndex >= action.questionCount;

      if (isComplete && action.completionRequestId) {
        return createCompletionSubmissionState(
          {
            ...state,
            currentIndex: action.questionCount - 1,
          },
          action.completionRequestId,
          state.answers,
        );
      }

      return {
        ...state,
        completionError: null,
        currentIndex: nextIndex,
        feedbackKind: null,
        feedbackMessage: null,
        pendingSelection: getStoredSelection(state.answers, action.nextQuestionId),
        phase: "question",
      };
    }
    case "beginCompletionSubmit":
      if (state.phase !== "complete" || state.latestCompletion) {
        return state;
      }

      return {
        ...state,
        completionError: null,
        completionRequestId: action.completionRequestId,
        phase: "submitting_completion",
      };
    case "completeCompletionSubmit":
      return {
        ...state,
        completionError: null,
        latestCompletion: action.completion,
        phase: "complete",
      };
    case "failCompletionSubmit":
      return {
        ...state,
        completionError: action.message,
        phase: "complete",
      };
    default:
      return state;
  }
}

export function useQuizSession(game: GameConfig) {
  const [state, dispatch] = useReducer(quizReducer, undefined, () => createQuizState());
  const handledSubmissionRequestId = useRef<string | null>(null);

  useEffect(() => {
    dispatch({ type: "reset" });
    handledSubmissionRequestId.current = null;
  }, [game.id]);

  const questions = game.questions;
  const currentQuestion = questions[state.currentIndex];
  const isComplete = state.phase === "complete";
  const isStarted = state.phase !== "intro";
  const isShowingCorrectFeedback = state.phase === "correct_feedback";
  const isShowingQuestion = state.phase === "question";
  const isSubmittingCompletion = state.phase === "submitting_completion";
  const allowBackNavigation = game.allowBackNavigation ?? true;
  const allowRetake = game.allowRetake ?? true;
  const canGoBack =
    allowBackNavigation && state.phase === "question" && state.currentIndex > 0;
  const canSubmit = state.pendingSelection.length > 0;

  const localScore = useMemo(() => scoreAnswers(game, state.answers), [game, state.answers]);
  const score = state.latestCompletion?.score ?? localScore;

  useEffect(() => {
    if (state.phase !== "submitting_completion" || !state.completionRequestId) {
      return;
    }

    if (handledSubmissionRequestId.current === state.completionRequestId) {
      return;
    }

    handledSubmissionRequestId.current = state.completionRequestId;

    const durationMs =
      state.startedAt === null ? 0 : Math.max(0, Date.now() - state.startedAt);
    let isCancelled = false;

    void submitQuizCompletion({
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
                : "We couldn't finalize your raffle entry right now.",
          });
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [
    game.id,
    localScore,
    state.answers,
    state.completionRequestId,
    state.phase,
    state.startedAt,
  ]);

  const progressValue =
    questions.length === 0
      ? 100
      : isComplete || isSubmittingCompletion
        ? 100
        : ((state.currentIndex + 1) / questions.length) * 100;

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
    const completionRequestId =
      state.currentIndex === questions.length - 1 ? createRequestId() : null;

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
    const completionRequestId =
      state.currentIndex === questions.length - 1 ? createRequestId() : null;

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
