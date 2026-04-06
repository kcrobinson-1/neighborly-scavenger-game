import { createCorsHeaders, getAllowedOrigin } from "../_shared/cors.ts";
import {
  createSignedSessionCookie,
  readVerifiedSession,
} from "../_shared/session-cookie.ts";

export type IssueSessionHandlerDependencies = {
  createCorsHeaders: typeof createCorsHeaders;
  createSignedSessionCookie: typeof createSignedSessionCookie;
  getAllowedOrigin: typeof getAllowedOrigin;
  getSigningSecret: () => string | undefined;
  readVerifiedSession: typeof readVerifiedSession;
};

export const defaultIssueSessionHandlerDependencies: IssueSessionHandlerDependencies = {
  createCorsHeaders,
  createSignedSessionCookie,
  getAllowedOrigin,
  getSigningSecret: () => Deno.env.get("SESSION_SIGNING_SECRET"),
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

    const existingSession = await dependencies.readVerifiedSession(request, signingSecret);

    if (existingSession) {
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

    const { sessionToken, setCookieHeader } = await dependencies.createSignedSessionCookie(
      signingSecret,
    );

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
