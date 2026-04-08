import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Minimal error payload shape returned by Supabase-backed browser requests. */
type SupabaseBrowserErrorPayload = {
  error?: string;
  message?: string;
};

let browserSupabaseClient: SupabaseClient | null = null;

/** Runtime Supabase configuration read from Vite environment variables. */
export type SupabaseConfig = {
  enabled: boolean;
  supabaseClientKey: string;
  supabaseUrl: string;
};

/** Returns true when a Vite env flag explicitly enables a behavior. */
export function isEnabledFlag(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes(getEnvironmentValue(value).toLowerCase());
}

/** Trims environment variables so empty-looking values are treated consistently. */
export function getEnvironmentValue(value: string | undefined) {
  return value?.trim() ?? "";
}

/** Returns the browser-side Supabase configuration needed for public reads and functions. */
export function getSupabaseConfig(): SupabaseConfig {
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

/** Returns the shared browser Supabase client used by admin auth and data reads. */
export function getBrowserSupabaseClient() {
  const { enabled, supabaseClientKey, supabaseUrl } = getSupabaseConfig();

  if (!enabled) {
    throw new Error(getMissingSupabaseConfigMessage());
  }

  if (!browserSupabaseClient) {
    browserSupabaseClient = createClient(supabaseUrl, supabaseClientKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    });
  }

  return browserSupabaseClient;
}

/** Enables the local-only fallback only when explicitly requested in development. */
export function isPrototypeFallbackEnabled() {
  return (
    import.meta.env.DEV &&
    !getSupabaseConfig().enabled &&
    isEnabledFlag(import.meta.env.VITE_ENABLE_LOCAL_PROTOTYPE_FALLBACK)
  );
}

/** Explains how to proceed when browser Supabase configuration is missing. */
export function getMissingSupabaseConfigMessage() {
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

/** Builds the shared auth headers for browser reads and function calls. */
export function createSupabaseAuthHeaders(supabaseClientKey: string) {
  return {
    apikey: supabaseClientKey,
    Authorization: `Bearer ${supabaseClientKey}`,
  };
}

/** Extracts a useful error message from a Supabase-backed browser response. */
export async function readSupabaseErrorMessage(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as SupabaseBrowserErrorPayload;
    return payload.error ?? payload.message ?? fallback;
  } catch {
    return fallback;
  }
}
