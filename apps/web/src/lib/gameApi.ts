import { scoreAnswers } from "../../../../shared/game-config";
import { getGameById } from "../../../../shared/game-config/sample-fixtures.ts";
import type {
  GameCompletionEntitlement,
  GameCompletionResult,
  SubmitGameCompletionInput,
} from "../types/game";
import { createOpaqueId } from "./session";
import {
  createSupabaseAuthHeaders,
  getMissingSupabaseConfigMessage,
  getSupabaseConfig,
  isPrototypeFallbackEnabled,
  readSupabaseErrorMessage,
} from "./supabaseBrowser";

/**
 * Browser game-session API boundary for attendee gameplay.
 * Owns trusted session bootstrap and completion submission calls to Supabase,
 * plus the explicit local-only prototype fallback path for development without
 * backend configuration.
 */
/** Browser storage key for prototype entitlement records. */
const localEntitlementStorageKey = "neighborly.local-entitlements.v1";
/** Browser storage key for per-session attempt counters. */
const localAttemptStorageKey = "neighborly.local-attempts.v1";
/** Browser storage key for idempotent completion results. */
const localCompletionStorageKey = "neighborly.local-completions.v1";
/** Browser storage key for the local-only prototype session identifier. */
const localPrototypeSessionStorageKey = "neighborly.local-session.v1";
/** Browser storage key for the signed server session token fallback. */
const serverSessionTokenStorageKey = "neighborly.server-session-token.v1";

/** Stored reward entitlement for a prototype browser session. */
type LocalEntitlementRecord = {
  createdAt: string;
  verificationCode: string;
};

/** Browser-side map of event/session keys to entitlement records. */
type LocalEntitlementsStore = Record<string, LocalEntitlementRecord>;
/** Browser-side attempt counter per event/session pair. */
type LocalAttemptsStore = Record<string, number>;
/** Browser-side cache of completion results keyed by request id. */
type LocalCompletionsStore = Record<string, GameCompletionResult>;
/** Response shape returned when the backend prepares the signed session. */
type IssueSessionResponse = {
  issuedNewSession: boolean;
  sessionReady: boolean;
  sessionToken?: string;
};

/** Builds a stable storage key for a specific event/session pair. */
function getStorageKey(eventId: string, prototypeSessionId: string) {
  return `${eventId}:${prototypeSessionId}`;
}

/** Safely exposes localStorage for environments where it may be unavailable. */
function getLocalStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Creates the volunteer-facing verification code shown after completion. */
function createVerificationCode() {
  const token = createOpaqueId("vf")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-8)
    .toUpperCase();

  return `MMP-${token}`;
}

/** Reads and parses JSON from localStorage with a typed fallback value. */
function readStoredJson<T>(key: string, fallback: T) {
  const storage = getLocalStorage();

  if (!storage) {
    return fallback;
  }

  const rawValue = storage.getItem(key);

  if (!rawValue) {
    return fallback;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return fallback;
  }
}

/** Writes a JSON-serializable value to localStorage when available. */
function writeStoredJson<T>(key: string, value: T) {
  const storage = getLocalStorage();

  if (!storage) {
    return;
  }

  storage.setItem(key, JSON.stringify(value));
}

/** Reads the signed backend session token fallback from browser storage. */
function readStoredServerSessionToken() {
  const storage = getLocalStorage();

  if (!storage) {
    return "";
  }

  return storage.getItem(serverSessionTokenStorageKey)?.trim() ?? "";
}

/** Stores or clears the signed backend session token fallback. */
function writeStoredServerSessionToken(sessionToken: string | null) {
  const storage = getLocalStorage();

  if (!storage) {
    return;
  }

  if (sessionToken) {
    storage.setItem(serverSessionTokenStorageKey, sessionToken);
    return;
  }

  storage.removeItem(serverSessionTokenStorageKey);
}

/** Returns the prototype session id, creating it on first use in the browser. */
function getOrCreateLocalPrototypeSessionId() {
  const storage = getLocalStorage();

  if (!storage) {
    return createOpaqueId("prototype-session");
  }

  const existingSessionId = storage.getItem(localPrototypeSessionStorageKey);

  if (existingSessionId) {
    return existingSessionId;
  }

  const sessionId = createOpaqueId("prototype-session");
  storage.setItem(localPrototypeSessionStorageKey, sessionId);
  return sessionId;
}

/** Returns the user-facing entitlement copy for a new or reused reward entry. */
function buildEntitlementMessage(status: GameCompletionEntitlement["status"]) {
  return status === "new"
    ? "You're checked in for the reward."
    : "You're still checked in for the reward. Playing again does not add another reward entry.";
}

/** Simulates the backend completion flow when running locally without Supabase. */
function buildLocalCompletionResult(
  input: SubmitGameCompletionInput,
): GameCompletionResult {
  const prototypeSessionId = getOrCreateLocalPrototypeSessionId();
  const lookupKey = getStorageKey(input.eventId, prototypeSessionId);
  const completionLookupKey = `${lookupKey}:${input.requestId}`;
  const entitlements = readStoredJson<LocalEntitlementsStore>(
    localEntitlementStorageKey,
    {},
  );
  const attempts = readStoredJson<LocalAttemptsStore>(localAttemptStorageKey, {});
  const completions = readStoredJson<LocalCompletionsStore>(
    localCompletionStorageKey,
    {},
  );

  if (completions[completionLookupKey]) {
    return completions[completionLookupKey];
  }

  const game = getGameById(input.eventId);

  if (!game) {
    throw new Error("This game event could not be found.");
  }

  const nextAttemptNumber = (attempts[lookupKey] ?? 0) + 1;
  attempts[lookupKey] = nextAttemptNumber;

  let entitlement = entitlements[lookupKey];
  let entitlementStatus: GameCompletionEntitlement["status"] = "existing";

  if (!entitlement) {
    entitlement = {
      createdAt: new Date().toISOString(),
      verificationCode: createVerificationCode(),
    };
    entitlements[lookupKey] = entitlement;
    entitlementStatus = "new";
  }

  writeStoredJson(localEntitlementStorageKey, entitlements);
  writeStoredJson(localAttemptStorageKey, attempts);

  const result = {
    attemptNumber: nextAttemptNumber,
    completionId: createOpaqueId("cmp"),
    entitlement: {
      createdAt: entitlement.createdAt,
      status: entitlementStatus,
      verificationCode: entitlement.verificationCode,
    },
    message: buildEntitlementMessage(entitlementStatus),
    entitlementEligible: entitlementStatus === "new",
    score: scoreAnswers(game, input.answers),
  } satisfies GameCompletionResult;

  completions[completionLookupKey] = result;
  writeStoredJson(localCompletionStorageKey, completions);

  return result;
}

/** Converts the completion response into a typed result or throws a helpful error. */
async function handleCompletionResponse(response: Response) {
  if (!response.ok) {
    const errorMessage = await readSupabaseErrorMessage(
      response,
      "We couldn't finish your reward check-in right now.",
    );

    throw Object.assign(new Error(errorMessage), { status: response.status });
  }

  return (await response.json()) as GameCompletionResult;
}

/** Builds the shared fetch headers for backend session-aware requests. */
function createServerSessionHeaders(supabaseClientKey: string) {
  const sessionToken = readStoredServerSessionToken();

  return {
    "Content-Type": "application/json",
    ...createSupabaseAuthHeaders(supabaseClientKey),
    ...(sessionToken ? { "x-neighborly-session": sessionToken } : {}),
  };
}

/** Ensures the signed server session cookie exists before gameplay begins. */
export async function ensureServerSession(eventId?: string) {
  const { enabled, supabaseClientKey, supabaseUrl } = getSupabaseConfig();

  if (!enabled) {
    if (isPrototypeFallbackEnabled()) {
      return;
    }

    throw new Error(getMissingSupabaseConfigMessage());
  }

  // We bootstrap the signed server session before gameplay starts so the
  // entitlement flow fails early and recoverably on the intro screen instead
  // of only surfacing a problem after the user finishes the game.
  const response = await fetch(`${supabaseUrl}/functions/v1/issue-session`, {
    method: "POST",
    headers: createServerSessionHeaders(supabaseClientKey),
    credentials: "include",
    body: JSON.stringify(eventId ? { event_id: eventId } : {}),
  });

  if (!response.ok) {
    throw new Error(
      await readSupabaseErrorMessage(
        response,
        "We couldn't get the game ready right now.",
      ),
    );
  }

  const payload = (await response.json()) as IssueSessionResponse;
  writeStoredServerSessionToken(payload.sessionToken ?? null);
}

/** Submits game completion to Supabase and retries once after a 401 response. */
async function submitGameCompletionToSupabase(
  input: SubmitGameCompletionInput,
  retryOnUnauthorized = true,
) {
  const { supabaseClientKey, supabaseUrl } = getSupabaseConfig();
  const response = await fetch(`${supabaseUrl}/functions/v1/complete-game`, {
    method: "POST",
    headers: createServerSessionHeaders(supabaseClientKey),
    credentials: "include",
    body: JSON.stringify(input),
  });

  if (response.status === 401 && retryOnUnauthorized) {
    // If the cookie expired or was never set, we re-bootstrap the server
    // session once and replay the same request. The request id must stay the
    // same so the backend can dedupe safely. Pass eventId so the re-bootstrap
    // also records a start row — without it, a 401-retry path would produce a
    // completion row with no corresponding game_starts entry.
    await ensureServerSession(input.eventId);
    return submitGameCompletionToSupabase(input, false);
  }

  return handleCompletionResponse(response);
}

/** Finalizes game completion using Supabase or the local prototype fallback. */
export async function submitGameCompletion(input: SubmitGameCompletionInput) {
  if (!getSupabaseConfig().enabled) {
    if (isPrototypeFallbackEnabled()) {
      return buildLocalCompletionResult(input);
    }

    throw new Error(getMissingSupabaseConfigMessage());
  }

  return submitGameCompletionToSupabase(input);
}
