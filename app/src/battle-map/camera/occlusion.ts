import { Box3, Ray, Vector3 } from 'three'
import { terrainFeatureBox, type TerrainFeature } from '../../battle-maps/terrain'
import { cameraPositionForView, type CameraView } from './cameraView'
import { gridToWorld } from '../domain/grid'
import type { TokenRenderState } from '../domain/tokens'

const CAMERA_DISTANCE = 160
const RAY_ORIGIN = new Vector3()
const RAY_DIRECTION = new Vector3()
const TOKEN_POINT = new Vector3()
const HIT_POINT = new Vector3()
const FEATURE_BOX = new Box3()

/** Returns terrain that lies strictly between the current camera and selected token. */
export function occludingTerrainFeatureIds(
  features: readonly TerrainFeature[],
  selectedToken: TokenRenderState | null | undefined,
  cameraView: CameraView,
): ReadonlySet<string> {
  if (!selectedToken?.visible) return new Set()

  const tokenWorld = gridToWorld(selectedToken.cell)
  TOKEN_POINT.set(tokenWorld.x, selectedToken.elevation + 0.5, tokenWorld.z)
  RAY_ORIGIN.fromArray(cameraPositionForView(cameraView, CAMERA_DISTANCE))
  RAY_DIRECTION.subVectors(TOKEN_POINT, RAY_ORIGIN).normalize()
  const ray = new Ray(RAY_ORIGIN, RAY_DIRECTION)
  const cameraToTokenDistance = RAY_ORIGIN.distanceTo(TOKEN_POINT)
  const occludingIds = new Set<string>()

  for (const feature of features) {
    if (feature.kind !== 'wall' && feature.kind !== 'pillar') continue
    const box = terrainFeatureBox(feature)
    FEATURE_BOX.setFromCenterAndSize(
      new Vector3(...box.position),
      new Vector3(...box.scale),
    )
    const hit = ray.intersectBox(FEATURE_BOX, HIT_POINT)
    if (!hit) continue
    const hitDistance = RAY_ORIGIN.distanceTo(hit)
    if (hitDistance > 0 && hitDistance < cameraToTokenDistance) occludingIds.add(feature.id)
  }

  return occludingIds
}
