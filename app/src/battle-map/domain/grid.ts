export const MAP_SIZE_CELLS = 200

export type GridCell = Readonly<{ column: number; row: number }>
export type WorldPoint = Readonly<{ x: number; z: number }>

export function assertCellOnMap(cell: GridCell): void {
  if (
    !Number.isInteger(cell.column) ||
    !Number.isInteger(cell.row) ||
    cell.column < 0 ||
    cell.row < 0 ||
    cell.column >= MAP_SIZE_CELLS ||
    cell.row >= MAP_SIZE_CELLS
  ) {
    throw new RangeError(`Grid Cell (${cell.column}, ${cell.row}) is outside the Battle Map`)
  }
}

export function gridToWorld(cell: GridCell): WorldPoint {
  assertCellOnMap(cell)
  return { x: cell.column + 0.5, z: cell.row + 0.5 }
}

export function worldToGrid(point: WorldPoint): GridCell {
  const cell = { column: Math.floor(point.x), row: Math.floor(point.z) }
  assertCellOnMap(cell)
  return cell
}
