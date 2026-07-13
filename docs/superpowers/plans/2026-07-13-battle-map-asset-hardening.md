# Battle Map Asset Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current ready-made 2.5D environment asset slice into a validated, pan-safe, data-driven battle-map visual layer that is ready for the next production content pass.

**Architecture:** Keep GLB as the runtime interchange format and keep the existing `BiomeDetailLayer` as a visual-only layer. First add a repository-owned environment asset contract and browser acceptance evidence; then feed biome selection from persisted battle-map terrain metadata instead of the fixture classifier. Preserve a bounded fallback path so maps remain readable when optional detail assets fail to load.

**Tech Stack:** React 19, TypeScript, Three.js 0.185, React Three Fiber/Drei, Vite, Vitest, Playwright, glTF Transform CLI.

## Global Constraints

- Battle Map remains a fixed 200x200 coordinate space rendered as an adjustable orthographic 2.5D tabletop.
- Runtime assets stay under `app/public/assets/environment/`; source archives stay in ignored `app/.asset-workbench/`.
- Environment assets must remain CC0/public-domain or have a checked-in license record before entering the runtime bundle.
- Do not reintroduce a full freely navigable 3D world, marketplace assets, or a second rendering stack.
- Preserve the character acceptance gate and `npm test`/`npm run build` as required checks.

---

### Task 1: Add an Environment Asset Validation Gate

**Files:**
- Create: `app/scripts/validate-environment-assets.mjs`
- Create: `app/src/battle-map/scene/environmentAssetManifest.ts`
- Modify: `app/package.json`
- Test: `app/src/battle-map/scene/environmentAssetManifest.test.ts`
- Modify: `app/public/assets/environment/asset-manifest.json`
- Modify: `app/public/assets/environment/LICENSES.md`

**Interfaces:**
- Produces `npm run assets:validate:environment`.
- Reads the manifest records `{ id, biome, url, source, license }` and validates each referenced GLB exists, is glTF binary version 2, and stays under the environment byte budget of 400,000 bytes per file.
- The test imports the manifest through the parser exported from `app/src/battle-map/scene/environmentAssetManifest.ts`.

- [ ] **Step 1: Write the failing manifest contract test**

```ts
it('accepts every runtime environment asset and rejects missing or non-CC0 records', () => {
  const manifest = readEnvironmentAssetManifest()
  expect(manifest.assets.length).toBeGreaterThanOrEqual(6)
  expect(manifest.assets.every((asset) => asset.url.startsWith('/assets/environment/'))).toBe(true)
  expect(manifest.assets.every((asset) => asset.license === 'CC0-1.0')).toBe(true)
})
```

- [ ] **Step 2: Run the focused test and verify it fails because the parser/gate is absent**

Run: `cd app && npx vitest run src/battle-map/scene/environmentAssetManifest.test.ts`

Expected: FAIL with the missing module or missing validation function.

- [ ] **Step 3: Implement the parser and CLI validator**

Export a readonly parser that validates `schemaVersion === 1`, non-empty IDs/URLs, unique IDs, and `license === 'CC0-1.0'`. The Node validator must resolve each URL against `app/public`, inspect the first four GLB bytes (`glTF`) and version bytes (`02 00 00 00`), then check `stat.size <= 400_000`. Exit non-zero with the asset ID and reason for any violation.

Add the script to `app/package.json`:

```json
"assets:validate:environment": "node scripts/validate-environment-assets.mjs"
```

- [ ] **Step 4: Run the focused test and validator**

Run: `cd app && npx vitest run src/battle-map/scene/environmentAssetManifest.test.ts && npm run assets:validate:environment`

Expected: the test passes and the validator reports all six environment assets valid.

- [ ] **Step 5: Commit**

```bash
git add app/scripts/validate-environment-assets.mjs app/src/battle-map/scene/environmentAssetManifest.ts app/src/battle-map/scene/environmentAssetManifest.test.ts app/package.json app/public/assets/environment/asset-manifest.json app/public/assets/environment/LICENSES.md
git commit -m "Validate battle map environment assets"
```

### Task 2: Make Detail Placement Pan-Safe and Bounded

**Files:**
- Modify: `app/src/battle-map/scene/BiomeDetailLayer.tsx`
- Modify: `app/src/battle-map/scene/BattleMapScene.tsx`
- Test: `app/src/battle-map/scene/BiomeDetailLayer.test.tsx`

**Interfaces:**
- Keep `BiomeDetailLayer({ visibleChunks, focus, enabled })` as the public component contract.
- Extract a pure `environmentPlacements(visibleChunks, focus)` function returning bounded arrays for `grass`, `forest`, `road`, `water`, and `mountain`.
- Enforce hard caps of `42` grass, `28` forest, `14` rocks, `8` rivers, and `4` mountains in the visible detail window; choose nearest placements to `focus` before slicing.

- [ ] **Step 1: Add failing placement tests for focus changes and caps**

```ts
it('keeps placements near the active camera focus instead of the first prefetched chunk', () => {
  const near = environmentPlacements(CHUNKS, { x: 100, z: 100 })
  const moved = environmentPlacements(CHUNKS, { x: 180, z: 180 })
  expect(near.forest[0]).not.toEqual(moved.forest[0])
  expect(Math.abs(moved.forest[0]!.x - 180)).toBeLessThan(48)
  expect(moved.grass.length).toBeLessThanOrEqual(42)
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `cd app && npx vitest run src/battle-map/scene/BiomeDetailLayer.test.tsx`

Expected: FAIL until the pure function is exported.

- [ ] **Step 3: Extract the pure function and keep GLB loading in the React shell**

Move deterministic placement generation out of the component, keep `useGLTF`/`SkeletonUtils.clone` inside `AssetInstances`, and ensure a changed focus invalidates only the bounded placement list. Do not create one clone per prefetched map cell.

- [ ] **Step 4: Run unit/build checks**

Run: `cd app && npx vitest run src/battle-map/scene/BiomeDetailLayer.test.tsx src/battle-map/scene/BattleMapScene.test.tsx && npm run build`

Expected: focused tests pass and TypeScript/Vite build passes.

- [ ] **Step 5: Commit**

```bash
git add app/src/battle-map/scene/BiomeDetailLayer.tsx app/src/battle-map/scene/BattleMapScene.tsx app/src/battle-map/scene/BiomeDetailLayer.test.tsx
git commit -m "Bound battle map environment detail placements"
```

### Task 3: Add Browser Acceptance Evidence for Assets and Pan Gestures

**Files:**
- Create: `app/tests/e2e/environment-assets.spec.ts`
- Modify: `app/playwright.config.ts` only if the existing harness web server needs the `npm run dev:harness` command documented.

**Interfaces:**
- Use the existing harness URL `/?characters=1&manual=1` and `data-testid="battle-map-canvas"`.
- Assert runtime asset requests return HTTP 200 and the canvas remains nonblank after detail assets load.
- Assert a right-button orbit and middle-button pan still work over a token and after a camera move; this protects the camera/asset layering contract.

- [ ] **Step 1: Write the failing browser assertions**

```ts
test('renders environment GLBs and keeps the canvas readable after pan', async ({ page }) => {
  const assetResponse = page.waitForResponse((response) => response.url().endsWith('/assets/environment/kaykit-tree.glb'))
  await page.goto('/?characters=1&manual=1')
  await expect((await assetResponse).status()).toBe(200)
  await expect.poll(() => page.locator('[data-testid="battle-map-canvas"] canvas').count()).toBe(1)
  await page.waitForTimeout(1500)
  const before = await page.locator('[data-testid="battle-map-canvas"] canvas').screenshot()
  await page.mouse.move(720, 460)
  await page.mouse.down({ button: 'middle' })
  await page.mouse.move(780, 500)
  await page.mouse.up({ button: 'middle' })
  const after = await page.locator('[data-testid="battle-map-canvas"] canvas').screenshot()
  expect(Buffer.compare(before, after)).not.toBe(0)
})
```

- [ ] **Step 2: Run the focused browser test and verify the new assertion fails or exposes the current gap**

Run: `cd app && npx playwright test tests/e2e/environment-assets.spec.ts --project=chromium`

- [ ] **Step 3: Implement only the minimum harness/test hooks needed**

Use existing camera controls and diagnostics; do not add visible instructional UI. If a canvas pixel assertion is too timing-sensitive, poll for the existing scene diagnostics or object-count marker before sampling pixels.

- [ ] **Step 4: Run the focused browser test plus existing orbit/character gates**

Run: `cd app && npx playwright test tests/e2e/environment-assets.spec.ts tests/e2e/controlled-orbit-camera.spec.ts tests/e2e/character-vertical-slice.spec.ts --project=chromium`

Expected: all focused Chromium tests pass with no asset request failures.

- [ ] **Step 5: Commit**

```bash
git add app/tests/e2e/environment-assets.spec.ts app/playwright.config.ts
git commit -m "Cover environment assets and map gestures in the browser"
```

### Task 4: Replace Fixture Biomes with Persisted Terrain Metadata

**Files:**
- Modify: `app/src/battle-maps/terrain.ts`
- Modify: `app/src/battle-map/scene/BiomeDetailLayer.tsx`
- Modify: `app/src/battle-map/scene/BattleMapScene.tsx`
- Modify: `app/src/battle-map/fixtures/createChunkTexture.ts`
- Test: `app/src/battle-maps/terrain.test.ts`
- Test: `app/src/battle-map/scene/BiomeDetailLayer.test.tsx`

**Interfaces:**
- Extend the persisted terrain feature contract with an optional `biome` union: `'grass' | 'forest' | 'water' | 'road' | 'mountain'`.
- Add a pure `terrainBiomeAt(features, worldX, worldZ)` query that returns the explicit feature biome when the point lies in a feature, then the map's grass default. Keep `createChunkTexture` using the same query so flat colors and 3D detail cannot disagree.
- Preserve old rows without `biome` by returning the existing grass default; do not migrate fixture-only classifier rules into production data.

- [ ] **Step 1: Add failing terrain contract tests**

```ts
it('uses persisted biome metadata for detail and base texture colors', () => {
  const features = [{ id: 'river-1', kind: 'platform', biome: 'water', column: 147, row: 80, widthCells: 8, depthCells: 40, heightCells: 1 }]
  expect(terrainBiomeAt(features, 151, 100)).toBe('water')
  expect(terrainBiomeAt(features, 20, 20)).toBe('grass')
})
```

- [ ] **Step 2: Run focused terrain tests and verify they fail**

Run: `cd app && npx vitest run src/battle-maps/terrain.test.ts src/battle-map/scene/BiomeDetailLayer.test.tsx`

Expected: FAIL because the optional biome field and query are not yet present.

- [ ] **Step 3: Implement the shared metadata query**

Use the existing terrain bounds/intersection helpers from `app/src/battle-maps/terrain.ts`. Make explicit `biome` metadata authoritative, use `kind` only for backwards-compatible inference, and fall back to grass. Pass the query inputs into `BiomeDetailLayer`; remove its direct import of the fixture-only classifier for production map rendering.

- [ ] **Step 4: Verify persisted-map and fixture compatibility**

Run: `cd app && npm test -- --run && npm run build`

Expected: all existing tests pass, including malformed persisted terrain parsing, and the build remains clean.

- [ ] **Step 5: Commit**

```bash
git add app/src/battle-maps/terrain.ts app/src/battle-map/scene/BiomeDetailLayer.tsx app/src/battle-map/scene/BattleMapScene.tsx app/src/battle-map/fixtures/createChunkTexture.ts app/src/battle-maps/terrain.test.ts app/src/battle-map/scene/BiomeDetailLayer.test.tsx
git commit -m "Drive battle map detail from persisted biomes"
```

## Final Verification

- [ ] Run `cd app && npm run assets:validate:environment`.
- [ ] Run `cd app && npm test -- --run`.
- [ ] Run `cd app && npm run build`.
- [ ] Run the focused Chromium acceptance suite from Task 3.
- [ ] Run `git diff --check` and confirm the root `package-lock.json` remains untouched if it is still untracked.
