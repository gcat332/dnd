# Task 4 Report: Accepted combat presentation events and VFX

Status: DONE

## Implemented

- Added the readonly `CharacterPresentationEvent` contract with the four approved effect IDs.
- Added runtime validation and `reducePresentationEvents`, which rejects malformed positions, expires at the exact end timestamp, preserves the first event for stable-ID replay deduplication, and sorts by timestamp plus byte-wise event ID.
- Added deterministic `CharacterEffects` renderers for melee slash, fire projectile and impact, hit burst, and healing pulse. `particleScale` only changes the secondary healing particle count; core effect timing is unchanged.
- Wired effects into `BattleMapScene` after `TokenLayer` and before `VisibilityLayer`. The scene derives viewer visibility only from currently visible Tokens, including stale-event filtering for both source and target IDs.

## Verification

- `cd app && npm test -- src/battle-map/effects src/battle-map/scene/BattleMapScene.test.tsx` (13 tests passed)
- `cd app && npm test` (55 files, 262 tests passed)
- `cd app && npm run build` (TypeScript and Vite build passed)
- `git diff --check` passed

## Notes

Effect geometry/materials are owned by each transient React subtree, so removal at expiry lets the R3F disposer release them. Presentation events carry no rules outcome fields and are never used to decide gameplay.
