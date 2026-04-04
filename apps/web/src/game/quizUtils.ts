import type { Question } from "../data/games";
import {
  answersMatch,
  normalizeOptionIds,
} from "../../../../shared/game-config";

export { answersMatch, normalizeOptionIds };

export function getNextSelection(
  currentSelection: string[],
  optionId: string,
  selectionMode: Question["selectionMode"],
) {
  if (selectionMode === "single") {
    return [optionId];
  }

  return currentSelection.includes(optionId)
    ? currentSelection.filter((selectedOptionId) => selectedOptionId !== optionId)
    : [...currentSelection, optionId];
}

export function getSelectionLabel(question: Question) {
  return question.selectionMode === "multiple"
    ? "Select all that apply."
    : "Choose one answer.";
}

export function getOptionLabels(question: Question, optionIds: string[]) {
  return question.options
    .filter((option) => optionIds.includes(option.id))
    .map((option) => option.label);
}

export function getQuestionFeedbackMessage(question: Question) {
  return (
    question.sponsorFact ??
    question.explanation ??
    `Correct. ${question.sponsor} is part of the neighborhood event experience.`
  );
}
