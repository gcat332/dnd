import { describe, expect, it } from 'vitest'
import { DEFAULT_CAMERA_VIEW, type CameraView } from './cameraView'
import { occludingTerrainFeatureIds } from './occlusion'
import type { TerrainFeature } from '../../battle-maps/terrain'
import type { TokenRenderState } from '../domain/tokens'

const TOKEN: TokenRenderState = {
  id: 'hero',
  label: 'Hero',
  cell: { column: 100, row: 100 },
  elevation: 0,
  color: '#37ff78',
  visible: true,
}

const NORTH_WALL: TerrainFeature = {
  id: 'north-wall',
  kind: 'wall',
  column: 98,
  row: 101,
  widthCells: 4,
  depthCells: 1,
  heightCells: 3,
}

const SOUTH_WALL: TerrainFeature = {
  ...NORTH_WALL,
  id: 'south-wall',
  row: 98,
}

const view = (yawDegrees: number): CameraView => ({ ...DEFAULT_CAMERA_VIEW, yawDegrees })

describe('occludingTerrainFeatureIds', () => {
  it('returns a wall between the camera and selected visible token', () => {
    expect(occludingTerrainFeatureIds([NORTH_WALL], TOKEN, view(0))).toEqual(
      new Set(['north-wall']),
    )
  })

  it('ignores off-axis walls and walls behind the token', () => {
    const offAxis = { ...NORTH_WALL, id: 'off-axis', column: 120 }
    expect(occludingTerrainFeatureIds([offAxis, SOUTH_WALL], TOKEN, view(0))).toEqual(new Set())
  })

  it('ignores invisible and null selections', () => {
    expect(occludingTerrainFeatureIds([NORTH_WALL], { ...TOKEN, visible: false }, view(0))).toEqual(
      new Set(),
    )
    expect(occludingTerrainFeatureIds([NORTH_WALL], null, view(0))).toEqual(new Set())
  })

  it('fades the opposite wall when orbiting to yaw 180', () => {
    expect(occludingTerrainFeatureIds([NORTH_WALL, SOUTH_WALL], TOKEN, view(180))).toEqual(
      new Set(['south-wall']),
    )
  })
})
