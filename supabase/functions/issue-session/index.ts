import { createCorsHeaders, getAllowedOrigin } from "../_shared/cors.ts";
import {
  createSignedSessionCookie,
  readVerifiedSessionId,
} from "../_shared/session-cookie.ts";

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  origin: string | null,
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

Deno.serve(async (request) => {
  const origin = getAllowedOrigin(request);

  if (!origin) {
    return jsonResponse(403, { error: "Origin not allowed." }, null);
  }

  if (request.method === "OPTIONS") {
    return new Response("ok", {
      headers: createCorsHeaders(origin),
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." }, origin);
  }

  const signingSecret = Deno.env.get("SESSION_SIGNING_SECRET");

  if (!signingSecret) {
    return jsonResponse(
      500,
      { error: "Session signing configuration is missing." },
      origin,
    );
  }

  const existingSessionId = await readVerifiedSessionId(request, signingSecret);

  if (existingSessionId) {
    return jsonResponse(
      200,
      {
        issuedNewSession: false,
        sessionReady: true,
      },
      origin,
    );
  }

  const { setCookieHeader } = await createSignedSessionCookie(signingSecret);

  return jsonResponse(
    200,
    {
      issuedNewSession: true,
      sessionReady: true,
    },
    origin,
    {
      "Set-Cookie": setCookieHeader,
    },
  );
});
