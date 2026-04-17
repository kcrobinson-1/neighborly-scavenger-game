/**
 * Compatibility facade for admin question helpers.
 *
 * Prefer importing focused helpers from `questionFormMapping.ts` and
 * `questionStructure.ts` for new code.
 */
export type {
  AdminQuestionFormValues,
  AdminQuestionOptionFormValues,
} from "./questionFormMapping";
export {
  applyQuestionFormValues,
  createQuestionFormValues,
  prepareQuestionContentForSave,
  updateQuestionFormValues,
} from "./questionFormMapping";
export type { QuestionStructureResult } from "./questionStructure";
export {
  addOption,
  addQuestion,
  deleteOption,
  deleteQuestion,
  duplicateQuestion,
  moveQuestion,
  updateQuestionSelectionMode,
} from "./questionStructure";
