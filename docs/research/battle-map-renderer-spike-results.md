# Battle Map Renderer Spike Results

Date: 2026-07-11

## Result

The Three.js/React Three Fiber spike passes its functional browser gates but does not pass the measured performance release gates in this environment. The deterministic stress scene contains exactly 200 interactive Token/prop records, representative walls, exactly four total shadow-casting lights (one directional and three point lights), active fog, 24 continuously reissued Token animations, and a concurrent animated particle effect. Adaptive quality settled on `low` for both measured profiles.

The desktop 60 FPS target failed under headless SwiftShader at 16.05 FPS. The tablet 30 FPS target failed in Playwright viewport/DPR emulation at 18.96 FPS. The tablet result is emulated and is not a real-device claim. Physical tablet validation at 30 FPS or better remains an unpassed release gate.

## Environment

| Device | Browser | Viewport | DPR | GPU |
| --- | --- | ---: | ---: | --- |
| MacBook Pro (Mac15,6, Apple M3 Pro, 18 GB), headless desktop profile | Chromium 149.0.7827.55 | 1440 x 900 | 1 | ANGLE Vulkan SwiftShader (LLVM 10.0.0) |
| Playwright tablet emulation on the same MacBook Pro host | Chromium 149.0.7827.55 | 820 x 1180 | 2 emulated; adaptive renderer DPR 1 | ANGLE Vulkan SwiftShader (LLVM 10.0.0) |

Both rows were collected on macOS 26.5.2. SwiftShader is a software GPU and is not representative of the Apple M3 Pro physical GPU.

## Measurements

Measurements were read after 16 seconds of adaptive-quality settling, then five pointer samples were generated with four clicks and one drag on known `stress-object-050`. The renderer still reported 24 active Token animations at capture. FPS and P95 frame time use the rolling five-second window.

| Device | Quality | Average FPS | P95 frame time | Draw calls | Triangles | Textures | Scene-resource lower bound | P95 chunk latency | P95 pointer-to-rendered-frame latency |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Headless desktop | low | 16.05 | 79.00 ms | 249 | 26,082 | 31 | 647,156 bytes (0.617 MiB) | 6.00 ms | 6.90 ms |
| Tablet emulation | low | 18.96 | 70.20 ms | 239 | 24,802 | 31 | 455,668 bytes (0.435 MiB) | 4.60 ms | 5.30 ms |

The scene-resource value is a defensible lower-bound estimate, not a GPU allocation reading. It traverses the rendered scene, deduplicates `BufferGeometry` objects and their unique attribute/index array buffers, and adds their actual byte lengths. It also deduplicates scene-referenced textures and uses source-data byte lengths when present, otherwise source width x height x actual format channel count x component-type byte width. It excludes driver alignment, uploaded mip levels, shadow/render targets, shader programs, framebuffer storage, and driver bookkeeping, so it must not be interpreted as total GPU memory or a memory PASS result.

The pointer metric measures time from the canvas `pointerdown` handler to the first subsequent R3F rendered-frame callback. It is not end-to-end input-to-photon latency and does not include display scanout. Both rows use five samples and report their P95. Both runs rendered 200 objects with committed Token checksum `5d44613b`.

## Quality And Recovery Gates

- Hysteresis requires two consecutive five-second candidate windows, resets when the candidate changes, and clears without oscillation when the current quality returns.
- High quality applies actual device-capped DPR, four 2048 shadow maps, enabled `PCFShadowMap`, 48 particles, and `ACESFilmicToneMapping` output processing.
- Low quality applies renderer DPR 1, four 512 shadow maps, disabled shadows, 12 particles, and `NoToneMapping`. WebKit's DPR 2 profile verifies the actual renderer changes from DPR 2 to 1.
- Output processing is implemented as renderer-consumed tone mapping; no unused post-processing diagnostic is claimed.
- Native `WEBGL_lose_context` loss/restore passed in Chromium 149, Firefox 151, and WebKit 26.5.
- Forced synthetic loss plus `Retry renderer` increments the renderer generation, remounts the Canvas, preserves the committed Token checksum, and returns a nonblank canvas in all three browsers.
- The stress fixture drag produces a real MoveIntent for `stress-object-050`.
- Responsive canvas and toolbar rectangles do not intersect at 1440 x 900, 1024 x 768, and 820 x 1180. Nonblank pixel checks pass at every viewport in all three browsers.

## Target Decisions

| Gate | Result |
| --- | --- |
| Exactly 200 interactive objects with concurrent movement/effect animation | PASS |
| Applied adaptive renderer state | PASS |
| Native and forced renderer recovery in three browsers | PASS |
| Responsive non-overlap/nonblank canvas in three browsers | PASS |
| Complete Playwright matrix | PASS: 30/30 |
| Desktop 60 FPS | FAIL in headless SwiftShader: 16.05 FPS |
| Tablet 30 FPS | FAIL in Playwright emulation: 18.96 FPS |
| Physical tablet 30 FPS | NOT RUN; unpassed release gate |

## Reproduction And Warnings

```bash
npm --prefix prototypes/battle-map-renderer run build
npm --prefix prototypes/battle-map-renderer test
npm --prefix prototypes/battle-map-renderer run test:e2e
```

The production build retains Vite's warning that the renderer bundle exceeds 500 kB. Browser tests retain React Three Fiber's upstream `THREE.Clock` deprecation warning. Neither warning changes the performance gate failures above.

## Recommendation

**Revise and rerun the scene.** Reduce draw calls, with instancing as the first candidate, then profile on the agreed physical mid-range desktop and tablet. Do not accept Three.js/R3F or revisit Babylon.js from SwiftShader data alone. Acceptance still requires a physical tablet result of at least 30 FPS.
