import ReactThreeTestRenderer from '@react-three/test-renderer'
import { useState } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import type { TokenRenderState } from '../domain/tokens'
import {
  AnimatedToken,
  removeCompletedRemoteTokenAnimation,
  type RemoteTokenAnimation,
} from './AnimatedToken'

const TOKEN: TokenRenderState = {
  id: 'token-1',
  label: 'Token One',
  cell: { column: 12, row: 10 },
  elevation: 0,
  color: '#37ff78',
  visible: true,
}

const ANIMATION: RemoteTokenAnimation = {
  tokenId: TOKEN.id,
  from: { column: 10, row: 10 },
  to: TOKEN.cell,
  eventStartMs: 1_000,
  durationMs: 1_000,
}

afterEach(() => {
  vi.useRealTimers()
})

it('reports its actual transform and completes once before returning to idle', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(1_500)
  const points: { x: number; z: number }[] = []
  const completions: RemoteTokenAnimation[] = []

  function Harness() {
    const [animations, setAnimations] = useState<readonly RemoteTokenAnimation[]>([ANIMATION])
    const animation = animations[0]
    return animation ? (
      <AnimatedToken
        token={TOKEN}
        animation={animation}
        onMoveIntent={vi.fn()}
        onWorldPoint={(_tokenId, point) => points.push(point)}
        onComplete={(completed) => {
          completions.push(completed)
          setAnimations((current) => removeCompletedRemoteTokenAnimation(current, completed))
        }}
      />
    ) : null
  }

  const renderer = await ReactThreeTestRenderer.create(<Harness />)
  const group = renderer.scene.findByProps({ name: `animated-token-${TOKEN.id}` })
  expect(group.instance.position.toArray()).toEqual([-1, 0, 0])
  expect(points.at(-1)).toEqual({ x: 11.5, z: 10.5 })

  vi.setSystemTime(2_000)
  await ReactThreeTestRenderer.act(async () => {
    await renderer.advanceFrames(1, 0.016)
  })

  expect(points.at(-1)).toEqual({ x: 12.5, z: 10.5 })
  expect(completions).toEqual([ANIMATION])
  expect(renderer.scene.findAllByProps({ name: `animated-token-${TOKEN.id}` })).toHaveLength(0)
  const sampleCountAtCompletion = points.length

  vi.setSystemTime(3_000)
  await ReactThreeTestRenderer.act(async () => {
    await renderer.advanceFrames(5, 0.016)
  })
  expect(points).toHaveLength(sampleCountAtCompletion)
  expect(completions).toHaveLength(1)
  await renderer.unmount()
})

it('does not remove a replacement animation when an older record completes', () => {
  const replacement = { ...ANIMATION, eventStartMs: 1_500 }
  expect(removeCompletedRemoteTokenAnimation([replacement], ANIMATION)).toEqual([replacement])
  expect(removeCompletedRemoteTokenAnimation([ANIMATION, replacement], ANIMATION)).toEqual([
    replacement,
  ])
})
