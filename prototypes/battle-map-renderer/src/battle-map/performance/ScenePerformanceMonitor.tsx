import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import {
  frameTimesForRollingWindow,
  qualityForAverageFps,
  type FrameTimeSample,
  type SceneQuality,
} from './quality'

export type SceneMetrics = Readonly<{
  averageFps: number
  p95FrameTimeMs: number
  drawCalls: number
  triangles: number
  textures: number
  dpr: number
  p95ChunkLatencyMs: number
  p95InputLatencyMs: number
  frameSamples: number
}>

type ScenePerformanceMonitorProps = Readonly<{
  quality: SceneQuality
  onQualityChange: (quality: SceneQuality) => void
  onMetrics: (metrics: SceneMetrics) => void
}>

function percentile95(samples: readonly number[]): number {
  if (samples.length === 0) return 0
  const sorted = [...samples].sort((left, right) => left - right)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)]!
}

export function ScenePerformanceMonitor({
  quality,
  onQualityChange,
  onMetrics,
}: ScenePerformanceMonitorProps) {
  const gl = useThree((state) => state.gl)
  const frameTimes = useRef<FrameTimeSample[]>([])
  const frameSampleCount = useRef(0)
  const chunkLatencies = useRef<number[]>([])
  const inputLatencies = useRef<number[]>([])
  const windowStartedAt = useRef(performance.now())
  const lastReportAt = useRef(0)
  const pendingQuality = useRef<SceneQuality | null>(null)
  const consecutiveWindows = useRef(0)

  useEffect(() => {
    const recordChunkLatency = (event: Event) => {
      const latency = (event as CustomEvent<{ latencyMs?: unknown }>).detail?.latencyMs
      if (typeof latency === 'number' && Number.isFinite(latency) && latency >= 0) {
        chunkLatencies.current.push(latency)
      }
    }
    const recordInputLatency = () => {
      const startedAt = performance.now()
      requestAnimationFrame(() => inputLatencies.current.push(performance.now() - startedAt))
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
    frameTimes.current.push({ recordedAtMs: now, frameTimeMs: deltaSeconds * 1_000 })
    frameSampleCount.current += 1
    frameTimes.current = frameTimes.current.filter(
      (sample) => sample.recordedAtMs >= now - 5_000,
    )

    if (now - lastReportAt.current >= 500) {
      lastReportAt.current = now
      const recent = frameTimesForRollingWindow(frameTimes.current, now)
      const averageFrameTime = recent.reduce((sum, value) => sum + value, 0) / recent.length
      onMetrics({
        averageFps: averageFrameTime > 0 ? 1_000 / averageFrameTime : 0,
        p95FrameTimeMs: percentile95(recent),
        drawCalls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        textures: gl.info.memory.textures,
        dpr: gl.getPixelRatio(),
        p95ChunkLatencyMs: percentile95(chunkLatencies.current),
        p95InputLatencyMs: percentile95(inputLatencies.current),
        frameSamples: frameSampleCount.current,
      })
    }

    if (now - windowStartedAt.current < 5_000) return
    const windowSamples = frameTimesForRollingWindow(frameTimes.current, now)
    const averageFrameTime =
      windowSamples.reduce((sum, value) => sum + value, 0) / windowSamples.length
    const candidate = qualityForAverageFps(averageFrameTime > 0 ? 1_000 / averageFrameTime : 0)
    if (candidate === quality) {
      pendingQuality.current = null
      consecutiveWindows.current = 0
    } else if (candidate === pendingQuality.current) {
      consecutiveWindows.current += 1
      if (consecutiveWindows.current >= 2) {
        onQualityChange(candidate)
        pendingQuality.current = null
        consecutiveWindows.current = 0
      }
    } else {
      pendingQuality.current = candidate
      consecutiveWindows.current = 1
    }
    windowStartedAt.current = now
  })

  return null
}
