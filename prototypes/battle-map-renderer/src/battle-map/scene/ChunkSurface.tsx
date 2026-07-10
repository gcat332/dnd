import { useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { DoubleSide, PlaneGeometry, type MeshStandardMaterial, type Texture } from 'three'
import { createChunkTexture } from '../fixtures/createChunkTexture'
import { chunkBounds, type ChunkAddress } from '../domain/chunks'
import { loadChunkWithRetry } from './chunkLoader'

const CELL_TEXTURE_PIXELS = 64
const UNIT_PLANE = new PlaneGeometry(1, 1)

type ChunkSurfaceProps = {
  address: ChunkAddress
}

export function ChunkSurface({ address }: ChunkSurfaceProps) {
  const invalidate = useThree((state) => state.invalidate)
  const material = useRef<MeshStandardMaterial>(null)
  const [texture, setTexture] = useState<Texture | null>(null)
  const bounds = chunkBounds(address, CELL_TEXTURE_PIXELS)
  const width = bounds.maxColumnExclusive - bounds.minColumn
  const depth = bounds.maxRowExclusive - bounds.minRow

  useEffect(() => {
    let active = true
    let loadedTexture: Texture | null = null

    void loadChunkWithRetry(address, async (chunkAddress) => createChunkTexture(chunkAddress)).then(
      (resource) => {
        loadedTexture = resource
        if (!active) {
          resource.dispose()
          return
        }
        setTexture(resource)
        invalidate()
      },
    )

    return () => {
      active = false
      loadedTexture?.dispose()
    }
  }, [address.column, address.row, invalidate])

  useLayoutEffect(() => {
    if (!texture || !material.current) return
    material.current.needsUpdate = true
    invalidate()
  }, [invalidate, texture])

  return (
    <mesh
      position={[
        bounds.minColumn + width / 2,
        0,
        bounds.minRow + depth / 2,
      ]}
      rotation={[-Math.PI / 2, 0, 0]}
      scale={[width, depth, 1]}
      receiveShadow
    >
      <primitive object={UNIT_PLANE} attach="geometry" />
      <meshStandardMaterial
        ref={material}
        color={texture ? '#ffffff' : '#455f3e'}
        map={texture}
        roughness={0.96}
        metalness={0}
        side={DoubleSide}
      />
    </mesh>
  )
}
