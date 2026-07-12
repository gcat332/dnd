import type { GridCell } from './grid'
import type { CharacterPresentationState } from '../characters/contract'

export type TokenRenderState = Readonly<{
  id: string
  label: string
  cell: GridCell
  elevation: number
  color: string
  visible: boolean
  character?: CharacterPresentationState
}>

export type MoveIntent = Readonly<{
  tokenId: string
  from: GridCell
  to: GridCell
  path: readonly GridCell[]
}>
