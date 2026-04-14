import {
  validateAuthoringGameDraftContent,
  type AuthoringGameDraftContent,
  type SelectionMode,
} from "../../../../shared/game-config";

export type AdminQuestionOptionFormValues = {
  id: string;
  isCorrect: boolean;
  label: string;
};

export type AdminQuestionFormValues = {
  correctAnswerIds: string[];
  explanation: string;
  options: AdminQuestionOptionFormValues[];
  prompt: string;
  selectionMode: SelectionMode;
  sponsor: string;
  sponsorFact: string;
};

function createRequiredMessage(label: string) {
  return `${label} is required.`;
}

function trimRequired(value: string, label: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    throw new Error(createRequiredMessage(label));
  }

  return trimmedValue;
}

function trimOptional(value: string) {
  const trimmedValue = value.trim();

  return trimmedValue || undefined;
}

function normalizeCorrectAnswerIds(values: AdminQuestionFormValues) {
  const optionIds = new Set(values.options.map((option) => option.id));
  const correctAnswerIds = values.options
    .filter((option) => option.isCorrect)
    .map((option) => option.id);

  if (correctAnswerIds.length === 0) {
    throw new Error("Choose at least one correct answer.");
  }

  if (values.selectionMode === "single" && correctAnswerIds.length !== 1) {
    throw new Error("Single-select questions need exactly one correct answer.");
  }

  for (const correctAnswerId of values.correctAnswerIds) {
    if (!optionIds.has(correctAnswerId)) {
      throw new Error(`Correct answer "${correctAnswerId}" is not an option.`);
    }
  }

  return correctAnswerIds;
}

export function createQuestionFormValues(
  content: AuthoringGameDraftContent,
  questionId: string,
): AdminQuestionFormValues {
  const question = content.questions.find((entry) => entry.id === questionId);

  if (!question) {
    throw new Error("Question not found.");
  }

  const correctAnswerIdSet = new Set(question.correctAnswerIds);

  return {
    correctAnswerIds: [...question.correctAnswerIds],
    explanation: question.explanation ?? "",
    options: question.options.map((option) => ({
      id: option.id,
      isCorrect: correctAnswerIdSet.has(option.id),
      label: option.label,
    })),
    prompt: question.prompt,
    selectionMode: question.selectionMode,
    sponsor: question.sponsor,
    sponsorFact: question.sponsorFact ?? "",
  };
}

export function applyQuestionFormValues(
  content: AuthoringGameDraftContent,
  questionId: string,
  values: AdminQuestionFormValues,
): AuthoringGameDraftContent {
  const questionIndex = content.questions.findIndex(
    (question) => question.id === questionId,
  );

  if (questionIndex < 0) {
    throw new Error("Question not found.");
  }

  const correctAnswerIds = normalizeCorrectAnswerIds(values);
  const nextQuestions = content.questions.map((question, index) => {
    if (index !== questionIndex) {
      return question;
    }

    return {
      id: question.id,
      prompt: trimRequired(values.prompt, "Question prompt"),
      sponsor: trimRequired(values.sponsor, "Sponsor"),
      selectionMode: values.selectionMode,
      correctAnswerIds,
      options: question.options.map((option) => {
        const optionValues = values.options.find(
          (entry) => entry.id === option.id,
        );

        if (!optionValues) {
          throw new Error(`Option "${option.id}" is missing.`);
        }

        return {
          id: option.id,
          label: trimRequired(optionValues.label, `Option ${option.id} label`),
        };
      }),
      ...(trimOptional(values.explanation)
        ? { explanation: trimOptional(values.explanation) }
        : {}),
      ...(trimOptional(values.sponsorFact)
        ? { sponsorFact: trimOptional(values.sponsorFact) }
        : {}),
    };
  });
  const nextContent: AuthoringGameDraftContent = {
    ...content,
    questions: nextQuestions,
  };

  validateAuthoringGameDraftContent(nextContent);
  return nextContent;
}
