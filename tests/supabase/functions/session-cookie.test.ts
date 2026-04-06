import {
  assert,
  assertEquals,
  assertMatch,
} from "jsr:@std/assert@1";
import {
  createSignedSessionCookie,
  readVerifiedSession,
  sessionHeaderName,
} from "../../../supabase/functions/_shared/session-cookie.ts";

const signingSecret = "test-session-secret";

Deno.test("createSignedSessionCookie creates a signed cookie that readVerifiedSession accepts", async () => {
  const session = await createSignedSessionCookie(signingSecret);
  const request = new Request("https://example.com", {
    headers: {
      cookie: `neighborly_session=${encodeURIComponent(session.sessionToken)}`,
    },
  });

  const verifiedSession = await readVerifiedSession(request, signingSecret);

  assert(verifiedSession);
  assertEquals(verifiedSession.sessionToken, session.sessionToken);
  assertEquals(verifiedSession.sessionId, session.sessionId);
  assertMatch(session.setCookieHeader, /HttpOnly/);
  assertMatch(session.setCookieHeader, /SameSite=None/);
  assertMatch(session.setCookieHeader, /Secure/);
});

Deno.test("readVerifiedSession falls back to the explicit session header", async () => {
  const session = await createSignedSessionCookie(signingSecret);
  const request = new Request("https://example.com", {
    headers: {
      [sessionHeaderName]: session.sessionToken,
    },
  });

  const verifiedSession = await readVerifiedSession(request, signingSecret);

  assert(verifiedSession);
  assertEquals(verifiedSession.sessionToken, session.sessionToken);
});

Deno.test("readVerifiedSession rejects tampered and malformed tokens", async () => {
  const session = await createSignedSessionCookie(signingSecret);
  const tamperedRequest = new Request("https://example.com", {
    headers: {
      cookie: `neighborly_session=${encodeURIComponent(`${session.sessionId}.deadbeef`)}`,
    },
  });
  const malformedRequest = new Request("https://example.com", {
    headers: {
      cookie: "neighborly_session=not-a-valid-token",
    },
  });

  assertEquals(await readVerifiedSession(tamperedRequest, signingSecret), null);
  assertEquals(await readVerifiedSession(malformedRequest, signingSecret), null);
});
