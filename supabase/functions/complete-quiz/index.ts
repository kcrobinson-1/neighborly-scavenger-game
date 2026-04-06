import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  type GameConfig,
  normalizeSubmittedAnswers,
  scoreAnswers,
  validateSubmittedAnswers,
} from "../../../shared/game-config.ts";
import { getGameById } from "../../../shared/game-config/sample-fixtures.ts";
import { createCorsHeaders, getAllowedOrigin } from "../_shared/cors.ts";
import { readVerifiedSession } from "../_shared/session-cookie.ts";

/** Shape returned by the completion RPC before it is mapped to the API response. */
export type CompletionRpcRow = {
  attempt_number: number;
  completion_id: string;
  entitlement_created_at: string;
  entitlement_status: "existing" | "new";
  message: string;
  raffle_eligible: boolean;
  score: number;
  verification_code: string;
};

/** Request payload accepted by the completion endpoint. */
export type CompletionRequestBody = {
  answers: Record<string, string[]>;
  durationMs: number;
  eventId: string;
  requestId: string;
};

type CompletionPersistenceInput = {
  durationMs: number;
  eventId: string;
  normalizedAnswers: Record<string, string[]>;
  requestId: string;
  sessionId: string;
  trustedScore: number;
};

type CompletionPersistenceResult = {
  data: CompletionRpcRow | null;
  error: { message: string } | null;
};

export type CompleteQuizHandlerDependencies = {
  createCorsHeaders: typeof createCorsHeaders;
  getAllowedOrigin: typeof getAllowedOrigin;
  getGameById: (gameId: string) => GameConfig | undefined;
  getServiceRoleKey: () => string | undefined;
  getSigningSecret: () => string | undefined;
  getSupabaseUrl: () => string | undefined;
  normalizeSubmittedAnswers: typeof normalizeSubmittedAnswers;
  persistCompletion: (
    input: CompletionPersistenceInput,
    supabaseUrl: string,
    serviceRoleKey: string,
  ) => Promise<CompletionPersistenceResult>;
  readVerifiedSession: typeof readVerifiedSession;
  scoreAnswers: typeof scoreAnswers;
  validateSubmittedAnswers: typeof validateSubmittedAnswers;
};

async function persistCompletion(
  input: CompletionPersistenceInput,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<CompletionPersistenceResult> {
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });

  return await supabase
    .rpc("complete_quiz_and_award_entitlement", {
      p_client_session_id: input.sessionId,
      p_duration_ms: input.durationMs,
      p_event_id: input.eventId,
      p_request_id: input.requestId,
      p_score: input.trustedScore,
      p_submitted_answers: input.normalizedAnswers,
    })
    .single<CompletionRpcRow>();
}

export const defaultCompleteQuizHandlerDependencies: CompleteQuizHandlerDependencies = {
  createCorsHeaders,
  getAllowedOrigin,
  getGameById,
  getServiceRoleKey: () => Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  getSigningSecret: () => Deno.env.get("SESSION_SIGNING_SECRET"),
  getSupabaseUrl: () => Deno.env.get("SUPABASE_URL"),
  normalizeSubmittedAnswers,
  persistCompletion,
  readVerifiedSession,
  scoreAnswers,
  validateSubmittedAnswers,
};

/** Creates a JSON response with the shared CORS policy applied. */
function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  origin: string | null,
  createCorsHeaders: CompleteQuizHandlerDependencies["createCorsHeaders"],
) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...createCorsHeaders(origin),
      "Content-Type": "application/json",
    },
    status,
  });
}

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
export function validateCompletionPayload(payload: unknown): CompletionRequestBody | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const candidate = payload as Partial<CompletionRequestBody>;

  const eventId =
    typeof candidate.eventId === "string" ? candidate.eventId.trim() : "";
  const requestId =
    typeof candidate.requestId === "string" ? candidate.requestId.trim() : "";

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

/** Builds the request handler used by the trusted completion function. */
export function createCompleteQuizHandler(
  dependencies: CompleteQuizHandlerDependencies = defaultCompleteQuizHandlerDependencies,
) {
  return async (request: Request) => {
    const origin = dependencies.getAllowedOrigin(request);

    // We require an allowed browser origin here because this function issues
    // raffle entitlements. The signed cookie is the main trust primitive, and the
    // origin gate keeps that cookie flow scoped to the product's own surfaces.
    if (!origin) {
      return jsonResponse(403, { error: "Origin not allowed." }, null, dependencies.createCorsHeaders);
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

    const payload = validateCompletionPayload(await request.json().catch(() => null));

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

    const session = await dependencies.readVerifiedSession(request, signingSecret);

    if (!session) {
      return jsonResponse(
        401,
        { error: "Session is missing or invalid." },
        origin,
        dependencies.createCorsHeaders,
      );
    }

    const game = dependencies.getGameById(payload.eventId);

    if (!game) {
      return jsonResponse(
        400,
        { error: "Quiz event was not found." },
        origin,
        dependencies.createCorsHeaders,
      );
    }

    const validation = dependencies.validateSubmittedAnswers(game, payload.answers);

    if (!validation.ok) {
      return jsonResponse(
        400,
        { error: validation.error },
        origin,
        dependencies.createCorsHeaders,
      );
    }

    // The browser sends answers, but the server owns the authoritative result.
    // We normalize the payload, recompute score from trusted config, and only
    // then persist the attempt through the RPC.
    const normalizedAnswers = dependencies.normalizeSubmittedAnswers(game, payload.answers);
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
