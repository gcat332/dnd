import { useThree } from '@react-three/fiber'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { DoubleSide, PlaneGeometry, type MeshStandardMaterial, type Texture } from 'three'
import { createChunkTexture } from '../fixtures/createChunkTexture'
import {
  MAX_CHUNK_TEXTURE_PIXELS,
  chunkBounds,
  type ChunkAddress,
} from '../domain/chunks'
import { loadChunkWithRetry } from './chunkLoader'

const CELL_TEXTURE_PIXELS = 64
export const STANDARD_DETAIL_TEXTURE_SIZE = 64
const UNIT_PLANE = new PlaneGeometry(1, 1)

export type ChunkTextureLoader = (address: ChunkAddress, textureSize: number) => Promise<Texture>
export type MaximumClassTextureRender = Readonly<{
  address: ChunkAddress
  sourceWidth: number
  sourceHeight: number
  rendered: true
  uploaded: true
}>

type ChunkSurfaceProps = {
  address: ChunkAddress
  textureSize?: number
  loadTexture?: ChunkTextureLoader
  onMaximumClassTextureRender?: (diagnostic: MaximumClassTextureRender) => void
}

type ChunkLoadState = 'loading' | 'ready' | 'failed'

const loadFixtureTexture: ChunkTextureLoader = async (address, textureSize) =>
  createChunkTexture(address, textureSize)

export function ChunkSurface({
  address,
  textureSize = STANDARD_DETAIL_TEXTURE_SIZE,
  loadTexture = loadFixtureTexture,
  onMaximumClassTextureRender,
}: ChunkSurfaceProps) {
  const invalidate = useThree((state) => state.invalidate)
  const material = useRef<MeshStandardMaterial>(null)
  const lastReportedTexture = useRef<Texture | null>(null)
  const [texture, setTexture] = useState<Texture | null>(null)
  const [loadState, setLoadState] = useState<ChunkLoadState>('loading')
  const bounds = chunkBounds(address, CELL_TEXTURE_PIXELS)
  const width = bounds.maxColumnExclusive - bounds.minColumn
  const depth = bounds.maxRowExclusive - bounds.minRow

  useEffect(() => {
    let active = true
    let loadedTexture: Texture | null = null
    const loadStartedAt = performance.now()
    setTexture(null)
    setLoadState('loading')

    void loadChunkWithRetry(address, (candidate) => loadTexture(candidate, textureSize)).then(
      (resource) => {
        loadedTexture = resource
        if (!active) {
          resource.dispose()
          return
        }
        setTexture(resource)
        setLoadState('ready')
        window.dispatchEvent(
          new CustomEvent('battle-map:chunk-loaded', {
            detail: { latencyMs: performance.now() - loadStartedAt },
          }),
        )
        invalidate()
      },
      () => {
        if (!active) return
        setTexture(null)
        setLoadState('failed')
        invalidate()
      },
    )

    return () => {
      active = false
      loadedTexture?.dispose()
    }
  }, [address.column, address.row, invalidate, loadTexture, textureSize])

  useLayoutEffect(() => {
    if (!material.current) return
    material.current.needsUpdate = true
    invalidate()
  }, [invalidate, texture])

  const recordMaximumClassRender = useCallback(() => {
    if (
      textureSize !== MAX_CHUNK_TEXTURE_PIXELS ||
      !texture ||
      lastReportedTexture.current === texture ||
      !onMaximumClassTextureRender
    ) {
      return
    }
    const image = texture.image as { width?: unknown; height?: unknown } | undefined
    if (typeof image?.width !== 'number' || typeof image.height !== 'number') return
    lastReportedTexture.current = texture
    onMaximumClassTextureRender({
      address,
      sourceWidth: image.width,
      sourceHeight: image.height,
      rendered: true,
      uploaded: true,
    })
  }, [address, onMaximumClassTextureRender, texture, textureSize])

  return (
    <mesh
      name={`chunk-surface-${address.column}:${address.row}`}
      userData={{ loadState }}
      position={[
        bounds.minColumn + width / 2,
        0,
        bounds.minRow + depth / 2,
      ]}
      rotation={[-Math.PI / 2, 0, 0]}
      scale={[width, depth, 1]}
      receiveShadow
      onAfterRender={recordMaximumClassRender}
    >
      <primitive object={UNIT_PLANE} attach="geometry" />
      <meshStandardMaterial
        ref={material}
        color={loadState === 'failed' ? '#7a3b32' : texture ? '#ffffff' : '#455f3e'}
        map={texture}
        roughness={0.96}
        metalness={0}
        side={DoubleSide}
      />
    </mesh>
  )
}
