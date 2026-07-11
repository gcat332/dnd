import { useEffect, useMemo } from 'react'
import {
  DataTexture,
  NearestFilter,
  PlaneGeometry,
  RedFormat,
  UnsignedByteType,
} from 'three'
import { chunkBounds, type ChunkAddress, type ChunkBounds } from '../domain/chunks'
import { MAP_SIZE_CELLS } from '../domain/grid'
import { visibilityTextureData, type VisibilityGrid } from '../domain/visibility'
import type { MapDetailMode } from '../domain/viewport'
import { chunkAddressKey } from './MapSurface'

const CELL_TEXTURE_PIXELS = 64
const UNIT_PLANE = new PlaneGeometry(1, 1)
const OVERVIEW_BOUNDS: ChunkBounds = {
  minColumn: 0,
  minRow: 0,
  maxColumnExclusive: MAP_SIZE_CELLS,
  maxRowExclusive: MAP_SIZE_CELLS,
}

const VERTEX_SHADER = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAGMENT_SHADER = `
  uniform sampler2D visibilityMap;
  varying vec2 vUv;

  void main() {
    float visibility = texture2D(visibilityMap, vUv).r;
    if (visibility < 0.19) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    } else if (visibility < 0.75) {
      gl_FragColor = vec4(0.055, 0.06, 0.065, 0.76);
    } else {
      gl_FragColor = vec4(0.0);
    }
  }
`

function visibilitySlice(
  grid: VisibilityGrid,
  encodedGrid: Uint8Array,
  bounds: ChunkBounds,
): { width: number; height: number; data: Uint8Array } {
  if (grid.width < bounds.maxColumnExclusive || grid.height < bounds.maxRowExclusive) {
    throw new RangeError('Visibility data must cover every requested Render Chunk')
  }

  const width = bounds.maxColumnExclusive - bounds.minColumn
  const height = bounds.maxRowExclusive - bounds.minRow
  const data = new Uint8Array(width * height)
  for (let textureRow = 0; textureRow < height; textureRow += 1) {
    const worldRow = bounds.maxRowExclusive - textureRow - 1
    const sourceStart = worldRow * grid.width + bounds.minColumn
    data.set(encodedGrid.subarray(sourceStart, sourceStart + width), textureRow * width)
  }
  return { width, height, data }
}

type VisibilitySurfaceProps = {
  name: string
  bounds: ChunkBounds
  grid: VisibilityGrid
  encodedGrid: Uint8Array
}

function VisibilitySurface({ name, bounds, grid, encodedGrid }: VisibilitySurfaceProps) {
  const width = bounds.maxColumnExclusive - bounds.minColumn
  const depth = bounds.maxRowExclusive - bounds.minRow
  const texture = useMemo(() => {
    const slice = visibilitySlice(grid, encodedGrid, bounds)
    const resource = new DataTexture(
      slice.data,
      slice.width,
      slice.height,
      RedFormat,
      UnsignedByteType,
    )
    resource.magFilter = NearestFilter
    resource.minFilter = NearestFilter
    resource.generateMipmaps = false
    resource.needsUpdate = true
    return resource
  }, [bounds.maxColumnExclusive, bounds.maxRowExclusive, bounds.minColumn, bounds.minRow, encodedGrid, grid])

  useEffect(() => () => texture.dispose(), [texture])

  return (
    <mesh
      name={name}
      position={[bounds.minColumn + width / 2, 0.06, bounds.minRow + depth / 2]}
      rotation={[-Math.PI / 2, 0, 0]}
      scale={[width, depth, 1]}
      renderOrder={10}
    >
      <primitive object={UNIT_PLANE} attach="geometry" dispose={null} />
      <shaderMaterial
        uniforms={{ visibilityMap: { value: texture } }}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        transparent
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}

export type VisibilityLayerProps = {
  mode: MapDetailMode
  grid: VisibilityGrid
  visibleChunks: readonly ChunkAddress[]
}

export function VisibilityLayer({ mode, grid, visibleChunks }: VisibilityLayerProps) {
  const encodedGrid = useMemo(() => visibilityTextureData(grid), [grid])

  return (
    <group name="visibility-layer">
      {mode === 'overview' ? (
        <VisibilitySurface
          name="visibility-overview"
          bounds={OVERVIEW_BOUNDS}
          grid={grid}
          encodedGrid={encodedGrid}
        />
      ) : (
        visibleChunks.map((address) => (
          <VisibilitySurface
            key={chunkAddressKey(address)}
            name={`visibility-chunk-${chunkAddressKey(address)}`}
            bounds={chunkBounds(address, CELL_TEXTURE_PIXELS)}
            grid={grid}
            encodedGrid={encodedGrid}
          />
        ))
      )}
    </group>
  )
}
