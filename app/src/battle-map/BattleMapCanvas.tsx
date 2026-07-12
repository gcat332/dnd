import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Vector3 } from 'three'
import { ControlledOrbitCamera } from './camera/ControlledOrbitCamera'
import { cellsCoveredByTemplate, type AreaTemplate } from './domain/effects'
import { MAP_SIZE_CELLS, type GridCell, type WorldPoint } from './domain/grid'
import type { MoveIntent, TokenRenderState } from './domain/tokens'
import {
  visibilityTextureData,
  type CellVisibility,
  type VisibilityGrid,
} from './domain/visibility'
import { useBattleMapView } from './state/useBattleMapView'
import { BattleMapScene, useSceneSelection } from './scene/BattleMapScene'
import type { VisualLight } from './scene/LightLayer'
import { chunkAddressKey } from './scene/MapSurface'
import type { MaximumClassTextureRender } from './scene/ChunkSurface'
import {
  removeCompletedRemoteTokenAnimation,
  type RemoteTokenAnimation,
} from './scene/AnimatedToken'
import { createStressScene } from './fixtures/createStressScene'
import {
  ScenePerformanceMonitor,
  type SceneMetrics,
} from './performance/ScenePerformanceMonitor'
import { QUALITY_SETTINGS, type SceneQuality } from './performance/quality'
import { WebGLContextBoundary } from './performance/WebGLContextBoundary'

type BattleMapCameraProbeProps = {
  onReady: () => void
  onVisibilityProbePoints: (points: VisibilityProbePoints) => void
  onStressTokenPoint: (point: ScreenPoint | null) => void
  stressTokenCell: GridCell | null
}

type ScreenPoint = Readonly<{ x: number; y: number }>
type VisibilityProbePoints = Readonly<{
  visible: ScreenPoint
  explored: ScreenPoint
  hidden: ScreenPoint
}>

const VISIBILITY_PROBE_CELLS = {
  visible: { column: 97, row: 99 },
  explored: { column: 105, row: 99 },
  hidden: { column: 110, row: 99 },
} as const

const FIXTURE_TOKENS: readonly TokenRenderState[] = [
  {
    id: 'fixture-token',
    label: 'Fixture Token',
    cell: { column: 99, row: 99 },
    elevation: 0,
    color: '#37ff78',
    visible: true,
  },
  {
    id: 'hidden-token',
    label: 'Hidden Token',
    cell: { column: 112, row: 100 },
    elevation: 0,
    color: '#ff4f81',
    visible: true,
  },
]

const PLAYER_TOKENS = FIXTURE_TOKENS.filter((token) => token.id !== 'hidden-token')

const DM_VISIBILITY: VisibilityGrid = {
  width: MAP_SIZE_CELLS,
  height: MAP_SIZE_CELLS,
  cells: Array.from({ length: MAP_SIZE_CELLS * MAP_SIZE_CELLS }, () => 'visible'),
}

function playerVisibility(): VisibilityGrid {
  const cells: CellVisibility[] = []
  for (let row = 0; row < MAP_SIZE_CELLS; row += 1) {
    for (let column = 0; column < MAP_SIZE_CELLS; column += 1) {
      const distance = Math.hypot(column - 99, row - 99)
      cells.push(distance <= 4 ? 'visible' : distance <= 8 ? 'explored' : 'hidden')
    }
  }
  return { width: MAP_SIZE_CELLS, height: MAP_SIZE_CELLS, cells }
}

const PLAYER_VISIBILITY = playerVisibility()

const FIXED_LIGHTS: readonly VisualLight[] = [
  {
    id: 'door-sconce',
    cell: { column: 99, row: 93 },
    elevation: 3,
    color: '#ff9f43',
    intensity: 18,
    range: 14,
  },
]

type TemplateKind = AreaTemplate['kind']

const TARGET_TEMPLATES: Record<TemplateKind, AreaTemplate> = {
  circle: { kind: 'circle', origin: { column: 99, row: 99 }, radius: 1 },
  cone: {
    kind: 'cone',
    origin: { column: 99, row: 99 },
    direction: { column: 1, row: 0 },
    length: 2,
  },
  line: {
    kind: 'line',
    origin: { column: 99, row: 99 },
    direction: { column: 1, row: 0 },
    length: 2,
  },
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null
}

function isGridCell(value: unknown): value is GridCell {
  if (!isRecord(value)) return false
  return (
    typeof value.column === 'number' &&
    typeof value.row === 'number' &&
    Number.isInteger(value.column) &&
    Number.isInteger(value.row) &&
    value.column >= 0 &&
    value.row >= 0 &&
    value.column < MAP_SIZE_CELLS &&
    value.row < MAP_SIZE_CELLS
  )
}

function fixtureRemoteTokenAnimation(value: unknown): RemoteTokenAnimation | null {
  if (!isRecord(value)) return null
  if (
    typeof value.tokenId !== 'string' ||
    !FIXTURE_TOKENS.some((token) => token.id === value.tokenId) ||
    !isGridCell(value.from) ||
    !isGridCell(value.to) ||
    typeof value.eventStartMs !== 'number' ||
    !Number.isFinite(value.eventStartMs) ||
    typeof value.durationMs !== 'number' ||
    !Number.isFinite(value.durationMs) ||
    value.durationMs <= 0
  ) {
    return null
  }
  return {
    tokenId: value.tokenId,
    from: value.from,
    to: value.to,
    eventStartMs: value.eventStartMs,
    durationMs: value.durationMs,
  }
}

function visibilityChecksum(grid: VisibilityGrid): string {
  let checksum = 0x811c9dc5
  for (const byte of visibilityTextureData(grid)) {
    checksum ^= byte
    checksum = Math.imul(checksum, 0x01000193)
  }
  return (checksum >>> 0).toString(16).padStart(8, '0')
}

type Viewer = 'dm' | 'player'

function fixtureViewer(): Viewer {
  return new URLSearchParams(window.location.search).get('viewer') === 'player' ? 'player' : 'dm'
}

function BattleMapCameraProbe({
  onReady,
  onVisibilityProbePoints,
  onStressTokenPoint,
  stressTokenCell,
}: BattleMapCameraProbeProps) {
  const warmupFrame = useRef(0)
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  const invalidate = useThree((state) => state.invalidate)
  const cameraView = useBattleMapView((state) => state.cameraView)

  const publishProbePoints = useCallback(() => {
    camera.updateMatrixWorld()
    camera.updateProjectionMatrix()
    const projectCell = (cell: GridCell): ScreenPoint => {
      const point = new Vector3(cell.column + 0.5, 0.06, cell.row + 0.5).project(camera)
      return {
        x: ((point.x + 1) / 2) * size.width,
        y: ((1 - point.y) / 2) * size.height,
      }
    }
    onVisibilityProbePoints({
      visible: projectCell(VISIBILITY_PROBE_CELLS.visible),
      explored: projectCell(VISIBILITY_PROBE_CELLS.explored),
      hidden: projectCell(VISIBILITY_PROBE_CELLS.hidden),
    })
    onStressTokenPoint(stressTokenCell ? projectCell(stressTokenCell) : null)
    invalidate()
  }, [camera, invalidate, onStressTokenPoint, onVisibilityProbePoints, size.height, size.width, stressTokenCell])

  useEffect(() => {
    warmupFrame.current = 0
    invalidate()
  }, [cameraView, invalidate])

  useFrame(() => {
    if (warmupFrame.current >= 2) return
    warmupFrame.current += 1
    if (warmupFrame.current === 2) {
      publishProbePoints()
      onReady()
      return
    }
    invalidate()
  })

  return null
}

type TokenInteractionDiagnosticsProps = {
  moveIntents: readonly MoveIntent[]
}

function TokenInteractionDiagnostics({ moveIntents }: TokenInteractionDiagnosticsProps) {
  const dragPreview = useBattleMapView((state) => state.dragPreview)
  const selectedTokenId = useBattleMapView((state) => state.selectedTokenId)
  return (
    <output
      hidden
      data-testid="token-interaction-diagnostics"
      data-drag-preview={dragPreview ? JSON.stringify(dragPreview) : ''}
      data-selected-token-id={selectedTokenId ?? ''}
      data-move-intents={JSON.stringify(moveIntents)}
    />
  )
}

type ChunkDiagnosticsProps = {
  cameraReady: boolean
}

function ChunkDiagnostics({ cameraReady }: ChunkDiagnosticsProps) {
  const { mode, visibleChunks, centerChunk } = useSceneSelection()
  if (!cameraReady) return null
  return (
    <output
      hidden
      data-testid="chunk-diagnostics"
      data-mode={mode}
      data-visible-chunks={visibleChunks.map(chunkAddressKey).join(',')}
      data-center-chunk={centerChunk ? chunkAddressKey(centerChunk) : ''}
    />
  )
}

type VisibilityDiagnosticsProps = {
  viewer: Viewer
  tokens: readonly TokenRenderState[]
  visibility: VisibilityGrid
  movingLightCell: GridCell
  probePoints: VisibilityProbePoints | null
}

function VisibilityDiagnostics({
  viewer,
  tokens,
  visibility,
  movingLightCell,
  probePoints,
}: VisibilityDiagnosticsProps) {
  return (
    <output
      hidden
      data-testid="visibility-diagnostics"
      data-viewer={viewer}
      data-visible-token-ids={tokens.filter((token) => token.visible).map((token) => token.id).join(',')}
      data-visibility-checksum={visibilityChecksum(visibility)}
      data-moving-light-cell={`${movingLightCell.column}:${movingLightCell.row}`}
      data-visibility-probe-points={probePoints ? JSON.stringify(probePoints) : ''}
    />
  )
}

type EffectsAnimationDiagnosticsProps = {
  template: AreaTemplate
  renderedTokenPoint: WorldPoint | null
  animationSampleCount: number
  activeAnimationCount: number
}

function EffectsAnimationDiagnostics({
  template,
  renderedTokenPoint,
  animationSampleCount,
  activeAnimationCount,
}: EffectsAnimationDiagnosticsProps) {
  return (
    <output
      hidden
      data-testid="effects-animation-diagnostics"
      data-template-kind={template.kind}
      data-target-cells={JSON.stringify(cellsCoveredByTemplate(template))}
      data-rendered-token-point={renderedTokenPoint ? JSON.stringify(renderedTokenPoint) : ''}
      data-animation-sample-count={animationSampleCount}
      data-active-animation-count={activeAnimationCount}
    />
  )
}

const EMPTY_METRICS: SceneMetrics = {
  averageFps: 0,
  p95FrameTimeMs: 0,
  drawCalls: 0,
  triangles: 0,
  textures: 0,
  maximumClassDetailTextures: 0,
  dpr: 1,
  p95ChunkLatencyMs: 0,
  p95PointerToRenderedFrameLatencyMs: 0,
  sceneResourceBytes: 0,
  rendererState: {
    dpr: 1,
    shadowEnabled: false,
    shadowType: 'other',
    softShadows: false,
    shadowCastingLights: 0,
    shadowMapSizes: [],
    particleCount: 0,
    toneMapping: 'other',
  },
  frameSamples: 0,
}
const IGNORE_METRICS = () => undefined

function tokenChecksum(tokens: readonly TokenRenderState[]): string {
  let checksum = 0x811c9dc5
  for (const token of tokens) {
    for (const character of `${token.id}:${token.cell.column}:${token.cell.row};`) {
      checksum ^= character.charCodeAt(0)
      checksum = Math.imul(checksum, 0x01000193)
    }
  }
  return (checksum >>> 0).toString(16).padStart(8, '0')
}

function fixtureStressMode(): boolean {
  return new URLSearchParams(window.location.search).get('stress') === '1'
}

function isSceneQuality(value: unknown): value is SceneQuality {
  return value === 'high' || value === 'medium' || value === 'low'
}

export function BattleMapCanvas() {
  const [viewer] = useState<Viewer>(fixtureViewer)
  const [stressMode] = useState(fixtureStressMode)
  const [stressScene] = useState(() => createStressScene(Date.now()))
  const [fixtureTokens, setFixtureTokens] = useState<readonly TokenRenderState[]>(() =>
    stressMode ? stressScene.interactiveObjects : FIXTURE_TOKENS,
  )
  const [cameraReady, setCameraReady] = useState(false)
  const [moveIntents, setMoveIntents] = useState<readonly MoveIntent[]>([])
  const [movingLightCell, setMovingLightCell] = useState<GridCell>({ column: 101, row: 100 })
  const [probePoints, setProbePoints] = useState<VisibilityProbePoints | null>(null)
  const [stressTokenPoint, setStressTokenPoint] = useState<ScreenPoint | null>(null)
  const [templateKind, setTemplateKind] = useState<TemplateKind>('circle')
  const [remoteTokenAnimations, setRemoteTokenAnimations] = useState<readonly RemoteTokenAnimation[]>(
    () => (stressMode ? stressScene.animations : []),
  )
  const [quality, setQuality] = useState<SceneQuality>('high')
  const [metrics, setMetrics] = useState<SceneMetrics>(EMPTY_METRICS)
  const [maximumClassTextureRender, setMaximumClassTextureRender] =
    useState<MaximumClassTextureRender | null>(null)
  const [contextLost, setContextLost] = useState(false)
  const [rendererGeneration, setRendererGeneration] = useState(0)
  const [animationDiagnostics, setAnimationDiagnostics] = useState<{
    point: WorldPoint | null
    sampleCount: number
  }>({ point: null, sampleCount: 0 })
  const markCameraReady = useCallback(() => setCameraReady(true), [])
  const recordVisibilityProbePoints = useCallback(
    (points: VisibilityProbePoints) => setProbePoints(points),
    [],
  )
  const recordMoveIntent = useCallback(
    (intent: MoveIntent) => setMoveIntents((current) => [...current, intent]),
    [],
  )
  const moveFixtureLight = useCallback(() => {
    setMovingLightCell((cell) =>
      cell.column === 101 ? { column: 106, row: 100 } : { column: 101, row: 100 },
    )
  }, [])
  const setFixtureTemplate = useCallback((event: Event) => {
    const detail: unknown = (event as CustomEvent<unknown>).detail
    if (!isRecord(detail) || typeof detail.kind !== 'string') return
    if (Object.hasOwn(TARGET_TEMPLATES, detail.kind)) setTemplateKind(detail.kind as TemplateKind)
  }, [])
  const acceptRemoteTokenUpdate = useCallback((event: Event) => {
    const animation = fixtureRemoteTokenAnimation((event as CustomEvent<unknown>).detail)
    if (!animation) return
    setAnimationDiagnostics((current) => ({ ...current, point: null }))
    setRemoteTokenAnimations((animations) => [
      ...animations.filter((candidate) => candidate.tokenId !== animation.tokenId),
      animation,
    ])
    setFixtureTokens((current) =>
      current.map((token) =>
        token.id === animation.tokenId ? { ...token, cell: animation.to } : token,
      ),
    )
  }, [])
  const recordAnimatedTokenPoint = useCallback((_tokenId: string, point: WorldPoint) => {
    if (stressMode) return
    setAnimationDiagnostics((current) => ({
      point,
      sampleCount: current.sampleCount + 1,
    }))
  }, [stressMode])
  const completeRemoteTokenAnimation = useCallback((completed: RemoteTokenAnimation) => {
    if (!stressMode) {
      setRemoteTokenAnimations((current) =>
        removeCompletedRemoteTokenAnimation(current, completed),
      )
      return
    }
    const replacement: RemoteTokenAnimation = {
      tokenId: completed.tokenId,
      from: completed.from,
      to: completed.to,
      eventStartMs: Date.now(),
      durationMs: completed.durationMs,
    }
    setRemoteTokenAnimations((current) => [
      ...removeCompletedRemoteTokenAnimation(current, completed),
      replacement,
    ])
  }, [stressMode])
  const loseContext = useCallback(() => setContextLost(true), [])
  const restoreContext = useCallback(() => setContextLost(false), [])
  const retryRenderer = useCallback(() => {
    setRendererGeneration((generation) => generation + 1)
    setContextLost(false)
  }, [])
  const forceFixtureQuality = useCallback((event: Event) => {
    const detail: unknown = (event as CustomEvent<unknown>).detail
    if (isRecord(detail) && isSceneQuality(detail.quality)) setQuality(detail.quality)
  }, [])
  const tokens =
    viewer === 'dm'
      ? fixtureTokens
      : fixtureTokens.filter((token) => PLAYER_TOKENS.some((playerToken) => playerToken.id === token.id))
  const visibility = viewer === 'dm' ? DM_VISIBILITY : PLAYER_VISIBILITY
  const lights: readonly VisualLight[] = stressMode
    ? stressScene.lights
    : [
        ...FIXED_LIGHTS,
        {
          id: 'moving-torch',
          cell: movingLightCell,
          elevation: 3.5,
          color: '#ffd27a',
          intensity: 24,
          range: 18,
        },
      ]
  const qualitySettings = QUALITY_SETTINGS[quality]
  const interactionTokenCell =
    stressMode
      ? tokens.find((token) => token.id === 'stress-object-050')?.cell ?? null
      : tokens.find((token) => token.id === 'fixture-token')?.cell ?? null

  useEffect(() => {
    window.addEventListener('battle-map:move-light', moveFixtureLight)
    window.addEventListener('battle-map:set-template', setFixtureTemplate)
    window.addEventListener('battle-map:remote-token-update', acceptRemoteTokenUpdate)
    window.addEventListener('battle-map:set-quality', forceFixtureQuality)
    return () => {
      window.removeEventListener('battle-map:move-light', moveFixtureLight)
      window.removeEventListener('battle-map:set-template', setFixtureTemplate)
      window.removeEventListener('battle-map:remote-token-update', acceptRemoteTokenUpdate)
      window.removeEventListener('battle-map:set-quality', forceFixtureQuality)
    }
  }, [acceptRemoteTokenUpdate, forceFixtureQuality, moveFixtureLight, setFixtureTemplate])

  return (
    <div className="battle-map-shell">
      <div className="map-toolbar-band">
        <div className="map-tool-controls" role="toolbar" aria-label="Map effects">
          {(['circle', 'cone', 'line'] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              aria-pressed={templateKind === kind}
              onClick={() => setTemplateKind(kind)}
            >
              {kind[0]!.toUpperCase() + kind.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="battle-map-viewport">
        <Canvas
        key={rendererGeneration}
        data-testid="battle-map-canvas"
        className={contextLost ? 'battle-map-canvas-paused' : undefined}
        orthographic
        frameloop={stressMode ? 'always' : 'demand'}
        camera={{
          position: [100, 150, 160],
          rotation: [-1.19, 0, 0],
          zoom: stressMode ? 18 : 4,
        }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        dpr={[1, qualitySettings.maxDpr]}
        shadows={qualitySettings.softShadows ? 'percentage' : false}
      >
        <color attach="background" args={['#171a1f']} />
        {stressMode && stressScene.fog.active ? (
          <fog
            attach="fog"
            args={[stressScene.fog.color, stressScene.fog.near, stressScene.fog.far]}
          />
        ) : null}
        <WebGLContextBoundary onLost={loseContext} onRestored={restoreContext} />
        <ScenePerformanceMonitor
          quality={quality}
          settings={qualitySettings}
          onQualityChange={setQuality}
          onMetrics={stressMode ? setMetrics : IGNORE_METRICS}
        />
        <ControlledOrbitCamera enabled={!contextLost} />
        <BattleMapCameraProbe
          onReady={markCameraReady}
          onVisibilityProbePoints={recordVisibilityProbePoints}
          onStressTokenPoint={setStressTokenPoint}
          stressTokenCell={interactionTokenCell}
        />
        <BattleMapScene
          tokens={tokens}
          onMoveIntent={recordMoveIntent}
          visibility={visibility}
          lights={lights}
          targetTemplate={TARGET_TEMPLATES[templateKind]}
          remoteTokenAnimations={remoteTokenAnimations}
          onAnimatedTokenWorldPoint={recordAnimatedTokenPoint}
          onRemoteTokenAnimationComplete={completeRemoteTokenAnimation}
          qualitySettings={qualitySettings}
          stressWalls={stressMode ? stressScene.walls : []}
          stressEffects={stressMode}
          onMaximumClassTextureRender={setMaximumClassTextureRender}
        />
        </Canvas>
        {contextLost ? (
          <section className="webgl-recovery" data-testid="webgl-recovery" role="alert">
            <strong>Map renderer paused</strong>
            <button type="button" onClick={retryRenderer}>Retry renderer</button>
          </section>
        ) : null}
      </div>
      <ChunkDiagnostics cameraReady={cameraReady} />
      <TokenInteractionDiagnostics moveIntents={moveIntents} />
      <VisibilityDiagnostics
        viewer={viewer}
        tokens={tokens}
        visibility={visibility}
        movingLightCell={movingLightCell}
        probePoints={probePoints}
      />
      <EffectsAnimationDiagnostics
        template={TARGET_TEMPLATES[templateKind]}
        renderedTokenPoint={animationDiagnostics.point}
        animationSampleCount={animationDiagnostics.sampleCount}
        activeAnimationCount={remoteTokenAnimations.length}
      />
      <output
        hidden
        data-testid="scene-performance-diagnostics"
        data-quality={quality}
        data-max-dpr={qualitySettings.maxDpr}
        data-shadow-map-size={qualitySettings.shadowMapSize}
        data-soft-shadows={qualitySettings.softShadows}
        data-particle-scale={qualitySettings.particleScale}
        data-output-processing={qualitySettings.outputProcessing}
        data-object-count={tokens.length}
        data-maximum-class-detail-texture-count={metrics.maximumClassDetailTextures}
        data-maximum-class-texture-render={
          maximumClassTextureRender ? JSON.stringify(maximumClassTextureRender) : ''
        }
        data-token-checksum={tokenChecksum(tokens)}
        data-interaction-token-point={stressTokenPoint ? JSON.stringify(stressTokenPoint) : ''}
        data-stress-token-point={stressMode && stressTokenPoint ? JSON.stringify(stressTokenPoint) : ''}
        data-renderer-generation={rendererGeneration}
        data-frame-samples={metrics.frameSamples}
        data-renderer-state={JSON.stringify(metrics.rendererState)}
        data-metrics={JSON.stringify(metrics)}
      />
    </div>
  )
}
