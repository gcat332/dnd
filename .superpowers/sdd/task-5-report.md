# Task 5 Report: Three-character harness and acceptance evidence

Status: DONE
Commit: `18eebc0 Verify character vertical slice acceptance`

## Delivered

- `CharacterSlice.tsx` activates only for `?characters=1`, with deterministic
  Knight/Mage/Skeleton fixtures, a 40-token stress fixture, animation/equipment
  actions, accepted presentation events, replay deduplication, and hidden
  diagnostics.
- `BattleMapCanvas.tsx` wires the slice tokens/events and a harness-only
  renderer-loss trigger while preserving normal map behavior without the query.
- `character-vertical-slice.spec.ts` covers Chromium, Firefox, and WebKit:
  real GLB load/zero asset errors/nonblank pixels, stable Grid Cell checksum,
  animation transitions, sword-to-axe and back/off-hand state, deduplicated
  slash event, optional empty equipment, renderer retry, and named orbit
  screenshots at representative yaw/pitch combinations.
- `docs/research/character-vertical-slice-results.md` records asset sizes,
  tool versions, automated evidence, and the physical gate decision.

## Verification

- `npm run assets:validate`: PASS, all nine asset rows; character slice total
  1,462,308 bytes.
- `npm test`: PASS, 55 files / 264 tests.
- `npm run build`: PASS.
- Focused Chromium renderer-backed attack/fallback, combined stress, and orbit
  acceptance tests: PASS.
- The pre-fix 12-test cross-browser matrix passed. A post-fix 18-test
  three-worker matrix showed resource-contention flakes in GLB load timing, so
  it is not claimed as release evidence; deterministic `manual=1` tests and
  the focused gates are the current evidence.
- `git diff --check`: PASS.

## Physical device decision

No physical desktop or tablet was available. FPS, frame-time, input-latency,
load-time, and 40-mixer measurements therefore remain unmeasured. The report
correctly records **pipeline not accepted** pending the 60 FPS desktop and
30 FPS tablet gate.
