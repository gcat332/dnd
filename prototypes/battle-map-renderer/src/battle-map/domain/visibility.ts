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
