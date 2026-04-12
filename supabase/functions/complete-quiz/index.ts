import { type GameConfig } from "../../../shared/game-config.ts";
import {
  type CompleteQuizHandlerDependencies,
  defaultCompleteQuizHandlerDependencies,
} from "./dependencies.ts";
import { validateCompletionPayload } from "./payload.ts";
import { jsonResponse } from "./response.ts";

export {
  type CompleteQuizHandlerDependencies,
  defaultCompleteQuizHandlerDependencies,
} from "./dependencies.ts";
export type {
  CompletionPersistenceInput,
  CompletionPersistenceResult,
  CompletionRpcRow,
} from "./persistence.ts";
export {
  type CompletionRequestBody,
  validateCompletionPayload,
} from "./payload.ts";

/** Builds the request handler used by the trusted completion function. */
export function createCompleteQuizHandler(
  dependencies: CompleteQuizHandlerDependencies =
    defaultCompleteQuizHandlerDependencies,
) {
  return async (request: Request) => {
    const origin = dependencies.getAllowedOrigin(request);

    // We require an allowed browser origin here because this function issues
    // raffle entitlements. The signed cookie is the main trust primitive, and the
    // origin gate keeps that cookie flow scoped to the product's own surfaces.
    if (!origin) {
      return jsonResponse(
        403,
        { error: "Origin not allowed." },
        null,
        dependencies.createCorsHeaders,
      );
    }

    if (request.method === "OPTIONS") {
      return new Response("ok", {
        headers: dependencies.createCorsHeaders(origin),
      });
    }

    if (request.method !== "POST") {
      return jsonResponse(
        405,
        { error: "Method not allowed." },
        origin,
        dependencies.createCorsHeaders,
      );
    }

    const payload = validateCompletionPayload(
      await request.json().catch(() => null),
    );

    if (!payload) {
      return jsonResponse(
        400,
        { error: "Invalid completion payload." },
        origin,
        dependencies.createCorsHeaders,
      );
    }

    const signingSecret = dependencies.getSigningSecret();
    const supabaseUrl = dependencies.getSupabaseUrl();
    const serviceRoleKey = dependencies.getServiceRoleKey();

    if (!signingSecret || !supabaseUrl || !serviceRoleKey) {
      return jsonResponse(
        500,
        { error: "Server-side completion configuration is missing." },
        origin,
        dependencies.createCorsHeaders,
      );
    }

    const session = await dependencies.readVerifiedSession(
      request,
      signingSecret,
    );

    if (!session) {
      return jsonResponse(
        401,
        { error: "Session is missing or invalid." },
        origin,
        dependencies.createCorsHeaders,
      );
    }

    let game: GameConfig | null;

    try {
      game = await dependencies.loadPublishedGameById(
        payload.eventId,
        supabaseUrl,
        serviceRoleKey,
      );
    } catch (error: unknown) {
      return jsonResponse(
        500,
        {
          details: error instanceof Error ? error.message : undefined,
          error: "We couldn't load this quiz event right now.",
        },
        origin,
        dependencies.createCorsHeaders,
      );
    }

    if (!game) {
      return jsonResponse(
        400,
        { error: "Quiz event was not found." },
        origin,
        dependencies.createCorsHeaders,
      );
    }

    const validation = dependencies.validateSubmittedAnswers(
      game,
      payload.answers,
    );

    if (!validation.ok) {
      return jsonResponse(
        400,
        { error: validation.error },
        origin,
        dependencies.createCorsHeaders,
      );
    }

    // The browser sends answers, but the server owns the authoritative result.
    // We normalize the payload, recompute score from trusted published content,
    // and only then persist the attempt through the RPC.
    const normalizedAnswers = dependencies.normalizeSubmittedAnswers(
      game,
      payload.answers,
    );
    const trustedScore = dependencies.scoreAnswers(game, normalizedAnswers);

    const { data, error } = await dependencies.persistCompletion(
      {
        durationMs: Math.max(0, Math.round(payload.durationMs)),
        eventId: payload.eventId,
        normalizedAnswers,
        requestId: payload.requestId,
        sessionId: session.sessionId,
        trustedScore,
      },
      supabaseUrl,
      serviceRoleKey,
    );

    if (error || !data) {
      return jsonResponse(
        500,
        {
          error: "We couldn't finalize your raffle entry right now.",
          details: error?.message,
        },
        origin,
        dependencies.createCorsHeaders,
      );
    }

    return jsonResponse(
      200,
      {
        attemptNumber: data.attempt_number,
        completionId: data.completion_id,
        entitlement: {
          createdAt: data.entitlement_created_at,
          status: data.entitlement_status,
          verificationCode: data.verification_code,
        },
        message: data.message,
        raffleEligible: data.raffle_eligible,
        score: data.score,
      },
      origin,
      dependencies.createCorsHeaders,
    );
  };
}

/** Finalizes a quiz attempt and awards or reuses the raffle entitlement. */
export const handleCompleteQuizRequest = createCompleteQuizHandler();

if (import.meta.main) {
  Deno.serve(handleCompleteQuizRequest);
}
