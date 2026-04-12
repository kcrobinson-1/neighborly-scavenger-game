## Summary

-

## Why This Is Worth Merging

Name the concrete maintainability, correctness, user, or operational value that
outweighs the added diff and review cost.

## User Behavior

Describe what a user can now do differently or what flow behaves differently.
If this is behavior-preserving, say that explicitly.

## Contract And Scope

Call out whether this changes public API contracts, status codes, response
bodies, database schema or semantics, authentication or authorization rules,
routing, production platform configuration, or generated artifacts.

## Target Shape Evidence

For behavior-preserving refactors or checklist work, describe the final
responsibility split and include concrete evidence such as before/after size or
ownership boundaries. For other changes, write `N/A`.

## Documentation

List docs or checklist updates. If none are needed, explain why.

## Validation

- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run test:functions`
- [ ] `npm run build:web`

List any additional checks run, and state any relevant checks that could not be
run.

## Remaining Risk

Name residual risk, blockers, or follow-up work. If none are known, say so.
