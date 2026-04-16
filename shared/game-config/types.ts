/** A single answer choice shown to the player for a question. */
export type AnswerOption = {
  id: string;
  label: string;
};

/** Controls when the player sees correctness feedback during a quiz. */
export type FeedbackMode =
  | "final_score_reveal"
  | "instant_feedback_required";

/** Defines whether a question accepts one choice or many. */
export type SelectionMode = "single" | "multiple";

/** Shared quiz-question shape used by the web app and edge functions. */
export type Question = {
  id: string;
  sponsor: string | null;
  prompt: string;
  options: AnswerOption[];
  selectionMode: SelectionMode;
  correctAnswerIds: string[];
  explanation?: string;
  sponsorFact?: string;
};

/** Top-level configuration for a playable quiz experience. */
export type GameConfig = {
  allowBackNavigation?: boolean;
  allowRetake?: boolean;
  id: string;
  slug: string;
  name: string;
  location: string;
  estimatedMinutes: number;
  raffleLabel: string;
  intro: string;
  summary: string;
  feedbackMode: FeedbackMode;
  questions: Question[];
};

/** Canonical answer payload keyed by question id. */
export type SubmittedAnswers = Record<string, string[]>;

/** Result returned when server-side or shared validation inspects an answer set. */
export type AnswerValidationResult =
  | { ok: true }
  | { error: string; ok: false };
