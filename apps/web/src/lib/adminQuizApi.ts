import type { Session } from "@supabase/supabase-js";
import {
  parseAuthoringGameDraftContent,
  type AuthoringGameDraftContent,
} from "../../../../shared/game-config";
import { routes } from "../routes";
import {
  createSupabaseAuthHeaders,
  getBrowserSupabaseClient,
  getSupabaseConfig,
  readSupabaseErrorMessage,
} from "./supabaseBrowser";

type DraftEventRow = {
  content?: AuthoringGameDraftContent;
  created_at?: string;
  id: string;
  last_saved_by?: string | null;
  live_version_number: number | null;
  name: string;
  slug: string;
  updated_at: string;
};

export type DraftEventSummary = {
  id: string;
  liveVersionNumber: number | null;
  name: string;
  slug: string;
  updatedAt: string;
};

export type DraftEventDetail = DraftEventSummary & {
  content: AuthoringGameDraftContent;
  createdAt: string;
  lastSavedBy: string | null;
};

export type PublishDraftResult = {
  eventId: string;
  publishedAt: string;
  slug: string;
  versionNumber: number;
};

export type UnpublishEventResult = {
  eventId: string;
  unpublishedAt: string;
};

function mapDraftSummary(row: DraftEventRow): DraftEventSummary {
  return {
    id: row.id,
    liveVersionNumber: row.live_version_number,
    name: row.name,
    slug: row.slug,
    updatedAt: row.updated_at,
  };
}

function createFunctionUrl(functionName: string) {
  return `${getSupabaseConfig().supabaseUrl}/functions/v1/${functionName}`;
}

async function getAdminAccessToken() {
  const session = await getAdminSession();

  if (!session?.access_token) {
    throw new Error("Admin sign-in is required.");
  }

  return session.access_token;
}

async function callAuthoringFunction<T>(
  functionName: string,
  body: Record<string, unknown>,
  fallbackMessage: string,
): Promise<T> {
  const { enabled, supabaseClientKey } = getSupabaseConfig();

  if (!enabled) {
    throw new Error("Admin authoring needs Supabase configuration.");
  }

  const accessToken = await getAdminAccessToken();
  const response = await fetch(createFunctionUrl(functionName), {
    body: JSON.stringify(body),
    credentials: "include",
    headers: {
      ...createSupabaseAuthHeaders(supabaseClientKey),
      // Authoring functions need the signed-in admin's JWT, not the publishable
      // key bearer token used for public PostgREST reads.
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await readSupabaseErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as T;
}

/** Restores the current browser auth session for the admin route. */
export async function getAdminSession(): Promise<Session | null> {
  const { data, error } = await getBrowserSupabaseClient().auth.getSession();

  if (error) {
    throw new Error("We couldn't restore the admin session right now.");
  }

  return data.session;
}

/** Subscribes to browser auth changes for the admin route. */
export function subscribeToAdminAuthState(
  onSessionChange: (session: Session | null) => void,
) {
  const { data } = getBrowserSupabaseClient().auth.onAuthStateChange(
    (_event, session) => {
      onSessionChange(session);
    },
  );

  return () => {
    data.subscription.unsubscribe();
  };
}

/** Requests a Supabase magic-link sign-in email for the admin route. */
export async function requestAdminMagicLink(email: string) {
  const { error } = await getBrowserSupabaseClient().auth.signInWithOtp({
    email: email.trim(),
    options: {
      emailRedirectTo: new URL(routes.admin, window.location.origin).toString(),
    },
  });

  if (error) {
    throw new Error(error.message || "We couldn't send the admin sign-in link.");
  }
}

/** Signs the current browser admin session out. */
export async function signOutAdmin() {
  const { error } = await getBrowserSupabaseClient().auth.signOut();

  if (error) {
    throw new Error("We couldn't sign out right now.");
  }
}

/** Checks whether the current authenticated session is allowlisted for quiz authoring. */
export async function getQuizAdminStatus() {
  const { data, error } = await getBrowserSupabaseClient().rpc("is_quiz_admin");

  if (error) {
    throw new Error("We couldn't verify admin access right now.");
  }

  return Boolean(data);
}

/** Lists the private draft events visible to an authenticated quiz admin. */
export async function listDraftEventSummaries(): Promise<DraftEventSummary[]> {
  const { data, error } = await getBrowserSupabaseClient()
    .from("quiz_event_drafts")
    .select("id,live_version_number,name,slug,updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error("We couldn't load the draft events right now.");
  }

  return (data ?? []).map((row: DraftEventRow) => mapDraftSummary(row));
}

/** Loads one private draft event document for an authenticated quiz admin. */
export async function loadDraftEvent(eventId: string): Promise<DraftEventDetail | null> {
  const { data, error } = await getBrowserSupabaseClient()
    .from("quiz_event_drafts")
    .select("content,created_at,id,last_saved_by,live_version_number,name,slug,updated_at")
    .eq("id", eventId)
    .maybeSingle<DraftEventRow>();

  if (error) {
    throw new Error("We couldn't load the draft event right now.");
  }

  if (!data) {
    return null;
  }

  return {
    ...mapDraftSummary(data),
    content: parseAuthoringGameDraftContent(data.content),
    createdAt: data.created_at ?? data.updated_at,
    lastSavedBy: data.last_saved_by ?? null,
  };
}

/** Saves a private quiz draft through the authenticated authoring function. */
export async function saveDraftEvent(
  content: AuthoringGameDraftContent,
): Promise<DraftEventSummary> {
  return await callAuthoringFunction<DraftEventSummary>(
    "save-draft",
    { content },
    "We couldn't save the draft right now.",
  );
}

/** Publishes a private draft into the live attendee-facing quiz projection. */
export async function publishDraftEvent(eventId: string): Promise<PublishDraftResult> {
  return await callAuthoringFunction<PublishDraftResult>(
    "publish-draft",
    { eventId },
    "We couldn't publish the draft right now.",
  );
}

/** Unpublishes a live quiz event without deleting draft or version history. */
export async function unpublishEvent(eventId: string): Promise<UnpublishEventResult> {
  return await callAuthoringFunction<UnpublishEventResult>(
    "unpublish-event",
    { eventId },
    "We couldn't unpublish the event right now.",
  );
}
