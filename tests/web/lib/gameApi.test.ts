import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SubmitGameCompletionInput } from "../../../apps/web/src/types/game.ts";

const { mockCreateOpaqueId } = vi.hoisted(() => {
  return {
    mockCreateOpaqueId: vi.fn(),
  };
});

vi.mock("../../../apps/web/src/lib/session.ts", () => ({
  createOpaqueId: mockCreateOpaqueId,
}));

import {
  ensureServerSession,
  submitGameCompletion,
} from "../../../apps/web/src/lib/gameApi.ts";

const serverSessionTokenStorageKey = "neighborly.server-session-token.v1";
const sampleInput: SubmitGameCompletionInput = {
  answers: {
    q1: ["a"],
    q2: ["b"],
  },
  durationMs: 1200,
  eventId: "madrona-music-2026",
  requestId: "req-123",
};

function createMemoryStorage() {
  const values = new Map<string, string>();

  return {
    clear() {
      values.clear();
    },
    getItem(key: string) {
      return values.has(key) ? values.get(key) ?? null : null;
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    get length() {
      return values.size;
    },
  };
}

function createJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
    },
    status,
  });
}

function setSupabaseEnv({
  fallbackEnabled = false,
  key,
  url,
}: {
  fallbackEnabled?: boolean;
  key?: string;
  url?: string;
}) {
  if (url) {
    vi.stubEnv("VITE_SUPABASE_URL", url);
  }

  if (key) {
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY", key);
  }

  vi.stubEnv(
    "VITE_ENABLE_LOCAL_PROTOTYPE_FALLBACK",
    fallbackEnabled ? "true" : "",
  );
}

describe("gameApi", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: createMemoryStorage(),
    });

    // The browser API boundary is what we are exercising here, so the only
    // stubbed dependency is opaque id generation used by the local fallback.
    mockCreateOpaqueId.mockImplementation((prefix: string) => {
      switch (prefix) {
        case "prototype-session":
          return "prototype-session-1";
        case "vf":
          return "vf-12345678";
        case "cmp":
          return "cmp-1";
        default:
          return `${prefix}-generated`;
      }
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("fails loudly when Supabase config is missing and fallback is not enabled", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(ensureServerSession()).rejects.toThrow(
      "If you're working locally, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`, or set `VITE_ENABLE_LOCAL_PROTOTYPE_FALLBACK=true` to run the local-only prototype flow.",
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips the backend bootstrap when the explicit local prototype fallback is enabled", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    setSupabaseEnv({ fallbackEnabled: true });

    await expect(ensureServerSession()).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bootstraps the server session and stores the fallback token for later requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        issuedNewSession: true,
        sessionReady: true,
        sessionToken: "signed-session-token",
      }),
    );

    vi.stubGlobal("fetch", fetchMock);
    setSupabaseEnv({
      key: "publishable-key",
      url: "https://example.supabase.co",
    });

    await ensureServerSession();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.supabase.co/functions/v1/issue-session",
      expect.objectContaining({
        body: "{}",
        credentials: "include",
        method: "POST",
      }),
    );

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer publishable-key",
      apikey: "publishable-key",
    });
    expect(window.localStorage.getItem(serverSessionTokenStorageKey)).toBe(
      "signed-session-token",
    );
  });

  it("uses the local fallback idempotently for the same request id and preserves one entitlement per session", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    setSupabaseEnv({ fallbackEnabled: true });

    const firstResult = await submitGameCompletion(sampleInput);
    const sameRequestResult = await submitGameCompletion(sampleInput);
    const secondAttempt = await submitGameCompletion({
      ...sampleInput,
      requestId: "req-456",
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(firstResult).toEqual(sameRequestResult);
    expect(firstResult).toMatchObject({
      attemptNumber: 1,
      completionId: "cmp-1",
      entitlement: {
        status: "new",
        verificationCode: "MMP-12345678",
      },
      entitlementEligible: true,
    });

    expect(secondAttempt).toMatchObject({
      attemptNumber: 2,
      entitlement: {
        status: "existing",
        verificationCode: "MMP-12345678",
      },
      entitlementEligible: false,
    });
  });

  it("retries completion once after a 401 and reuses the same request id", async () => {
    window.localStorage.setItem(serverSessionTokenStorageKey, "expired-token");

    const completionResponse = {
      attemptNumber: 1,
      completionId: "cmp-server",
      entitlement: {
        createdAt: "2026-04-05T12:00:00.000Z",
        status: "new",
        verificationCode: "MMP-SERVER01",
      },
      message: "You're checked in for the reward.",
      entitlementEligible: true,
      score: 2,
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse({ error: "Session is missing or invalid." }, 401),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          issuedNewSession: true,
          sessionReady: true,
          sessionToken: "fresh-token",
        }),
      )
      .mockResolvedValueOnce(createJsonResponse(completionResponse));

    vi.stubGlobal("fetch", fetchMock);
    setSupabaseEnv({
      key: "publishable-key",
      url: "https://example.supabase.co",
    });

    await expect(submitGameCompletion(sampleInput)).resolves.toEqual(completionResponse);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://example.supabase.co/functions/v1/complete-game",
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://example.supabase.co/functions/v1/issue-session",
    );
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      "https://example.supabase.co/functions/v1/complete-game",
    );

    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      "x-neighborly-session": "expired-token",
    });
    expect(fetchMock.mock.calls[2]?.[1]?.headers).toMatchObject({
      "x-neighborly-session": "fresh-token",
    });

    const firstPayload = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    const secondPayload = JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body));
    expect(firstPayload).toMatchObject({ requestId: "req-123" });
    expect(secondPayload).toMatchObject({ requestId: "req-123" });
  });
});
