import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import {
  getAdminSession,
  subscribeToAdminAuthState,
} from "../lib/adminGameApi";
import {
  getMissingSupabaseConfigMessage,
  getSupabaseConfig,
} from "../lib/supabaseBrowser";

export type AdminSessionState =
  | { message: string; status: "missing_config" }
  | { status: "loading" }
  | { status: "signed_out" }
  | { email: string | null; session: Session; status: "signed_in" };

function mapSessionState(session: Session | null): AdminSessionState {
  if (!session) {
    return { status: "signed_out" };
  }

  return {
    email: session.user.email ?? null,
    session,
    status: "signed_in",
  };
}

/** Restores and subscribes to the browser admin auth session for the /admin route. */
export function useAdminSession() {
  const [state, setState] = useState<AdminSessionState>(() => {
    if (!getSupabaseConfig().enabled) {
      return {
        message: getMissingSupabaseConfigMessage(),
        status: "missing_config",
      };
    }

    return { status: "loading" };
  });

  useEffect(() => {
    if (!getSupabaseConfig().enabled) {
      return;
    }

    let isCancelled = false;

    void getAdminSession()
      .then((session) => {
        if (!isCancelled) {
          setState(mapSessionState(session));
        }
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          setState(
            error instanceof Error
              ? {
                  message: error.message,
                  status: "missing_config",
                }
              : {
                  message: "We couldn't restore the admin session right now.",
                  status: "missing_config",
                },
          );
        }
      });

    const unsubscribe = subscribeToAdminAuthState((session) => {
      if (!isCancelled) {
        setState(mapSessionState(session));
      }
    });

    return () => {
      isCancelled = true;
      unsubscribe();
    };
  }, []);

  return state;
}
