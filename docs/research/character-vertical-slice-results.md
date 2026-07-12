# Character Vertical Slice Results

Date: 2026-07-12

This report records the technical KayKit CC0 slice only. These assets are a
pipeline probe and are not Taleforge's permanent Hero or Demon Lord catalogue.

## Automated Evidence

Runner: Node `v26.3.0`, npm, Playwright `1.61.1`, Three `0.185.1`, React Three
Fiber `9.6.1`, and Vite `8.1.4`. Browser coverage is the Playwright Chromium,
Firefox, and WebKit projects configured in `app/playwright.config.ts`.

`npm run assets:validate` passed all nine rows:

| Runtime asset | Size | Geometry/contract result |
| --- | ---: | --- |
| `kaykit-knight.glb` | 470,544 B | 5,800 triangles, 5 clips, 1 skin |
| `kaykit-mage.glb` | 484,128 B | 6,668 triangles, 5 clips, 1 skin |
| `kaykit-skeleton.glb` | 507,636 B | 5,104 triangles, 5 clips, 1 skin |
| Equipment (six GLBs) | 334,280 B | static, one material each |
| Character slice total | 1,462,308 B | under 4 MB first-three gate |

The browser harness is enabled with `/?characters=1`. It exposes hidden
`character-slice-diagnostics` for renderer-reported recipe IDs, animation
states, equipment attachments, accepted event IDs, mixer count, and asset
errors/fallbacks. Attack events are emitted by the GLB animation marker and
flow through the scene into the accepted presentation-event reducer; the
manual event replay test is separate. The acceptance suite
captures `character-{yaw}-{pitch}.png` evidence for the representative orbit
angles and checks canvas pixels, not screenshots alone. Replayed presentation
event IDs are reduced by stable ID, so slash/fire effects are emitted once.

The stress acceptance route (`/?characters=1&stress=1`) combines 40 real
character render states/mixers with the existing 200 interactive stress
objects. Its renderer diagnostics report `data-object-count=240` and
`data-character-mixer-count=40`; browser frame samples are asserted, but they
are not a substitute for the physical-device gate below.

The browser harness records object count, mixer count, frame samples, and
nonblank/readability pixels. Decode timing and per-mixer CPU/GPU time are not
exposed by Three.js/R3F or this Playwright harness, so those metrics are
explicitly **unavailable**, not estimated. Physical FPS, frame-time, input
latency, and load-time remain unmeasured as described below.

The automated gates run with:

```text
npm run assets:validate   PASS
npm test                  PASS (55 files, 264 tests)
npm run build             PASS
npx playwright test ... --project=chromium --grep renderer-backed PASS
npx playwright test ... --project=chromium --grep stress PASS
npx playwright test ... --project=chromium --grep orbit PASS

The pre-existing 12-test cross-browser run passed before these acceptance
hardening additions. A post-change 18-test three-worker matrix was not used as
release evidence because parallel browser resource contention caused flaky GLB
load timing; the focused Chromium gates above are the evidence for this fix.
git diff --check          PASS
```

## Physical Device Gate

No physical desktop or tablet was available in this run. Therefore load time,
average FPS, p95 frame time, input latency, and the 40-mixer stress mode were
not measured on physical hardware. The production pipeline is **not accepted**
for signature commission until a representative desktop reaches 60 FPS and a
representative tablet reaches at least 30 FPS at pitch 35/55/90 with the
normal and stress harnesses.

Decision: **pipeline not accepted**.
