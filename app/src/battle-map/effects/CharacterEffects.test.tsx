import ReactThreeTestRenderer from '@react-three/test-renderer'
import { expect, it } from 'vitest'
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
