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
  const adminDashboard = useAdminDashboard(selectedEventId);

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
        draftMutationState={adminDashboard.draftMutationState}
        emailInput={adminDashboard.emailInput}
        focusedQuestionId={adminDashboard.focusedQuestionId}
        hasDraftChanges={adminDashboard.hasDraftChanges}
        magicLinkState={adminDashboard.magicLinkState}
        onCancelUnpublish={adminDashboard.cancelUnpublish}
        onConfirmUnpublish={adminDashboard.confirmUnpublish}
        onCreateDraft={adminDashboard.createDraft}
        onDuplicateDraft={adminDashboard.duplicateDraft}
        onEmailInputChange={adminDashboard.setEmailInput}
        onFocusQuestion={adminDashboard.setFocusedQuestionId}
        onNavigate={onNavigate}
        onPublish={adminDashboard.publishEvent}
        onRetryDashboard={adminDashboard.retryDashboard}
        onSaveSelectedEventDetails={adminDashboard.saveSelectedEventDetails}
        onSaveSelectedQuestionContent={adminDashboard.saveSelectedQuestionContent}
        onSubmitMagicLink={adminDashboard.requestMagicLink}
        onUnpublish={adminDashboard.startUnpublish}
        publishState={adminDashboard.publishState}
        questionSaveState={adminDashboard.questionSaveState}
        selectedDraftState={adminDashboard.selectedDraftState}
        selectedEventId={selectedEventId}
        sessionState={adminDashboard.sessionState}
        unpublishState={adminDashboard.unpublishState}
      />
    </AdminPageShell>
  );
}
