import { useEffect, useMemo } from 'react'
import {
  DataTexture,
  NearestFilter,
  PlaneGeometry,
  RedFormat,
  UnsignedByteType,
} from 'three'
import { chunkBounds, type ChunkAddress } from '../domain/chunks'
import {
  visibilityTextureData,
  type CellVisibility,
  type VisibilityGrid,
} from '../domain/visibility'
import { chunkAddressKey } from './MapSurface'

const CELL_TEXTURE_PIXELS = 64
const UNIT_PLANE = new PlaneGeometry(1, 1)

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

type VisibilityChunkProps = {
  address: ChunkAddress
  grid: VisibilityGrid
}

function visibilityChunkGrid(grid: VisibilityGrid, address: ChunkAddress): VisibilityGrid {
  visibilityTextureData(grid)
  const bounds = chunkBounds(address, CELL_TEXTURE_PIXELS)
  if (grid.width < bounds.maxColumnExclusive || grid.height < bounds.maxRowExclusive) {
    throw new RangeError('Visibility data must cover every requested Render Chunk')
  }

  const width = bounds.maxColumnExclusive - bounds.minColumn
  const height = bounds.maxRowExclusive - bounds.minRow
  const cells: CellVisibility[] = []
  for (let row = bounds.minRow; row < bounds.maxRowExclusive; row += 1) {
    for (let column = bounds.minColumn; column < bounds.maxColumnExclusive; column += 1) {
      cells.push(grid.cells[row * grid.width + column]!)
    }
  }
  return { width, height, cells }
}

function VisibilityChunk({ address, grid }: VisibilityChunkProps) {
  const bounds = chunkBounds(address, CELL_TEXTURE_PIXELS)
  const width = bounds.maxColumnExclusive - bounds.minColumn
  const depth = bounds.maxRowExclusive - bounds.minRow
  const texture = useMemo(() => {
    const chunkGrid = visibilityChunkGrid(grid, address)
    const resource = new DataTexture(
      visibilityTextureData(chunkGrid),
      chunkGrid.width,
      chunkGrid.height,
      RedFormat,
      UnsignedByteType,
    )
    resource.magFilter = NearestFilter
    resource.minFilter = NearestFilter
    resource.generateMipmaps = false
    resource.needsUpdate = true
    return resource
  }, [address.column, address.row, grid])

  useEffect(() => () => texture.dispose(), [texture])

  return (
    <mesh
      name={`visibility-chunk-${chunkAddressKey(address)}`}
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
  grid: VisibilityGrid
  visibleChunks: readonly ChunkAddress[]
}

export function VisibilityLayer({ grid, visibleChunks }: VisibilityLayerProps) {
  return (
    <group name="visibility-layer">
      {visibleChunks.map((address) => (
        <VisibilityChunk key={chunkAddressKey(address)} address={address} grid={grid} />
      ))}
    </group>
  )
}
