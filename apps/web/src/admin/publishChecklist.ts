import type { AuthoringGameDraftContent } from "../../../../shared/game-config";

export type PublishCheckItem = {
  detail?: string;
  id: string;
  label: string;
  passed: boolean;
};

function truncatePrompt(prompt: string, maxLength = 60) {
  return prompt.length <= maxLength ? prompt : `${prompt.slice(0, maxLength)}…`;
}

/** Runs all publish readiness checks independently and returns a checklist. */
export function computePublishChecklist(
  content: AuthoringGameDraftContent,
): PublishCheckItem[] {
  const { questions } = content;

  // Check 1: At least one question
  const hasQuestions = questions.length > 0;

  // Check 2: Every question has at least one answer option
  const questionMissingOptions = questions.find(
    (question) => question.options.length === 0,
  );
  const allQuestionsHaveOptions = !questionMissingOptions;

  // Check 3: Every question has at least one correct answer selected
  const questionMissingCorrectAnswer = questions.find(
    (question) => question.correctAnswerIds.length === 0,
  );
  const allQuestionsHaveCorrectAnswer = !questionMissingCorrectAnswer;

  // Check 4: Single-select questions have exactly one correct answer
  const singleSelectWithMultipleCorrect = questions.find(
    (question) =>
      question.selectionMode === "single" &&
      question.correctAnswerIds.length !== 1,
  );
  const singleSelectQuestionsValid = !singleSelectWithMultipleCorrect;

  // Check 5: All correct answer IDs reference existing option IDs on that question
  const questionWithBadCorrectAnswerId = questions.find((question) => {
    const optionIds = new Set(question.options.map((option) => option.id));
    return question.correctAnswerIds.some((id) => !optionIds.has(id));
  });
  const correctAnswerIdsValid = !questionWithBadCorrectAnswerId;

  return [
    {
      id: "has-questions",
      label: "At least one question",
      passed: hasQuestions,
    },
    {
      detail: questionMissingOptions
        ? truncatePrompt(questionMissingOptions.prompt || "Untitled question")
        : undefined,
      id: "all-questions-have-options",
      label: "Every question has at least one answer option",
      passed: allQuestionsHaveOptions,
    },
    {
      detail: questionMissingCorrectAnswer
        ? truncatePrompt(
            questionMissingCorrectAnswer.prompt || "Untitled question",
          )
        : undefined,
      id: "all-questions-have-correct-answer",
      label: "Every question has at least one correct answer selected",
      passed: allQuestionsHaveCorrectAnswer,
    },
    {
      detail: singleSelectWithMultipleCorrect
        ? truncatePrompt(
            singleSelectWithMultipleCorrect.prompt || "Untitled question",
          )
        : undefined,
      id: "single-select-one-correct",
      label: "Single-select questions have exactly one correct answer",
      passed: singleSelectQuestionsValid,
    },
    {
      detail: questionWithBadCorrectAnswerId
        ? truncatePrompt(
            questionWithBadCorrectAnswerId.prompt || "Untitled question",
          )
        : undefined,
      id: "correct-answer-ids-valid",
      label: "All correct answer IDs reference existing options",
      passed: correctAnswerIdsValid,
    },
  ];
}

/** Returns true when every item in the checklist has passed. */
export function isPublishReady(checklist: PublishCheckItem[]): boolean {
  return checklist.every((item) => item.passed);
}
