import ReactThreeTestRenderer from '@react-three/test-renderer'
import { afterEach, expect, it, vi } from 'vitest'
import type { CharacterPresentationEvent } from './presentationEvents'
import { CharacterEffects } from './CharacterEffects'

const EVENT: CharacterPresentationEvent = {
  id: 'spell-1',
  effectId: 'fire_projectile',
  sourceTokenId: 'mage',
  targetTokenId: 'skeleton',
  source: { x: 1.5, z: 2.5 },
  target: { x: 5.5, z: 2.5 },
  startedAtMs: Date.now(),
  durationMs: 2_000,
}

afterEach(() => {
  vi.useRealTimers()
})

it('renders only effects whose source and target are visible', async () => {
  const renderer = await ReactThreeTestRenderer.create(
    <CharacterEffects
      events={[EVENT, { ...EVENT, id: 'hidden-source', sourceTokenId: 'hidden' }]}
      visibleTokenIds={new Set(['mage', 'skeleton'])}
      particleScale={1}
    />,
  )
  expect(renderer.scene.findByProps({ name: 'character-effects' }).type).toBe('Group')
  expect(renderer.scene.findByProps({ name: 'character-effect-fire_projectile-spell-1' })).toBeDefined()
  expect(renderer.scene.findAllByProps({ name: 'character-effect-fire_projectile-hidden-source' })).toHaveLength(0)
  await renderer.unmount()
})

it('keeps the core effect at low quality while reducing secondary particles', async () => {
  const high = await ReactThreeTestRenderer.create(
    <CharacterEffects events={[{ ...EVENT, effectId: 'heal_pulse' }]} visibleTokenIds={new Set(['mage', 'skeleton'])} particleScale={1} />,
  )
  const low = await ReactThreeTestRenderer.create(
    <CharacterEffects events={[{ ...EVENT, effectId: 'heal_pulse', id: 'heal-low' }]} visibleTokenIds={new Set(['mage', 'skeleton'])} particleScale={0.25} />,
  )
  expect(high.scene.findByProps({ name: 'character-effect-core-heal_pulse-spell-1' })).toBeDefined()
  expect(low.scene.findByProps({ name: 'character-effect-core-heal_pulse-heal-low' })).toBeDefined()
  expect(high.scene.findAllByProps({ name: /^character-effect-particle-/ }).length).toBeGreaterThan(
    low.scene.findAllByProps({ name: /^character-effect-particle-/ }).length,
  )
  await high.unmount()
  await low.unmount()
})

it('wakes a demand-mode renderer when an active event arrives and keeps it invalidated while animating', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(1_000)
  const invalidate = vi.fn()
  const renderer = await ReactThreeTestRenderer.create(
    <CharacterEffects events={[]} visibleTokenIds={new Set(['mage', 'skeleton'])} particleScale={1} />,
    {
      frameloop: 'demand',
      onCreated: (state) => {
        state.set({ invalidate })
      },
    },
  )
  const initialInvalidationCount = invalidate.mock.calls.length

  await renderer.update(
    <CharacterEffects
      events={[{ ...EVENT, id: 'arrived', startedAtMs: 500 }]}
      visibleTokenIds={new Set(['mage', 'skeleton'])}
      particleScale={1}
    />,
  )
  await ReactThreeTestRenderer.act(async () => {})
  expect(invalidate.mock.calls.length).toBeGreaterThan(initialInvalidationCount)

  const afterArrival = invalidate.mock.calls.length
  await ReactThreeTestRenderer.act(async () => {
    await renderer.advanceFrames(1, 0.016)
  })
  expect(invalidate.mock.calls.length).toBeGreaterThan(afterArrival)
  await renderer.unmount()
})

it('keeps future-dated effects hidden until their start time', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(1_000)
  const futureEvent = { ...EVENT, id: 'future', startedAtMs: 2_000, durationMs: 1_000 }
  const renderer = await ReactThreeTestRenderer.create(
    <CharacterEffects
      events={[futureEvent]}
      visibleTokenIds={new Set(['mage', 'skeleton'])}
      particleScale={1}
    />,
    { frameloop: 'demand' },
  )
  expect(renderer.scene.findAllByProps({ name: 'character-effect-fire_projectile-future' })).toHaveLength(0)

  await ReactThreeTestRenderer.act(async () => {
    vi.advanceTimersByTime(1_000)
  })
  expect(renderer.scene.findByProps({ name: 'character-effect-fire_projectile-future' })).toBeDefined()
  await renderer.unmount()
})
