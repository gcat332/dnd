import { chunkCellSpan, type ChunkAddress } from './chunks'
import { MAP_SIZE_CELLS } from './grid'

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
  const maxColumn = Math.min(
    maxChunk,
    Math.floor((bounds.maxX - Number.EPSILON) / span) + prefetchRings,
  )
  const maxRow = Math.min(
    maxChunk,
    Math.floor((bounds.maxZ - Number.EPSILON) / span) + prefetchRings,
  )
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
