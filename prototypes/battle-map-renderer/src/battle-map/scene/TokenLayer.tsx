import type { MoveIntent, TokenRenderState } from '../domain/tokens'
import { useBattleMapView } from '../state/useBattleMapView'
import { MovementPreview } from './MovementPreview'
import { TokenMesh } from './TokenMesh'

export type TokenLayerProps = {
  tokens: readonly TokenRenderState[]
  onMoveIntent: (intent: MoveIntent) => void
}

export function TokenLayer({ tokens, onMoveIntent }: TokenLayerProps) {
  const dragPreview = useBattleMapView((state) => state.dragPreview)
  const previewToken = dragPreview
    ? tokens.find((token) => token.id === dragPreview.tokenId)
    : undefined

  return (
    <group name="token-layer" dispose={null}>
      {previewToken ? <MovementPreview from={previewToken.cell} to={dragPreview!.cell} /> : null}
      {tokens
        .filter((token) => token.visible)
        .map((token) => (
          <TokenMesh key={token.id} token={token} onMoveIntent={onMoveIntent} />
        ))}
    </group>
  )
}
