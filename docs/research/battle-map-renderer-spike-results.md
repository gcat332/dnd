# Battle Map Renderer Spike Results

Date: 2026-07-11

## Result

The spike proves the Three.js/React Three Fiber renderer's functional shape, but it does not pass the performance release gate in this environment. The deterministic stress scene contains exactly 200 interactive Token/prop records, representative walls, four shadow-casting lights, active fog, and concurrent Token/effect animation. Adaptive quality settled on `low` for both measured profiles.

The desktop 60 FPS target failed under headless SwiftShader at 8.96 FPS. The tablet 30 FPS target also failed in Playwright viewport/DPR emulation at 13.20 FPS. The tablet result is emulated, not a real-device claim. Physical tablet validation at 30 FPS or better remains an unpassed release gate.

## Environment

| Device | Browser | Viewport | DPR | GPU |
| --- | --- | ---: | ---: | --- |
| MacBook Pro (Mac15,6, Apple M3 Pro, 18 GB), headless desktop profile | Chromium 149.0.7827.55 | 1440 x 900 | 1 | ANGLE Vulkan SwiftShader (LLVM 10.0.0) |
| Playwright tablet emulation on the same MacBook Pro host | Chromium 149.0.7827.55 | 820 x 1180 | 2 emulated; adaptive renderer DPR 1 | ANGLE Vulkan SwiftShader (LLVM 10.0.0) |

Both rows were collected on macOS 26.5.2. SwiftShader is a software GPU and is not representative of the Apple M3 Pro's physical GPU performance.

## Measurements

Measurements were read from the hidden renderer diagnostics after 16 seconds of adaptive-quality settling and a one-second input-latency sample. FPS and P95 frame time use the monitor's rolling five-second window.

| Device | Quality | Average FPS | P95 frame time | Draw calls | Texture count | GPU-memory estimate | P95 chunk latency | P95 input latency |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Headless desktop | low | 8.96 | 263.50 ms | 249 | 32 | 130.39 MiB | 11.80 ms | 1.50 ms |
| Tablet emulation | low | 13.20 | 88.30 ms | 239 | 32 | 130.27 MiB | 10.50 ms | 1.40 ms |

GPU memory is an estimate, not a driver allocation reading: `texture count * 4 MiB + triangles * 3 vertices * 32 bytes`. The renderer reported 26,082 triangles on desktop and 24,802 triangles in tablet emulation. Both runs reported 200 objects and the same committed Token checksum, `5d44613b`.

## Quality And Recovery Gates

- High, medium, and low quality policies apply the required DPR caps, shadow map sizes, soft-shadow switch, particle scales, and post-processing switch.
- Quality changes require two consecutive five-second windows at the new level.
- Forced low quality was verified in Chromium, Firefox, and WebKit diagnostics.
- `WEBGL_lose_context` was available in Chromium 149, Firefox 151, and WebKit 26.5.
- Context loss, recovery UI, context restoration, unchanged committed Token checksum, and nonblank restored canvas passed in all three browsers.
- Responsive framing and canvas pixel checks passed at 1440 x 900, 1024 x 768, and 820 x 1180 in Chromium, Firefox, and WebKit.

## Target Decisions

| Gate | Result |
| --- | --- |
| Exactly 200 interactive objects | PASS |
| Desktop 60 FPS | FAIL in headless SwiftShader: 8.96 FPS |
| Tablet 30 FPS | FAIL in Playwright emulation: 13.20 FPS |
| Physical tablet 30 FPS | NOT RUN; unpassed release gate |
| Three-browser context recovery | PASS |
| Three-browser responsive/nonblank canvas | PASS |

## Observed Failures

The performance targets are the only observed spike-gate failures. Reproduce the functional and diagnostic path with:

```bash
npm --prefix prototypes/battle-map-renderer run dev -- --host 127.0.0.1 --port 4173
# Open http://127.0.0.1:4173/?stress=1 and inspect
# [data-testid="scene-performance-diagnostics"] after adaptive quality settles.
```

Run the automated quality, recovery, and responsive checks with:

```bash
npm --prefix prototypes/battle-map-renderer run test:e2e -- performance-and-recovery.spec.ts responsive-framing.spec.ts
```

The production build also retains Vite's warning that the renderer bundle exceeds 500 kB. Browser tests retain React Three Fiber's upstream `THREE.Clock` deprecation warning.

The exact full `npm run test:e2e` matrix observed two established WebKit-only regression failures outside the Task 8 gates: Token drag did not produce its preview diagnostic, and an explored visibility probe sampled black. One five-worker run also exposed and removed a profiler-test assumption that at least 16 frames would arrive within ten seconds; the SwiftShader run produced 12 complete samples. Reproduce the remaining WebKit failures with:

```bash
npm --prefix prototypes/battle-map-renderer run test:e2e -- token-interaction.spec.ts visibility-lighting.spec.ts --project=webkit --workers=1
```

They remained reproducible in isolation. The new WebKit performance/recovery and responsive-framing tests passed in the same runs, so no global canvas-pixel tolerance was weakened. These failures must be resolved before treating the complete three-browser renderer suite as green.

## Recommendation

**Revise and rerun the scene.** Reduce the stress scene's draw-call cost, with instancing as the first candidate, then profile on the agreed physical mid-range desktop and tablet. Do not accept Three.js/R3F or revisit Babylon.js from SwiftShader data alone. Acceptance still requires a physical tablet result of at least 30 FPS.
