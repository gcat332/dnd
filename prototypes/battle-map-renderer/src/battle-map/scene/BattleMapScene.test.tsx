import ReactThreeTestRenderer from '@react-three/test-renderer'
import { expect, it } from 'vitest'
import { BattleMapScene } from './BattleMapScene'

it('builds the layered Battle Map scene graph', async () => {
  const renderer = await ReactThreeTestRenderer.create(<BattleMapScene />)
  expect(renderer.scene.children.length).toBeGreaterThanOrEqual(4)
  await renderer.unmount()
})
