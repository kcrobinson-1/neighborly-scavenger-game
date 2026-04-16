import { createClient } from "jsr:@supabase/supabase-js@2.101.1";
import { createCorsHeaders, getAllowedOrigin } from "../_shared/cors.ts";
import {
  createSignedSessionCookie,
  readVerifiedSession,
} from "../_shared/session-cookie.ts";

export type IssueSessionHandlerDependencies = {
  createCorsHeaders: typeof createCorsHeaders;
  createSignedSessionCookie: typeof createSignedSessionCookie;
  getAllowedOrigin: typeof getAllowedOrigin;
  getServiceRoleKey: () => string | undefined;
  getSigningSecret: () => string | undefined;
  getSupabaseUrl: () => string | undefined;
  insertQuizStart: (
    eventId: string,
    clientSessionId: string,
    supabaseUrl: string,
    serviceRoleKey: string,
  ) => Promise<void>;
  readVerifiedSession: typeof readVerifiedSession;
};

/** Records a quiz start row for the given event/session pair. Idempotent. */
async function defaultInsertQuizStart(
  eventId: string,
  clientSessionId: string,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<void> {
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // ignoreDuplicates: true maps to ON CONFLICT DO NOTHING — a second call for
  // the same (event_id, client_session_id) pair is a safe no-op.
  const { error } = await supabase
    .from("quiz_starts")
    .upsert(
      { event_id: eventId, client_session_id: clientSessionId },
      { onConflict: "event_id,client_session_id", ignoreDuplicates: true },
    );

  if (error) {
    throw new Error(error.message);
  }
}

export const defaultIssueSessionHandlerDependencies: IssueSessionHandlerDependencies = {
  createCorsHeaders,
  createSignedSessionCookie,
  getAllowedOrigin,
  getServiceRoleKey: () => Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  getSigningSecret: () => Deno.env.get("SESSION_SIGNING_SECRET"),
  getSupabaseUrl: () => Deno.env.get("SUPABASE_URL"),
  insertQuizStart: defaultInsertQuizStart,
  readVerifiedSession,
};

/** Creates a JSON response with the shared CORS policy and optional extra headers. */
function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  origin: string | null,
  createCorsHeaders: IssueSessionHandlerDependencies["createCorsHeaders"],
  extraHeaders: HeadersInit = {},
) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...createCorsHeaders(origin),
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    status,
  });
}

/** Parses an optional event_id string from the POST body. Returns null on any parse failure. */
async function parseEventId(request: Request): Promise<string | null> {
  try {
    const body = await request.clone().json();
    const eventId = body?.event_id;
    return typeof eventId === "string" && eventId.length > 0 ? eventId : null;
  } catch {
    return null;
  }
}

/** Builds the request handler used by the session bootstrap function. */
export function createIssueSessionHandler(
  dependencies: IssueSessionHandlerDependencies = defaultIssueSessionHandlerDependencies,
) {
  return async (request: Request) => {
    const origin = dependencies.getAllowedOrigin(request);

    // The no-login MVP still needs a narrow trust boundary. We only mint browser
    // sessions for known web origins, then tie entitlement to the signed cookie
    // rather than to any caller-supplied session identifier.
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

    const signingSecret = dependencies.getSigningSecret();

    if (!signingSecret) {
      return jsonResponse(
        500,
        { error: "Session signing configuration is missing." },
        origin,
        dependencies.createCorsHeaders,
      );
    }

    const eventId = await parseEventId(request);
    const existingSession = await dependencies.readVerifiedSession(request, signingSecret);

    if (existingSession) {
      // Best-effort start tracking: awaited so the Edge Function runtime does
      // not discard the write before it completes. A DB failure is swallowed —
      // session issuance is the trust boundary; analytics is observability.
      if (eventId) {
        const supabaseUrl = dependencies.getSupabaseUrl();
        const serviceRoleKey = dependencies.getServiceRoleKey();

        if (supabaseUrl && serviceRoleKey) {
          try {
            await dependencies.insertQuizStart(
              eventId,
              existingSession.sessionId,
              supabaseUrl,
              serviceRoleKey,
            );
          } catch {
            // Swallow: start tracking must not block session issuance.
          }
        }
      }

      return jsonResponse(
        200,
        {
          issuedNewSession: false,
          sessionReady: true,
          sessionToken: existingSession.sessionToken,
        },
        origin,
        dependencies.createCorsHeaders,
      );
    }

    const { sessionId, sessionToken, setCookieHeader } = await dependencies.createSignedSessionCookie(
      signingSecret,
    );

    // Best-effort start tracking for new sessions (same failure semantics as above).
    if (eventId) {
      const supabaseUrl = dependencies.getSupabaseUrl();
      const serviceRoleKey = dependencies.getServiceRoleKey();

      if (supabaseUrl && serviceRoleKey) {
        try {
          await dependencies.insertQuizStart(eventId, sessionId, supabaseUrl, serviceRoleKey);
        } catch {
          // Swallow: start tracking must not block session issuance.
        }
      }
    }

    return jsonResponse(
      200,
      {
        issuedNewSession: true,
        sessionReady: true,
        sessionToken,
      },
      origin,
      dependencies.createCorsHeaders,
      {
        "Set-Cookie": setCookieHeader,
      },
    );
  };
}

/** Issues the signed browser session credential used by completion requests. */
export const handleIssueSessionRequest = createIssueSessionHandler();

if (import.meta.main) {
  Deno.serve(handleIssueSessionRequest);
}
