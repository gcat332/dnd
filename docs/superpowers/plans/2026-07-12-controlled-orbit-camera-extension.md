# Controlled Orbit Camera Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the validated 2.5D Battle Map with a local orthographic tabletop camera that orbits 360 degrees, pitches from 35 to 90 degrees, pans and zooms, exposes reliable presets, keeps tactical overlays readable, and fades only viewer-visible occluders.

**Architecture:** Put all angle conversion, clamping, presets, and camera-position derivation in a pure `cameraView` module. A single `ControlledOrbitCamera` component adapts Drei `MapControls` to that contract and publishes local view state to Zustand for chunk selection, overlays, diagnostics, and cutaway calculation; both the production `BattleMapView` and e2e `BattleMapCanvas` use it. Cutaway selection is a pure ray-versus-terrain calculation gated by the currently visible selected Token.

**Tech Stack:** React 19, TypeScript 7, Three.js 0.185.1, `@react-three/fiber` 9.6.1, `@react-three/drei` 10.7.7, Zustand 5.0.14, Lucide React 1.24.0, Vitest 4.1.10, React Three Test Renderer 9.1.0, Playwright 1.61.1.

## Global Constraints

- Keep one logical 200 by 200 Grid Cell coordinate space; camera movement never changes Token position, facing, movement distance, fog permission, or line of sight.
- Use an orthographic camera. Yaw is continuous through 360 degrees; pitch is measured above the table plane and clamped to 35 through 90 degrees; default pitch is 55 degrees.
- Camera state is local presentation state and is never written to Supabase or realtime campaign state.
- `North` preserves focus, pitch, and zoom while setting yaw to 0. `Top View` preserves focus, yaw, and zoom while setting pitch to 90. `Reset Camera` restores focus `{ x: 100, z: 100 }`, yaw 0, pitch 55, and zoom 4.
- Keep `frameloop="demand"` outside the existing stress harness. Every camera command and control change must invalidate the canvas.
- A selected Token may cause already-visible walls or pillars between the camera and that Token to fade. A hidden or absent Token causes no fade; cutaway never changes `VisibilityGrid` or renders a hidden Token.
- Establish right-drag orbit while preserving middle-drag pan, wheel zoom,
  one-touch empty-map pan, and two-touch dolly/orbit semantics without allowing
  a Token drag to move the camera.
- The current renderer is not production-accepted: automated functional evidence plus physical desktop/tablet performance evidence are still required.

---

## File Structure

```text
app/src/battle-map/
  camera/
    cameraView.ts                 # pure view math, defaults, presets
    cameraView.test.ts
    ControlledOrbitCamera.tsx     # sole MapControls adapter
    ControlledOrbitCamera.test.tsx
    CameraToolbar.tsx             # icon-only local camera commands
    CameraToolbar.test.tsx
    occlusion.ts                  # visible-selected-Token cutaway calculation
    occlusion.test.ts
  state/
    useBattleMapView.ts           # camera view, command, diagnostics state
    useBattleMapView.test.ts
  scene/
    BattleMapScene.tsx            # computes faded terrain IDs
    BattleMapScene.test.tsx
    DimensionalTerrain.tsx        # normal/faded material selection
    DimensionalTerrain.test.tsx
    TokenMesh.tsx                 # selected Token camera-facing label
    TokenMesh.test.tsx
  BattleMapView.tsx               # production composition uses shared controls/toolbar
  BattleMapView.test.tsx
  BattleMapCanvas.tsx             # harness uses shared controls/toolbar/diagnostics
app/src/styles.css
app/tests/e2e/controlled-orbit-camera.spec.ts
docs/research/battle-map-renderer-spike-results.md
```

### Task 1: Pure camera contract and local view state

**Files:**
- Create: `app/src/battle-map/camera/cameraView.ts`
- Create: `app/src/battle-map/camera/cameraView.test.ts`
- Modify: `app/src/battle-map/state/useBattleMapView.ts`
- Modify: `app/src/battle-map/state/useBattleMapView.test.ts`
- Modify: `app/src/battle-map/scene/BattleMapScene.tsx`
- Modify: `app/src/battle-map/scene/BattleMapScene.test.tsx`

**Interfaces:**
- Produces: `CameraView`, `CameraPreset`, `DEFAULT_CAMERA_VIEW`, `cameraPositionForView(view, distance)`, `cameraViewFromPosition(position, focus, zoom)`, `applyCameraPreset(view, preset)`, and `visibleCellSpan(viewport, zoom)`.
- Produces store methods: `publishCameraView(view, span)` and `requestCameraPreset(preset)` plus `cameraCommand: { sequence: number; preset: CameraPreset } | null`.

- [ ] **Step 1: Write failing camera-math tests**

Create tests that assert yaw normalization (`-10 -> 350`, `370 -> 10`), pitch clamping (`20 -> 35`, `100 -> 90`), a default 55-degree position round-trip within `0.001`, and exact preset behavior:

```ts
const custom = { focus: { x: 40, z: 60 }, yawDegrees: 125, pitchDegrees: 48, zoom: 12 }
expect(applyCameraPreset(custom, 'north')).toEqual({ ...custom, yawDegrees: 0 })
expect(applyCameraPreset(custom, 'top')).toEqual({ ...custom, pitchDegrees: 90 })
expect(applyCameraPreset(custom, 'reset')).toEqual(DEFAULT_CAMERA_VIEW)
expect(visibleCellSpan({ width: 1280, height: 800 }, 10)).toBe(128)
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `cd app && npm test -- src/battle-map/camera/cameraView.test.ts`

Expected: FAIL because `cameraView.ts` does not exist.

- [ ] **Step 3: Implement the pure camera contract**

Use this public shape and formulas:

```ts
export type CameraView = Readonly<{
  focus: WorldPoint
  yawDegrees: number
  pitchDegrees: number
  zoom: number
}>
export type CameraPreset = 'north' | 'top' | 'reset'
export const MIN_CAMERA_PITCH = 35
export const MAX_CAMERA_PITCH = 90
export const DEFAULT_CAMERA_VIEW: CameraView = {
  focus: { x: 100, z: 100 }, yawDegrees: 0, pitchDegrees: 55, zoom: 4,
}
```

Normalize yaw into `[0, 360)`, clamp pitch to `[35, 90]`, and derive the camera offset as:

```ts
const horizontal = distance * Math.cos(MathUtils.degToRad(pitchDegrees))
return [
  focus.x + horizontal * Math.sin(MathUtils.degToRad(yawDegrees)),
  distance * Math.sin(MathUtils.degToRad(pitchDegrees)),
  focus.z + horizontal * Math.cos(MathUtils.degToRad(yawDegrees)),
]
```

The inverse uses `atan2(offsetX, offsetZ)` for yaw and `asin(offsetY / distance)` for pitch. Reject non-finite positions, non-positive distance, zoom, or viewport dimensions with `RangeError`.

- [ ] **Step 4: Extend the Zustand store test-first**

Update its tests to prove `publishCameraView()` updates `cameraView` and `visibleCellSpan` without clearing selection/drag state, and sequential `requestCameraPreset('north')` calls produce different command sequence numbers. Replace the old `setCamera(center, span)` assertion.

- [ ] **Step 5: Implement store and scene consumers**

Replace `cameraCenter`/`setCamera` with `cameraView`/`publishCameraView`, keep `visibleCellSpan`, and make `useSceneSelection()` consume `cameraView.focus`. Update the one scene test to publish a view whose focus is `{ x: 100, z: 100 }` and span is `48`.

- [ ] **Step 6: Verify and commit**

Run: `cd app && npm test -- src/battle-map/camera/cameraView.test.ts src/battle-map/state/useBattleMapView.test.ts src/battle-map/scene/BattleMapScene.test.tsx`

Expected: all focused tests PASS.

```bash
git add app/src/battle-map/camera app/src/battle-map/state app/src/battle-map/scene/BattleMapScene.tsx app/src/battle-map/scene/BattleMapScene.test.tsx
git commit -m "Add controlled orbit camera state"
```

### Task 2: Shared Controlled Orbit adapter

**Files:**
- Create: `app/src/battle-map/camera/ControlledOrbitCamera.tsx`
- Create: `app/src/battle-map/camera/ControlledOrbitCamera.test.tsx`
- Modify: `app/src/battle-map/BattleMapView.tsx`
- Modify: `app/src/battle-map/BattleMapView.test.tsx`
- Modify: `app/src/battle-map/BattleMapCanvas.tsx`

**Interfaces:**
- Consumes: Task 1 camera contract and store command.
- Produces: `ControlledOrbitCamera({ enabled?, onReady?, onViewChange? })`; both canvases use this component and no other file renders `MapControls`.

- [ ] **Step 1: Write failing adapter tests**

Mount `ControlledOrbitCamera` with React Three Test Renderer and assert the rendered `MapControls` props include:

```ts
expect(controls.props).toMatchObject({
  enableDamping: false,
  enableRotate: true,
  minZoom: 4,
  maxZoom: 36,
  zoomSpeed: 24,
  screenSpacePanning: false,
  minPolarAngle: 0,
  maxPolarAngle: MathUtils.degToRad(55),
  mouseButtons: { LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE },
  touches: { ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_ROTATE },
})
```

Also assert `enabled` becomes false while `dragPreview` is non-null.

- [ ] **Step 2: Run RED**

Run: `cd app && npm test -- src/battle-map/camera/ControlledOrbitCamera.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the shared adapter**

Use `useThree()` for the orthographic camera, viewport size, and `invalidate`; use a `MapControlsImpl` ref. Initialize controls from `DEFAULT_CAMERA_VIEW`, publish `cameraViewFromPosition(camera.position, controls.target, camera.zoom)` and `visibleCellSpan(size, camera.zoom)` on every control change, and call `invalidate()`.

Observe `cameraCommand.sequence`. Apply the requested preset with `applyCameraPreset()`, update `controls.target`, camera position, zoom, matrices, call `controls.update()`, publish, and invalidate. Prevent the canvas `contextmenu` while mounted so right-drag orbit does not open the browser menu. Remove that listener on unmount.

At logical pitch 90, position the camera with a `0.0001` horizontal offset preserving yaw so OrbitControls avoids a polar singularity; publish logical pitch 90 after the command.

- [ ] **Step 4: Replace both old camera implementations**

Delete `BattleMapCameraControls` from `BattleMapView.tsx` and the private `BattleMapCamera` from `BattleMapCanvas.tsx`. Move harness-only warmup and screen-projection callbacks into a small `BattleMapCameraProbe` in `BattleMapCanvas.tsx`; it reads the actual camera but owns no controls. Render `ControlledOrbitCamera` in both canvases.

- [ ] **Step 5: Verify production/harness composition and commit**

Run: `cd app && npm test -- src/battle-map/camera/ControlledOrbitCamera.test.tsx src/battle-map/BattleMapView.test.tsx`

Expected: all focused tests PASS and no test expects `enableRotate: false`.

```bash
git add app/src/battle-map/camera app/src/battle-map/BattleMapView.tsx app/src/battle-map/BattleMapView.test.tsx app/src/battle-map/BattleMapCanvas.tsx
git commit -m "Share 360 degree tabletop camera controls"
```

### Task 3: Camera command toolbar

**Files:**
- Modify: `app/package.json`
- Modify: `app/package-lock.json`
- Create: `app/src/battle-map/camera/CameraToolbar.tsx`
- Create: `app/src/battle-map/camera/CameraToolbar.test.tsx`
- Modify: `app/src/battle-map/BattleMapView.tsx`
- Modify: `app/src/battle-map/BattleMapCanvas.tsx`
- Modify: `app/src/styles.css`

**Interfaces:**
- Produces: `CameraToolbar`, three icon buttons with accessible names `Face north`, `Top view`, and `Reset camera`.

- [ ] **Step 1: Install the icon dependency**

Run: `cd app && npm install lucide-react@1.24.0`

Expected: exact dependency `lucide-react: "1.24.0"` and updated lockfile.

- [ ] **Step 2: Write failing toolbar tests**

Render with Testing Library, click each accessible button, and assert the store command presets are `north`, `top`, and `reset` with increasing sequence numbers. Assert every button has a non-empty `title` tooltip and contains an SVG with `aria-hidden="true"`.

- [ ] **Step 3: Implement the icon-only toolbar**

Use Lucide `Compass`, `Scan`, and `RotateCcw` at 18px. Each `button type="button"` calls `requestCameraPreset()`, has the accessible name above, and repeats that name in `title`. Use `role="toolbar" aria-label="Camera view"`; do not add visible instructional copy.

- [ ] **Step 4: Integrate and style**

Render the toolbar as an absolute overlay at the upper-right of `.battle-map-view` and `.battle-map-viewport`, above the canvas and outside it. Use 36px square stable buttons, 6px outer radius, restrained neutral colors, focus-visible outline, and a 44px touch target at coarse-pointer media queries. Keep the effects toolbar unchanged.

- [ ] **Step 5: Verify and commit**

Run: `cd app && npm test -- src/battle-map/camera/CameraToolbar.test.tsx src/battle-map/BattleMapView.test.tsx`

Expected: all focused tests PASS.

```bash
git add app/package.json app/package-lock.json app/src/battle-map app/src/styles.css
git commit -m "Add battle map camera presets"
```

### Task 4: Viewer-safe cutaway and selected Token label

**Files:**
- Create: `app/src/battle-map/camera/occlusion.ts`
- Create: `app/src/battle-map/camera/occlusion.test.ts`
- Modify: `app/src/battle-map/scene/BattleMapScene.tsx`
- Modify: `app/src/battle-map/scene/BattleMapScene.test.tsx`
- Modify: `app/src/battle-map/scene/DimensionalTerrain.tsx`
- Modify: `app/src/battle-map/scene/DimensionalTerrain.test.tsx`
- Modify: `app/src/battle-map/scene/TokenMesh.tsx`
- Modify: `app/src/battle-map/scene/TokenMesh.test.tsx`
- Modify: `app/src/styles.css`

**Interfaces:**
- Produces: `occludingTerrainFeatureIds(features, selectedToken, cameraView): ReadonlySet<string>`.
- Adds `fadedFeatureIds?: ReadonlySet<string>` to `DimensionalTerrain`.

- [ ] **Step 1: Write failing occlusion tests**

Use a selected visible Token behind a three-cell-high wall and assert the wall ID is returned. Assert an off-axis wall, a wall behind the Token, an invisible selected Token, and `null` selection each return an empty set. Repeat at yaw 180 to prove orbit direction changes the faded wall.

- [ ] **Step 2: Run RED**

Run: `cd app && npm test -- src/battle-map/camera/occlusion.test.ts`

Expected: FAIL because `occlusion.ts` does not exist.

- [ ] **Step 3: Implement ray-box cutaway selection**

Derive camera position from `cameraPositionForView(view, 160)`. Build a `Ray` from camera to the Token world point at `token.elevation + 0.5`. For each `wall` or `pillar`, build a `Box3` from `terrainFeatureBox(feature)`, intersect the ray, and include the ID only when the hit distance is positive and strictly less than camera-to-Token distance. Return empty immediately unless `selectedToken?.visible === true`.

- [ ] **Step 4: Render faded materials without mutating shared materials**

Create immutable normal and faded material tables by `TerrainKind`; faded materials use `transparent: true`, `opacity: 0.2`, and `depthWrite: false`. `DimensionalTerrain` chooses one table per feature ID. Extend its tests to prove only the requested wall is transparent and all other terrain retains opacity 1.

- [ ] **Step 5: Wire viewer-safe selection and label**

In `BattleMapScene`, find the selected Token only from `tokens.filter(token => token.visible)`, compute faded IDs, and pass them to terrain. In `TokenMesh`, render a Drei `Html` label only for the selected Token, positioned above its model, centered, `pointerEvents: none`, and containing `token.label`. Style it as compact high-contrast tactical text with a maximum width and no layout shift. The mesh and equipment remain world-oriented; only the label is screen-facing.

- [ ] **Step 6: Verify and commit**

Run: `cd app && npm test -- src/battle-map/camera/occlusion.test.ts src/battle-map/scene/BattleMapScene.test.tsx src/battle-map/scene/DimensionalTerrain.test.tsx src/battle-map/scene/TokenMesh.test.tsx`

Expected: all focused tests PASS.

```bash
git add app/src/battle-map/camera app/src/battle-map/scene app/src/styles.css
git commit -m "Fade selected token occluders safely"
```

### Task 5: Browser evidence, regression suite, and result record

**Files:**
- Modify: `app/src/battle-map/BattleMapCanvas.tsx`
- Create: `app/tests/e2e/controlled-orbit-camera.spec.ts`
- Modify: `app/tests/e2e/responsive-framing.spec.ts`
- Modify: `docs/research/battle-map-renderer-spike-results.md`

**Interfaces:**
- Produces hidden `camera-diagnostics` fields for yaw, pitch, zoom, focus, and comma-separated faded terrain IDs; diagnostics observe real state and never drive it.

- [ ] **Step 1: Add deterministic harness evidence**

Add a fixture wall that initially lies between the default camera and `fixture-token`. Render it through `terrainFeatures`, not `stressWalls`. Add a hidden output:

```tsx
<output
  hidden
  data-testid="camera-diagnostics"
  data-yaw={cameraView.yawDegrees.toFixed(3)}
  data-pitch={cameraView.pitchDegrees.toFixed(3)}
  data-zoom={cameraView.zoom.toFixed(3)}
  data-focus={`${cameraView.focus.x.toFixed(3)}:${cameraView.focus.z.toFixed(3)}`}
  data-faded-terrain-ids={[...fadedTerrainIds].sort().join(',')}
/>
```

Expose faded IDs from the same pure calculation used by `BattleMapScene`; do not query Three.js materials from application code.

- [ ] **Step 2: Write real-browser camera tests**

Create Playwright tests that, on Chromium, Firefox, and WebKit:

1. right-drag on empty canvas and poll until yaw changes while pitch remains within 35–90;
2. wheel and middle-drag, proving zoom and focus change while Token state does not;
3. click `Top view`, `Face north`, and `Reset camera`, asserting exact logical diagnostics;
4. select the visible fixture Token, assert the fixture wall fades, orbit 180 degrees, and assert it no longer fades;
5. load `?viewer=player`, assert `hidden-token` cannot be selected and cannot cause a faded terrain ID;
6. take nonblank canvas screenshots at reset 55 degrees, shallow 35 degrees, and top view; and
7. dispatch one-pointer Token drag followed by a two-pointer empty-map gesture, proving the first moves only the Token preview and the second changes camera diagnostics.

Use diagnostic polling rather than timeouts. Add screenshot baselines only after assertions pass on all three engines.

- [ ] **Step 3: Verify responsive controls**

Extend the existing 1440x900, 1024x768, and 820x1180 test to assert the camera toolbar is fully inside the viewport and does not overlap the effects toolbar or Terrain editor controls.

- [ ] **Step 4: Run complete automated verification**

Run:

```bash
cd app
npm test
npm run build
npm run test:e2e
git diff --check
```

Expected: all Vitest tests pass, TypeScript/Vite build exits 0, every Playwright project passes, and diff check is empty.

- [ ] **Step 5: Run the physical-device gate and update evidence**

Serve the production preview on the LAN. On representative desktop Chrome/Safari and one physical tablet, record 55-degree orbit, continuous yaw, pan, pinch/two-touch orbit, Token drag separation, cutaway correctness, average FPS, p95 frame time, draw calls, and input latency. The release targets remain 60 FPS desktop and at least 30 FPS tablet. Update `battle-map-renderer-spike-results.md` with device/browser versions and measured values; do not mark Three.js/R3F accepted if either physical target is missing or failed.

- [ ] **Step 6: Commit evidence**

```bash
git add app/src/battle-map/BattleMapCanvas.tsx app/tests/e2e docs/research/battle-map-renderer-spike-results.md
git commit -m "Prove controlled orbit camera behavior"
```
