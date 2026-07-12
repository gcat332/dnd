import ReactThreeTestRenderer from '@react-three/test-renderer'
import { beforeEach, expect, it } from 'vitest'
import type { Mesh, MeshStandardMaterial } from 'three'
import { DEFAULT_CAMERA_VIEW } from '../camera/cameraView'
import type { TerrainFeature } from '../../battle-maps/terrain'
import type { AreaTemplate } from '../domain/effects'
import type { VisibilityGrid } from '../domain/visibility'
import { useBattleMapView } from '../state/useBattleMapView'
import { BattleMapScene, sceneSelection } from './BattleMapScene'
import type { VisualLight } from './LightLayer'

const VISIBILITY: VisibilityGrid = {
  width: 200,
  height: 200,
  cells: Array.from({ length: 200 * 200 }, () => 'visible'),
}

const LIGHTS: readonly VisualLight[] = [
  {
    id: 'fixture',
    cell: { column: 100, row: 100 },
    elevation: 4,
    color: '#ffe0a0',
    intensity: 24,
    range: 14,
  },
]

const TEMPLATE: AreaTemplate = {
  kind: 'circle',
  origin: { column: 100, row: 100 },
  radius: 1,
}

beforeEach(() => {
  useBattleMapView.setState(useBattleMapView.getInitialState(), true)
})

it('selects the detail chunk containing the camera center for the maximum-class probe', () => {
  const selection = sceneSelection({ x: 100, z: 100 }, 80)

  expect(selection.visibleChunks[0]).toEqual({ column: 0, row: 0 })
  expect(selection.centerChunk).toEqual({ column: 3, row: 3 })
  expect(selection.visibleChunks).toContainEqual(selection.centerChunk)
})

it('builds overview map and visibility layers', async () => {
  const renderer = await ReactThreeTestRenderer.create(
    <BattleMapScene visibility={VISIBILITY} lights={LIGHTS} />,
  )
  expect(renderer.scene.findByProps({ name: 'ambient-map-light' }).type).toBe('AmbientLight')
  expect(renderer.scene.findByProps({ name: 'directional-map-light' }).type).toBe('DirectionalLight')
  expect(renderer.scene.findByProps({ name: 'light-layer' }).type).toBe('Group')
  expect(renderer.scene.findByProps({ name: 'visual-light-fixture' }).type).toBe('PointLight')
  expect(renderer.scene.findByProps({ name: 'overview-surface' }).type).toBe('Mesh')
  expect(renderer.scene.findByProps({ name: 'procedural-grid' }).type).toBe('Mesh')
  expect(renderer.scene.findByProps({ name: 'dimensional-terrain' }).type).toBe('Group')
  expect(renderer.scene.findByProps({ name: 'token-layer' }).type).toBe('Group')
  expect(renderer.scene.findByProps({ name: 'visibility-layer' }).type).toBe('Group')
  expect(renderer.scene.findByProps({ name: 'visibility-overview' }).type).toBe('Mesh')
  expect(renderer.scene.findAllByProps({ name: 'detail-chunk-surfaces' })).toHaveLength(0)
  await renderer.unmount()
})

it('builds matching detail map and visibility chunk layers', async () => {
  useBattleMapView.getState().publishCameraView(
    { ...DEFAULT_CAMERA_VIEW, focus: { x: 100, z: 100 } },
    48,
  )
  const renderer = await ReactThreeTestRenderer.create(
    <BattleMapScene visibility={VISIBILITY} lights={LIGHTS} />,
  )

  expect(renderer.scene.findByProps({ name: 'detail-chunk-surfaces' }).type).toBe('Group')
  expect(renderer.scene.findAllByProps({ name: 'visibility-overview' })).toHaveLength(0)
  const mapChunks = renderer.scene.findByProps({ name: 'detail-chunk-surfaces' }).children.length
  const visibilityChunks = renderer.scene
    .findByProps({ name: 'visibility-layer' })
    .children.filter((child) => child.props.name?.startsWith('visibility-chunk-')).length
  expect(visibilityChunks).toBe(mapChunks)
  await renderer.unmount()
})

it('adds targeting and remote animation without bypassing Token visibility', async () => {
  const renderer = await ReactThreeTestRenderer.create(
    <BattleMapScene
      targetTemplate={TEMPLATE}
      tokens={[
        {
          id: 'visible-token',
          label: 'Visible Token',
          cell: { column: 102, row: 100 },
          elevation: 0,
          color: '#37ff78',
          visible: true,
        },
        {
          id: 'hidden-token',
          label: 'Hidden Token',
          cell: { column: 102, row: 101 },
          elevation: 0,
          color: '#ff4f81',
          visible: false,
        },
      ]}
      remoteTokenAnimations={[
        {
          tokenId: 'visible-token',
          from: { column: 100, row: 100 },
          to: { column: 102, row: 100 },
          eventStartMs: 1_000,
          durationMs: 1_000,
        },
        {
          tokenId: 'hidden-token',
          from: { column: 100, row: 101 },
          to: { column: 102, row: 101 },
          eventStartMs: 1_000,
          durationMs: 1_000,
        },
      ]}
    />,
  )

  expect(renderer.scene.findByProps({ name: 'targeting-layer' }).type).toBe('Group')
  expect(renderer.scene.findAllByProps({ name: /^target-cell-/ })).toHaveLength(5)
  expect(renderer.scene.findByProps({ name: 'animated-token-visible-token' }).type).toBe('Group')
  expect(renderer.scene.findAllByProps({ name: 'animated-token-hidden-token' })).toHaveLength(0)
  await renderer.unmount()
})

it('fades only terrain occluding the visible selected token', async () => {
  useBattleMapView.getState().selectToken('visible-token')
  const features: readonly TerrainFeature[] = [
    { id: 'occluder', kind: 'wall', column: 98, row: 101, widthCells: 4, depthCells: 1, heightCells: 3 },
    { id: 'off-axis', kind: 'wall', column: 120, row: 101, widthCells: 1, depthCells: 1, heightCells: 3 },
  ]
  const renderer = await ReactThreeTestRenderer.create(
    <BattleMapScene
      terrainFeatures={features}
      tokens={[
        {
          id: 'visible-token',
          label: 'Visible Token',
          cell: { column: 100, row: 100 },
          elevation: 0,
          color: '#37ff78',
          visible: true,
        },
        {
          id: 'hidden-token',
          label: 'Hidden Token',
          cell: { column: 100, row: 100 },
          elevation: 0,
          color: '#ff4f81',
          visible: false,
        },
      ]}
    />,
  )

  const occluderMaterial = renderer.scene.findByProps({ name: 'terrain-occluder' }).instance as Mesh
  const offAxisMaterial = renderer.scene.findByProps({ name: 'terrain-off-axis' }).instance as Mesh
  expect((occluderMaterial.material as MeshStandardMaterial).opacity).toBe(0.2)
  expect((offAxisMaterial.material as MeshStandardMaterial).opacity).toBe(1)
  await renderer.unmount()
})
