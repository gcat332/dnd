import { MAP_SIZE_CELLS } from '../battle-map/domain/grid'
import type { TokenRenderState } from '../battle-map/domain/tokens'

export type Token = {
  id: string
  battle_map_id: string
  label: string
  color: string
  column: number
  row: number
  elevation: number
}

export function isTokenCellOnMap(column: number, row: number): boolean {
  return (
    Number.isInteger(column) &&
    Number.isInteger(row) &&
    column >= 0 &&
    row >= 0 &&
    column < MAP_SIZE_CELLS &&
    row < MAP_SIZE_CELLS
  )
}

export function tokenToRenderState(token: Token): TokenRenderState {
  return {
    id: token.id,
    label: token.label,
    cell: { column: token.column, row: token.row },
    elevation: token.elevation,
    color: token.color,
    visible: true,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isToken(value: unknown): value is Token {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.battle_map_id === 'string' &&
    typeof value.label === 'string' &&
    typeof value.color === 'string' &&
    typeof value.elevation === 'number' &&
    typeof value.column === 'number' &&
    typeof value.row === 'number' &&
    isTokenCellOnMap(value.column, value.row)
  )
}

export function parseTokens(value: unknown): Token[] {
  if (!Array.isArray(value)) return []
  return value.filter(isToken)
}
