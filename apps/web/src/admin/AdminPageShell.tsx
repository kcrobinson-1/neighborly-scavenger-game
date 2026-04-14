import type { ReactNode } from "react";

type AdminPageShellProps = {
  children: ReactNode;
  isSignedIn: boolean;
  isSigningOut: boolean;
  onNavigateHome: () => void;
  onSignOut: () => void;
  signOutError: string | null;
};

/** Route-level admin layout and static copy for the /admin page. */
export function AdminPageShell({
  children,
  isSignedIn,
  isSigningOut,
  onNavigateHome,
  onSignOut,
  signOutError,
}: AdminPageShellProps) {
  return (
    <section className="admin-layout">
      <nav className="sample-nav">
        <button
          className="text-link"
          onClick={onNavigateHome}
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
          {isSignedIn ? (
            <button
              className="secondary-button admin-signout-button"
              disabled={isSigningOut}
              onClick={onSignOut}
              type="button"
            >
              {isSigningOut ? "Signing out..." : "Sign out"}
            </button>
          ) : null}
        </header>

        <section className="panel admin-panel">
          <div className="admin-copy">
            <span className="chip">Admin event workspace</span>
            <p>
              Review private event drafts, open live quiz routes, and select an
              event workspace before the editing, preview, and publish phases
              land.
            </p>
          </div>

          {signOutError ? (
            <p className="admin-message admin-message-error">{signOutError}</p>
          ) : null}

          {children}
        </section>
      </section>
    </section>
  );
}
