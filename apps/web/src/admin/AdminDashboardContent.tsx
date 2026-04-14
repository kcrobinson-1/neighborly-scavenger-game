import type { FormEvent } from "react";
import type { AdminSessionState } from "./useAdminSession";
import type {
  AdminDashboardState,
  AdminMagicLinkState,
} from "./useAdminDashboard";
import { AdminEventWorkspace } from "./AdminEventWorkspace";
import { AdminSignInForm } from "./AdminSignInForm";

type AdminDashboardContentProps = {
  dashboardState: AdminDashboardState;
  emailInput: string;
  magicLinkState: AdminMagicLinkState;
  onEmailInputChange: (value: string) => void;
  onNavigate: (path: string) => void;
  onRetryDashboard: () => void;
  onSubmitMagicLink: (event: FormEvent<HTMLFormElement>) => void;
  selectedEventId?: string;
  sessionState: AdminSessionState;
};

function SignedInAs({ email }: { email: string | null }) {
  return (
    <p className="admin-signed-in-as">
      Signed in as <strong>{email ?? "unknown email"}</strong>
    </p>
  );
}

/** Renders the active admin auth, authorization, and draft-list state. */
export function AdminDashboardContent({
  dashboardState,
  emailInput,
  magicLinkState,
  onEmailInputChange,
  onNavigate,
  onRetryDashboard,
  onSubmitMagicLink,
  selectedEventId,
  sessionState,
}: AdminDashboardContentProps) {
  if (sessionState.status === "missing_config") {
    return (
      <div className="admin-state-stack">
        <h2>Admin auth needs Supabase configuration.</h2>
        <p>{sessionState.message}</p>
      </div>
    );
  }

  if (sessionState.status === "loading") {
    return (
      <div className="admin-state-stack">
        <h2>Restoring admin session</h2>
        <button className="secondary-button" disabled type="button">
          Checking session...
        </button>
      </div>
    );
  }

  if (sessionState.status === "signed_out") {
    return (
      <AdminSignInForm
        emailInput={emailInput}
        magicLinkState={magicLinkState}
        onEmailInputChange={onEmailInputChange}
        onSubmit={onSubmitMagicLink}
      />
    );
  }

  if (dashboardState.status === "loading") {
    return (
      <div className="admin-state-stack">
        <h2>Loading admin access</h2>
        <SignedInAs email={dashboardState.email} />
        <button className="secondary-button" disabled type="button">
          Loading drafts...
        </button>
      </div>
    );
  }

  if (dashboardState.status === "unauthorized") {
    return (
      <div className="admin-state-stack">
        <h2>This account is not allowlisted for quiz authoring.</h2>
        <SignedInAs email={dashboardState.email} />
        <p>
          The auth link worked, but this email does not currently have admin
          access to private quiz drafts.
        </p>
      </div>
    );
  }

  if (dashboardState.status === "error") {
    return (
      <div className="admin-state-stack">
        <h2>Admin access couldn&apos;t load right now.</h2>
        <SignedInAs email={dashboardState.email} />
        <p>{dashboardState.message}</p>
        <button
          className="secondary-button"
          onClick={onRetryDashboard}
          type="button"
        >
          Retry loading drafts
        </button>
      </div>
    );
  }

  if (dashboardState.status === "ready") {
    return (
      <div className="admin-state-stack">
        <div className="section-heading">
          <p className="eyebrow">Authenticated admin</p>
          <h2>Event workspace</h2>
        </div>
        <SignedInAs email={dashboardState.email} />
        <AdminEventWorkspace
          drafts={dashboardState.drafts}
          onNavigate={onNavigate}
          onRefresh={onRetryDashboard}
          selectedEventId={selectedEventId}
        />
      </div>
    );
  }

  return null;
}
