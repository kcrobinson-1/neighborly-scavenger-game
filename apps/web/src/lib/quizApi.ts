import { getGameById, scoreAnswers } from "../../../../shared/game-config";
import type {
  QuizCompletionEntitlement,
  QuizCompletionResult,
  SubmitQuizCompletionInput,
} from "../types/quiz";

const localEntitlementStorageKey = "neighborly.local-entitlements.v1";
const localAttemptStorageKey = "neighborly.local-attempts.v1";
const localCompletionStorageKey = "neighborly.local-completions.v1";
const localPrototypeSessionStorageKey = "neighborly.local-session.v1";

type LocalEntitlementRecord = {
  createdAt: string;
  firstCompletionId: string;
  verificationCode: string;
};

type LocalEntitlementsStore = Record<string, LocalEntitlementRecord>;
type LocalAttemptsStore = Record<string, number>;
type LocalCompletionsStore = Record<string, QuizCompletionResult>;

function getEnvironmentValue(value: string | undefined) {
  return value?.trim() ?? "";
}

function getSupabaseConfig() {
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

function isPrototypeFallbackEnabled() {
  return import.meta.env.DEV && !getSupabaseConfig().enabled;
}

function getStorageKey(eventId: string, prototypeSessionId: string) {
  return `${eventId}:${prototypeSessionId}`;
}

function createOpaqueId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function createVerificationCode() {
  const token = createOpaqueId("vf")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-8)
    .toUpperCase();

  return `MMP-${token}`;
}

function readStoredJson<T>(key: string, fallback: T) {
  if (typeof window === "undefined") {
    return fallback;
  }

  const rawValue = window.localStorage.getItem(key);

  if (!rawValue) {
    return fallback;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return fallback;
  }
}

function writeStoredJson<T>(key: string, value: T) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

function getOrCreateLocalPrototypeSessionId() {
  if (typeof window === "undefined") {
    return createOpaqueId("prototype-session");
  }

  const existingSessionId = window.localStorage.getItem(localPrototypeSessionStorageKey);

  if (existingSessionId) {
    return existingSessionId;
  }

  const sessionId = createOpaqueId("prototype-session");
  window.localStorage.setItem(localPrototypeSessionStorageKey, sessionId);
  return sessionId;
}

function buildEntitlementMessage(status: QuizCompletionEntitlement["status"]) {
  return status === "new"
    ? "You earned your raffle entry."
    : "You already earned your raffle entry. This retake does not create another ticket.";
}

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
      firstCompletionId: createOpaqueId("cmp"),
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
  };

  completions[completionLookupKey] = result;
  writeStoredJson(localCompletionStorageKey, completions);

  return result;
}

async function handleCompletionResponse(response: Response) {
  if (!response.ok) {
    let errorMessage = "We couldn't finalize your raffle entry right now.";

    try {
      const errorPayload = (await response.json()) as { error?: string };
      errorMessage = errorPayload.error ?? errorMessage;
    } catch {
      // Fall back to the default message when the response body is not JSON.
    }

    throw Object.assign(new Error(errorMessage), { status: response.status });
  }

  return (await response.json()) as QuizCompletionResult;
}

export async function ensureServerSession() {
  const { enabled, supabaseClientKey, supabaseUrl } = getSupabaseConfig();

  if (!enabled) {
    if (isPrototypeFallbackEnabled()) {
      return;
    }

    throw new Error("Supabase browser configuration is missing.");
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/issue-session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseClientKey,
      Authorization: `Bearer ${supabaseClientKey}`,
    },
    credentials: "include",
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    throw new Error("We couldn't prepare your quiz session right now.");
  }
}

async function submitQuizCompletionToSupabase(
  input: SubmitQuizCompletionInput,
  retryOnUnauthorized = true,
) {
  const { supabaseClientKey, supabaseUrl } = getSupabaseConfig();
  const response = await fetch(`${supabaseUrl}/functions/v1/complete-quiz`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseClientKey,
      Authorization: `Bearer ${supabaseClientKey}`,
    },
    credentials: "include",
    body: JSON.stringify(input),
  });

  if (response.status === 401 && retryOnUnauthorized) {
    await ensureServerSession();
    return submitQuizCompletionToSupabase(input, false);
  }

  return handleCompletionResponse(response);
}

export async function submitQuizCompletion(input: SubmitQuizCompletionInput) {
  if (!getSupabaseConfig().enabled) {
    if (isPrototypeFallbackEnabled()) {
      return buildLocalCompletionResult(input);
    }

    throw new Error("Supabase browser configuration is missing.");
  }

  return submitQuizCompletionToSupabase(input);
}
