const defaultAllowedOrigins = [
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "https://neighborly-scavenger-game-web.vercel.app",
];

function getAllowedOrigins() {
  const configuredOrigins = Deno.env.get("ALLOWED_ORIGINS");

  if (!configuredOrigins) {
    return defaultAllowedOrigins;
  }

  return configuredOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function getAllowedOrigin(request: Request) {
  const requestOrigin = request.headers.get("origin");

  if (!requestOrigin) {
    return null;
  }

  return getAllowedOrigins().includes(requestOrigin) ? requestOrigin : null;
}

export function createCorsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
  };
}
