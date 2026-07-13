import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import { SkeletonUtils } from 'three-stdlib'
import { DoubleSide, Mesh, MeshStandardMaterial, type Object3D } from 'three'
import { terrainBiomeAt, type TerrainBiome } from '../fixtures/createChunkTexture'
import type { ChunkAddress } from '../domain/chunks'
import { chunkBounds } from '../domain/chunks'

type Placement = Readonly<{
  x: number
  z: number
  scale: number
  rotation: number
}>

type BiomeDetailLayerProps = Readonly<{
  visibleChunks: readonly ChunkAddress[]
  focus?: Readonly<{ x: number; z: number }>
  enabled?: boolean
}>

type AssetInstancesProps = Readonly<{
  name: string
  url: string
  placements: readonly Placement[]
  tint: string
  y?: number
}>

const ASSET_URLS = {
  tree: '/assets/environment/kaykit-tree.glb',
  grass: '/assets/environment/kaykit-grass.glb',
  rock: '/assets/environment/kaykit-rock.glb',
  mountain: '/assets/environment/kaykit-mountain.glb',
  river: '/assets/environment/kaykit-river.glb',
} as const

function placementKey(x: number, z: number): number {
  return Math.abs((x * 928371 + z * 523543) % 97)
}

function makePlacements(visibleChunks: readonly ChunkAddress[], focus: Readonly<{ x: number; z: number }>) {
  const result: Record<TerrainBiome | 'mountain', Placement[]> = {
    grass: [],
    forest: [],
    water: [],
    road: [],
    mountain: [],
  }

  for (const address of visibleChunks) {
    const bounds = chunkBounds(address, 64)
    for (let z = bounds.minRow + 1; z < bounds.maxRowExclusive - 1; z += 3) {
      for (let x = bounds.minColumn + 1; x < bounds.maxColumnExclusive - 1; x += 3) {
        if (x >= 94 && x <= 108 && z >= 95 && z <= 105) continue
        const biome = terrainBiomeAt(x + 0.5, z + 0.5)
        const key = placementKey(x, z)
        if (biome === 'forest' && key % 2 === 0) {
          result.forest.push({
            x: x + 0.5,
            z: z + 0.5,
            scale: 0.72 + (key % 4) * 0.08,
            rotation: (key % 8) * 0.78,
          })
          if (key % 13 === 0) {
            result.mountain.push({
              x: x + 0.5,
              z: z + 0.5,
              scale: 1.35 + (key % 3) * 0.16,
              rotation: (key % 6) * 1.04,
            })
          }
        } else if (biome === 'grass' && key % 2 === 0) {
          result.grass.push({
            x: x + 0.5,
            z: z + 0.5,
            scale: 1.4 + (key % 3) * 0.18,
            rotation: (key % 8) * 0.78,
          })
        } else if (biome === 'water' && key % 2 === 0) {
          result.water.push({ x: x + 0.5, z: z + 0.5, scale: 1.25, rotation: 0 })
        } else if (biome === 'road' && key % 7 === 0) {
          result.road.push({
            x: x + 0.5,
            z: z + 0.5,
            scale: 3.1 + (key % 3) * 0.35,
            rotation: (key % 8) * 0.78,
          })
        }
      }
    }
  }

  const centerX = focus.x
  const centerZ = focus.z
  const nearest = (placements: Placement[], limit: number) => placements
    .sort((left, right) => ((left.x - centerX) ** 2 + (left.z - centerZ) ** 2) - ((right.x - centerX) ** 2 + (right.z - centerZ) ** 2))
    .slice(0, limit)

  return {
    grass: nearest(result.grass, 42),
    forest: nearest(result.forest, 28),
    water: nearest(result.water.filter((_, index) => index % 10 === 0), 8),
    road: nearest(result.road, 14),
    mountain: nearest(result.mountain, 4),
  }
}

function configureScene(scene: Object3D, tint: string) {
  scene.traverse((object) => {
    object.matrixAutoUpdate = true
    if ('frustumCulled' in object) object.frustumCulled = false
    if ('castShadow' in object) object.castShadow = true
    if ('receiveShadow' in object) object.receiveShadow = true
    if (object instanceof Mesh) {
      object.material = new MeshStandardMaterial({ color: tint, roughness: 0.88, side: DoubleSide })
    }
  })
}

function AssetInstances({ name, url, placements, tint, y = 0 }: AssetInstancesProps) {
  // The scene tests use the R3F test renderer without a browser asset base URL.
  // Runtime builds still take the GLB path below; tests keep the layer structural.
  if (import.meta.env.MODE === 'test') return null
  const { scene } = useGLTF(url)
  const clones = useMemo(
    () => placements.map(() => {
      const clone = SkeletonUtils.clone(scene)
      configureScene(clone, tint)
      return clone
    }),
    [placements, scene, tint],
  )

  if (placements.length === 0) return null
  return (
    <group name={name}>
      {clones.map((clone, index) => {
        const placement = placements[index]!
        return (
          <group key={`${name}-${placement.x}-${placement.z}-${index}`} position={[placement.x, y, placement.z]} rotation-y={placement.rotation} scale={placement.scale}>
            <primitive object={clone} dispose={null} />
          </group>
        )
      })}
    </group>
  )
}

export function BiomeDetailLayer({ visibleChunks, focus = { x: 100, z: 100 }, enabled = true }: BiomeDetailLayerProps) {
  const placements = useMemo(() => makePlacements(visibleChunks, focus), [focus, visibleChunks])
  if (!enabled) return null

  return (
    <group name="biome-detail-layer">
      <AssetInstances name="kaykit-forest-trees" url={ASSET_URLS.tree} placements={placements.forest} tint="#3c8748" y={0.35} />
      <AssetInstances name="kaykit-forest-grass" url={ASSET_URLS.grass} placements={placements.grass} tint="#9bc95b" />
      <AssetInstances name="kaykit-forest-rocks" url={ASSET_URLS.rock} placements={placements.road} tint="#7c8b8c" />
      <AssetInstances name="kaykit-medieval-mountains" url={ASSET_URLS.mountain} placements={placements.mountain} tint="#6d8c6c" />
      <AssetInstances name="kaykit-medieval-rivers" url={ASSET_URLS.river} placements={placements.water} tint="#4ca9d2" y={1} />
    </group>
  )
}

for (const url of Object.values(ASSET_URLS)) useGLTF.preload(url)
