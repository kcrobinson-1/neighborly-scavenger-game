# Admin Module

## Purpose

This folder owns the authenticated organizer/admin shell inside the existing web
app.

It is responsible for:

- restoring the browser auth session for `/admin`
- reacting to Supabase auth changes
- keeping route-level admin auth state out of the attendee quiz module

## Boundaries

- keep login/session concerns here, not inside attendee pages
- keep draft reads, admin RPC calls, and authoring function calls in
  `src/lib/adminQuizApi.ts`
- keep quiz correctness and publish validation out of this module; those remain
  shared/backend responsibilities
