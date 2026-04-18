# Shared Game Config

## Purpose

This folder owns the shared game domain model used by both the web app and the
Supabase backend.

It is responsible for:

- the canonical `GameConfig` runtime shape
- answer normalization, validation, and scoring
- mapping published database rows into that canonical shape
- explicit sample fixtures used only for tests and local prototype fallback

## Module Boundaries

- `types.ts`
  Canonical shared game types.
- `answers.ts`
  Shared answer normalization, validation, and scoring.
- `game-validation.ts`
  Structural validation for any `GameConfig`.
- `draft-content.ts`
  Public authoring draft contract: row types plus top-level parse/validate/map
  helpers.
- `draft-json.ts`
  Shared JSON expectation primitives used by authoring draft parsing.
- `draft-question-parsing.ts`
  Authoring question/option and enum parsing used by `draft-content.ts`.
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

- Keep game correctness, answer validation, and scoring in this folder rather
  than duplicating rules in the browser or the backend.
- Keep database loading concerns out of `answers.ts`; DB reads should happen in
  app/backend code and be mapped into `GameConfig` through `db-content.ts`.
- Keep authoring-payload parsing and canonical draft validation in
  `draft-content.ts`; future admin or AI write paths should normalize there
  before persisting or publishing.
- Treat `sample-fixtures.ts` as an explicit escape hatch for tests and local
  prototype fallback, not as the standard runtime content source.
