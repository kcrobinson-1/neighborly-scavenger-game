const sessionCookieName = "neighborly_session";
const sessionCookieMaxAgeSeconds = 60 * 60 * 24 * 30;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function hexEncode(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function parseCookies(cookieHeader: string | null) {
  if (!cookieHeader) {
    return {};
  }

  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const separatorIndex = entry.indexOf("=");

        if (separatorIndex === -1) {
          return [entry, ""];
        }

        return [
          decodeURIComponent(entry.slice(0, separatorIndex)),
          decodeURIComponent(entry.slice(separatorIndex + 1)),
        ];
      }),
  );
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;

  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

async function signSessionId(sessionId: string, secret: string) {
  const encoder = new TextEncoder();
  const secretKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", secretKey, encoder.encode(sessionId));
  return hexEncode(new Uint8Array(signature));
}

function buildSessionToken(sessionId: string, signature: string) {
  return `${sessionId}.${signature}`;
}

export async function createSignedSessionCookie(secret: string) {
  const sessionId = crypto.randomUUID();
  const signature = await signSessionId(sessionId, secret);
  const token = buildSessionToken(sessionId, signature);

  return {
    sessionId,
    setCookieHeader: [
      `${sessionCookieName}=${encodeURIComponent(token)}`,
      "HttpOnly",
      `Max-Age=${sessionCookieMaxAgeSeconds}`,
      "Path=/",
      "SameSite=None",
      "Secure",
    ].join("; "),
  };
}

export async function readVerifiedSessionId(request: Request, secret: string) {
  const cookies = parseCookies(request.headers.get("cookie"));
  const token = cookies[sessionCookieName];

  if (!token) {
    return null;
  }

  const separatorIndex = token.indexOf(".");

  if (separatorIndex === -1) {
    return null;
  }

  const sessionId = token.slice(0, separatorIndex);
  const signature = token.slice(separatorIndex + 1);

  if (!uuidPattern.test(sessionId)) {
    return null;
  }

  const expectedSignature = await signSessionId(sessionId, secret);

  return constantTimeEqual(signature, expectedSignature) ? sessionId : null;
}
