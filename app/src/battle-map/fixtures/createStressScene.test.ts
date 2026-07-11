import { expect, it } from 'vitest'
import { createStressScene } from './createStressScene'

it('creates a deterministic 200-object renderer stress scene', () => {
  const first = createStressScene()
  const second = createStressScene()

  expect(first).toEqual(second)
  expect(first.interactiveObjects).toHaveLength(200)
  expect(new Set(first.interactiveObjects.map((object) => object.id)).size).toBe(200)
  expect(first.interactiveObjects.some((object) => object.kind === 'token')).toBe(true)
  expect(first.interactiveObjects.some((object) => object.kind === 'prop')).toBe(true)
  expect(first.walls.length).toBeGreaterThan(0)
  expect(first.lights).toHaveLength(3)
  expect(first.fog.active).toBe(true)
  expect(first.animations.length).toBeGreaterThan(0)
})
