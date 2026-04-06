# Shared Quiz Config

## Purpose

This folder owns the shared quiz domain model used by both the web app and the
Supabase backend.

It is responsible for:

- the canonical `GameConfig` runtime shape
- answer normalization, validation, and scoring
- mapping published database rows into that canonical shape
- explicit sample fixtures used only for tests and local prototype fallback

## Module Boundaries

- `types.ts`
  Canonical shared quiz types.
- `answers.ts`
  Shared answer normalization, validation, and scoring.
- `game-validation.ts`
  Structural validation for any `GameConfig`.
- `db-content.ts`
  Maps published Supabase rows into `GameConfig`.
- `sample-games.ts`
  Raw sample fixture definitions. These are not the normal runtime source of
  content anymore.
- `catalog.ts`
  Lookup helpers over the sample fixture set.
- `sample-fixtures.ts`
  Explicit public entrypoint for sample fixtures and sample lookups.
- `index.ts`
  Shared runtime barrel for canonical types, validation, scoring, and DB-row
  mapping. Sample fixtures stay out of this barrel on purpose.

## Ownership Rules

- Keep quiz correctness, answer validation, and scoring in this folder rather
  than duplicating rules in the browser or the backend.
- Keep database loading concerns out of `answers.ts`; DB reads should happen in
  app/backend code and be mapped into `GameConfig` through `db-content.ts`.
- Treat `sample-fixtures.ts` as an explicit escape hatch for tests and local
  prototype fallback, not as the standard runtime content source.
