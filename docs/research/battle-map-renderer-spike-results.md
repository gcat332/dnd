# Battle Map Renderer Spike Results

Date: 2026-07-11

## Result

The Three.js/React Three Fiber spike passes its functional browser gates but does not pass the measured performance release gates in this environment. The deterministic stress scene contains exactly 200 interactive Token/prop records, representative walls, exactly four total shadow-casting lights (one directional and three point lights), active fog, 24 continuously reissued Token animations, and a concurrent animated particle effect. Adaptive quality settled on `low` for both measured profiles.

The desktop 60 FPS target failed under headless SwiftShader at 16.61 FPS. The tablet 30 FPS target failed in Playwright viewport/DPR emulation at 20.01 FPS. These are CI diagnostics collected with a software GPU, not physical-device results. The tablet result is emulated and is not a real-device claim. Physical tablet validation at 30 FPS or better remains an unpassed release gate.

## Environment

| Device | Browser | Viewport | DPR | GPU |
| --- | --- | ---: | ---: | --- |
| MacBook Pro (Mac15,6, Apple M3 Pro, 18 GB), headless desktop profile | Chromium 149.0.7827.55 | 1440 x 900 | 1 | ANGLE Vulkan SwiftShader (LLVM 10.0.0) |
| Playwright tablet emulation on the same MacBook Pro host | Chromium 149.0.7827.55 | 820 x 1180 | 2 emulated; adaptive renderer DPR 1 | ANGLE Vulkan SwiftShader (LLVM 10.0.0) |

Both rows were collected on macOS 26.5.2. SwiftShader is a software GPU and is not representative of the Apple M3 Pro physical GPU.

## Measurements

Measurements were read after 16 seconds of adaptive-quality settling, then five pointer samples were generated with one verified non-zero drag and four click-only selections on rendered `stress-object-050`. The browser test locates the rendered Token pixels near its projected cell hint, requires a distinct drag preview before release, and verifies that the four clicks do not add MoveIntents. The renderer still reported 24 active Token animations at capture. FPS and P95 frame time use the rolling five-second window.

| CI diagnostic profile | Quality | Average FPS | P95 frame time | Draw calls | Triangles | Textures | Active 2048px detail textures | Scene-resource lower bound | P95 chunk latency | P95 pointer-to-rendered-frame latency |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Headless desktop | low | 16.61 | 65.40 ms | 249 | 26,082 | 31 | 1 | 17,407,988 bytes (16.602 MiB) | 273.00 ms | 2.70 ms |
| Tablet emulation | low | 20.01 | 54.70 ms | 238 | 24,674 | 30 | 1 | 17,216,500 bytes (16.419 MiB) | 259.50 ms | 2.50 ms |

The stress/performance path assigns exactly one currently visible detail Render Chunk a maximum-class 2048 x 2048 RGBA `DataTexture`; all other visible detail chunks retain the representative 64 x 64 texture. The selected address is the chunk containing the current camera center, deterministically `3:3` in both profiles, rather than a possibly offscreen prefetch address. A `ChunkSurface.onAfterRender` callback reported address `3:3`, source dimensions 2048 x 2048, `rendered: true`, and `uploaded: true` before metrics capture in both runs. This proves the texture was attached and consumed by a completed Three.js draw, whose render path uploads a dirty texture before drawing it; it does not claim a separately timed GPU-upload duration.

Diagnostics traverse scene-referenced textures and confirmed exactly one active 2048px detail texture in both profiles. P95 chunk latency measures loader start through source creation and attachment to the `ChunkSurface`; the separate `onAfterRender` evidence proves subsequent renderer consumption. This keeps the loading, resource lower-bound, and renderer-upload evidence tied to the maximum texture class without unrealistically expanding every prefetched chunk to 2048px.

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
| Desktop 60 FPS | FAIL in headless SwiftShader CI diagnostics: 16.61 FPS |
| Tablet 30 FPS | FAIL in Playwright emulation CI diagnostics: 20.01 FPS |
| Physical tablet 30 FPS | NOT RUN; unpassed release gate |

## Reproduction And Warnings

```bash
npm --prefix prototypes/battle-map-renderer run build
npm --prefix prototypes/battle-map-renderer test
npm --prefix prototypes/battle-map-renderer run test:e2e
```

Playwright's managed server executes `npm run build && npm run preview -- --host 127.0.0.1 --port 4173`, with server reuse disabled, so browser and performance runs profile the production bundle served by Vite preview rather than the development server. The two Chromium measurement contexts used 1440 x 900 at DPR 1 and 820 x 1180 at emulated DPR 2, respectively, against that managed production preview.

The production build retains Vite's warning that the renderer bundle exceeds 500 kB. Browser tests retain React Three Fiber's upstream `THREE.Clock` deprecation warning. Neither warning changes the performance gate failures above.

## Recommendation

**Revise and rerun the scene.** Reduce draw calls, with instancing as the first candidate, then profile on the agreed physical mid-range desktop and tablet. Do not accept Three.js/R3F or revisit Babylon.js from SwiftShader data alone. Acceptance still requires a physical tablet result of at least 30 FPS.
