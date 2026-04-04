import type { SubmittedAnswers } from "../../../../shared/game-config";

export type Answers = SubmittedAnswers;

export type EntitlementStatus = "new" | "existing";

export type QuizCompletionEntitlement = {
  createdAt: string;
  status: EntitlementStatus;
  verificationCode: string;
};

export type QuizCompletionResult = {
  attemptNumber: number;
  completionId: string;
  entitlement: QuizCompletionEntitlement;
  message: string;
  raffleEligible: boolean;
  score: number;
};

export type SubmitQuizCompletionInput = {
  answers: Answers;
  durationMs: number;
  eventId: string;
  requestId: string;
};
