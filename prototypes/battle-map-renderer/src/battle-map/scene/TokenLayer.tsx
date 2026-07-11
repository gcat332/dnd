import { useEffect } from 'react'
import type { WorldPoint } from '../domain/grid'
import type { MoveIntent, TokenRenderState } from '../domain/tokens'
import { useBattleMapView } from '../state/useBattleMapView'
import { MovementPreview } from './MovementPreview'
import { AnimatedToken, type RemoteTokenAnimation } from './AnimatedToken'
import { TokenMesh } from './TokenMesh'

export type TokenLayerProps = {
  tokens: readonly TokenRenderState[]
  onMoveIntent: (intent: MoveIntent) => void
  remoteTokenAnimations?: readonly RemoteTokenAnimation[]
  onAnimatedTokenWorldPoint?: (tokenId: string, point: WorldPoint) => void
}

export function TokenLayer({
  tokens,
  onMoveIntent,
  remoteTokenAnimations = [],
  onAnimatedTokenWorldPoint,
}: TokenLayerProps) {
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
        .map((token) => {
          const animation = remoteTokenAnimations.find((candidate) => candidate.tokenId === token.id)
          return animation ? (
            <AnimatedToken
              key={token.id}
              token={token}
              animation={animation}
              onMoveIntent={onMoveIntent}
              onWorldPoint={onAnimatedTokenWorldPoint}
            />
          ) : (
            <TokenMesh key={token.id} token={token} onMoveIntent={onMoveIntent} />
          )
        })}
    </group>
  )
}
