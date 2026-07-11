import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import {
  ACESFilmicToneMapping,
  FloatType,
  HalfFloatType,
  NoToneMapping,
  PCFShadowMap,
  PCFSoftShadowMap,
  RedFormat,
  RGFormat,
  ShortType,
  UnsignedIntType,
  UnsignedShortType,
  type BufferGeometry,
  type Material,
  type Texture,
} from 'three'
import {
  frameTimesForRollingWindow,
  nextQualityTransition,
  qualityForAverageFps,
  type FrameTimeSample,
  type SceneQuality,
  type SceneQualitySettings,
} from './quality'

export type RendererQualityState = Readonly<{
  dpr: number
  shadowEnabled: boolean
  shadowType: 'PCFShadowMap' | 'PCFSoftShadowMap' | 'other'
  softShadows: boolean
  shadowCastingLights: number
  shadowMapSizes: readonly number[]
  particleCount: number
  toneMapping: 'ACESFilmicToneMapping' | 'NoToneMapping' | 'other'
}>

export type SceneMetrics = Readonly<{
  averageFps: number
  p95FrameTimeMs: number
  drawCalls: number
  triangles: number
  textures: number
  maximumClassDetailTextures: number
  dpr: number
  p95ChunkLatencyMs: number
  p95PointerToRenderedFrameLatencyMs: number
  sceneResourceBytes: number
  rendererState: RendererQualityState
  frameSamples: number
}>

type ScenePerformanceMonitorProps = Readonly<{
  quality: SceneQuality
  settings: SceneQualitySettings
  onQualityChange: (quality: SceneQuality) => void
  onMetrics: (metrics: SceneMetrics) => void
}>

function percentile95(samples: readonly number[]): number {
  if (samples.length === 0) return 0
  const sorted = [...samples].sort((left, right) => left - right)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)]!
}

function texturesInMaterial(material: Material, textures: Set<Texture>): void {
  for (const value of Object.values(material)) {
    if (value && typeof value === 'object' && 'isTexture' in value) textures.add(value as Texture)
  }
  const uniforms = (material as Material & { uniforms?: Record<string, { value?: unknown }> }).uniforms
  for (const uniform of Object.values(uniforms ?? {})) {
    const value = uniform.value
    if (value && typeof value === 'object' && 'isTexture' in value) textures.add(value as Texture)
  }
}

function textureSourceBytes(texture: Texture): number {
  const image = texture.image as { width?: unknown; height?: unknown; data?: { byteLength?: unknown } } | undefined
  if (typeof image?.data?.byteLength === 'number') return image.data.byteLength
  const width = typeof image?.width === 'number' ? image.width : 0
  const height = typeof image?.height === 'number' ? image.height : 0
  const channels = texture.format === RedFormat ? 1 : texture.format === RGFormat ? 2 : 4
  const bytesPerComponent =
    texture.type === FloatType || texture.type === UnsignedIntType
      ? 4
      : texture.type === HalfFloatType || texture.type === UnsignedShortType || texture.type === ShortType
        ? 2
        : 1
  return width * height * channels * bytesPerComponent
}

function geometryBytes(geometry: BufferGeometry): number {
  const arrays = new Set<ArrayBufferLike>()
  if (geometry.index) arrays.add(geometry.index.array.buffer)
  for (const attribute of Object.values(geometry.attributes)) arrays.add(attribute.array.buffer)
  return [...arrays].reduce((sum, buffer) => sum + buffer.byteLength, 0)
}

export function ScenePerformanceMonitor({
  quality,
  settings,
  onQualityChange,
  onMetrics,
}: ScenePerformanceMonitorProps) {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const frameTimes = useRef<FrameTimeSample[]>([])
  const frameSampleCount = useRef(0)
  const chunkLatencies = useRef<number[]>([])
  const pointerToFrameLatencies = useRef<number[]>([])
  const pendingPointerTimes = useRef<number[]>([])
  const windowStartedAt = useRef(performance.now())
  const lastReportAt = useRef(0)
  const transition = useRef({ candidate: null as SceneQuality | null, consecutiveWindows: 0 })

  useEffect(() => {
    gl.toneMapping = settings.outputProcessing ? ACESFilmicToneMapping : NoToneMapping
    gl.shadowMap.type = PCFShadowMap
    gl.shadowMap.needsUpdate = true
  }, [gl, settings.outputProcessing])

  useEffect(() => {
    const recordChunkLatency = (event: Event) => {
      const latency = (event as CustomEvent<{ latencyMs?: unknown }>).detail?.latencyMs
      if (typeof latency === 'number' && Number.isFinite(latency) && latency >= 0) {
        chunkLatencies.current.push(latency)
      }
    }
    const recordInputLatency = () => {
      pendingPointerTimes.current.push(performance.now())
    }
    window.addEventListener('battle-map:chunk-loaded', recordChunkLatency)
    gl.domElement.addEventListener('pointerdown', recordInputLatency)
    return () => {
      window.removeEventListener('battle-map:chunk-loaded', recordChunkLatency)
      gl.domElement.removeEventListener('pointerdown', recordInputLatency)
    }
  }, [gl])

  useFrame((_state, deltaSeconds) => {
    const now = performance.now()
    for (const pointerTime of pendingPointerTimes.current.splice(0)) {
      pointerToFrameLatencies.current.push(now - pointerTime)
    }
    frameTimes.current.push({ recordedAtMs: now, frameTimeMs: deltaSeconds * 1_000 })
    frameSampleCount.current += 1
    frameTimes.current = frameTimes.current.filter(
      (sample) => sample.recordedAtMs >= now - 5_000,
    )

    if (now - lastReportAt.current >= 500) {
      lastReportAt.current = now
      const recent = frameTimesForRollingWindow(frameTimes.current, now)
      const averageFrameTime = recent.reduce((sum, value) => sum + value, 0) / recent.length
      const geometries = new Set<BufferGeometry>()
      const textures = new Set<Texture>()
      const shadowMapSizes: number[] = []
      let shadowCastingLights = 0
      scene.traverse((object) => {
        const renderable = object as typeof object & {
          geometry?: BufferGeometry
          material?: Material | Material[]
          isLight?: boolean
          castShadow?: boolean
          shadow?: { mapSize: { x: number } }
        }
        if (renderable.geometry) geometries.add(renderable.geometry)
        const materials = Array.isArray(renderable.material) ? renderable.material : renderable.material ? [renderable.material] : []
        for (const material of materials) texturesInMaterial(material, textures)
        if (renderable.isLight && renderable.castShadow && renderable.shadow) {
          shadowCastingLights += 1
          shadowMapSizes.push(renderable.shadow.mapSize.x)
        }
      })
      const particleCount = scene.getObjectByName('stress-particle-effect')?.children.length ?? 0
      const sceneResourceBytes =
        [...geometries].reduce((sum, geometry) => sum + geometryBytes(geometry), 0) +
        [...textures].reduce((sum, texture) => sum + textureSourceBytes(texture), 0)
      const maximumClassDetailTextures = [...textures].filter((texture) => {
        const image = texture.image as { width?: unknown; height?: unknown } | undefined
        return image?.width === 2048 && image.height === 2048
      }).length
      onMetrics({
        averageFps: averageFrameTime > 0 ? 1_000 / averageFrameTime : 0,
        p95FrameTimeMs: percentile95(recent),
        drawCalls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        textures: gl.info.memory.textures,
        maximumClassDetailTextures,
        dpr: gl.getPixelRatio(),
        p95ChunkLatencyMs: percentile95(chunkLatencies.current),
        p95PointerToRenderedFrameLatencyMs: percentile95(pointerToFrameLatencies.current),
        sceneResourceBytes,
        rendererState: {
          dpr: gl.getPixelRatio(),
          shadowEnabled: gl.shadowMap.enabled,
          shadowType:
            gl.shadowMap.type === PCFShadowMap
              ? 'PCFShadowMap'
              : gl.shadowMap.type === PCFSoftShadowMap
                ? 'PCFSoftShadowMap'
                : 'other',
          softShadows: settings.softShadows,
          shadowCastingLights,
          shadowMapSizes: shadowMapSizes.sort((left, right) => left - right),
          particleCount,
          toneMapping:
            gl.toneMapping === ACESFilmicToneMapping
              ? 'ACESFilmicToneMapping'
              : gl.toneMapping === NoToneMapping
                ? 'NoToneMapping'
                : 'other',
        },
        frameSamples: frameSampleCount.current,
      })
    }

    if (now - windowStartedAt.current < 5_000) return
    const windowSamples = frameTimesForRollingWindow(frameTimes.current, now)
    const averageFrameTime =
      windowSamples.reduce((sum, value) => sum + value, 0) / windowSamples.length
    const candidate = qualityForAverageFps(averageFrameTime > 0 ? 1_000 / averageFrameTime : 0)
    const result = nextQualityTransition(quality, transition.current, candidate)
    transition.current = result
    if (result.quality !== quality) onQualityChange(result.quality)
    windowStartedAt.current = now
  })

  return null
}
