import { getGameById } from "../../../shared/game-config/sample-fixtures.ts";
import { createOriginRequest } from "./helpers.ts";

export const sampleDraft = getGameById("madrona-music-2026");
export const adminUserId = "22222222-2222-4222-8222-222222222222";

if (!sampleDraft) {
  throw new Error("Expected the featured sample game to exist for authoring tests.");
}

export function createAuthoringRequest(body: unknown) {
  return createOriginRequest("https://example.com", {
    body: JSON.stringify(body),
    headers: {
      Authorization: "Bearer user-token",
    },
    method: "POST",
  });
}
