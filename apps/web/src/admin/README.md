# Admin Module

## Purpose

This folder owns the authenticated organizer/admin shell inside the existing web
app.

It is responsible for:

- restoring the browser auth session for `/admin`
- reacting to Supabase auth changes
- coordinating allowlist checks, draft summary loading, selected-event
  workspace state, selected draft detail loading, event-detail saves,
  existing-question and question-structure saves, create/duplicate draft
  mutations, publish/unpublish actions, magic-link requests, and sign-out
  state for the `/admin` dashboard
- rendering the small presentational pieces used by the `/admin` route shell
- keeping route-level admin auth state out of the attendee quiz module

## Boundaries

- keep login/session concerns here, not inside attendee pages
- keep `/admin` dashboard state orchestration in `useAdminDashboard`
- keep the top-level page route adapter thin; route navigation remains in
  `src/pages/AdminPage.tsx`
- keep `/admin/events/:eventId` scoped to workspace orientation,
  create/duplicate actions, event-level detail editing, existing-question
  content editing, question/option structure editing, and publish/unpublish
  with a pre-publish validation checklist
- load full private draft content only after the selected event is visible in
  the authorized draft-summary list
- keep client-side draft identity and content-template helpers in
  `draftCreation.ts`; the backend remains authoritative for validation and
  uniqueness
- keep event-level form mapping and validation in `eventDetails.ts`; preserve
  draft ids and question content when saving Phase 4.3 edits
- keep existing-question form mapping and save-time normalization in
  `questionFormMapping.ts`, and keep question/option structure transforms,
  id generation, delete guards, and correctness repair in
  `questionStructure.ts`; `questionBuilder.ts` remains a compatibility facade;
  preserve event details while saving Phase 4.4 edits
- keep selected question edits in a local draft buffer until the admin uses the
  explicit save action; structural changes do not call authoring APIs on their
  own
- persist new and duplicated drafts only through the authenticated
  `save-draft` Edge Function, save event-detail and question editor edits
  through that same function, and load full draft content only through
  authenticated draft reads
- keep draft reads, admin RPC calls, and authoring function calls in
  `src/lib/adminQuizApi.ts`
- keep publish checklist logic in `publishChecklist.ts`; it runs the five
  semantic content checks as independent pass/fail items so the UI can name
  each blocker; the backend remains authoritative for structural validation
  and slug uniqueness
- keep `usePreviewSession` (Phase 4.5, deferred) in this module when it
  lands; it must not modify production `useQuizSession`
