# Battle Map Renderer Spike Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove that the approved Three.js and React Three Fiber stack can render and interact with a continuous 200 by 200 Grid Cell 2.5D Battle Map while streaming internal chunks, preserving deterministic tactical state, and meeting the V1 quality gates.

**Architecture:** Build a standalone Vite prototype under `prototypes/battle-map-renderer` so the renderer decision does not select the eventual backend, transport, or application framework. Keep grid, chunk, visibility, and interpolation logic in framework-free TypeScript modules; keep Three.js objects and Zustand interaction state inside the renderer package. Exercise visual correctness and WebGL behavior in Playwright.

**Tech Stack:** Node.js 20.19 or newer, TypeScript 7, React 19, Vite 8, Three.js `WebGLRenderer`, `@react-three/fiber` 9, `@react-three/drei` 10, Zustand 5, Vitest 4, `@react-three/test-renderer` 9, and Playwright 1.61.

## Global Constraints

- The experience is top-down 2.5D with one orthographic camera; do not add a freely navigable full-3D camera.
- The logical Battle Map is at most 200 by 200 Grid Cells.
- A Render Chunk is at most 32 by 32 Grid Cells and at most 2048 by 2048 texture pixels, whichever limit is reached first.
- Use Three.js `WebGLRenderer` and WebGL 2; WebGPU is not part of this spike.
- Do not add a physics engine. Grid position, elevation, collision, and legal movement remain deterministic domain data.
- Fog and reveal state come from per-viewer visibility data; visual lights never grant tactical visibility.
- Target 60 frames per second on a representative mid-range desktop and at least 30 on a representative tablet.
- Exercise up to 200 active interactive Tokens or props.
- Full Battle Map interaction is required on desktop, laptop, and tablet, not phone.
- Every scene test must assert that the canvas is nonblank and correctly framed, not merely that a `<canvas>` element exists.

---

### Task 1: Standalone WebGL Spike Shell

**Files:**
- Create: `prototypes/battle-map-renderer/package.json`
- Create: `prototypes/battle-map-renderer/tsconfig.json`
- Create: `prototypes/battle-map-renderer/vite.config.ts`
- Create: `prototypes/battle-map-renderer/playwright.config.ts`
- Create: `prototypes/battle-map-renderer/index.html`
- Create: `prototypes/battle-map-renderer/src/main.tsx`
- Create: `prototypes/battle-map-renderer/src/App.tsx`
- Create: `prototypes/battle-map-renderer/src/styles.css`
- Create: `prototypes/battle-map-renderer/src/battle-map/BattleMapCanvas.tsx`
- Create: `prototypes/battle-map-renderer/tests/e2e/battle-map-shell.spec.ts`
- Create: `prototypes/battle-map-renderer/src/test/setup.ts`

**Interfaces:**
- Consumes: none.
- Produces: `BattleMapCanvas(): JSX.Element`, the shared Vite/Vitest/Playwright commands, and a canvas marked `data-testid="battle-map-canvas"` for later browser tests.

- [ ] **Step 1: Create the package and tool configuration**

Create `package.json` with exact dependency versions so later profiling runs are reproducible:

```json
{
  "name": "@dnd/battle-map-renderer-spike",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "test:e2e:update": "playwright test --update-snapshots"
  },
  "dependencies": {
    "@react-three/drei": "10.7.7",
    "@react-three/fiber": "9.6.1",
    "react": "19.2.7",
    "react-dom": "19.2.7",
    "three": "0.185.1",
    "zustand": "5.0.14"
  },
  "devDependencies": {
    "@playwright/test": "1.61.1",
    "@react-three/test-renderer": "9.1.0",
    "@types/node": "26.1.1",
    "@types/pngjs": "6.0.5",
    "@types/react": "19.2.17",
    "@types/react-dom": "19.2.3",
    "@types/three": "0.185.1",
    "@vitejs/plugin-react": "6.0.3",
    "jsdom": "29.1.1",
    "pngjs": "7.0.0",
    "typescript": "7.0.2",
    "vite": "8.1.4",
    "vitest": "4.1.10"
  },
  "engines": {
    "node": ">=20.19.0"
  }
}
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "useDefineForClassFields": true,
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "noUncheckedIndexedAccess": true,
    "types": ["node", "vite/client", "vitest/globals"]
  },
  "include": ["src", "tests", "vite.config.ts", "playwright.config.ts"]
}
```

Create `vite.config.ts`:

```ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
})
```

Create `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Battle Map Renderer Spike</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `src/test/setup.ts`:

```ts
class TestResizeObserver implements ResizeObserver {
  observe(_target: Element, _options?: ResizeObserverOptions) {}
  unobserve(_target: Element) {}
  disconnect() {}
}

globalThis.ResizeObserver = TestResizeObserver
```

- [ ] **Step 2: Install dependencies**

Run:

```bash
npm --prefix prototypes/battle-map-renderer install
npm --prefix prototypes/battle-map-renderer exec playwright install
```

Expected: `package-lock.json` is created inside the prototype and all three Playwright browser engines install successfully.

- [ ] **Step 3: Write the failing nonblank-canvas browser test**

Create `tests/e2e/battle-map-shell.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { PNG } from 'pngjs'

test('renders a nonblank, viewport-filling battle map', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')

  const canvas = page.getByTestId('battle-map-canvas')
  await expect(canvas).toHaveCSS('width', '1280px')
  await expect(canvas).toHaveCSS('height', '800px')

  const image = PNG.sync.read(await canvas.screenshot())
  const colors = new Set<string>()
  for (let index = 0; index < image.data.length; index += 4) {
    colors.add(`${image.data[index]}:${image.data[index + 1]}:${image.data[index + 2]}`)
    if (colors.size >= 3) break
  }
  expect(colors.size).toBeGreaterThanOrEqual(3)
})
```

- [ ] **Step 4: Run the test to verify it fails**

Run:

```bash
npm --prefix prototypes/battle-map-renderer run test:e2e -- battle-map-shell.spec.ts --project=chromium
```

Expected: FAIL because the Vite entry point and Battle Map canvas do not exist.

- [ ] **Step 5: Implement the minimal full-viewport scene**

Implement `BattleMapCanvas.tsx` with a top-down orthographic camera. Task 8 adds the unsupported-device and context-recovery boundary:

```tsx
import { Canvas } from '@react-three/fiber'

export function BattleMapCanvas() {
  return (
    <Canvas
      data-testid="battle-map-canvas"
      orthographic
      frameloop="demand"
      camera={{ position: [0, 50, 0], rotation: [-Math.PI / 2, 0, 0], zoom: 20 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      dpr={[1, 2]}
    >
      <color attach="background" args={['#171a1f']} />
      <ambientLight intensity={1.4} />
      <directionalLight position={[8, 14, 5]} intensity={2.2} castShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#52654c" />
      </mesh>
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#c84f3d" />
      </mesh>
    </Canvas>
  )
}
```

Create `App.tsx`:

```tsx
import { BattleMapCanvas } from './battle-map/BattleMapCanvas'

export function App() {
  return (
    <main className="battle-map-app">
      <BattleMapCanvas />
    </main>
  )
}
```

Create `main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

Create `styles.css`:

```css
html,
body,
#root,
.battle-map-app {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
}

body {
  background: #171a1f;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
}

canvas {
  display: block;
  touch-action: none;
}
```

- [ ] **Step 6: Verify the shell**

Run:

```bash
npm --prefix prototypes/battle-map-renderer run build
npm --prefix prototypes/battle-map-renderer run test:e2e -- battle-map-shell.spec.ts --project=chromium
```

Expected: TypeScript and Vite build successfully; the Playwright test passes and reports a nonblank canvas.

- [ ] **Step 7: Commit**

```bash
git add prototypes/battle-map-renderer
git commit -m "Spike the 2.5D battle map canvas"
```

---

### Task 2: Deterministic Grid And Chunk Model

**Files:**
- Create: `prototypes/battle-map-renderer/src/battle-map/domain/grid.ts`
- Create: `prototypes/battle-map-renderer/src/battle-map/domain/chunks.ts`
- Create: `prototypes/battle-map-renderer/src/battle-map/domain/grid.test.ts`
- Create: `prototypes/battle-map-renderer/src/battle-map/domain/chunks.test.ts`

**Interfaces:**
- Consumes: no renderer APIs.
- Produces: `GridCell`, `WorldPoint`, `ChunkAddress`, `ChunkBounds`, `gridToWorld`, `worldToGrid`, `assertCellOnMap`, `chunkCellSpan`, `chunkAddressForCell`, and `chunkBounds`.

- [ ] **Step 1: Write failing coordinate and chunk tests**

Cover cell centers, edge flooring, out-of-map rejection, the 200 by 200 boundary, 32-cell chunks, and the 2048-pixel cap:

```ts
import { describe, expect, it } from 'vitest'
import { gridToWorld, worldToGrid } from './grid'
import { chunkAddressForCell, chunkBounds, chunkCellSpan } from './chunks'

describe('grid coordinates', () => {
  it('round-trips through the center of a Grid Cell', () => {
    expect(worldToGrid(gridToWorld({ column: 199, row: 199 }))).toEqual({ column: 199, row: 199 })
  })

  it('rejects a cell outside the logical Battle Map', () => {
    expect(() => gridToWorld({ column: 200, row: 0 })).toThrow(RangeError)
  })
})

describe('Render Chunks', () => {
  it('uses 32 cells when a cell is 64 texture pixels', () => {
    expect(chunkCellSpan(64)).toBe(32)
    expect(chunkBounds({ column: 6, row: 6 }, 64)).toEqual({
      minColumn: 192,
      minRow: 192,
      maxColumnExclusive: 200,
      maxRowExclusive: 200,
    })
  })

  it('uses 16 cells when the texture-pixel cap wins', () => {
    expect(chunkCellSpan(128)).toBe(16)
    expect(chunkAddressForCell({ column: 31, row: 48 }, 128)).toEqual({ column: 1, row: 3 })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
npm --prefix prototypes/battle-map-renderer test -- src/battle-map/domain/grid.test.ts src/battle-map/domain/chunks.test.ts
```

Expected: FAIL because the domain modules do not exist.

- [ ] **Step 3: Implement the framework-free model**

Create `grid.ts`:

```ts
export const MAP_SIZE_CELLS = 200

export type GridCell = Readonly<{ column: number; row: number }>
export type WorldPoint = Readonly<{ x: number; z: number }>

export function assertCellOnMap(cell: GridCell): void {
  if (
    !Number.isInteger(cell.column) ||
    !Number.isInteger(cell.row) ||
    cell.column < 0 ||
    cell.row < 0 ||
    cell.column >= MAP_SIZE_CELLS ||
    cell.row >= MAP_SIZE_CELLS
  ) {
    throw new RangeError(`Grid Cell (${cell.column}, ${cell.row}) is outside the Battle Map`)
  }
}

export function gridToWorld(cell: GridCell): WorldPoint {
  assertCellOnMap(cell)
  return { x: cell.column + 0.5, z: cell.row + 0.5 }
}

export function worldToGrid(point: WorldPoint): GridCell {
  const cell = { column: Math.floor(point.x), row: Math.floor(point.z) }
  assertCellOnMap(cell)
  return cell
}
```

Create `chunks.ts`:

```ts
import { MAP_SIZE_CELLS, assertCellOnMap, type GridCell } from './grid'

export const MAX_CHUNK_CELLS = 32
export const MAX_CHUNK_TEXTURE_PIXELS = 2048

export type ChunkAddress = Readonly<{ column: number; row: number }>
export type ChunkBounds = Readonly<{
  minColumn: number
  minRow: number
  maxColumnExclusive: number
  maxRowExclusive: number
}>

export function chunkCellSpan(cellTexturePixels: number): number {
  if (!Number.isInteger(cellTexturePixels) || cellTexturePixels <= 0) {
    throw new RangeError('Cell texture pixels must be a positive integer')
  }
  const span = Math.min(MAX_CHUNK_CELLS, Math.floor(MAX_CHUNK_TEXTURE_PIXELS / cellTexturePixels))
  if (span < 1) throw new RangeError('A Grid Cell cannot exceed the chunk texture limit')
  return span
}

export function chunkAddressForCell(cell: GridCell, cellTexturePixels: number): ChunkAddress {
  assertCellOnMap(cell)
  const span = chunkCellSpan(cellTexturePixels)
  return { column: Math.floor(cell.column / span), row: Math.floor(cell.row / span) }
}

export function chunkBounds(address: ChunkAddress, cellTexturePixels: number): ChunkBounds {
  const span = chunkCellSpan(cellTexturePixels)
  const minColumn = address.column * span
  const minRow = address.row * span
  if (minColumn < 0 || minRow < 0 || minColumn >= MAP_SIZE_CELLS || minRow >= MAP_SIZE_CELLS) {
    throw new RangeError('Render Chunk is outside the Battle Map')
  }
  return {
    minColumn,
    minRow,
    maxColumnExclusive: Math.min(MAP_SIZE_CELLS, minColumn + span),
    maxRowExclusive: Math.min(MAP_SIZE_CELLS, minRow + span),
  }
}
```

- [ ] **Step 4: Verify domain behavior**

Run:

```bash
npm --prefix prototypes/battle-map-renderer test -- src/battle-map/domain
```

Expected: all grid and chunk tests PASS.

- [ ] **Step 5: Commit**

```bash
git add prototypes/battle-map-renderer/src/battle-map/domain
git commit -m "Model battle map grid and render chunks"
```

---

### Task 3: Viewport Chunk Selection And Local Camera State

**Files:**
- Create: `prototypes/battle-map-renderer/src/battle-map/domain/viewport.ts`
- Create: `prototypes/battle-map-renderer/src/battle-map/domain/viewport.test.ts`
- Create: `prototypes/battle-map-renderer/src/battle-map/state/useBattleMapView.ts`
- Create: `prototypes/battle-map-renderer/src/battle-map/state/useBattleMapView.test.ts`

**Interfaces:**
- Consumes: `ChunkAddress`, `GridCell`, and `chunkCellSpan` from Task 2.
- Produces: `WorldBounds`, `MapDetailMode`, `visibleChunkAddresses`, `mapDetailMode`, and `useBattleMapView` with `cameraCenter`, `visibleCellSpan`, `selectedTokenId`, and `dragPreview`.

- [ ] **Step 1: Write failing viewport tests**

```ts
import { expect, it } from 'vitest'
import { mapDetailMode, visibleChunkAddresses } from './viewport'

it('adds one prefetch ring and clamps chunks to the Battle Map', () => {
  expect(visibleChunkAddresses({ minX: 190, minZ: 190, maxX: 200, maxZ: 200 }, 64, 1)).toEqual([
    { column: 4, row: 4 }, { column: 5, row: 4 }, { column: 6, row: 4 },
    { column: 4, row: 5 }, { column: 5, row: 5 }, { column: 6, row: 5 },
    { column: 4, row: 6 }, { column: 5, row: 6 }, { column: 6, row: 6 },
  ])
})

it('uses the overview when more than 96 cells are visible', () => {
  expect(mapDetailMode(97)).toBe('overview')
  expect(mapDetailMode(96)).toBe('detail')
})
```

Add a Zustand test that resets the store, selects a Token, sets a drag preview, and verifies that camera updates do not change either interaction field.

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
npm --prefix prototypes/battle-map-renderer test -- src/battle-map/domain/viewport.test.ts src/battle-map/state/useBattleMapView.test.ts
```

Expected: FAIL because the viewport and store modules do not exist.

- [ ] **Step 3: Implement the selectors and store**

Create `viewport.ts`:

```ts
import { MAP_SIZE_CELLS } from './grid'
import { chunkCellSpan, type ChunkAddress } from './chunks'

export type WorldBounds = Readonly<{ minX: number; minZ: number; maxX: number; maxZ: number }>
export type MapDetailMode = 'overview' | 'detail'

export function visibleChunkAddresses(
  bounds: WorldBounds,
  cellTexturePixels: number,
  prefetchRings = 1,
): readonly ChunkAddress[] {
  const span = chunkCellSpan(cellTexturePixels)
  const maxChunk = Math.ceil(MAP_SIZE_CELLS / span) - 1
  const minColumn = Math.max(0, Math.floor(bounds.minX / span) - prefetchRings)
  const minRow = Math.max(0, Math.floor(bounds.minZ / span) - prefetchRings)
  const maxColumn = Math.min(maxChunk, Math.floor((bounds.maxX - Number.EPSILON) / span) + prefetchRings)
  const maxRow = Math.min(maxChunk, Math.floor((bounds.maxZ - Number.EPSILON) / span) + prefetchRings)
  const addresses: ChunkAddress[] = []
  for (let row = minRow; row <= maxRow; row += 1) {
    for (let column = minColumn; column <= maxColumn; column += 1) {
      addresses.push({ column, row })
    }
  }
  return addresses
}

export function mapDetailMode(visibleCellSpan: number): MapDetailMode {
  if (!Number.isFinite(visibleCellSpan) || visibleCellSpan <= 0) {
    throw new RangeError('Visible cell span must be positive')
  }
  return visibleCellSpan > 96 ? 'overview' : 'detail'
}
```

Create `useBattleMapView.ts`. The Zustand store contains only local view and interaction state:

```ts
import { create } from 'zustand'
import type { GridCell, WorldPoint } from '../domain/grid'

type BattleMapViewState = {
  cameraCenter: WorldPoint
  visibleCellSpan: number
  selectedTokenId: string | null
  dragPreview: { tokenId: string; cell: GridCell } | null
  setCamera: (center: WorldPoint, visibleCellSpan: number) => void
  selectToken: (tokenId: string | null) => void
  previewTokenMove: (tokenId: string, cell: GridCell) => void
  clearDragPreview: () => void
}

export const useBattleMapView = create<BattleMapViewState>((set) => ({
  cameraCenter: { x: 100, z: 100 },
  visibleCellSpan: 200,
  selectedTokenId: null,
  dragPreview: null,
  setCamera: (cameraCenter, visibleCellSpan) => set({ cameraCenter, visibleCellSpan }),
  selectToken: (selectedTokenId) => set({ selectedTokenId }),
  previewTokenMove: (tokenId, cell) => set({ dragPreview: { tokenId, cell } }),
  clearDragPreview: () => set({ dragPreview: null }),
}))
```

Do not store campaign truth, visibility permissions, or committed Token positions in Zustand.

- [ ] **Step 4: Verify viewport and local-state behavior**

Run:

```bash
npm --prefix prototypes/battle-map-renderer test -- src/battle-map/domain/viewport.test.ts src/battle-map/state/useBattleMapView.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add prototypes/battle-map-renderer/src/battle-map/domain/viewport* prototypes/battle-map-renderer/src/battle-map/state
git commit -m "Select streamed map chunks from the viewport"
```

---

### Task 4: Continuous 2.5D Surface, Grid, And Chunk Streaming

**Files:**
- Create: `prototypes/battle-map-renderer/src/battle-map/fixtures/createChunkTexture.ts`
- Create: `prototypes/battle-map-renderer/src/battle-map/scene/BattleMapScene.tsx`
- Create: `prototypes/battle-map-renderer/src/battle-map/scene/BattleMapScene.test.tsx`
- Create: `prototypes/battle-map-renderer/src/battle-map/scene/MapSurface.tsx`
- Create: `prototypes/battle-map-renderer/src/battle-map/scene/ProceduralGrid.tsx`
- Create: `prototypes/battle-map-renderer/src/battle-map/scene/ChunkSurface.tsx`
- Create: `prototypes/battle-map-renderer/src/battle-map/scene/chunkLoader.ts`
- Create: `prototypes/battle-map-renderer/src/battle-map/scene/chunkLoader.test.ts`
- Create: `prototypes/battle-map-renderer/src/battle-map/scene/DimensionalTerrain.tsx`
- Modify: `prototypes/battle-map-renderer/src/battle-map/BattleMapCanvas.tsx`
- Create: `prototypes/battle-map-renderer/tests/e2e/chunk-streaming.spec.ts`

**Interfaces:**
- Consumes: `visibleChunkAddresses`, `mapDetailMode`, chunk bounds, and the local camera store.
- Produces: `BattleMapScene`, a 200 by 200 continuous map surface, shader-rendered grid, overview/detail switching, and a hidden DOM diagnostic with `data-testid="chunk-diagnostics"`, `data-mode`, and `data-visible-chunks` attributes.

- [ ] **Step 1: Write the failing chunk transition browser test**

```ts
import { expect, test } from '@playwright/test'

test('switches from overview to detail without breaking the continuous grid', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')

  const diagnostics = page.getByTestId('chunk-diagnostics')
  await expect(diagnostics).toHaveAttribute('data-mode', 'overview')
  await page.mouse.wheel(0, -2400)
  await expect(diagnostics).toHaveAttribute('data-mode', 'detail')

  const visible = await diagnostics.getAttribute('data-visible-chunks')
  expect(visible?.split(',').length).toBeGreaterThan(1)
  await expect(page.getByTestId('battle-map-canvas')).toHaveScreenshot('detail-chunks.png', {
    maxDiffPixelRatio: 0.01,
  })
})
```

Add the scene-graph and failed-load tests:

```tsx
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { expect, it } from 'vitest'
import { BattleMapScene } from './BattleMapScene'

it('builds the layered Battle Map scene graph', async () => {
  const renderer = await ReactThreeTestRenderer.create(<BattleMapScene />)
  expect(renderer.scene.children.length).toBeGreaterThanOrEqual(4)
  await renderer.unmount()
})
```

```ts
import { expect, it, vi } from 'vitest'
import { loadChunkWithRetry } from './chunkLoader'

it('retries one failed chunk load and returns one resource', async () => {
  const loader = vi.fn().mockRejectedValueOnce(new Error('fixture failure')).mockResolvedValueOnce('texture')
  await expect(loadChunkWithRetry({ column: 3, row: 4 }, loader)).resolves.toBe('texture')
  expect(loader).toHaveBeenCalledTimes(2)
})
```

- [ ] **Step 2: Run the browser test to verify it fails**

Run:

```bash
npm --prefix prototypes/battle-map-renderer test -- src/battle-map/scene/BattleMapScene.test.tsx src/battle-map/scene/chunkLoader.test.ts
npm --prefix prototypes/battle-map-renderer run test:e2e -- chunk-streaming.spec.ts --project=chromium
```

Expected: unit tests FAIL because the scene and loader do not exist; the browser test FAILS because chunk diagnostics and zoom behavior do not exist.

- [ ] **Step 3: Implement the continuous surface and chunk layers**

Render one low-resolution overview plane covering `[0, 200]` in X and Z. At detail zoom, render only the selected chunk planes at their exact chunk bounds. Generate deterministic fixture textures from the chunk address so Playwright can detect swaps without network assets.

Implement the retry boundary and use the address string as the React key so a retry replaces the failed resource without duplicating its scene object:

```ts
import type { ChunkAddress } from '../domain/chunks'

export async function loadChunkWithRetry<T>(
  address: ChunkAddress,
  loader: (address: ChunkAddress) => Promise<T>,
  maxAttempts = 2,
): Promise<T> {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new RangeError('Chunk attempts must be a positive integer')
  }
  let lastError: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await loader(address)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}
```

Render the grid as one transparent plane with a shader based on world position:

```glsl
float lineX = 1.0 - step(0.035, min(fract(vWorld.x), 1.0 - fract(vWorld.x)));
float lineZ = 1.0 - step(0.035, min(fract(vWorld.z), 1.0 - fract(vWorld.z)));
float alpha = max(lineX, lineZ) * 0.42;
gl_FragColor = vec4(vec3(0.08), alpha);
```

Add one wall, one door, one raised platform, and one elevated marker in `DimensionalTerrain.tsx`. Reuse box geometries and materials rather than allocating them during render. Invalidate the demand render loop when zoom, visible chunks, or a chunk texture changes.

- [ ] **Step 4: Verify visual continuity**

Run:

```bash
npm --prefix prototypes/battle-map-renderer run build
npm --prefix prototypes/battle-map-renderer test -- src/battle-map/scene
npm --prefix prototypes/battle-map-renderer run test:e2e:update -- chunk-streaming.spec.ts
npm --prefix prototypes/battle-map-renderer run test:e2e -- chunk-streaming.spec.ts
```

Expected: build PASS. Inspect the three generated browser baselines before accepting them; then the Chromium, Firefox, and WebKit overview/detail assertions and screenshots PASS with no blank regions or grid discontinuities.

- [ ] **Step 5: Commit**

```bash
git add prototypes/battle-map-renderer
git commit -m "Stream continuous 2.5D battle map chunks"
```

---

### Task 5: Token Selection And Move Intent Boundary

**Files:**
- Create: `prototypes/battle-map-renderer/src/battle-map/domain/tokens.ts`
- Create: `prototypes/battle-map-renderer/src/battle-map/domain/movement.ts`
- Create: `prototypes/battle-map-renderer/src/battle-map/domain/movement.test.ts`
- Create: `prototypes/battle-map-renderer/src/battle-map/scene/TokenLayer.tsx`
- Create: `prototypes/battle-map-renderer/src/battle-map/scene/TokenMesh.tsx`
- Create: `prototypes/battle-map-renderer/src/battle-map/scene/MovementPreview.tsx`
- Modify: `prototypes/battle-map-renderer/src/battle-map/scene/BattleMapScene.tsx`
- Create: `prototypes/battle-map-renderer/tests/e2e/token-interaction.spec.ts`

**Interfaces:**
- Consumes: `GridCell`, `gridToWorld`, and local selection/drag-preview actions.
- Produces: `TokenRenderState`, `MoveIntent`, `straightGridPath`, `TokenLayer({ tokens, onMoveIntent })`, and presentation-only drag interpolation.

- [ ] **Step 1: Write the failing movement tests**

```ts
import { expect, it } from 'vitest'
import { straightGridPath } from './movement'

it('creates a stable snapped path including both endpoints', () => {
  expect(straightGridPath({ column: 2, row: 2 }, { column: 5, row: 4 })).toEqual([
    { column: 2, row: 2 },
    { column: 3, row: 3 },
    { column: 4, row: 3 },
    { column: 5, row: 4 },
  ])
})
```

Create `tokens.ts` with this public data boundary and import the types into the test and scene components:

```ts
export type TokenRenderState = Readonly<{
  id: string
  label: string
  cell: GridCell
  elevation: number
  color: string
  visible: boolean
}>

export type MoveIntent = Readonly<{
  tokenId: string
  from: GridCell
  to: GridCell
  path: readonly GridCell[]
}>
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
npm --prefix prototypes/battle-map-renderer test -- src/battle-map/domain/movement.test.ts
```

Expected: FAIL because `straightGridPath` does not exist.

- [ ] **Step 3: Implement deterministic movement preview**

Implement `straightGridPath` with an integer Bresenham line. It is pure, includes both endpoints, never leaves the 200 by 200 map, and does not decide whether movement is legal:

```ts
import { assertCellOnMap, type GridCell } from './grid'

export function straightGridPath(from: GridCell, to: GridCell): readonly GridCell[] {
  assertCellOnMap(from)
  assertCellOnMap(to)
  let column = from.column
  let row = from.row
  const deltaColumn = Math.abs(to.column - from.column)
  const deltaRow = Math.abs(to.row - from.row)
  const stepColumn = from.column < to.column ? 1 : -1
  const stepRow = from.row < to.row ? 1 : -1
  let error = deltaColumn - deltaRow
  const path: GridCell[] = []

  for (;;) {
    path.push({ column, row })
    if (column === to.column && row === to.row) return path
    const doubledError = error * 2
    if (doubledError > -deltaRow) {
      error -= deltaRow
      column += stepColumn
    }
    if (doubledError < deltaColumn) {
      error += deltaColumn
      row += stepRow
    }
  }
}
```

Render visible Tokens as cylinders with stable IDs. Pointer down selects a Token and captures the pointer. Pointer movement updates only `dragPreview`. Pointer up emits exactly one `MoveIntent` and clears the preview. Do not update the committed `TokenRenderState.cell` inside the renderer.

- [ ] **Step 4: Add and run the browser interaction test**

The Playwright test must select a fixture Token, drag it three cells, assert that the preview moved before pointer-up, and then assert the hidden event diagnostic contains one serialized `MoveIntent` with unchanged `from` and snapped `to` cells.

Run:

```bash
npm --prefix prototypes/battle-map-renderer test -- src/battle-map/domain/movement.test.ts
npm --prefix prototypes/battle-map-renderer run test:e2e -- token-interaction.spec.ts --project=chromium
```

Expected: unit and browser tests PASS.

- [ ] **Step 5: Commit**

```bash
git add prototypes/battle-map-renderer
git commit -m "Add token selection and move intent previews"
```

---

### Task 6: Per-Viewer Visibility And Visual Lighting

**Files:**
- Create: `prototypes/battle-map-renderer/src/battle-map/domain/visibility.ts`
- Create: `prototypes/battle-map-renderer/src/battle-map/domain/visibility.test.ts`
- Create: `prototypes/battle-map-renderer/src/battle-map/scene/VisibilityLayer.tsx`
- Create: `prototypes/battle-map-renderer/src/battle-map/scene/LightLayer.tsx`
- Modify: `prototypes/battle-map-renderer/src/battle-map/scene/BattleMapScene.tsx`
- Create: `prototypes/battle-map-renderer/tests/e2e/visibility-lighting.spec.ts`

**Interfaces:**
- Consumes: Render Chunk bounds and viewer-scoped visibility input.
- Produces: `VisibilityGrid`, `visibilityTextureData`, `VisibilityLayer`, and `LightLayer`; visual lights do not modify `VisibilityGrid`.

- [ ] **Step 1: Write failing visibility-data tests**

```ts
import { expect, it } from 'vitest'
import { visibilityTextureData } from './visibility'

it('encodes hidden, explored, and visible cells without consulting lights', () => {
  const data = visibilityTextureData({
    width: 3,
    height: 1,
    cells: ['hidden', 'explored', 'visible'],
  })
  expect([...data]).toEqual([0, 96, 255])
})
```

Use these exact types and implementation:

```ts
export type CellVisibility = 'hidden' | 'explored' | 'visible'
export type VisibilityGrid = Readonly<{
  width: number
  height: number
  cells: readonly CellVisibility[]
}>

const VISIBILITY_BYTE: Readonly<Record<CellVisibility, number>> = {
  hidden: 0,
  explored: 96,
  visible: 255,
}

export function visibilityTextureData(grid: VisibilityGrid): Uint8Array {
  if (
    !Number.isInteger(grid.width) ||
    !Number.isInteger(grid.height) ||
    grid.width <= 0 ||
    grid.height <= 0 ||
    grid.cells.length !== grid.width * grid.height
  ) {
    throw new RangeError('Visibility data must exactly fill a positive integer grid')
  }
  return Uint8Array.from(grid.cells, (visibility) => VISIBILITY_BYTE[visibility])
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm --prefix prototypes/battle-map-renderer test -- src/battle-map/domain/visibility.test.ts
```

Expected: FAIL because the visibility module does not exist.

- [ ] **Step 3: Implement visibility compositing and lights**

Build one `THREE.DataTexture` per visible Render Chunk from viewer-scoped data. Composite hidden cells as opaque black, explored cells as desaturated darkness, and visible cells as transparent. Set nearest-neighbor filtering so Grid Cell boundaries do not blur.

Add fixture point lights with shadow casting and one moving light for the spike. Keep the light list in renderer props:

```ts
export type VisualLight = Readonly<{
  id: string
  cell: GridCell
  elevation: number
  color: string
  intensity: number
  range: number
}>
```

Do not pass `VisualLight[]` into `visibilityTextureData` or any tactical visibility function.

- [ ] **Step 4: Verify DM/Player separation visually**

The Playwright test must capture a DM fixture view and a Player fixture view, assert the screenshots differ, assert a hidden Token is absent in the Player diagnostic, and move a visual light without changing the Player visibility-data checksum.

Run:

```bash
npm --prefix prototypes/battle-map-renderer test -- src/battle-map/domain/visibility.test.ts
npm --prefix prototypes/battle-map-renderer run test:e2e -- visibility-lighting.spec.ts --project=chromium
```

Expected: unit and browser tests PASS.

- [ ] **Step 5: Commit**

```bash
git add prototypes/battle-map-renderer
git commit -m "Render viewer visibility and dynamic lights"
```

---

### Task 7: Targeting Templates And Deterministic Remote Animation

**Files:**
- Create: `prototypes/battle-map-renderer/src/battle-map/domain/effects.ts`
- Create: `prototypes/battle-map-renderer/src/battle-map/domain/effects.test.ts`
- Create: `prototypes/battle-map-renderer/src/battle-map/domain/interpolation.ts`
- Create: `prototypes/battle-map-renderer/src/battle-map/domain/interpolation.test.ts`
- Create: `prototypes/battle-map-renderer/src/battle-map/scene/TargetingLayer.tsx`
- Create: `prototypes/battle-map-renderer/src/battle-map/scene/AnimatedToken.tsx`
- Modify: `prototypes/battle-map-renderer/src/battle-map/scene/BattleMapScene.tsx`
- Create: `prototypes/battle-map-renderer/tests/e2e/effects-animation.spec.ts`

**Interfaces:**
- Consumes: Grid Cells, stable Token IDs, accepted remote updates, and event timestamps.
- Produces: `AreaTemplate`, `cellsCoveredByTemplate`, `interpolateWorldPoint`, targeting meshes, and timestamp-based Token/effect animation.

- [ ] **Step 1: Write failing area and interpolation tests**

```ts
import { expect, it } from 'vitest'
import { cellsCoveredByTemplate } from './effects'
import { interpolateWorldPoint } from './interpolation'

it('returns stable cells for a circle template', () => {
  expect(cellsCoveredByTemplate({ kind: 'circle', origin: { column: 10, row: 10 }, radius: 1 })).toEqual([
    { column: 10, row: 9 },
    { column: 9, row: 10 },
    { column: 10, row: 10 },
    { column: 11, row: 10 },
    { column: 10, row: 11 },
  ])
})

it('resumes animation from the event timestamp instead of restarting', () => {
  expect(interpolateWorldPoint({ x: 0, z: 0 }, { x: 10, z: 0 }, 1_500, 1_000, 1_000)).toEqual({ x: 5, z: 0 })
})
```

Define `AreaTemplate` and the covered-cell implementation as follows. Cone direction is one of the eight neighboring Grid Cell offsets and represents a 90-degree cone:

```ts
import { MAP_SIZE_CELLS, assertCellOnMap, type GridCell } from './grid'
import { straightGridPath } from './movement'

type GridDirection = Readonly<{ column: -1 | 0 | 1; row: -1 | 0 | 1 }>

export type AreaTemplate =
  | Readonly<{ kind: 'circle'; origin: GridCell; radius: number }>
  | Readonly<{ kind: 'line'; origin: GridCell; direction: GridDirection; length: number }>
  | Readonly<{ kind: 'cone'; origin: GridCell; direction: GridDirection; length: number }>

function validCell(column: number, row: number): GridCell | null {
  if (column < 0 || row < 0 || column >= MAP_SIZE_CELLS || row >= MAP_SIZE_CELLS) return null
  return { column, row }
}

function assertDirection(direction: GridDirection): void {
  if (direction.column === 0 && direction.row === 0) throw new RangeError('Direction cannot be zero')
}

export function cellsCoveredByTemplate(template: AreaTemplate): readonly GridCell[] {
  assertCellOnMap(template.origin)
  const templateSize = template.kind === 'circle' ? template.radius : template.length
  if (!Number.isInteger(templateSize) || templateSize < 1) {
    throw new RangeError('Template size must be a positive integer')
  }

  if (template.kind === 'line') {
    assertDirection(template.direction)
    const end = {
      column: Math.min(
        MAP_SIZE_CELLS - 1,
        Math.max(0, template.origin.column + template.direction.column * template.length),
      ),
      row: Math.min(
        MAP_SIZE_CELLS - 1,
        Math.max(0, template.origin.row + template.direction.row * template.length),
      ),
    }
    return straightGridPath(template.origin, end)
  }

  const covered: GridCell[] = []
  const size = templateSize
  if (template.kind === 'cone') assertDirection(template.direction)

  for (let row = template.origin.row - size; row <= template.origin.row + size; row += 1) {
    for (let column = template.origin.column - size; column <= template.origin.column + size; column += 1) {
      const cell = validCell(column, row)
      if (!cell) continue
      const deltaColumn = column - template.origin.column
      const deltaRow = row - template.origin.row
      if (template.kind === 'circle') {
        if (deltaColumn ** 2 + deltaRow ** 2 <= template.radius ** 2) covered.push(cell)
        continue
      }
      const forward =
        deltaColumn * template.direction.column + deltaRow * template.direction.row
      const sideways = Math.abs(
        deltaColumn * template.direction.row - deltaRow * template.direction.column,
      )
      const directionScale = Math.hypot(template.direction.column, template.direction.row)
      if (forward >= 0 && forward <= template.length * directionScale && sideways <= forward) {
        covered.push(cell)
      }
    }
  }
  return covered
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm --prefix prototypes/battle-map-renderer test -- src/battle-map/domain/effects.test.ts src/battle-map/domain/interpolation.test.ts
```

Expected: FAIL because the effect and interpolation modules do not exist.

- [ ] **Step 3: Implement pure geometry and timestamp animation**

Return covered cells in row-major order and clip them to the logical Battle Map. Create `interpolation.ts`:

```ts
import type { WorldPoint } from './grid'

export function interpolateWorldPoint(
  from: WorldPoint,
  to: WorldPoint,
  nowMs: number,
  eventStartMs: number,
  durationMs: number,
): WorldPoint {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new RangeError('Animation duration must be positive')
  }
  const progress = Math.min(1, Math.max(0, (nowMs - eventStartMs) / durationMs))
  return {
    x: from.x + (to.x - from.x) * progress,
    z: from.z + (to.z - from.z) * progress,
  }
}
```

Render circle, cone, and line templates as transparent meshes above the grid. Render remote Token movement from accepted updates with `useFrame`, but derive every frame from the event timestamp so reconnecting halfway through an effect resumes halfway through.

- [ ] **Step 4: Verify effects and animation**

The browser test must switch among all three template types, assert target-cell diagnostics, simulate a late remote update, advance the page clock, and assert the Token reaches the expected midpoint and endpoint without restarting.

Run:

```bash
npm --prefix prototypes/battle-map-renderer test -- src/battle-map/domain/effects.test.ts src/battle-map/domain/interpolation.test.ts
npm --prefix prototypes/battle-map-renderer run test:e2e -- effects-animation.spec.ts --project=chromium
```

Expected: unit and browser tests PASS.

- [ ] **Step 5: Commit**

```bash
git add prototypes/battle-map-renderer
git commit -m "Add targeting templates and remote animation"
```

---

### Task 8: Adaptive Quality, Context Recovery, And Spike Report

**Files:**
- Create: `prototypes/battle-map-renderer/src/battle-map/performance/quality.ts`
- Create: `prototypes/battle-map-renderer/src/battle-map/performance/quality.test.ts`
- Create: `prototypes/battle-map-renderer/src/battle-map/performance/ScenePerformanceMonitor.tsx`
- Create: `prototypes/battle-map-renderer/src/battle-map/performance/WebGLContextBoundary.tsx`
- Create: `prototypes/battle-map-renderer/src/battle-map/fixtures/createStressScene.ts`
- Modify: `prototypes/battle-map-renderer/src/battle-map/BattleMapCanvas.tsx`
- Create: `prototypes/battle-map-renderer/tests/e2e/performance-and-recovery.spec.ts`
- Create: `prototypes/battle-map-renderer/tests/e2e/responsive-framing.spec.ts`
- Create: `docs/research/battle-map-renderer-spike-results.md`

**Interfaces:**
- Consumes: the complete spike scene and `renderer.info` metrics.
- Produces: `SceneQuality`, `qualityForAverageFps`, adaptive DPR/shadow/particle settings, explicit WebGL context recovery, a 200-object stress fixture, and the measured spike report.

- [ ] **Step 1: Write the failing quality-policy test**

```ts
import { expect, it } from 'vitest'
import { qualityForAverageFps } from './quality'

it.each([
  [61, 'high'],
  [44, 'medium'],
  [29, 'low'],
] as const)('maps %i fps to %s quality', (fps, quality) => {
  expect(qualityForAverageFps(fps)).toBe(quality)
})
```

Create `quality.ts`:

```ts
export type SceneQuality = 'high' | 'medium' | 'low'

export type SceneQualitySettings = Readonly<{
  maxDpr: number
  shadowMapSize: 2048 | 1024 | 512
  softShadows: boolean
  particleScale: 1 | 0.5 | 0.25
  postProcessing: boolean
}>

export function qualityForAverageFps(averageFps: number): SceneQuality {
  if (!Number.isFinite(averageFps) || averageFps < 0) throw new RangeError('FPS must be non-negative')
  if (averageFps >= 55) return 'high'
  if (averageFps >= 30) return 'medium'
  return 'low'
}

export const QUALITY_SETTINGS: Readonly<Record<SceneQuality, SceneQualitySettings>> = {
  high: { maxDpr: 2, shadowMapSize: 2048, softShadows: true, particleScale: 1, postProcessing: true },
  medium: { maxDpr: 1.5, shadowMapSize: 1024, softShadows: true, particleScale: 0.5, postProcessing: true },
  low: { maxDpr: 1, shadowMapSize: 512, softShadows: false, particleScale: 0.25, postProcessing: false },
}
```

High uses DPR up to 2, full shadows, and all particles. Medium caps DPR at 1.5 and halves shadow resolution and particles. Low caps DPR at 1, disables soft shadows and post-processing, and quarters particles.

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm --prefix prototypes/battle-map-renderer test -- src/battle-map/performance/quality.test.ts
```

Expected: FAIL because the quality module does not exist.

- [ ] **Step 3: Implement adaptive quality and context recovery**

Sample frame time over a rolling five-second window and require two consecutive windows before changing quality to avoid oscillation. Expose the current quality and renderer metrics through hidden test diagnostics.

Listen for `webglcontextlost`, call `preventDefault`, pause interactions, and show a concise recovery surface. Its retry command calls the renderer recreation boundary rather than mutating Campaign or Session state. Listen for `webglcontextrestored` and rehydrate GPU resources from renderer props.

Create a deterministic stress scene containing exactly 200 interactive Token/prop records, representative walls, four shadow-casting lights, active fog, and concurrent movement/effect animations.

- [ ] **Step 4: Add browser quality gates**

`performance-and-recovery.spec.ts` must:

1. load the 200-object stress fixture;
2. collect average frame time, draw calls, triangles, texture count, and chunk-load latency;
3. force the low-quality policy and assert DPR/shadow/particle diagnostics change;
4. dispatch `WEBGL_lose_context.loseContext()` when available;
5. assert the recovery surface appears; and
6. restore context and assert the nonblank canvas returns with the same committed Token checksum.

`responsive-framing.spec.ts` must capture and pixel-check the complete map UI at `1440x900`, `1024x768`, and `820x1180`, asserting that the canvas and tool controls do not overlap or leave the map blank.

- [ ] **Step 5: Run the complete verification matrix**

Run:

```bash
npm --prefix prototypes/battle-map-renderer run build
npm --prefix prototypes/battle-map-renderer test
npm --prefix prototypes/battle-map-renderer run test:e2e
```

Expected: build PASS, all Vitest tests PASS, and Playwright PASS on Chromium, Firefox, and WebKit. Record any browser-specific visual tolerance rather than weakening the global nonblank check.

- [ ] **Step 6: Profile representative devices and write the result**

Run the stress scene on the agreed mid-range desktop and tablet. Create the report only after the measurements exist. Include:

- an Environment table with one actual row per device containing device, browser, viewport, DPR, and GPU;
- a Measurements table with one actual row per device containing quality, average FPS, P95 frame time, draw calls, texture count, GPU-memory estimate, P95 chunk latency, and P95 input latency;
- an explicit result for the 60 FPS desktop target and 30 FPS tablet target;
- an explicit result for the 200-interactive-object scene;
- the browsers in which context loss and recovery passed;
- observed failures with reproduction commands; and
- one recommendation: accept Three.js/R3F, revise and rerun the scene, or revisit Babylon.js.

Do not create the report with blank rows and do not claim the spike passes until both device rows contain real measurements.

- [ ] **Step 7: Commit**

```bash
git add prototypes/battle-map-renderer docs/research/battle-map-renderer-spike-results.md
git commit -m "Verify battle map renderer spike quality gates"
```

---

## Final Verification

After all tasks are complete:

```bash
npm --prefix prototypes/battle-map-renderer run build
npm --prefix prototypes/battle-map-renderer test
npm --prefix prototypes/battle-map-renderer run test:e2e
git status --short
```

Expected:

- TypeScript and Vite build successfully.
- All deterministic domain and renderer tests pass.
- Chromium, Firefox, and WebKit browser tests pass at desktop and tablet viewports.
- Canvas-pixel assertions prove the 2.5D scene is nonblank and framed correctly.
- The stress-scene report contains real desktop and tablet measurements.
- The worktree is clean after the final scoped commit.
