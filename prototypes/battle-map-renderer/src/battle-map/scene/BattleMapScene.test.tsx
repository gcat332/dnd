import ReactThreeTestRenderer from '@react-three/test-renderer'
import { expect, it } from 'vitest'
import { BattleMapScene } from './BattleMapScene'

it('builds the layered Battle Map scene graph', async () => {
  const renderer = await ReactThreeTestRenderer.create(<BattleMapScene />)
  expect(renderer.scene.findByProps({ name: 'ambient-map-light' }).type).toBe('AmbientLight')
  expect(renderer.scene.findByProps({ name: 'directional-map-light' }).type).toBe('DirectionalLight')
  expect(renderer.scene.findByProps({ name: 'overview-surface' }).type).toBe('Mesh')
  expect(renderer.scene.findByProps({ name: 'procedural-grid' }).type).toBe('Mesh')
  expect(renderer.scene.findByProps({ name: 'dimensional-terrain' }).type).toBe('Group')
  await renderer.unmount()
})
