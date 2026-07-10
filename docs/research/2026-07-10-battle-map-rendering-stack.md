# Battle Map Rendering Stack Research

Date: 2026-07-10

## Question

Which browser rendering stack is the best fit for the V1 Battle Map when V1 includes:

- a square-grid 2D map as the baseline;
- a top-down 2.5D presentation with elevation, dimensional terrain/tokens, and
  shadows, but no freely navigable full-3D world;
- dynamic lighting and fog of war;
- animation;
- token selection, drag/movement, targeting, and area-effect previews; and
- a live session with 4-6 players?

This note compares renderer-facing choices only. It does not select the backend, transport, persistence, or realtime synchronization architecture.

## Recommendation

Use **Three.js with React Three Fiber (R3F)** as the Battle Map renderer.

Start V1 on **Three.js `WebGLRenderer` (WebGL 2)**, behind a small renderer-construction boundary. Do not make WebGPU a V1 dependency. Three.js now has a `WebGPURenderer` that tries WebGPU and falls back to WebGL 2, but R3F still describes this renderer path as a work in progress and not fully compatible with all Three.js features. The stable WebGL path lowers cross-browser risk while preserving a credible migration path. [Three.js `WebGPURenderer`](https://threejs.org/docs/pages/WebGPURenderer.html), [R3F Canvas: WebGPU](https://r3f.docs.pmnd.rs/api/canvas#webgpu)

Suggested renderer packages:

- `three`
- `@react-three/fiber`
- `@react-three/drei` for maintained scene helpers where they remove boilerplate
- `@react-three/test-renderer` for scene-graph and interaction unit tests
- Playwright for browser interaction, screenshot, and canvas-pixel tests

Use **glTF/GLB** as the canonical 3D interchange format and compressed textures such as **KTX2/Basis** where asset size warrants it. Three.js's `GLTFLoader` supports glTF 2.0 plus Draco, Meshopt, KTX2/Basis, GPU instancing, WebP, and AVIF-related extensions. [Three.js `GLTFLoader`](https://threejs.org/docs/pages/GLTFLoader.html)

This choice is primarily about product shape: R3F is a first-class React renderer, provides React-style pointer events over Three.js raycasting, exposes all Three.js capabilities without waiting for wrapper-specific APIs, and has a maintained helper and test ecosystem. R3F v9 pairs with React 19; if the broader app deliberately remains on React 18, R3F v8 is the matching major. [R3F introduction](https://r3f.docs.pmnd.rs/getting-started/introduction), [R3F repository and releases](https://github.com/pmndrs/react-three-fiber)

## Proposed Renderer Shape

Keep tactical state independent of renderer objects. The renderer should consume stable IDs and domain values such as grid coordinates, elevation, facing, visibility state, selected targets, movement paths, and effect templates. Three.js vectors, meshes, materials, and animation mixers should remain presentation details.

Use one R3F canvas with an orthographic camera for the tabletop view. Organize the scene into explicit layers:

1. map image/terrain and square grid;
2. walls, doors, elevation, props, and occluders;
3. tokens and token bases;
4. movement path, ruler, target markers, and area-effect previews;
5. fog/visibility compositing;
6. visual lights, shadows, particles, and transient animations.

Implement fog of war as a **per-viewer visibility texture or polygon mask** composited over the map, not as a side effect of visual lights. Visual Three.js lights and shadows can make a 2.5D scene readable, but tactical line of sight and revealed/hidden state must remain deterministic domain data. A render target or shader-driven overlay can then present that state in the top-down orthographic view. This is an architectural inference from the product requirements rather than a built-in Three.js fog-of-war feature.

For a mostly static tabletop, use R3F's `frameloop="demand"` and invalidate on camera, state, or animation changes. Reuse geometries/materials and instance repeated grid markers, props, or identical token bases. R3F documents on-demand rendering, resource reuse, adaptive pixel ratio, and instancing; Three.js `InstancedMesh` reduces draw calls, and raycasting returns an `instanceId` for picking individual instances. [R3F scaling performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance), [Three.js `InstancedMesh`](https://threejs.org/docs/pages/InstancedMesh.html), [Three.js `Raycaster`](https://threejs.org/docs/pages/Raycaster.html)

Treat OffscreenCanvas as an optimization to validate after profiling, not a baseline assumption. Three.js documents worker rendering with OffscreenCanvas but also shows the required event proxying because workers cannot access DOM input. R3F lists an offscreen package in its ecosystem, but moving a React-driven interactive scene into a worker adds coordination cost. [Three.js OffscreenCanvas guide](https://threejs.org/manual/en/offscreencanvas.html), [R3F repository ecosystem](https://github.com/pmndrs/react-three-fiber)

## Comparison

| Criterion | Three.js + React Three Fiber | Babylon.js | PixiJS + `@pixi/react` |
| --- | --- | --- | --- |
| Core fit | General-purpose 3D renderer with a mature React renderer; handles flat planes and 2.5D in one scene | Full game/rendering engine with especially broad built-in 3D systems | High-performance 2D renderer; strongest for a flat VTT |
| React integration | First-class custom React renderer; JSX scene graph, hooks, React event integration, broad helper ecosystem | Official docs show an imperative React component; declarative `react-babylonjs` is presented as a community extension | Official `@pixi/react`, production-ready, React 19/PixiJS v8 support |
| Production GPU path | Stable WebGL renderer now; WebGPU renderer can fall back to WebGL 2, but R3F calls its WebGPU path work in progress | Mature parallel WebGL/WebGPU engines; `EngineFactory` can try WebGPU, then WebGL, then null engine | Official docs recommend WebGL for production; WebGPU is feature-complete but still marked experimental/maturing |
| Picking/input | R3F pointer events over Three.js raycasting; intersections include 3D point/data and instanced-mesh IDs | CPU picking plus GPU picking; GPU picker supports thin-instance indices | Strong DOM-like federated events, custom hit areas, and efficient 2D tree hit testing |
| Lighting/shaders | Built-in 3D lights/shadows, post-processing, shader materials, and TSL/node materials | Broadest built-in lighting/shadow/render-pipeline toolset of the three; Node Material supports WebGL/WebGPU | Filters and custom WebGL/WGSL shaders, but no built-in 3D lighting or 3D scene semantics |
| Animation | Three.js clips, mixers, skeletal/morph animation; React animation ecosystem also available | Rich animation system, animation groups, skeletal/morph animation, baked vertex animation | Ticker and sprite animation are strong for 2D; 3D skeletal/scene animation is outside the core model |
| Performance primitives | Instancing, batching options, LOD, on-demand rendering, adaptive DPR; OffscreenCanvas possible | Hardware/thin instancing, baked vertex animation, GPU picking, OffscreenCanvas, extensive profiling features | Sprite batching, render groups, cache-as-texture, culling, particles, WebWorker adapter |
| Assets | Strong glTF/GLB path with common compression extensions | Strong glTF import/export and official loaders; worker-supported compressed asset paths | Excellent image/video/font/spritesheet/compressed-texture loader; not a 3D asset pipeline |
| Testability | R3F test renderer tests scene trees and events in Node; visual correctness still needs browser tests | Best engine-level headless story via `NullEngine`; project itself uses Vitest and Playwright visual/integration tests | Custom environment adapter supports headless setups; core has visual tests, but no equivalent documented React scene test renderer was found |
| License/maintenance | Three.js and R3F are MIT; both have active 2026 releases | Apache 2.0; active 2026 releases | PixiJS and `@pixi/react` are MIT; active 2026 releases |
| Main cost for this V1 | Must design tactical visibility/fog and renderer boundaries; WebGPU should be deferred | React scene ownership is less idiomatic unless adopting a community renderer; larger engine surface | 2.5D elevation and real dynamic lighting would require custom systems or a second renderer |

## Option Details

### 1. Three.js + React Three Fiber

R3F turns Three.js objects into declarative React components and sets up the scene, camera, render loop, resize handling, tone mapping, and raycast-based pointer events. Its event system supports clicks, pointer capture, propagation through occluding 3D objects, alternate event targets, and custom event computation. This maps cleanly to token selection/dragging, map panning, and DOM controls around a canvas. [How R3F works](https://r3f.docs.pmnd.rs/tutorials/how-it-works), [R3F events](https://r3f.docs.pmnd.rs/api/events)

Three.js has the primitives needed for V1 without choosing a full game engine: an orthographic camera, lights and shadow-casting lights, render targets, post-processing, shader/node materials, instanced meshes, raycasting, glTF loading, and animation mixers. The animation system supports transforms, material properties, bones, and morph targets. [Three.js docs](https://threejs.org/docs/), [Three.js animation system](https://threejs.org/manual/en/animation-system.html), [Three.js TSL](https://threejs.org/docs/pages/TSL.html)

The testing story is appropriate but layered. `@react-three/test-renderer` can inspect a scene graph, fire events, and advance frames without tying tests to Jest specifically. It does not remove the need for Playwright browser tests for shaders, texture compositing, shadows, WebGL context behavior, and pixel output. [R3F testing](https://r3f.docs.pmnd.rs/api/testing)

Risk: R3F's WebGPU documentation explicitly says the path is still a work in progress and not fully backward-compatible with all Three.js features. V1 should therefore ship on WebGL 2 and keep renderer creation plus custom materials narrow enough to test a future WebGPU variant. [R3F Canvas: WebGPU](https://r3f.docs.pmnd.rs/api/canvas#webgpu)

### 2. Babylon.js

Babylon.js is the strongest alternative if the project prioritizes an engine-first 3D workflow over idiomatic React composition. It has WebGL and WebGPU engines maintained side by side, and `EngineFactory.CreateAsync` can try WebGPU, WebGL, then the null engine. Its dynamic-lighting stack includes multiple light types, shadow generators, soft-shadow choices, cascaded shadow maps, and explicit performance controls such as freezing static shadow maps. [Babylon.js WebGPU support](https://doc.babylonjs.com/setup/support/webGPU/), [Babylon.js WebGPU engine creation/fallback](https://github.com/BabylonJS/Documentation/blob/master/content/setup/support/webGPU/webGPUBreakingChanges.md), [Babylon.js lights](https://doc.babylonjs.com/features/featuresDeepDive/lights/), [Babylon.js shadows](https://doc.babylonjs.com/features/featuresDeepDive/lights/shadows)

Its input and performance primitives are excellent. Babylon.js supports ray picking and GPU picking, including thin-instance indices; hardware instances and thin instances reduce repeated-mesh cost; baked vertex animation can move animation work to the GPU; and the engine can render in an OffscreenCanvas worker with explicitly forwarded input. [Babylon.js picking](https://doc.babylonjs.com/features/featuresDeepDive/mesh/interactions/picking_collisions), [Babylon.js instances](https://doc.babylonjs.com/features/featuresDeepDive/mesh/copies/instances/), [Babylon.js baked texture animation](https://doc.babylonjs.com/features/featuresDeepDive/animation/baked_texture_animations), [Babylon.js OffscreenCanvas](https://doc.babylonjs.com/features/featuresDeepDive/scene/offscreenCanvas)

Babylon.js also has the best documented headless engine option: `NullEngine` is explicitly intended for server-side or test use, and Babylon's own repository documents Vitest unit tests plus Playwright integration and multi-engine visual tests. [Babylon.js `NullEngine`](https://doc.babylonjs.com/setup/support/serverSide/), [Babylon.js testing/contribution guide](https://doc.babylonjs.com/contribute/toBabylon/HowToContribute)

The tradeoff is React ownership. Official Babylon.js documentation demonstrates wrapping an imperative engine/scene lifecycle in a React component and points to `react-babylonjs` as a community renderer. That is viable, but it is a less direct and less first-party React integration than R3F for a product whose controls, panels, map tools, and scene state will all live in React. [Babylon.js and React](https://doc.babylonjs.com/communityExtensions/Babylon.js%2BExternalLibraries/BabylonJS_and_ReactJS)

### 3. PixiJS + `@pixi/react`

PixiJS is an excellent choice for a 2D-only VTT. It is explicitly a 2D renderer and provides efficient sprites, graphics, text, masks, filters, batching, render groups, culling, particles, and a DOM-like mouse/touch/pointer event system with custom hit areas. Its official React renderer supports React 19 and PixiJS v8. [PixiJS introduction](https://pixijs.com/8.x/guides/getting-started/intro), [PixiJS events](https://pixijs.com/8.x/guides/components/events), [PixiJS performance tips](https://pixijs.com/8.x/guides/concepts/performance-tips), [`@pixi/react`](https://github.com/pixijs/pixi-react)

PixiJS has a credible modern platform story: WebGL is the documented production recommendation, WebGPU is available but marked experimental/maturing, and a `WebWorkerAdapter` supports worker rendering through OffscreenCanvas. Its asset manager handles images, video, fonts, JSON, spritesheets, SVG, and compressed texture formats. [PixiJS renderers](https://pixijs.com/8.x/guides/components/renderers), [PixiJS environments](https://pixijs.com/8.x/guides/concepts/environments), [PixiJS assets](https://pixijs.com/8.x/guides/components/assets)

PixiJS filters and meshes allow custom GLSL/WGSL effects, so a 2D light mask and fog overlay are practical. However, 2.5D elevation, 3D occlusion, shadow-casting lights, and glTF animation would become custom infrastructure or require mixing PixiJS with a 3D renderer. PixiJS documents how to mix it with Three.js, but that creates two scene graphs, two interaction models, and shared render-state coordination. Because 2.5D presentation and dynamic lighting are in V1, the hybrid cost outweighs PixiJS's 2D advantage. [PixiJS filters](https://pixijs.com/8.x/guides/components/filters), [PixiJS renderers: mixing with Three.js](https://pixijs.com/8.x/guides/components/renderers)

## Renderer-Facing Realtime Constraints

The 4-6 player target is not itself a GPU scalability problem. Each browser still renders one local scene. The renderer does, however, need contracts that prevent network cadence from leaking into the frame loop:

- address tokens, lights, doors, effects, and map objects by stable IDs;
- keep committed grid position separate from transient interpolated world position;
- interpolate remote movement between authoritative updates rather than coupling rendering to message arrival;
- keep selection, hover, drag preview, camera, and animation state local unless they are intentionally shared;
- receive visibility/reveal state already scoped for the current viewer;
- batch state changes per animation frame and mutate instance buffers rather than rebuilding the React scene for every pointer or network event;
- make effect timing deterministic from an event timestamp/duration, so reconnects or late messages do not restart animations incorrectly.

These constraints do not prescribe a transport. They only define a stable boundary between synchronized tabletop state and the local renderer.

## V1 Quality Gates

Before locking the renderer in an ADR, build one focused spike that proves the riskiest combined path:

- orthographic square-grid map with visible elevation and dimensional terrain;
- at least one 3D wall/door and elevated token;
- per-viewer fog/reveal mask plus moving visual light;
- token selection, drag preview, snapped movement path, target selection, and cone/circle/line templates;
- simultaneous animation of representative tokens/effects while remote-position updates are interpolated;
- adaptive pixel ratio and a low-quality lighting mode;
- browser tests on the actual supported desktop/mobile matrix, including screenshot and nonblank canvas-pixel assertions;
- a WebGL context-loss recovery state;
- profiling on an agreed low-end device with the expected maximum map texture and object counts.

The spike should use `WebGLRenderer`. A separate experimental run can exercise `WebGPURenderer`; WebGPU parity should not block the V1 renderer decision.

## Licensing And Maintenance

- Three.js and React Three Fiber use the MIT license and show active 2026 releases. [Three.js license](https://github.com/mrdoob/three.js/blob/dev/LICENSE), [Three.js releases](https://github.com/mrdoob/three.js/releases), [R3F repository/releases/license](https://github.com/pmndrs/react-three-fiber)
- Babylon.js uses Apache License 2.0 and shows active 2026 releases. [Babylon.js license](https://github.com/BabylonJS/Babylon.js/blob/master/license.md), [Babylon.js releases](https://github.com/BabylonJS/Babylon.js/releases)
- PixiJS and `@pixi/react` use the MIT license and show active 2026 releases. [PixiJS license](https://github.com/pixijs/pixijs/blob/dev/LICENSE), [PixiJS releases](https://github.com/pixijs/pixijs/releases), [`@pixi/react` repository/releases/license](https://github.com/pixijs/pixi-react)

No licensing blocker was found for using any of the three in this project. Asset licenses remain a separate concern from renderer licenses.
