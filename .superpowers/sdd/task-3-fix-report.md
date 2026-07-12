# Task 3 Review Fix Report

## Status

Implemented the demand-rendering animation fix and the fallback-boundary reset requested by review.

## Changes

- `CharacterModel` now calls R3F `invalidate()` when an action starts, then keeps requesting frames while a repeating action or unfinished one-shot action is running. One-shot actions stop requesting frames after the mixer `finished` event marks them complete.
- Attack marker detection remains in the same frame callback and now runs independently of the invalidation guard.
- `CharacterFallbackBoundary` is keyed by `recipeId`, so changing to a different character recipe remounts the boundary and clears a prior asset failure state.

## Verification

- Focused: `npm test -- src/battle-map/characters/CharacterModel.test.tsx src/battle-map/characters/CharacterToken.test.tsx` (4 passed)
- Full: `npm test` (53 files, 254 tests passed)
- Build: `npm run build` passed

No new test was added because the R3F demand-frame lifecycle is owned by the renderer; existing CharacterModel and CharacterToken tests remain green.
