/** Internal game session state machine for reducer-driven game progression. */
import type { Question } from "../data/games";
import { createRequestId } from "../lib/session";
import type { Answers, GameCompletionResult } from "../types/game";
import {
  answersMatch,
  getNextSelection,
  getQuestionFeedbackMessage,
  normalizeOptionIds,
} from "./gameUtils";

/** All high-level phases the browser game session can occupy. */
export type GamePhase =
  | "intro"
  | "question"
  | "correct_feedback"
  | "submitting_completion"
  | "complete";

/** Reducer state that drives the full game interaction flow. */
export type GameState = {
  answers: Answers;
  completionError: string | null;
  completionRequestId: string | null;
  currentIndex: number;
  feedbackKind: "correct" | "incorrect" | null;
  feedbackMessage: string | null;
  latestCompletion: GameCompletionResult | null;
  pendingSelection: string[];
  phase: GamePhase;
  startedAt: number | null;
};

/** Supported reducer events for game interaction and completion submission. */
export type GameAction =
  | { type: "completeCompletionSubmit"; completion: GameCompletionResult }
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

/** Restores the saved answer selection for a question when navigating backward. */
function getStoredSelection(answers: Answers, questionId: string | null) {
  if (!questionId) {
    return [];
  }

  return answers[questionId] ?? [];
}

/** Creates a completion request id only for the last question in a run. */
export function createCompletionRequestId(currentIndex: number, questionCount: number) {
  return currentIndex === questionCount - 1 ? createRequestId() : null;
}

/** Builds a fresh reducer state for a new intro screen or active run. */
export function createGameState(
  phase: GamePhase = "intro",
  startedAt: number | null = null,
) {
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
  } satisfies GameState;
}

/** Moves the reducer into the backend submission phase after local game play ends. */
function createCompletionSubmissionState(
  state: GameState,
  completionRequestId: string,
  answers: Answers,
) {
  // Completion is a distinct phase because we want the game UX to stay local
  // and fast during play, while still letting the backend own the official
  // reward entitlement decision at the end.
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

/** Central state machine for game progression, feedback, and completion. */
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "start":
      return createGameState("question", action.startedAt);
    case "reset":
      return createGameState();
    case "resetForRetake":
      return createGameState("question", action.startedAt);
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
            "That one is not right yet. Change your answer and try again.",
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
