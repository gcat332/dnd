import { MAP_SIZE_CELLS, assertCellOnMap, type GridCell } from './grid'
import { straightGridPath } from './movement'

type GridDirection = Readonly<{ column: -1 | 0 | 1; row: -1 | 0 | 1 }>

export type AreaTemplate =
  | Readonly<{ kind: 'circle'; origin: GridCell; radius: number }>
  | Readonly<{ kind: 'line'; origin: GridCell; direction: GridDirection; length: number }>
  | Readonly<{ kind: 'cone'; origin: GridCell; direction: GridDirection; length: number }>

function validCell(column: number, row: number): GridCell | null {
  if (column < 0 || row < 0 || column >= MAP_SIZE_CELLS || row >= MAP_SIZE_CELLS) return null
  return { column, row }
}

function assertDirection(direction: GridDirection): void {
  if (direction.column === 0 && direction.row === 0) {
    throw new RangeError('Direction cannot be zero')
  }
}

export function cellsCoveredByTemplate(template: AreaTemplate): readonly GridCell[] {
  assertCellOnMap(template.origin)
  const templateSize = template.kind === 'circle' ? template.radius : template.length
  if (!Number.isInteger(templateSize) || templateSize < 1) {
    throw new RangeError('Template size must be a positive integer')
  }

  if (template.kind === 'line') {
    assertDirection(template.direction)
    const end = {
      column: Math.min(
        MAP_SIZE_CELLS - 1,
        Math.max(0, template.origin.column + template.direction.column * template.length),
      ),
      row: Math.min(
        MAP_SIZE_CELLS - 1,
        Math.max(0, template.origin.row + template.direction.row * template.length),
      ),
    }
    return straightGridPath(template.origin, end)
  }

  const covered: GridCell[] = []
  const size = templateSize
  if (template.kind === 'cone') assertDirection(template.direction)

  for (let row = template.origin.row - size; row <= template.origin.row + size; row += 1) {
    for (
      let column = template.origin.column - size;
      column <= template.origin.column + size;
      column += 1
    ) {
      const cell = validCell(column, row)
      if (!cell) continue
      const deltaColumn = column - template.origin.column
      const deltaRow = row - template.origin.row
      if (template.kind === 'circle') {
        if (deltaColumn ** 2 + deltaRow ** 2 <= template.radius ** 2) covered.push(cell)
        continue
      }
      const forward =
        deltaColumn * template.direction.column + deltaRow * template.direction.row
      const sideways = Math.abs(
        deltaColumn * template.direction.row - deltaRow * template.direction.column,
      )
      const directionScale = Math.hypot(template.direction.column, template.direction.row)
      if (forward >= 0 && forward <= template.length * directionScale && sideways <= forward) {
        covered.push(cell)
      }
    }
  }
  return covered
}
