import {
  validateAuthoringGameDraftContent,
  type AuthoringGameDraftContent,
  type FeedbackMode,
} from "../../../../shared/game-config";

/**
 * Event-details form mapping for the admin workspace.
 * Owns converting between form fields and canonical draft event-detail content.
 * Does not own persistence; callers pass the mapped payload to save APIs.
 */
export type AdminEventDetailsFormValues = {
  allowBackNavigation: boolean;
  allowRetake: boolean;
  estimatedMinutes: string;
  feedbackMode: FeedbackMode;
  intro: string;
  location: string;
  name: string;
  raffleLabel: string;
  slug: string;
  summary: string;
};

type RequiredStringField = keyof Pick<
  AdminEventDetailsFormValues,
  "intro" | "location" | "name" | "raffleLabel" | "slug" | "summary"
>;

function parseEstimatedMinutes(value: string) {
  const trimmedValue = value.trim();
  const estimatedMinutes = Number(trimmedValue);

  if (
    !trimmedValue ||
    !Number.isInteger(estimatedMinutes) ||
    estimatedMinutes <= 0
  ) {
    throw new Error("Estimated minutes must be a positive whole number.");
  }

  return estimatedMinutes;
}

function createRequiredFieldMessage(field: keyof AdminEventDetailsFormValues) {
  const labels: Record<typeof field, string> = {
    allowBackNavigation: "Back navigation",
    allowRetake: "Retake setting",
    estimatedMinutes: "Estimated minutes",
    feedbackMode: "Feedback mode",
    intro: "Intro",
    location: "Location",
    name: "Event name",
    raffleLabel: "Raffle label",
    slug: "Slug",
    summary: "Summary",
  };

  return `${labels[field]} is required.`;
}

function trimRequiredString(
  values: AdminEventDetailsFormValues,
  field: RequiredStringField,
) {
  const value = values[field].trim();

  if (!value) {
    throw new Error(createRequiredFieldMessage(field));
  }

  return value;
}

/**
 * Projects canonical draft content into editable event-details form values.
 */
export function createEventDetailsFormValues(
  content: AuthoringGameDraftContent,
): AdminEventDetailsFormValues {
  return {
    allowBackNavigation: content.allowBackNavigation ?? true,
    allowRetake: content.allowRetake ?? true,
    estimatedMinutes: String(content.estimatedMinutes),
    feedbackMode: content.feedbackMode,
    intro: content.intro,
    location: content.location,
    name: content.name,
    raffleLabel: content.raffleLabel,
    slug: content.slug,
    summary: content.summary,
  };
}

/**
 * Converts event-details form values into canonical draft content for save.
 * Throws when required fields are blank or estimated minutes is not a positive integer.
 */
export function applyEventDetailsFormValues(
  content: AuthoringGameDraftContent,
  values: AdminEventDetailsFormValues,
): AuthoringGameDraftContent {
  const nextContent: AuthoringGameDraftContent = {
    ...content,
    allowBackNavigation: values.allowBackNavigation,
    allowRetake: values.allowRetake,
    estimatedMinutes: parseEstimatedMinutes(values.estimatedMinutes),
    feedbackMode: values.feedbackMode,
    intro: trimRequiredString(values, "intro"),
    location: trimRequiredString(values, "location"),
    name: trimRequiredString(values, "name"),
    raffleLabel: trimRequiredString(values, "raffleLabel"),
    slug: trimRequiredString(values, "slug"),
    summary: trimRequiredString(values, "summary"),
  };

  validateAuthoringGameDraftContent(nextContent);
  return nextContent;
}
