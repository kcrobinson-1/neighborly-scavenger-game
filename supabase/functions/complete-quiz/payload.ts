/** Request payload accepted by the completion endpoint. */
export type CompletionRequestBody = {
  answers: Record<string, string[]>;
  durationMs: number;
  eventId: string;
  requestId: string;
};

/** Type guard for the answers object sent by the browser. */
function isAnswersRecord(value: unknown): value is Record<string, string[]> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every(
    (optionIds) =>
      Array.isArray(optionIds) &&
      optionIds.every((optionId) => typeof optionId === "string"),
  );
}

/** Validates and normalizes the completion request payload. */
export function validateCompletionPayload(
  payload: unknown,
): CompletionRequestBody | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const candidate = payload as Partial<CompletionRequestBody>;

  const eventId = typeof candidate.eventId === "string"
    ? candidate.eventId.trim()
    : "";
  const requestId = typeof candidate.requestId === "string"
    ? candidate.requestId.trim()
    : "";

  if (
    typeof candidate.durationMs !== "number" ||
    !Number.isFinite(candidate.durationMs) ||
    eventId.length === 0 ||
    requestId.length === 0 ||
    !isAnswersRecord(candidate.answers)
  ) {
    return null;
  }

  return {
    answers: candidate.answers,
    durationMs: candidate.durationMs,
    eventId,
    requestId,
  };
}
