/** Built-in origins allowed to call edge functions when env config is absent. */
const defaultAllowedOrigins = new Set([
  "http://127.0.0.1:4173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://localhost:5173",
  "https://neighborly-scavenger-game-web.vercel.app",
]);

/** Returns the set of browser origins that may call the edge functions. */
function getAllowedOrigins() {
  const configuredOrigins = Deno.env.get("ALLOWED_ORIGINS");

  if (!configuredOrigins) {
    return defaultAllowedOrigins;
  }

  return new Set(
    configuredOrigins
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

/** Returns the request origin only when it is explicitly allowed. */
export function getAllowedOrigin(request: Request) {
  const requestOrigin = request.headers.get("origin");

  if (!requestOrigin) {
    return null;
  }

  return getAllowedOrigins().has(requestOrigin) ? requestOrigin : null;
}

/** Creates the CORS headers shared by the edge functions. */
export function createCorsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
  };
}
