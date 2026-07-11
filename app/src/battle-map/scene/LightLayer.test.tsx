import ReactThreeTestRenderer from '@react-three/test-renderer'
import { expect, it } from 'vitest'
import type { PointLight } from 'three'
import type { VisualLight } from './LightLayer'
import { LightLayer } from './LightLayer'

const LIGHT: VisualLight = {
  id: 'torch',
  cell: { column: 99, row: 101 },
  elevation: 3,
  color: '#ffb454',
  intensity: 18,
  range: 12,
}

it('places shadow-casting visual lights at renderer-provided Grid Cells', async () => {
  const renderer = await ReactThreeTestRenderer.create(<LightLayer lights={[LIGHT]} />)
  const light = renderer.scene.findByProps({ name: 'visual-light-torch' })
  const pointLight = light.instance as PointLight

  expect(light.type).toBe('PointLight')
  expect(pointLight.position.toArray()).toEqual([99.5, 3, 101.5])
  expect(pointLight.castShadow).toBe(true)
  expect(pointLight.distance).toBe(12)
  await renderer.unmount()
})

it('moves a visual light without requiring tactical visibility data', async () => {
  const renderer = await ReactThreeTestRenderer.create(<LightLayer lights={[LIGHT]} />)

  await renderer.update(
    <LightLayer lights={[{ ...LIGHT, cell: { column: 104, row: 99 } }]} />,
  )

  expect(
    (renderer.scene.findByProps({ name: 'visual-light-torch' }).instance as PointLight).position.toArray(),
  ).toEqual([104.5, 3, 99.5])
  await renderer.unmount()
})
