# Battle Map 2.5D Rendering Design

Date: 2026-07-10
Status: Approved for planning

## Objective

Design the V1 rendering boundary for a top-down Battle Map that remains a
square-grid tabletop while adding elevation, dimensional terrain and tokens,
dynamic lighting, shadows, fog of war, and animation.

The V1 Battle Map is 2.5D. It is not a freely navigable 3D world. The DM and
players interact with one top-down tactical coordinate space.

## V1 Experience

The Battle Map must support:

- map image upload and square-grid alignment;
- a logical map size up to 200 by 200 Grid Cells;
- multiple Battle Maps in a Campaign;
- Token creation, selection, movement, elevation, and removal;
- walls, doors, terrain, props, traps, and other occluders;
- separate DM View and Player View visibility;
- manually revealed fog of war and rules-derived visibility;
- dynamic visual lights and shadows;
- distance measurement, movement paths, target selection, and circle, cone,
  and line area-effect previews;
- animated Token movement, effects, and environmental presentation; and
- deterministic integration with Tactical Rules Automation and Session Log.

Marketplace assets are outside V1. A freely rotatable or explorable full-3D
camera is also outside this design.

## Rendering Stack

Use:

- TypeScript;
- React 19;
- Three.js on `WebGLRenderer` and WebGL 2;
- `@react-three/fiber` v9 as the React renderer;
- `@react-three/drei` for maintained helpers where they remove boilerplate;
- Zustand for local interaction and presentation state;
- `@react-three/test-renderer` for scene-graph and interaction tests;
- Vitest for deterministic logic tests; and
- Playwright for browser interaction, screenshot, and canvas-pixel tests.

Use WebP or AVIF for raster map assets. Use GLB/glTF with compressed textures
such as KTX2 when a dimensional asset warrants a 3D interchange format.

WebGPU is not a V1 dependency. Renderer construction and custom material
boundaries should remain narrow enough to evaluate Three.js WebGPU support
later without changing the tactical domain model.

Do not introduce a physics engine for tactical movement. Grid position,
elevation, collision rules, and legal movement are deterministic domain
concerns rather than physical simulation.

## Alternatives Considered

### Babylon.js

Babylon.js provides strong built-in lighting, shadows, WebGL/WebGPU support,
picking, performance tools, and headless testing. It was not selected because
the V1 product is a React application with dense controls and panels, while
Babylon's official React integration is more imperative and its declarative
renderer is community-maintained.

### PixiJS

PixiJS is a strong choice for a flat 2D tabletop. It was not selected because
elevation, shadow-casting dimensional objects, 3D occlusion, and glTF animation
would require custom infrastructure or a second renderer. A PixiJS/Three.js
hybrid would introduce two scene graphs and two interaction models.

## Domain And Renderer Boundary

The synchronized tabletop state is independent of Three.js. It uses stable
entity IDs and domain values such as:

- Grid Cell position;
- elevation and facing;
- Token ownership and visibility;
- wall, door, terrain, and occluder geometry;
- committed movement path;
- selected targets and effect templates; and
- visibility and reveal state scoped to the current viewer.

Three.js vectors, meshes, materials, render targets, animation mixers, camera
position, hover state, drag previews, and interpolated transforms are local
presentation details.

The renderer submits player intent, such as a proposed Token move. Tactical
Rules Automation validates or overrides that intent according to the Campaign
enforcement setting. Only accepted domain state becomes campaign truth. The
renderer then animates from the previous accepted state to the new state.

Remote movement updates are interpolated locally. Message timing must not
change the committed Grid Cell position or restart an effect incorrectly after
a reconnect.

## Scene Structure

Use one React Three Fiber canvas and an orthographic camera. Organize the scene
into explicit layers:

1. map surface and procedural square grid;
2. walls, doors, terrain, elevation, props, and occluders;
3. Tokens and Token bases;
4. movement paths, rulers, target markers, and area-effect previews;
5. fog and per-viewer visibility compositing; and
6. visual lights, shadows, particles, and transient animation.

The square grid is shader-rendered or batched. It must not create one React
component or mesh per Grid Cell.

Fog of war is driven by deterministic per-viewer visibility data and presented
through a texture or polygon mask. Visual lights and shadows may enrich the
scene, but they do not decide what a player is allowed to see.

## Logical Map And Render Chunks

A Battle Map is one logical coordinate space up to 200 by 200 Grid Cells. The
DM and players experience it as one continuous map.

Internally, raster detail, visibility data, and other GPU-heavy layers are
partitioned into Render Chunks. A Render Chunk has both of these limits:

- at most 32 by 32 Grid Cells; and
- at most 2048 by 2048 pixels for a single texture.

Whichever limit is reached first determines the chunk boundary. Chunking is an
implementation detail and must not leak into rules, movement, measurement,
authoring, saves, or the Session Log.

When zoomed out, the renderer uses a low-resolution overview texture covering
the full Battle Map. At closer zoom levels it loads high-resolution chunks for
the visible region and a small prefetch margin. Chunk transitions must not
produce visible gaps, grid discontinuities, or inconsistent fog.

Walls, lights, Tokens, and other interactive objects remain addressable by
stable IDs across chunk boundaries. Spatial indexing selects relevant objects
for rendering, picking, lighting, and line-of-sight queries without changing
their domain identity.

## Performance Baseline

V1 targets:

- DM use on desktop or laptop;
- Player use on desktop, laptop, or tablet;
- current Chrome, Edge, Firefox, and Safari versions with WebGL 2;
- 60 frames per second on a representative mid-range desktop;
- at least 30 frames per second on a representative tablet;
- up to 200 active interactive Tokens or props; and
- more static terrain than the interactive-object limit, subject to the spike
  performance budget.

Phone layouts may expose the Advanced Character Sheet, dice, and Session Log,
but full Battle Map interaction is not a V1 phone requirement.

Use on-demand rendering when the scene is idle. Reuse geometries and materials,
instance repeated objects, batch state changes per animation frame, and adapt
pixel ratio, shadow quality, particles, and post-processing to device
performance.

OffscreenCanvas is a profiling-led optimization, not a baseline requirement.
It must not be introduced until the main-thread implementation is measured and
shown to miss an agreed performance target.

## Loading And Failure Handling

The Battle Map must:

- show deterministic loading states for overview and detailed chunks;
- retain the last accepted tabletop state during a temporary network loss;
- distinguish an uncommitted local drag preview from synchronized state;
- retry failed asset chunks without duplicating scene objects;
- replace unavailable optional dimensional assets with a usable placeholder;
- reduce rendering quality before abandoning the session on a slow device;
- detect WebGL context loss and present a recovery action; and
- fail with a clear unsupported-device state when WebGL 2 is unavailable.

A renderer failure must not mutate or discard Campaign, Session, or Session
Save data.

## Renderer Spike

Before building the complete Battle Map, create a focused spike that proves:

- a 200 by 200 logical grid with overview and detailed chunk transitions;
- an orthographic map with dimensional terrain, a wall, a door, and an elevated
  Token;
- continuous grid alignment and picking across chunk boundaries;
- per-viewer fog and reveal data with a moving visual light;
- Token selection, drag preview, snapped movement, and target selection;
- circle, cone, and line area-effect previews;
- representative simultaneous Token and effect animations;
- interpolation of simulated remote position updates;
- adaptive pixel ratio and low-quality lighting mode;
- WebGL context-loss recovery; and
- nonblank canvas-pixel and screenshot tests on the supported browser/device
  matrix.

Profile the spike with the maximum overview size, representative high-detail
chunks, 200 active interactive objects, and a realistic number of walls and
lights. Record GPU memory, draw calls, frame time, chunk load latency, and input
latency before committing the complete implementation plan.

## Testing Strategy

Test deterministic map and rules-facing behavior without WebGL:

- Grid Cell and world-coordinate conversion;
- chunk addressing and boundary cases;
- viewport-to-visible-chunk selection;
- movement preview and accepted-state transitions;
- visibility-mask inputs;
- spatial-index queries; and
- remote interpolation timing.

Use `@react-three/test-renderer` for scene composition and pointer-event
contracts. Use Playwright on real browsers for textures, shaders, lighting,
shadows, fog compositing, chunk transitions, context recovery, responsive
framing, and canvas-pixel output.

## Research Basis

The primary-source comparison and package references are recorded in
`docs/research/2026-07-10-battle-map-rendering-stack.md`.
