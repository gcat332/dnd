# Character Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove a real three-character KayKit slice on the Battle Map with five normalized animations, state-driven equipment, accepted presentation-event VFX, controlled-orbit readability, reproducible licences, and enforceable browser asset budgets.

**Architecture:** Normalize one Knight, Mage, and Skeleton offline into immutable GLB Character Recipes with a small shared runtime contract. `CharacterModel` clones each skinned scene, owns animation transitions, and mounts equipment into standardized sockets; `CharacterToken` adapts accepted Token/equipment state to presentation without becoming rules authority. A presentation-event layer renders deterministic melee, spell, hit, and heal effects, deduplicated by stable event ID.

**Tech Stack:** Blender glTF export, GLB/glTF 2.0, Meshopt, KTX2 when measured, React 19, TypeScript 7, Three.js 0.185.1, React Three Fiber 9.6.1, Drei 10.7.7, `@gltf-transform/*` 4.4.1, meshoptimizer 1.2.0, Vitest, React Three Test Renderer, Playwright.

## Global Constraints

- Execute only after Tasks 1–4 of `2026-07-12-controlled-orbit-camera-extension.md`; final physical-device acceptance may be measured with both features together.
- KayKit Knight, Mage, and Skeleton are CC0 technical-slice assets, not Taleforge's permanent Hero/Demon Lord identity.
- Runtime humanoid clips are exactly `idle`, `move`, `attack`, `hit`, and `death`; `move` is in-place and animation never commits Grid Cell position.
- Equipment slots are exactly `socket_main_hand`, `socket_off_hand`, `socket_back`, and `socket_head`; accepted equipment state selects visuals, while inventory legality and damage remain outside the renderer.
- Hero/NPC limits: at most 12,000 render triangles, 2 skinned meshes, 2 materials/draw calls, 60 deformation bones, 4 influences per vertex, one 512x512 runtime atlas, and 1.5 MB compressed GLB.
- Common-monster limits: at most 8,000 triangles, 2 skinned meshes, 2 materials/draw calls, 50 bones, 4 influences, one 512x512 atlas, and 1.0 MB compressed GLB.
- The first three character GLBs total at most 4 MB compressed. Source archives and editable `.blend` files never enter `public/`; only approved runtime derivatives and licence records do.
- Initial mixer policy profiles 32–40 nearby active skeletal mixers; distant idle animation is paused or throttled and overview presentation may be static.
- VFX may reduce particles/lights by quality tier but never decides hit, damage, saving throws, conditions, visibility permission, or resources.
- Validate at yaw 0/90/180/270 and pitch 35/55/90 degrees in the real orthographic scene.

---

## File Structure

```text
app/
  .asset-workbench/                         # ignored source archives and .blend files
  asset-records/characters/
    kaykit-source-provenance.json           # archive hashes; tracked, not served
  public/assets/characters/
    asset-manifest.json                     # runtime recipe/provenance index
    LICENSES.md
    kaykit-knight.glb
    kaykit-mage.glb
    kaykit-skeleton.glb
    equipment/{sword,shield,staff,wand,axe,helmet}.glb
  scripts/
    record-asset-provenance.mjs              # archive SHA-256 and source record
    validate-character-assets.mjs            # glTF/budget/contract gate
  src/battle-map/characters/
    contract.ts
    contract.test.ts
    characterManifest.ts
    characterManifest.test.ts
    CharacterModel.tsx
    CharacterModel.test.tsx
    CharacterToken.tsx
    CharacterToken.test.tsx
    CharacterSlice.tsx
  src/battle-map/effects/
    presentationEvents.ts
    presentationEvents.test.ts
    CharacterEffects.tsx
    CharacterEffects.test.tsx
  src/battle-map/BattleMapCanvas.tsx
  tests/e2e/character-vertical-slice.spec.ts
docs/research/character-vertical-slice-results.md
```

### Task 1: Reproducible CC0 asset intake and validation gate

**Files:**
- Modify: `app/.gitignore`
- Modify: `app/package.json`
- Modify: `app/package-lock.json`
- Create: `app/scripts/record-asset-provenance.mjs`
- Create: `app/scripts/validate-character-assets.mjs`
- Create: `app/public/assets/characters/asset-manifest.json`
- Create: `app/public/assets/characters/LICENSES.md`
- Create: normalized GLBs listed in File Structure

**Interfaces:**
- Produces manifest schema version `1`, three `CharacterAssetRecord`s and six `EquipmentAssetRecord`s.
- Produces commands `npm run assets:provenance` and `npm run assets:validate`; later tasks treat validation failure as a hard gate.

- [ ] **Step 1: Isolate source workbench and install audit tooling**

Add `.asset-workbench/` to `app/.gitignore`, then run:

```bash
cd app
npm install --save-dev @gltf-transform/core@4.4.1 @gltf-transform/extensions@4.4.1 @gltf-transform/functions@4.4.1 @gltf-transform/cli@4.4.1 meshoptimizer@1.2.0
```

Add scripts:

```json
"assets:provenance": "node scripts/record-asset-provenance.mjs",
"assets:validate": "node scripts/validate-character-assets.mjs"
```

- [ ] **Step 2: Acquire the exact CC0 source versions**

Download the free tiers from the official KayKit pages into:

```text
app/.asset-workbench/kaykit/archives/adventurers-free-2.0.zip
app/.asset-workbench/kaykit/archives/skeletons-free-1.1.zip
app/.asset-workbench/kaykit/archives/character-animations-free-1.1.zip
```

Sources:

- `https://kaylousberg.itch.io/kaykit-adventurers`
- `https://kaylousberg.itch.io/kaykit-skeletons`
- `https://kaylousberg.itch.io/kaykit-character-animations`

Do not substitute paid tiers or a marketplace mirror. Preserve each included licence file alongside the extracted archive.

- [ ] **Step 3: Implement generated provenance**

`record-asset-provenance.mjs` reads the three exact archive paths, computes
SHA-256 with `node:crypto`, and writes the tracked, non-public
`asset-records/characters/kaykit-source-provenance.json` containing source ID,
official URL, advertised version, download date supplied as required CLI
argument `--download-date=YYYY-MM-DD`, archive filename, byte size, and computed
hash. It exits nonzero if a file is absent or the date is invalid; it never
writes an invented hash.

Run: `npm run assets:provenance -- --download-date=2026-07-12`

Expected: three records with 64-character lowercase SHA-256 values.

- [ ] **Step 4: Normalize the runtime assets in Blender**

Create one editable file per character under `.asset-workbench/kaykit/blender/`. Import the matching KayKit model plus Rig_Medium animation sources, use meters and ground-centered origin, retain no hidden geometry, cap weights at four, and create the four socket bones with exact names from Global Constraints.

Map and rename source actions to exactly:

| Runtime clip | Knight | Mage | Skeleton |
| --- | --- | --- | --- |
| `idle` | combat idle | spell/combat idle | skeleton combat idle |
| `move` | in-place walk | in-place walk | skeleton in-place walk |
| `attack` | one-hand horizontal slice | spellcast shoot | one-hand chop |
| `hit` | first hit reaction | first hit reaction | skeleton hit reaction |
| `death` | first death | first death | skeleton death |

Export one self-contained GLB per character and one static GLB per listed equipment item. Bake at 30 fps, remove root translation from `move`, remove unused actions/tracks/materials/bones, and downsample the shared color atlas to 512x512. Preserve contact/release timing in `asset-manifest.json` as normalized clip time `0..1`.

- [ ] **Step 5: Write the concrete runtime manifest and licence record**

Use this top-level shape with no nullable source fields:

```json
{
  "schemaVersion": 1,
  "characters": [
    { "id": "kaykit-knight", "role": "player", "url": "/assets/characters/kaykit-knight.glb", "rig": "kaykit-medium", "attackEventTime": 0.55 },
    { "id": "kaykit-mage", "role": "npc", "url": "/assets/characters/kaykit-mage.glb", "rig": "kaykit-medium", "attackEventTime": 0.62 },
    { "id": "kaykit-skeleton", "role": "monster", "url": "/assets/characters/kaykit-skeleton.glb", "rig": "kaykit-medium", "attackEventTime": 0.48 }
  ],
  "equipment": [
    { "id": "sword", "allowedSlots": ["mainHand", "back"], "url": "/assets/characters/equipment/sword.glb" },
    { "id": "shield", "allowedSlots": ["offHand"], "url": "/assets/characters/equipment/shield.glb" },
    { "id": "staff", "allowedSlots": ["mainHand", "back"], "url": "/assets/characters/equipment/staff.glb" },
    { "id": "wand", "allowedSlots": ["mainHand", "back"], "url": "/assets/characters/equipment/wand.glb" },
    { "id": "axe", "allowedSlots": ["mainHand", "back"], "url": "/assets/characters/equipment/axe.glb" },
    { "id": "helmet", "allowedSlots": ["head"], "url": "/assets/characters/equipment/helmet.glb" }
  ]
}
```

`LICENSES.md` records the three official pages, exact versions, CC0 1.0 URL,
download date, and points to the tracked provenance record. Do not claim KayKit
art as Taleforge original art.

- [ ] **Step 6: Implement the GLB audit**

Use glTF Transform `NodeIO` with `ALL_EXTENSIONS` and Meshopt decoder. For every character, assert file size and total across the slice, exactly five animation names, all four socket nodes, triangle/material/skin/joint limits by role, at most four joint influences per vertex, finite accessor values, and textures no larger than 512x512. For equipment, assert no skin/animation and at most one material. Print a compact per-file table and exit 1 on any violation.

- [ ] **Step 7: Run the gate and commit**

Run: `cd app && npm run assets:validate`

Expected: nine PASS rows, three character GLBs totaling at most 4 MB.

```bash
git add app/.gitignore app/package.json app/package-lock.json app/scripts app/asset-records app/public/assets/characters
git commit -m "Add validated KayKit character slice assets"
```

### Task 2: Runtime character and equipment contracts

**Files:**
- Create: `app/src/battle-map/characters/contract.ts`
- Create: `app/src/battle-map/characters/contract.test.ts`
- Create: `app/src/battle-map/characters/characterManifest.ts`
- Create: `app/src/battle-map/characters/characterManifest.test.ts`

**Interfaces:**
- Produces `CharacterAnimationName`, `EquipmentSlot`, `EquippedVisuals`, `CharacterRecipe`, `EquipmentRecipe`, `CharacterPresentationState`, `getCharacterRecipe(id)`, and `getEquipmentRecipe(id)`.

- [ ] **Step 1: Write failing contract tests**

Assert the only animation names are `idle/move/attack/hit/death`, equipment slot JSON keys map to the four socket names, all manifest IDs and URLs are unique, every URL is root-relative, attack timing is within `[0,1]`, and these states parse:

```ts
{
  recipeId: 'kaykit-knight',
  animation: 'idle',
  facingRadians: 0,
  equipment: { mainHand: 'sword', offHand: 'shield', back: null, head: 'helmet' },
}
```

Invalid recipe, animation, equipment-slot mismatch, non-finite facing, or unknown item must fail with a descriptive result rather than a cast.

- [ ] **Step 2: Implement closed unions and parsers**

Use readonly data and structured type guards; do not derive IDs from filenames. Export:

```ts
export const CHARACTER_ANIMATIONS = ['idle', 'move', 'attack', 'hit', 'death'] as const
export const EQUIPMENT_SOCKET = {
  mainHand: 'socket_main_hand', offHand: 'socket_off_hand',
  back: 'socket_back', head: 'socket_head',
} as const
```

Import `asset-manifest.json`, validate it once at module load, index it into readonly maps, and throw a startup error containing the bad record ID if repository-owned manifest data violates the contract.

- [ ] **Step 3: Verify and commit**

Run: `cd app && npm test -- src/battle-map/characters/contract.test.ts src/battle-map/characters/characterManifest.test.ts`

Expected: all focused tests PASS.

```bash
git add app/src/battle-map/characters
git commit -m "Define character presentation contracts"
```

### Task 3: Animated skinned models with state-driven equipment

**Files:**
- Create: `app/src/battle-map/characters/CharacterModel.tsx`
- Create: `app/src/battle-map/characters/CharacterModel.test.tsx`
- Create: `app/src/battle-map/characters/CharacterToken.tsx`
- Create: `app/src/battle-map/characters/CharacterToken.test.tsx`
- Modify: `app/src/battle-map/scene/TokenLayer.tsx`
- Modify: `app/src/battle-map/scene/TokenLayer.test.tsx`

**Interfaces:**
- Produces `CharacterModel({ state, onAttackEvent?, onAnimationComplete? })` and optional `character?: CharacterPresentationState` on `TokenRenderState`.
- Preserves primitive `TokenMesh` fallback when `character` is absent or an asset load fails.

- [ ] **Step 1: Write failing animation/equipment tests**

Mock `useGLTF` only at the file-loading boundary with a real Three `Group`, `SkinnedMesh`, five `AnimationClip`s, and four named socket nodes. Assert the selected clip plays, the previous action cross-fades over 0.12 seconds, loop modes are repeat for idle/move and once with clamp for attack/hit/death, and an attack callback fires once when mixer time crosses recipe `attackEventTime`.

Render Knight equipment, rerender from sword/shield to axe/no off-hand, and assert `socket_main_hand` contains only axe while `socket_off_hand` is empty. Assert cleanup removes cloned equipment without disposing cached source assets.

- [ ] **Step 2: Implement clone-safe animation ownership**

Load the recipe with `useGLTF`, clone its scene with `SkeletonUtils.clone` in `useMemo`, and bind `useAnimations` to that clone. Validate clips and socket nodes defensively; throw an `AssetContractError` naming the recipe and missing member so the nearest character fallback can render a primitive Token.

On animation change, reset/fade/play the next action and fade out the previous action. Keep movement in-place. Stop actions and uncouple mixer listeners on cleanup. Track attack marker crossings per animation invocation so React rerenders cannot duplicate the presentation event.

- [ ] **Step 3: Implement equipment attachment**

Each `EquipmentAttachment` loads and clones one static equipment GLB, verifies
the requested slot is in `allowedSlots`, resolves the socket from
`EQUIPMENT_SOCKET`, and attaches the asset with identity local transform. The
offline export owns equipment origin and orientation. Invalidate after attach
and remove it on cleanup. Never infer equipment from animation or mesh name.

- [ ] **Step 4: Adapt Token rendering**

Extend `TokenRenderState` with optional validated character state. `CharacterToken` uses `gridToWorld`, accepted elevation/facing, selection scale/ring, and `CharacterModel`; Token drag/picking remains on a stable invisible cylinder hit target so model topology does not change interaction. `TokenLayer` chooses `CharacterToken` only when character state is present, retaining `AnimatedToken` interpolation and primitive fallback.

- [ ] **Step 5: Verify and commit**

Run: `cd app && npm test -- src/battle-map/characters src/battle-map/scene/TokenLayer.test.tsx`

Expected: all focused tests PASS with no WebGL requirement.

```bash
git add app/src/battle-map/characters app/src/battle-map/domain/tokens.ts app/src/battle-map/scene/TokenLayer.tsx app/src/battle-map/scene/TokenLayer.test.tsx
git commit -m "Render animated equipped characters"
```

### Task 4: Accepted combat presentation events and VFX

**Files:**
- Create: `app/src/battle-map/effects/presentationEvents.ts`
- Create: `app/src/battle-map/effects/presentationEvents.test.ts`
- Create: `app/src/battle-map/effects/CharacterEffects.tsx`
- Create: `app/src/battle-map/effects/CharacterEffects.test.tsx`
- Modify: `app/src/battle-map/scene/BattleMapScene.tsx`
- Modify: `app/src/battle-map/scene/BattleMapScene.test.tsx`

**Interfaces:**
- Produces `CharacterPresentationEvent` with effect IDs `melee_slash`, `fire_projectile`, `hit_burst`, and `heal_pulse`; `reducePresentationEvents(current, incoming, nowMs)` deduplicates by stable ID and expires completed events.
- Produces `CharacterEffects({ events, visibleTokenIds, particleScale })`; an
  event renders only when its source and non-null target are viewer-visible.
- Adds `presentationEvents?: readonly CharacterPresentationEvent[]` to `BattleMapScene`.

- [ ] **Step 1: Write failing reducer tests**

Test stable-ID deduplication across reconnect replay, chronological deterministic ordering, expiry at `startedAtMs + durationMs`, rejection of missing source/target positions, and preservation of the same domain payload at high/low quality.

- [ ] **Step 2: Implement the presentation-only contract**

Use readonly discriminated data:

```ts
type CharacterPresentationEvent = Readonly<{
  id: string
  effectId: 'melee_slash' | 'fire_projectile' | 'hit_burst' | 'heal_pulse'
  sourceTokenId: string
  targetTokenId: string | null
  source: WorldPoint
  target: WorldPoint
  startedAtMs: number
  durationMs: number
}>
```

No damage, roll, hit chance, status, resource, or rules fields belong in this type.

- [ ] **Step 3: Implement quality-scaled effects**

Render slash as a short-lived oriented arc mesh, fire as an interpolated emissive projectile plus impact burst, hit as an expanding ring, and heal as rising green/gold particles. All transforms derive from normalized event time. `particleScale` changes secondary particle counts only; core projectile/impact timing remains identical. Dispose per-effect geometry/materials on expiry and invalidate only while effects are active.

- [ ] **Step 4: Integrate scene ordering and verify**

Render `CharacterEffects` after Tokens and before visibility compositing so fog
remains the final permission mask. Pass a set derived only from visible Tokens.
Add scene tests proving an event referencing a hidden source or target is
filtered even if a stale event reaches the renderer, and low quality retains
the core effect.

Run: `cd app && npm test -- src/battle-map/effects src/battle-map/scene/BattleMapScene.test.tsx`

Expected: all focused tests PASS.

```bash
git add app/src/battle-map/effects app/src/battle-map/scene/BattleMapScene.tsx app/src/battle-map/scene/BattleMapScene.test.tsx
git commit -m "Add character combat presentation effects"
```

### Task 5: Three-character harness and acceptance evidence

**Files:**
- Create: `app/src/battle-map/characters/CharacterSlice.tsx`
- Modify: `app/src/battle-map/BattleMapCanvas.tsx`
- Create: `app/tests/e2e/character-vertical-slice.spec.ts`
- Create: `docs/research/character-vertical-slice-results.md`

**Interfaces:**
- `?characters=1` activates deterministic Knight/Mage/Skeleton fixtures and hidden `character-slice-diagnostics`; normal harness and production map behavior remain unchanged.

- [ ] **Step 1: Build the deterministic slice**

Place Knight at `(98,100)` with sword, shield, and helmet; Mage at `(101,100)`
with staff; and Skeleton at `(104,100)` with axe. Add harness-only events to
switch each normalized animation, stow Knight's sword on the back while
equipping the axe in the main hand, cast Mage fire, apply Skeleton hit/death,
and play heal. This exercises main-hand, off-hand, back, and head sockets.
Diagnostics expose loaded recipe IDs, current animations, equipped IDs,
emitted/active event IDs, mixer count, asset error count, and renderer metrics.

- [ ] **Step 2: Write browser acceptance tests**

Across Chromium, Firefox, and WebKit, assert:

1. all three GLBs load with zero asset errors and render nonblank pixels;
2. idle/move/attack/hit/death transitions complete without changing accepted Grid Cells;
3. sword-to-axe state change replaces the visible attachment and keeps the off-hand shield;
4. attack marker emits exactly one slash/fire event and replayed event IDs do not duplicate VFX;
5. models, selected labels, rings, and equipment remain readable at yaw 0/90/180/270 and pitch 35/55/90;
6. context loss/retry reloads characters once without duplicate mixers or attachments; and
7. missing optional equipment produces a neutral fallback visual while the
   Token stays usable.

Use diagnostics and canvas-pixel regions for behavior, plus named screenshots for the 12 angle combinations. Do not approve from screenshot appearance alone.

- [ ] **Step 3: Profile the mixer policy**

Add a stress mode that clones the three recipes into 40 nearby animated Tokens and fills the remaining interactive-object budget with static or throttled presentation. Record first-load bytes, decode time, mixer CPU time, frame time, draw calls, triangles, textures, and GPU-resource lower bound at high/low quality. Confirm distant/overview mixers pause without changing Token domain state.

- [ ] **Step 4: Run all automated gates**

```bash
cd app
npm run assets:validate
npm test
npm run build
npm run test:e2e
git diff --check
```

Expected: asset audit passes, all Vitest/Playwright tests pass, build exits 0, and diff check is empty.

- [ ] **Step 5: Run physical desktop/tablet review and record the decision**

At 35/55/90 pitch and representative yaw, record role recognition, facing, weapon recognition, label/ring occlusion, animation timing, cutaway interaction, load time, average FPS, p95 frame time, and input latency. Test 3-character normal mode and 40-mixer stress mode. Require 60 FPS representative desktop and at least 30 FPS representative tablet before approving mass production.

Write `character-vertical-slice-results.md` with exact device/browser versions, asset audit table, screenshots, measurements, pass/fail per gate, and one of: `pipeline accepted for signature commission` or `pipeline not accepted`. Do not choose or purchase a permanent catalogue in this task.

- [ ] **Step 6: Commit evidence**

```bash
git add app/src/battle-map/characters/CharacterSlice.tsx app/src/battle-map/BattleMapCanvas.tsx app/tests/e2e/character-vertical-slice.spec.ts docs/research/character-vertical-slice-results.md
git commit -m "Prove character vertical slice"
```
