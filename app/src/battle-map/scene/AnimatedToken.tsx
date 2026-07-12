import { useFrame, useThree } from '@react-three/fiber'
import { useCallback, useLayoutEffect, useMemo, useRef } from 'react'
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
  onComplete: (animation: RemoteTokenAnimation) => void
}

export function removeCompletedRemoteTokenAnimation(
  animations: readonly RemoteTokenAnimation[],
  completed: RemoteTokenAnimation,
): readonly RemoteTokenAnimation[] {
  return animations.filter((animation) => animation !== completed)
}

export function AnimatedToken({
  token,
  animation,
  onMoveIntent,
  onWorldPoint,
  onComplete,
}: AnimatedTokenProps) {
  const group = useRef<Group>(null)
  const active = useRef(true)
  const invalidate = useThree((state) => state.invalidate)
  const { from, to, initial } = useMemo(() => {
    const animationFrom = gridToWorld(animation.from)
    const animationTo = gridToWorld(animation.to)
    return {
      from: animationFrom,
      to: animationTo,
      initial: interpolateWorldPoint(
        animationFrom,
        animationTo,
        Date.now(),
        animation.eventStartMs,
        animation.durationMs,
      ),
    }
  }, [animation])

  const reportGroupWorldPoint = useCallback(() => {
    const position = group.current?.position
    if (!position) return
    onWorldPoint?.(token.id, { x: to.x + position.x, z: to.z + position.z })
  }, [onWorldPoint, token.id, to.x, to.z])

  useLayoutEffect(() => {
    active.current = true
    reportGroupWorldPoint()
    invalidate()
    return () => {
      active.current = false
    }
  }, [animation, invalidate, reportGroupWorldPoint])

  useFrame(() => {
    if (!active.current) return
    const nowMs = Date.now()
    const point = interpolateWorldPoint(
      from,
      to,
      nowMs,
      animation.eventStartMs,
      animation.durationMs,
    )
    group.current?.position.set(point.x - to.x, 0, point.z - to.z)
    reportGroupWorldPoint()
    if (nowMs >= animation.eventStartMs + animation.durationMs) {
      active.current = false
      onComplete(animation)
      return
    }
    invalidate()
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
