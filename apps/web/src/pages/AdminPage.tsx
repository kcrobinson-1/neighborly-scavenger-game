import { useEffect, useState } from "react";
import { useAdminSession } from "../admin/useAdminSession";
import {
  getQuizAdminStatus,
  listDraftEventSummaries,
  requestAdminMagicLink,
  signOutAdmin,
  type DraftEventSummary,
} from "../lib/adminQuizApi";
import { routes } from "../routes";

type AdminPageProps = {
  onNavigate: (path: string) => void;
};

type DashboardState =
  | { status: "idle" }
  | { email: string | null; status: "loading" }
  | { email: string | null; message: string; status: "error" }
  | { email: string | null; status: "unauthorized" }
  | { drafts: DraftEventSummary[]; email: string | null; status: "ready" };

function formatSavedAt(timestamp: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

/** Minimal authenticated admin shell for quiz authoring access and draft visibility. */
export function AdminPage({ onNavigate }: AdminPageProps) {
  const sessionState = useAdminSession();
  const [emailInput, setEmailInput] = useState("");
  const [magicLinkState, setMagicLinkState] = useState<{
    message: string | null;
    status: "idle" | "error" | "pending" | "success";
  }>({
    message: null,
    status: "idle",
  });
  const [dashboardState, setDashboardState] = useState<DashboardState>({
    status: "idle",
  });
  const [reloadToken, setReloadToken] = useState(0);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    if (sessionState.status !== "signed_in") {
      setDashboardState({ status: "idle" });
      return;
    }

    let isCancelled = false;

    setDashboardState({
      email: sessionState.email,
      status: "loading",
    });

    void getQuizAdminStatus()
      .then(async (isAdmin) => {
        if (isCancelled) {
          return;
        }

        if (!isAdmin) {
          setDashboardState({
            email: sessionState.email,
            status: "unauthorized",
          });
          return;
        }

        const drafts = await listDraftEventSummaries();

        if (!isCancelled) {
          setDashboardState({
            drafts,
            email: sessionState.email,
            status: "ready",
          });
        }
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          setDashboardState({
            email: sessionState.email,
            message:
              error instanceof Error
                ? error.message
                : "We couldn't load the admin dashboard right now.",
            status: "error",
          });
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [reloadToken, sessionState]);

  const requestMagicLink = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!emailInput.trim()) {
      setMagicLinkState({
        message: "Enter the email address that should receive the sign-in link.",
        status: "error",
      });
      return;
    }

    setMagicLinkState({
      message: null,
      status: "pending",
    });

    try {
      await requestAdminMagicLink(emailInput);
      setMagicLinkState({
        message: "Check your email for the admin sign-in link.",
        status: "success",
      });
    } catch (error: unknown) {
      setMagicLinkState({
        message:
          error instanceof Error
            ? error.message
            : "We couldn't send the admin sign-in link.",
        status: "error",
      });
    }
  };

  const handleSignOut = async () => {
    setSignOutError(null);
    setIsSigningOut(true);

    try {
      await signOutAdmin();
    } catch (error: unknown) {
      setSignOutError(
        error instanceof Error
          ? error.message
          : "We couldn't sign out right now.",
      );
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <section className="admin-layout">
      <nav className="sample-nav">
        <button
          className="text-link"
          onClick={() => onNavigate(routes.home)}
          type="button"
        >
          Back to demo overview
        </button>
      </nav>

      <section className="app-card">
        <header className="topbar">
          <div>
            <p className="eyebrow">Admin authoring</p>
            <h1>Quiz draft access</h1>
          </div>
          {sessionState.status === "signed_in" ? (
            <button
              className="secondary-button admin-signout-button"
              disabled={isSigningOut}
              onClick={handleSignOut}
              type="button"
            >
              {isSigningOut ? "Signing out..." : "Sign out"}
            </button>
          ) : null}
        </header>

        <section className="panel admin-panel">
          <div className="admin-copy">
            <span className="chip">Phase 2 admin shell</span>
            <p>
              This route proves the auth and authorization model for private quiz
              drafts. Editing and publish controls still land in Phase 3.
            </p>
          </div>

          {signOutError ? <p className="admin-message admin-message-error">{signOutError}</p> : null}

          {sessionState.status === "missing_config" ? (
            <div className="admin-state-stack">
              <h2>Admin auth needs Supabase configuration.</h2>
              <p>{sessionState.message}</p>
            </div>
          ) : null}

          {sessionState.status === "loading" ? (
            <div className="admin-state-stack">
              <h2>Restoring admin session</h2>
              <button className="secondary-button" disabled type="button">
                Checking session...
              </button>
            </div>
          ) : null}

          {sessionState.status === "signed_out" ? (
            <div className="admin-state-stack">
              <div className="section-heading">
                <p className="eyebrow">Magic-link sign-in</p>
                <h2>Send a sign-in link to an admin email.</h2>
              </div>
              <form className="admin-form" onSubmit={requestMagicLink}>
                <label className="admin-field" htmlFor="admin-email">
                  <span className="admin-field-label">Admin email</span>
                  <input
                    autoComplete="email"
                    className="admin-input"
                    id="admin-email"
                    name="email"
                    onChange={(event) => setEmailInput(event.target.value)}
                    placeholder="admin@example.com"
                    type="email"
                    value={emailInput}
                  />
                </label>
                <button
                  className="primary-button"
                  disabled={magicLinkState.status === "pending"}
                  type="submit"
                >
                  {magicLinkState.status === "pending"
                    ? "Sending sign-in link..."
                    : "Email sign-in link"}
                </button>
              </form>
              {magicLinkState.message ? (
                <p
                  className={
                    magicLinkState.status === "error"
                      ? "admin-message admin-message-error"
                      : "admin-message admin-message-success"
                  }
                >
                  {magicLinkState.message}
                </p>
              ) : null}
            </div>
          ) : null}

          {sessionState.status === "signed_in" && dashboardState.status === "loading" ? (
            <div className="admin-state-stack">
              <h2>Loading admin access</h2>
              <p className="admin-signed-in-as">
                Signed in as <strong>{dashboardState.email ?? "unknown email"}</strong>
              </p>
              <button className="secondary-button" disabled type="button">
                Loading drafts...
              </button>
            </div>
          ) : null}

          {sessionState.status === "signed_in" && dashboardState.status === "unauthorized" ? (
            <div className="admin-state-stack">
              <h2>This account is not allowlisted for quiz authoring.</h2>
              <p className="admin-signed-in-as">
                Signed in as <strong>{dashboardState.email ?? "unknown email"}</strong>
              </p>
              <p>
                The auth link worked, but this email does not currently have admin
                access to private quiz drafts.
              </p>
            </div>
          ) : null}

          {sessionState.status === "signed_in" && dashboardState.status === "error" ? (
            <div className="admin-state-stack">
              <h2>Admin access couldn&apos;t load right now.</h2>
              <p className="admin-signed-in-as">
                Signed in as <strong>{dashboardState.email ?? "unknown email"}</strong>
              </p>
              <p>{dashboardState.message}</p>
              <button
                className="secondary-button"
                onClick={() => setReloadToken((value) => value + 1)}
                type="button"
              >
                Retry loading drafts
              </button>
            </div>
          ) : null}

          {sessionState.status === "signed_in" && dashboardState.status === "ready" ? (
            <div className="admin-state-stack">
              <div className="section-heading">
                <p className="eyebrow">Authenticated admin</p>
                <h2>Private draft events</h2>
              </div>
              <p className="admin-signed-in-as">
                Signed in as <strong>{dashboardState.email ?? "unknown email"}</strong>
              </p>
              <button
                className="secondary-button admin-refresh-button"
                onClick={() => setReloadToken((value) => value + 1)}
                type="button"
              >
                Refresh draft list
              </button>
              <div className="draft-list">
                {dashboardState.drafts.map((draft) => (
                  <article className="draft-row" key={draft.id}>
                    <div className="draft-row-copy">
                      <div className="draft-row-header">
                        <h3>{draft.name}</h3>
                        <span className="chip">
                          {draft.liveVersionNumber
                            ? `Live v${draft.liveVersionNumber}`
                            : "Draft only"}
                        </span>
                      </div>
                      <p className="draft-row-meta">
                        <strong>Slug:</strong> {draft.slug}
                      </p>
                      <p className="draft-row-meta">
                        <strong>Last saved:</strong> {formatSavedAt(draft.updatedAt)}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </section>
    </section>
  );
}
