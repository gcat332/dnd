import { useEffect } from 'react'
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
  const clearDragPreview = useBattleMapView((state) => state.clearDragPreview)
  const previewToken = dragPreview
    ? tokens.find((token) => token.visible && token.id === dragPreview.tokenId)
    : undefined

  useEffect(() => {
    if (dragPreview && !previewToken) clearDragPreview()
  }, [clearDragPreview, dragPreview, previewToken])

  return (
    <group name="token-layer">
      {dragPreview && previewToken ? (
        <MovementPreview from={previewToken.cell} to={dragPreview.cell} />
      ) : null}
      {tokens
        .filter((token) => token.visible)
        .map((token) => (
          <TokenMesh key={token.id} token={token} onMoveIntent={onMoveIntent} />
        ))}
    </group>
  )
}
