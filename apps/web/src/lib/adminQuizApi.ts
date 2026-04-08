import type { Session } from "@supabase/supabase-js";
import { routes } from "../routes";
import { getBrowserSupabaseClient } from "./supabaseBrowser";

type DraftEventRow = {
  id: string;
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

  return (data ?? []).map((row: DraftEventRow) => ({
    id: row.id,
    liveVersionNumber: row.live_version_number,
    name: row.name,
    slug: row.slug,
    updatedAt: row.updated_at,
  }));
}
