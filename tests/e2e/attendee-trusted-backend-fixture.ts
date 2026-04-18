import { expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";

type TrustedCompletionRecord = {
  attempt_number: number;
  client_session_id: string;
  entitlement_awarded: boolean;
  event_id: string;
  id: string;
  verification_code: string;
};

type TrustedEntitlementRecord = {
  client_session_id: string;
  event_id: string;
  id: string;
  status: string;
  verification_code: string;
};

type TrustedStartRecord = {
  client_session_id: string;
  event_id: string;
};

export type TamperedCompletionRequestCapture = {
  eventId: string | null;
  requestId: string | null;
};

type AttendeeFunctionProxyOptions = {
  failFirstIssueSessionRequest?: boolean;
  captureTamperedCompletionRequest?: TamperedCompletionRequestCapture;
  tamperFirstCompletionPayload?: boolean;
};

function readRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function createServiceRoleClient() {
  return createClient(
    readRequiredEnv("TEST_SUPABASE_URL"),
    readRequiredEnv("TEST_SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

export async function assertTrustedAttendeeCompletionPersisted(
  verificationCode: string,
  eventId = "madrona-music-2026",
) {
  const serviceRoleClient = createServiceRoleClient();

  const { data: entitlementRows, error: entitlementError } = await serviceRoleClient
    .from("game_entitlements")
    .select("id,event_id,client_session_id,verification_code,status")
    .eq("event_id", eventId)
    .eq("verification_code", verificationCode)
    .eq("status", "active")
    .returns<TrustedEntitlementRecord[]>();

  if (entitlementError) {
    throw new Error(
      `Failed to read trusted entitlement state for attendee smoke test: ${entitlementError.message}`,
    );
  }

  expect(entitlementRows).toHaveLength(1);
  const entitlement = entitlementRows[0];
  expect(entitlement.event_id).toBe(eventId);
  expect(entitlement.verification_code).toBe(verificationCode);

  const { data: completionRows, error: completionError } = await serviceRoleClient
    .from("game_completions")
    .select(
      "id,event_id,client_session_id,verification_code,attempt_number,entitlement_awarded",
    )
    .eq("event_id", eventId)
    .eq("verification_code", verificationCode)
    .eq("entitlement_id", entitlement.id)
    .order("attempt_number", { ascending: true })
    .returns<TrustedCompletionRecord[]>();

  if (completionError) {
    throw new Error(
      `Failed to read trusted completion state for attendee smoke test: ${completionError.message}`,
    );
  }

  expect(completionRows.length).toBeGreaterThan(0);
  expect(completionRows[0]?.attempt_number).toBe(1);
  expect(completionRows[0]?.entitlement_awarded).toBe(true);
  expect(completionRows[0]?.client_session_id).toBe(entitlement.client_session_id);

  const { data: startRow, error: startError } = await serviceRoleClient
    .from("game_starts")
    .select("event_id,client_session_id")
    .eq("event_id", eventId)
    .eq("client_session_id", entitlement.client_session_id)
    .maybeSingle<TrustedStartRecord>();

  if (startError) {
    throw new Error(
      `Failed to read game start state for attendee smoke test: ${startError.message}`,
    );
  }

  expect(startRow).not.toBeNull();
  expect(startRow?.event_id).toBe(eventId);
  expect(startRow?.client_session_id).toBe(entitlement.client_session_id);
}

export async function assertNoTrustedCompletionPersistedForRequest(
  eventId: string,
  requestId: string,
) {
  const serviceRoleClient = createServiceRoleClient();
  const { data: completionRows, error: completionError } = await serviceRoleClient
    .from("game_completions")
    .select("id")
    .eq("event_id", eventId)
    .eq("request_id", requestId)
    .returns<Array<{ id: string }>>();

  if (completionError) {
    throw new Error(
      `Failed to verify malformed completion non-persistence: ${completionError.message}`,
    );
  }

  expect(completionRows).toHaveLength(0);
}

export async function installAttendeeFunctionProxy(
  page: Page,
  options: AttendeeFunctionProxyOptions = {},
) {
  const {
    failFirstIssueSessionRequest = false,
    captureTamperedCompletionRequest,
    tamperFirstCompletionPayload = false,
  } = options;
  const supabaseUrl = readRequiredEnv("TEST_SUPABASE_URL").replace(/\/$/, "");
  const functionNames = new Set(["issue-session", "complete-game"]);
  let hasFailedFirstIssueSessionRequest = false;
  let hasTamperedFirstCompletionPayload = false;

  await page.route(`${supabaseUrl}/functions/v1/**`, async (route) => {
    const request = route.request();
    const requestUrl = new URL(request.url());
    const functionName = requestUrl.pathname.split("/").at(-1) ?? "";

    if (!functionNames.has(functionName)) {
      await route.continue();
      return;
    }

    if (request.method() === "OPTIONS") {
      const requestedHeaders = await request.headerValue(
        "access-control-request-headers",
      );
      await route.fulfill({
        headers: {
          "access-control-allow-credentials": "true",
          "access-control-allow-headers":
            requestedHeaders ??
            "authorization,apikey,content-type,x-client-info,x-neighborly-session",
          "access-control-allow-methods": "POST,OPTIONS",
          "access-control-allow-origin": "http://127.0.0.1:4173",
          vary: "Origin",
        },
        status: 200,
      });
      return;
    }

    const shouldFailIssueSessionRequest =
      failFirstIssueSessionRequest &&
      functionName === "issue-session" &&
      request.method() === "POST" &&
      !hasFailedFirstIssueSessionRequest;

    if (shouldFailIssueSessionRequest) {
      hasFailedFirstIssueSessionRequest = true;
      await route.fulfill({
        body: JSON.stringify({ error: "Backend bootstrap smoke failure." }),
        headers: {
          "access-control-allow-credentials": "true",
          "access-control-allow-origin": "http://127.0.0.1:4173",
          "content-type": "application/json",
          vary: "Origin",
        },
        status: 503,
      });
      return;
    }

    const requestApikey = await request.headerValue("apikey");
    const requestAuthorization = await request.headerValue("authorization");
    const requestContentType = await request.headerValue("content-type");
    const requestSessionHeader = await request.headerValue("x-neighborly-session");
    const requestCookie = await request.headerValue("cookie");
    const headers: Record<string, string> = {
      origin: "http://127.0.0.1:4173",
    };

    if (requestApikey) {
      headers.apikey = requestApikey;
    }

    if (requestAuthorization) {
      headers.Authorization = requestAuthorization;
    }

    if (requestContentType) {
      headers["Content-Type"] = requestContentType;
    }

    if (requestSessionHeader) {
      headers["x-neighborly-session"] = requestSessionHeader;
    }

    if (requestCookie) {
      headers.cookie = requestCookie;
    }

    const shouldTamperCompletionPayload =
      tamperFirstCompletionPayload &&
      functionName === "complete-game" &&
      request.method() === "POST" &&
      !hasTamperedFirstCompletionPayload;
    let originalPayload:
      | {
          eventId?: unknown;
          requestId?: unknown;
        }
      | undefined;

    try {
      originalPayload = request.postDataJSON() as
        | {
            eventId?: unknown;
            requestId?: unknown;
          }
        | undefined;
    } catch {
      originalPayload = undefined;
    }
    let requestBody = request.postData() ?? undefined;

    if (shouldTamperCompletionPayload) {
      hasTamperedFirstCompletionPayload = true;

      if (captureTamperedCompletionRequest) {
        captureTamperedCompletionRequest.eventId =
          typeof originalPayload?.eventId === "string"
            ? originalPayload.eventId
            : null;
        captureTamperedCompletionRequest.requestId =
          typeof originalPayload?.requestId === "string"
            ? originalPayload.requestId
            : null;
      }

      requestBody = JSON.stringify({
        ...(originalPayload ?? {}),
        durationMs: "invalid-duration",
      });
    }

    const response = await fetch(request.url(), {
      body: requestBody,
      headers,
      method: request.method(),
    });

    const responseHeaders: Record<string, string> = {
      "access-control-allow-credentials": "true",
      "access-control-allow-origin": "http://127.0.0.1:4173",
      "content-type": response.headers.get("content-type") ?? "application/json",
      vary: "Origin",
    };
    const responseSetCookie = response.headers.get("set-cookie");

    if (responseSetCookie) {
      responseHeaders["set-cookie"] = responseSetCookie;
    }

    await route.fulfill({
      body: await response.text(),
      headers: responseHeaders,
      status: response.status,
    });
  });
}
