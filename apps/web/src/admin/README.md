# Admin Module

## Purpose

This folder owns the authenticated organizer/admin shell inside the existing web
app.

It is responsible for:

- restoring the browser auth session for `/admin`
- reacting to Supabase auth changes
- coordinating allowlist checks, draft summary loading, selected-event
  workspace state, selected draft detail loading, event-detail saves,
  existing-question saves, create/duplicate draft mutations, magic-link
  requests, and sign-out state for the `/admin` dashboard
- rendering the small presentational pieces used by the `/admin` route shell
- keeping route-level admin auth state out of the attendee quiz module

## Boundaries

- keep login/session concerns here, not inside attendee pages
- keep `/admin` dashboard state orchestration in `useAdminDashboard`
- keep the top-level page route adapter thin; route navigation remains in
  `src/pages/AdminPage.tsx`
- keep `/admin/events/:eventId` limited to workspace orientation,
  create/duplicate actions, event-level detail editing, and existing-question
  content editing until later question-structure, preview, and publish phases
  add their own state
- load full private draft content only after the selected event is visible in
  the authorized draft-summary list
- keep client-side draft identity and content-template helpers in
  `draftCreation.ts`; the backend remains authoritative for validation and
  uniqueness
- keep event-level form mapping and validation in `eventDetails.ts`; preserve
  draft ids and question content when saving Phase 4.3 edits
- keep existing-question form mapping and validation in `questionBuilder.ts`;
  preserve event details, question ids/order, and option ids/order when saving
  Phase 4.4.1 edits
- persist new and duplicated drafts only through the authenticated
  `save-draft` Edge Function, save event-detail and existing-question edits
  through that same function, and load full draft content only through
  authenticated draft reads
- keep draft reads, admin RPC calls, and authoring function calls in
  `src/lib/adminQuizApi.ts`
- keep quiz correctness and publish validation out of this module; those remain
  shared/backend responsibilities
- do not introduce question add/delete/reorder, option add/delete, preview,
  publish, unpublish, or live-content mutation in the admin workspace before
  their dedicated phases
