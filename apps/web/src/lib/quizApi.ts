import { scoreAnswers } from "../../../../shared/game-config";
import { getGameById } from "../../../../shared/game-config/sample-fixtures.ts";
import type {
  QuizCompletionEntitlement,
  QuizCompletionResult,
  SubmitQuizCompletionInput,
} from "../types/quiz";
import { createOpaqueId } from "./session";

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

/** Stored raffle entitlement for a prototype browser session. */
type LocalEntitlementRecord = {
  createdAt: string;
  verificationCode: string;
};

/** Browser-side map of event/session keys to entitlement records. */
type LocalEntitlementsStore = Record<string, LocalEntitlementRecord>;
/** Browser-side attempt counter per event/session pair. */
type LocalAttemptsStore = Record<string, number>;
/** Browser-side cache of completion results keyed by request id. */
type LocalCompletionsStore = Record<string, QuizCompletionResult>;
/** Minimal error payload shape returned by the edge functions. */
type QuizApiErrorPayload = {
  error?: string;
};
/** Response shape returned when the backend prepares the signed session. */
type IssueSessionResponse = {
  issuedNewSession: boolean;
  sessionReady: boolean;
  sessionToken?: string;
};
/** Runtime Supabase configuration read from Vite environment variables. */
type SupabaseConfig = {
  enabled: boolean;
  supabaseClientKey: string;
  supabaseUrl: string;
};

/** Returns true when a Vite env flag explicitly enables a behavior. */
function isEnabledFlag(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes(getEnvironmentValue(value).toLowerCase());
}

/** Trims environment variables so empty-looking values are treated consistently. */
function getEnvironmentValue(value: string | undefined) {
  return value?.trim() ?? "";
}

/** Returns the browser-side Supabase configuration needed for edge function calls. */
function getSupabaseConfig(): SupabaseConfig {
  const supabaseUrl = getEnvironmentValue(import.meta.env.VITE_SUPABASE_URL);
  const supabasePublishableKey = getEnvironmentValue(
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
  );
  const legacyAnonKey = getEnvironmentValue(import.meta.env.VITE_SUPABASE_ANON_KEY);
  const supabaseClientKey = supabasePublishableKey || legacyAnonKey;

  return {
    enabled: Boolean(supabaseUrl && supabaseClientKey),
    supabaseClientKey,
    supabaseUrl,
  };
}

/** Enables the local-only fallback only when explicitly requested in development. */
function isPrototypeFallbackEnabled() {
  return (
    import.meta.env.DEV &&
    !getSupabaseConfig().enabled &&
    isEnabledFlag(import.meta.env.VITE_ENABLE_LOCAL_PROTOTYPE_FALLBACK)
  );
}

/** Explains how to proceed when local Supabase browser configuration is missing. */
function getMissingSupabaseConfigMessage() {
  if (!import.meta.env.DEV) {
    return "This quiz isn't available right now.";
  }

  return [
    "This quiz isn't available right now.",
    "If you're working locally, add `VITE_SUPABASE_URL` and",
    "`VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`, or set",
    "`VITE_ENABLE_LOCAL_PROTOTYPE_FALLBACK=true` to run the local-only prototype flow.",
  ].join(" ");
}

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

/** Returns the user-facing entitlement copy for a new or reused raffle entry. */
function buildEntitlementMessage(status: QuizCompletionEntitlement["status"]) {
  return status === "new"
    ? "You're checked in for the raffle."
    : "You're still checked in for the raffle. Playing again does not add another ticket.";
}

/** Simulates the backend completion flow when running locally without Supabase. */
function buildLocalCompletionResult(
  input: SubmitQuizCompletionInput,
): QuizCompletionResult {
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
    throw new Error("This quiz event could not be found.");
  }

  const nextAttemptNumber = (attempts[lookupKey] ?? 0) + 1;
  attempts[lookupKey] = nextAttemptNumber;

  let entitlement = entitlements[lookupKey];
  let entitlementStatus: QuizCompletionEntitlement["status"] = "existing";

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
    raffleEligible: entitlementStatus === "new",
    score: scoreAnswers(game, input.answers),
  } satisfies QuizCompletionResult;

  completions[completionLookupKey] = result;
  writeStoredJson(localCompletionStorageKey, completions);

  return result;
}

/** Extracts a useful error message from an edge-function response body. */
async function readErrorMessage(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as QuizApiErrorPayload;
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
}

/** Converts the completion response into a typed result or throws a helpful error. */
async function handleCompletionResponse(response: Response) {
  if (!response.ok) {
    const errorMessage = await readErrorMessage(
      response,
      "We couldn't finish your raffle check-in right now.",
    );

    throw Object.assign(new Error(errorMessage), { status: response.status });
  }

  return (await response.json()) as QuizCompletionResult;
}

/** Builds the shared fetch headers for backend session-aware requests. */
function createServerSessionHeaders(supabaseClientKey: string) {
  const sessionToken = readStoredServerSessionToken();

  return {
    "Content-Type": "application/json",
    apikey: supabaseClientKey,
    Authorization: `Bearer ${supabaseClientKey}`,
    ...(sessionToken ? { "x-neighborly-session": sessionToken } : {}),
  };
}

/** Ensures the signed server session cookie exists before gameplay begins. */
export async function ensureServerSession() {
  const { enabled, supabaseClientKey, supabaseUrl } = getSupabaseConfig();

  if (!enabled) {
    if (isPrototypeFallbackEnabled()) {
      return;
    }

    throw new Error(getMissingSupabaseConfigMessage());
  }

  // We bootstrap the signed server session before gameplay starts so the
  // entitlement flow fails early and recoverably on the intro screen instead
  // of only surfacing a problem after the user finishes the quiz.
  const response = await fetch(`${supabaseUrl}/functions/v1/issue-session`, {
    method: "POST",
    headers: createServerSessionHeaders(supabaseClientKey),
    credentials: "include",
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    throw new Error(
      await readErrorMessage(
        response,
        "We couldn't get the quiz ready right now.",
      ),
    );
  }

  const payload = (await response.json()) as IssueSessionResponse;
  writeStoredServerSessionToken(payload.sessionToken ?? null);
}

/** Submits quiz completion to Supabase and retries once after a 401 response. */
async function submitQuizCompletionToSupabase(
  input: SubmitQuizCompletionInput,
  retryOnUnauthorized = true,
) {
  const { supabaseClientKey, supabaseUrl } = getSupabaseConfig();
  const response = await fetch(`${supabaseUrl}/functions/v1/complete-quiz`, {
    method: "POST",
    headers: createServerSessionHeaders(supabaseClientKey),
    credentials: "include",
    body: JSON.stringify(input),
  });

  if (response.status === 401 && retryOnUnauthorized) {
    // If the cookie expired or was never set, we re-bootstrap the server
    // session once and replay the same request. The request id must stay the
    // same so the backend can dedupe safely.
    await ensureServerSession();
    return submitQuizCompletionToSupabase(input, false);
  }

  return handleCompletionResponse(response);
}

/** Finalizes quiz completion using Supabase or the local prototype fallback. */
export async function submitQuizCompletion(input: SubmitQuizCompletionInput) {
  if (!getSupabaseConfig().enabled) {
    if (isPrototypeFallbackEnabled()) {
      return buildLocalCompletionResult(input);
    }

    throw new Error(getMissingSupabaseConfigMessage());
  }

  return submitQuizCompletionToSupabase(input);
}
