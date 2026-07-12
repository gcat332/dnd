import { BoxGeometry, MeshStandardMaterial } from 'three'
import { terrainFeatureBox, type TerrainFeature, type TerrainKind } from '../../battle-maps/terrain'
import type { StressWall } from '../fixtures/createStressScene'

const BOX_GEOMETRY = new BoxGeometry(1, 1, 1)

const MATERIALS: Readonly<Record<TerrainKind, MeshStandardMaterial>> = Object.freeze({
  wall: new MeshStandardMaterial({ color: '#73777b', roughness: 0.88 }),
  platform: new MeshStandardMaterial({ color: '#596d50', roughness: 0.94 }),
  pillar: new MeshStandardMaterial({ color: '#d6b759', roughness: 0.65 }),
})

const FADED_MATERIALS: Readonly<Record<TerrainKind, MeshStandardMaterial>> = Object.freeze({
  wall: new MeshStandardMaterial({
    color: '#73777b',
    roughness: 0.88,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
  }),
  platform: new MeshStandardMaterial({
    color: '#596d50',
    roughness: 0.94,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
  }),
  pillar: new MeshStandardMaterial({
    color: '#d6b759',
    roughness: 0.65,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
  }),
})

const STONE_MATERIAL = MATERIALS.wall

type TerrainBoxProps = {
  name: string
  position: [number, number, number]
  scale: [number, number, number]
  material: MeshStandardMaterial
}

function TerrainBox({ name, position, scale, material }: TerrainBoxProps) {
  return (
    <mesh name={name} position={position} scale={scale} castShadow receiveShadow>
      <primitive object={BOX_GEOMETRY} attach="geometry" />
      <primitive object={material} attach="material" />
    </mesh>
  )
}

type DimensionalTerrainProps = Readonly<{
  features?: readonly TerrainFeature[]
  stressWalls?: readonly StressWall[]
  fadedFeatureIds?: ReadonlySet<string>
}>

export function DimensionalTerrain({
  features = [],
  stressWalls = [],
  fadedFeatureIds,
}: DimensionalTerrainProps) {
  return (
    <group name="dimensional-terrain" dispose={null}>
      {features.map((feature) => {
        const box = terrainFeatureBox(feature)
        return (
          <TerrainBox
            key={feature.id}
            name={`terrain-${feature.id}`}
            position={box.position}
            scale={box.scale}
            material={fadedFeatureIds?.has(feature.id) ? FADED_MATERIALS[feature.kind] : MATERIALS[feature.kind]}
          />
        )
      })}
      {stressWalls.map((wall) => (
        <TerrainBox
          key={wall.id}
          name={`stress-wall-${wall.id}`}
          position={[...wall.position]}
          scale={[...wall.scale]}
          material={STONE_MATERIAL}
        />
      ))}
    </group>
  )
}
