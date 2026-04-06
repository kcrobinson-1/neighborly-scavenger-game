import {
  assertEquals,
  assertExists,
} from "jsr:@std/assert@1";
import {
  normalizeSubmittedAnswers,
  scoreAnswers,
} from "../../../shared/game-config.ts";
import { getGameById } from "../../../shared/game-config/sample-fixtures.ts";
import {
  createCompleteQuizHandler,
  defaultCompleteQuizHandlerDependencies,
  validateCompletionPayload,
} from "../../../supabase/functions/complete-quiz/index.ts";
import { createOriginRequest } from "./helpers.ts";

const sampleGame = getGameById("madrona-music-2026");

if (!sampleGame) {
  throw new Error("Expected the featured sample game to exist for trust-path tests.");
}

Deno.test("validateCompletionPayload trims ids and rejects malformed completion input", () => {
  assertEquals(
    validateCompletionPayload({
      answers: { q1: ["a"] },
      durationMs: 1200,
      eventId: " madrona-music-2026 ",
      requestId: " req-123 ",
    }),
    {
      answers: { q1: ["a"] },
      durationMs: 1200,
      eventId: "madrona-music-2026",
      requestId: "req-123",
    },
  );

  assertEquals(
    validateCompletionPayload({
      answers: { q1: [1] },
      durationMs: 1200,
      eventId: "madrona-music-2026",
      requestId: "req-123",
    }),
    null,
  );
  assertEquals(validateCompletionPayload(null), null);
});

Deno.test("complete-quiz rejects invalid sessions before touching persistence", async () => {
  let persistCalls = 0;
  const handler = createCompleteQuizHandler({
    ...defaultCompleteQuizHandlerDependencies,
    getAllowedOrigin: () => "http://127.0.0.1:4173",
    getServiceRoleKey: () => "service-role-key",
    getSigningSecret: () => "session-secret",
    getSupabaseUrl: () => "http://127.0.0.1:54321",
    loadPublishedGameById: async () => sampleGame,
    persistCompletion: async () => {
      persistCalls += 1;
      return { data: null, error: null };
    },
    readVerifiedSession: async () => null,
  });

  const response = await handler(
    createOriginRequest("https://example.com", {
      body: JSON.stringify({
        answers: { q1: ["a"] },
        durationMs: 1200,
        eventId: sampleGame.id,
        requestId: "req-123",
      }),
      method: "POST",
    }),
  );

  assertEquals(response.status, 401);
  assertEquals(await response.json(), { error: "Session is missing or invalid." });
  assertEquals(persistCalls, 0);
});

Deno.test("complete-quiz rejects answers that fail shared validation", async () => {
  const handler = createCompleteQuizHandler({
    ...defaultCompleteQuizHandlerDependencies,
    getAllowedOrigin: () => "http://127.0.0.1:4173",
    getServiceRoleKey: () => "service-role-key",
    getSigningSecret: () => "session-secret",
    getSupabaseUrl: () => "http://127.0.0.1:54321",
    loadPublishedGameById: async () => sampleGame,
    readVerifiedSession: async () => ({
      sessionId: "session-id",
      sessionToken: "session-token",
    }),
  });

  const response = await handler(
    createOriginRequest("https://example.com", {
      body: JSON.stringify({
        answers: { q1: ["invalid-option"] },
        durationMs: 1200,
        eventId: sampleGame.id,
        requestId: "req-123",
      }),
      method: "POST",
    }),
  );

  assertEquals(response.status, 400);
  assertExists((await response.json()).error);
});

Deno.test("complete-quiz returns 400 when published content is missing or unpublished", async () => {
  const handler = createCompleteQuizHandler({
    ...defaultCompleteQuizHandlerDependencies,
    getAllowedOrigin: () => "http://127.0.0.1:4173",
    getServiceRoleKey: () => "service-role-key",
    getSigningSecret: () => "session-secret",
    getSupabaseUrl: () => "http://127.0.0.1:54321",
    loadPublishedGameById: async () => null,
    readVerifiedSession: async () => ({
      sessionId: "session-id",
      sessionToken: "session-token",
    }),
  });

  const response = await handler(
    createOriginRequest("https://example.com", {
      body: JSON.stringify({
        answers: { q1: ["a"] },
        durationMs: 1200,
        eventId: sampleGame.id,
        requestId: "req-123",
      }),
      method: "POST",
    }),
  );

  assertEquals(response.status, 400);
  assertEquals(await response.json(), { error: "Quiz event was not found." });
});

Deno.test("complete-quiz returns a 500 when the published content loader fails", async () => {
  const handler = createCompleteQuizHandler({
    ...defaultCompleteQuizHandlerDependencies,
    getAllowedOrigin: () => "http://127.0.0.1:4173",
    getServiceRoleKey: () => "service-role-key",
    getSigningSecret: () => "session-secret",
    getSupabaseUrl: () => "http://127.0.0.1:54321",
    loadPublishedGameById: async () => {
      throw new Error("published content query failed");
    },
    readVerifiedSession: async () => ({
      sessionId: "session-id",
      sessionToken: "session-token",
    }),
  });

  const response = await handler(
    createOriginRequest("https://example.com", {
      body: JSON.stringify({
        answers: { q1: ["a"] },
        durationMs: 1200,
        eventId: sampleGame.id,
        requestId: "req-123",
      }),
      method: "POST",
    }),
  );

  assertEquals(response.status, 500);
  assertEquals(await response.json(), {
    details: "published content query failed",
    error: "We couldn't load this quiz event right now.",
  });
});

Deno.test("complete-quiz persists the trusted normalized payload and clamped duration", async () => {
  let capturedInput:
    | {
      durationMs: number;
      eventId: string;
      normalizedAnswers: Record<string, string[]>;
      requestId: string;
      sessionId: string;
      trustedScore: number;
    }
    | null = null;

  const handler = createCompleteQuizHandler({
    ...defaultCompleteQuizHandlerDependencies,
    getAllowedOrigin: () => "http://127.0.0.1:4173",
    getServiceRoleKey: () => "service-role-key",
    getSigningSecret: () => "session-secret",
    getSupabaseUrl: () => "http://127.0.0.1:54321",
    loadPublishedGameById: async () => sampleGame,
    persistCompletion: async (input) => {
      capturedInput = input;

      return {
        data: {
          attempt_number: 1,
          completion_id: "cmp-123",
          entitlement_created_at: "2026-04-05T12:00:00.000Z",
          entitlement_status: "new",
          message: "You're checked in for the raffle.",
          raffle_eligible: true,
          score: input.trustedScore,
          verification_code: "MMP-SERVER01",
        },
        error: null,
      };
    },
    readVerifiedSession: async () => ({
      sessionId: "session-id",
      sessionToken: "session-token",
    }),
  });

  const response = await handler(
    createOriginRequest("https://example.com", {
      body: JSON.stringify({
        answers: {
          q1: ["a"],
          q2: ["b"],
          q3: ["b"],
          q4: ["a"],
          q5: ["b"],
          q6: ["a"],
        },
        durationMs: -14.7,
        eventId: sampleGame.id,
        requestId: "req-123",
      }),
      method: "POST",
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    attemptNumber: 1,
    completionId: "cmp-123",
    entitlement: {
      createdAt: "2026-04-05T12:00:00.000Z",
      status: "new",
      verificationCode: "MMP-SERVER01",
    },
    message: "You're checked in for the raffle.",
    raffleEligible: true,
    score: 6,
  });
  assertEquals(capturedInput, {
    durationMs: 0,
    eventId: sampleGame.id,
    normalizedAnswers: normalizeSubmittedAnswers(sampleGame, {
      q1: ["a"],
      q2: ["b"],
      q3: ["b"],
      q4: ["a"],
      q5: ["b"],
      q6: ["a"],
    }),
    requestId: "req-123",
    sessionId: "session-id",
    trustedScore: scoreAnswers(
      sampleGame,
      normalizeSubmittedAnswers(sampleGame, {
        q1: ["a"],
        q2: ["b"],
        q3: ["b"],
        q4: ["a"],
        q5: ["b"],
        q6: ["a"],
      }),
    ),
  });
});

Deno.test("complete-quiz returns a 500 when trusted persistence fails", async () => {
  const handler = createCompleteQuizHandler({
    ...defaultCompleteQuizHandlerDependencies,
    getAllowedOrigin: () => "http://127.0.0.1:4173",
    getServiceRoleKey: () => "service-role-key",
    getSigningSecret: () => "session-secret",
    getSupabaseUrl: () => "http://127.0.0.1:54321",
    loadPublishedGameById: async () => sampleGame,
    persistCompletion: async () => ({
      data: null,
      error: { message: "rpc failed" },
    }),
    readVerifiedSession: async () => ({
      sessionId: "session-id",
      sessionToken: "session-token",
    }),
  });

  const response = await handler(
    createOriginRequest("https://example.com", {
      body: JSON.stringify({
        answers: {
          q1: ["a"],
          q2: ["b"],
          q3: ["b"],
          q4: ["a"],
          q5: ["b"],
          q6: ["a"],
        },
        durationMs: 1200,
        eventId: sampleGame.id,
        requestId: "req-123",
      }),
      method: "POST",
    }),
  );

  assertEquals(response.status, 500);
  assertEquals(await response.json(), {
    details: "rpc failed",
    error: "We couldn't finalize your raffle entry right now.",
  });
});
