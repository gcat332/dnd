import { expect, it } from 'vitest'
import { visibilityTextureData } from './visibility'

it('encodes hidden, explored, and visible cells without consulting lights', () => {
  const data = visibilityTextureData({
    width: 3,
    height: 1,
    cells: ['hidden', 'explored', 'visible'],
  })
  expect([...data]).toEqual([0, 96, 255])
})
