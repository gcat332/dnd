import { assertCellOnMap, type GridCell } from './grid'

export function straightGridPath(from: GridCell, to: GridCell): readonly GridCell[] {
  assertCellOnMap(from)
  assertCellOnMap(to)
  let column = from.column
  let row = from.row
  const deltaColumn = Math.abs(to.column - from.column)
  const deltaRow = Math.abs(to.row - from.row)
  const stepColumn = from.column < to.column ? 1 : -1
  const stepRow = from.row < to.row ? 1 : -1
  let error = deltaColumn - deltaRow
  const path: GridCell[] = []

  for (;;) {
    path.push({ column, row })
    if (column === to.column && row === to.row) return path
    const doubledError = error * 2
    if (doubledError > -deltaRow) {
      error -= deltaRow
      column += stepColumn
    }
    if (doubledError < deltaColumn) {
      error += deltaColumn
      row += stepRow
    }
  }
}
