# Admin Module

## Purpose

This folder owns the authenticated organizer/admin shell inside the existing web
app.

It is responsible for:

- restoring the browser auth session for `/admin`
- reacting to Supabase auth changes
- coordinating allowlist checks, draft summary loading, selected-event
  workspace state, magic-link requests, and sign-out state for the `/admin`
  dashboard
- rendering the small presentational pieces used by the `/admin` route shell
- keeping route-level admin auth state out of the attendee quiz module

## Boundaries

- keep login/session concerns here, not inside attendee pages
- keep `/admin` dashboard state orchestration in `useAdminDashboard`
- keep the top-level page route adapter thin; route navigation remains in
  `src/pages/AdminPage.tsx`
- keep `/admin/events/:eventId` read-only until the later editor, preview, and
  publish phases add mutation-specific state
- keep draft reads, admin RPC calls, and authoring function calls in
  `src/lib/adminQuizApi.ts`
- keep quiz correctness and publish validation out of this module; those remain
  shared/backend responsibilities
