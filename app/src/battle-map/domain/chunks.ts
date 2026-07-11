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
  if (!Number.isInteger(address.column) || !Number.isInteger(address.row)) {
    throw new RangeError('Render Chunk address components must be non-negative integers')
  }
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
