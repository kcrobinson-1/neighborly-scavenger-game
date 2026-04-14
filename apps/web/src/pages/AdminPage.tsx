import { AdminDashboardContent } from "../admin/AdminDashboardContent";
import { AdminPageShell } from "../admin/AdminPageShell";
import { useAdminDashboard } from "../admin/useAdminDashboard";
import { routes } from "../routes";

type AdminPageProps = {
  onNavigate: (path: string) => void;
  selectedEventId?: string;
};

/** Route adapter for the authenticated admin shell. */
export function AdminPage({ onNavigate, selectedEventId }: AdminPageProps) {
  const adminDashboard = useAdminDashboard();

  return (
    <AdminPageShell
      isSignedIn={adminDashboard.sessionState.status === "signed_in"}
      isSigningOut={adminDashboard.isSigningOut}
      onNavigateHome={() => onNavigate(routes.home)}
      onSignOut={adminDashboard.signOut}
      signOutError={adminDashboard.signOutError}
    >
      <AdminDashboardContent
        dashboardState={adminDashboard.dashboardState}
        emailInput={adminDashboard.emailInput}
        magicLinkState={adminDashboard.magicLinkState}
        onEmailInputChange={adminDashboard.setEmailInput}
        onNavigate={onNavigate}
        onRetryDashboard={adminDashboard.retryDashboard}
        onSubmitMagicLink={adminDashboard.requestMagicLink}
        selectedEventId={selectedEventId}
        sessionState={adminDashboard.sessionState}
      />
    </AdminPageShell>
  );
}
