import type {
  AuthoringGameDraftContent,
  Question,
  SelectionMode,
} from "../../../../shared/game-config";

export type QuestionStructureResult = {
  content: AuthoringGameDraftContent;
  focusedQuestionId: string;
};

function findQuestionIndex(
  content: AuthoringGameDraftContent,
  questionId: string,
) {
  const questionIndex = content.questions.findIndex(
    (question) => question.id === questionId,
  );

  if (questionIndex < 0) {
    throw new Error("Question not found.");
  }

  return questionIndex;
}

function createQuestionId(content: AuthoringGameDraftContent) {
  const questionIds = new Set(content.questions.map((question) => question.id));
  let index = 1;

  while (questionIds.has(`q${index}`)) {
    index += 1;
  }

  return `q${index}`;
}

function createOptionId(question: Question) {
  const optionIds = new Set(question.options.map((option) => option.id));

  for (let code = 97; code <= 122; code += 1) {
    const optionId = String.fromCharCode(code);

    if (!optionIds.has(optionId)) {
      return optionId;
    }
  }

  let index = 1;

  while (optionIds.has(`option-${index}`)) {
    index += 1;
  }

  return `option-${index}`;
}

function createPlaceholderQuestion(id: string): Question {
  return {
    id,
    correctAnswerIds: ["a"],
    options: [
      {
        id: "a",
        label: "Option A",
      },
      {
        id: "b",
        label: "Option B",
      },
    ],
    prompt: "New question",
    selectionMode: "single",
    sponsor: "New sponsor",
  };
}

function replaceQuestion(
  content: AuthoringGameDraftContent,
  questionId: string,
  createQuestion: (question: Question) => Question,
) {
  findQuestionIndex(content, questionId);

  return {
    ...content,
    questions: content.questions.map((question) =>
      question.id === questionId ? createQuestion(question) : question,
    ),
  };
}

function normalizeCorrectAnswerIds(question: Question) {
  const optionIds = new Set(question.options.map((option) => option.id));
  const validCorrectAnswerIds = question.correctAnswerIds.filter((optionId) =>
    optionIds.has(optionId),
  );
  const fallbackCorrectAnswerId = question.options[0]?.id;

  if (question.selectionMode === "single") {
    return validCorrectAnswerIds[0]
      ? [validCorrectAnswerIds[0]]
      : fallbackCorrectAnswerId
        ? [fallbackCorrectAnswerId]
        : [];
  }

  return validCorrectAnswerIds.length
    ? validCorrectAnswerIds
    : fallbackCorrectAnswerId
      ? [fallbackCorrectAnswerId]
      : [];
}

export function addQuestion(
  content: AuthoringGameDraftContent,
): QuestionStructureResult {
  const questionId = createQuestionId(content);

  return {
    content: {
      ...content,
      questions: [
        ...content.questions,
        createPlaceholderQuestion(questionId),
      ],
    },
    focusedQuestionId: questionId,
  };
}

export function duplicateQuestion(
  content: AuthoringGameDraftContent,
  questionId: string,
): QuestionStructureResult {
  const questionIndex = findQuestionIndex(content, questionId);
  const sourceQuestion = content.questions[questionIndex];
  const nextQuestionId = createQuestionId(content);
  const duplicate: Question = {
    ...sourceQuestion,
    id: nextQuestionId,
    prompt: `${sourceQuestion.prompt} Copy`,
    correctAnswerIds: [...sourceQuestion.correctAnswerIds],
    options: sourceQuestion.options.map((option) => ({ ...option })),
  };

  return {
    content: {
      ...content,
      questions: [
        ...content.questions.slice(0, questionIndex + 1),
        duplicate,
        ...content.questions.slice(questionIndex + 1),
      ],
    },
    focusedQuestionId: nextQuestionId,
  };
}

export function moveQuestion(
  content: AuthoringGameDraftContent,
  questionId: string,
  direction: "down" | "up",
): QuestionStructureResult {
  const questionIndex = findQuestionIndex(content, questionId);
  const nextIndex = direction === "up" ? questionIndex - 1 : questionIndex + 1;

  if (nextIndex < 0 || nextIndex >= content.questions.length) {
    return {
      content,
      focusedQuestionId: questionId,
    };
  }

  const nextQuestions = [...content.questions];
  const [question] = nextQuestions.splice(questionIndex, 1);
  nextQuestions.splice(nextIndex, 0, question);

  return {
    content: {
      ...content,
      questions: nextQuestions,
    },
    focusedQuestionId: questionId,
  };
}

export function deleteQuestion(
  content: AuthoringGameDraftContent,
  questionId: string,
): QuestionStructureResult {
  const questionIndex = findQuestionIndex(content, questionId);

  if (content.questions.length <= 1) {
    throw new Error("Keep at least one question.");
  }

  const nextQuestions = content.questions.filter(
    (question) => question.id !== questionId,
  );
  const focusedQuestionId =
    nextQuestions[questionIndex]?.id ??
    nextQuestions[questionIndex - 1]?.id ??
    nextQuestions[0]?.id;

  if (!focusedQuestionId) {
    throw new Error("Keep at least one question.");
  }

  return {
    content: {
      ...content,
      questions: nextQuestions,
    },
    focusedQuestionId,
  };
}

export function addOption(
  content: AuthoringGameDraftContent,
  questionId: string,
): AuthoringGameDraftContent {
  return replaceQuestion(content, questionId, (question) => {
    const optionId = createOptionId(question);
    const nextQuestion: Question = {
      ...question,
      options: [
        ...question.options,
        {
          id: optionId,
          label: "New option",
        },
      ],
    };

    return {
      ...nextQuestion,
      correctAnswerIds: normalizeCorrectAnswerIds(nextQuestion),
    };
  });
}

export function deleteOption(
  content: AuthoringGameDraftContent,
  questionId: string,
  optionId: string,
): AuthoringGameDraftContent {
  return replaceQuestion(content, questionId, (question) => {
    if (question.options.length <= 1) {
      throw new Error("Keep at least one answer option.");
    }

    const nextQuestion: Question = {
      ...question,
      correctAnswerIds: question.correctAnswerIds.filter(
        (correctAnswerId) => correctAnswerId !== optionId,
      ),
      options: question.options.filter((option) => option.id !== optionId),
    };

    return {
      ...nextQuestion,
      correctAnswerIds: normalizeCorrectAnswerIds(nextQuestion),
    };
  });
}

export function updateQuestionSelectionMode(
  content: AuthoringGameDraftContent,
  questionId: string,
  selectionMode: SelectionMode,
): AuthoringGameDraftContent {
  return replaceQuestion(content, questionId, (question) => {
    const nextQuestion: Question = {
      ...question,
      selectionMode,
    };

    return {
      ...nextQuestion,
      correctAnswerIds: normalizeCorrectAnswerIds(nextQuestion),
    };
  });
}
