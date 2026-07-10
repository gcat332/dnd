import { BoxGeometry, MeshStandardMaterial } from 'three'

const BOX_GEOMETRY = new BoxGeometry(1, 1, 1)
const STONE_MATERIAL = new MeshStandardMaterial({ color: '#73777b', roughness: 0.88 })
const DOOR_MATERIAL = new MeshStandardMaterial({ color: '#713f2c', roughness: 0.82 })
const PLATFORM_MATERIAL = new MeshStandardMaterial({ color: '#596d50', roughness: 0.94 })
const MARKER_MATERIAL = new MeshStandardMaterial({ color: '#d6b759', roughness: 0.65 })

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

export function DimensionalTerrain() {
  return (
    <group name="dimensional-terrain" dispose={null}>
      <TerrainBox name="wall" position={[99, 1.5, 94]} scale={[18, 3, 1]} material={STONE_MATERIAL} />
      <TerrainBox name="door" position={[99, 1.25, 93.45]} scale={[3, 2.5, 0.3]} material={DOOR_MATERIAL} />
      <TerrainBox
        name="raised-platform"
        position={[110, 1, 106]}
        scale={[11, 2, 10]}
        material={PLATFORM_MATERIAL}
      />
      <TerrainBox
        name="elevated-marker"
        position={[110, 4, 106]}
        scale={[1.1, 4, 1.1]}
        material={MARKER_MATERIAL}
      />
    </group>
  )
}
