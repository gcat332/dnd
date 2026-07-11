import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group } from 'three'
import { gridToWorld, type GridCell, type WorldPoint } from '../domain/grid'
import { interpolateWorldPoint } from '../domain/interpolation'
import type { MoveIntent, TokenRenderState } from '../domain/tokens'
import { TokenMesh } from './TokenMesh'

export type RemoteTokenAnimation = Readonly<{
  tokenId: string
  from: GridCell
  to: GridCell
  eventStartMs: number
  durationMs: number
}>

export type AnimatedTokenProps = {
  token: TokenRenderState
  animation: RemoteTokenAnimation
  onMoveIntent: (intent: MoveIntent) => void
  onWorldPoint?: (tokenId: string, point: WorldPoint) => void
}

export function AnimatedToken({
  token,
  animation,
  onMoveIntent,
  onWorldPoint,
}: AnimatedTokenProps) {
  const group = useRef<Group>(null)
  const invalidate = useThree((state) => state.invalidate)
  const from = gridToWorld(animation.from)
  const to = gridToWorld(animation.to)
  const initial = interpolateWorldPoint(from, to, Date.now(), animation.eventStartMs, animation.durationMs)

  useFrame(() => {
    const point = interpolateWorldPoint(
      from,
      to,
      Date.now(),
      animation.eventStartMs,
      animation.durationMs,
    )
    group.current?.position.set(point.x - to.x, 0, point.z - to.z)
    onWorldPoint?.(token.id, point)
    if (Date.now() < animation.eventStartMs + animation.durationMs) invalidate()
  })

  return (
    <group
      ref={group}
      name={`animated-token-${token.id}`}
      position={[initial.x - to.x, 0, initial.z - to.z]}
    >
      <TokenMesh token={{ ...token, cell: animation.to }} onMoveIntent={onMoveIntent} />
    </group>
  )
}
