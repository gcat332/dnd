import type { GridCell } from './grid'

export type TokenRenderState = Readonly<{
  id: string
  label: string
  cell: GridCell
  elevation: number
  color: string
  visible: boolean
}>

export type MoveIntent = Readonly<{
  tokenId: string
  from: GridCell
  to: GridCell
  path: readonly GridCell[]
}>
