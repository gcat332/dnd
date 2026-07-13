import { useLayoutEffect, useMemo, useRef } from 'react'
import { ConeGeometry, CylinderGeometry, DodecahedronGeometry, DoubleSide, Matrix4, Material, MeshStandardMaterial, PlaneGeometry, ShaderMaterial, Vector3, type InstancedMesh } from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { terrainBiomeAt, type TerrainBiome } from '../fixtures/createChunkTexture'
import type { ChunkAddress } from '../domain/chunks'
import { chunkBounds } from '../domain/chunks'

const TREE_TRUNK_GEOMETRY = new CylinderGeometry(0.12, 0.18, 0.95, 6)
const TREE_CANOPY_GEOMETRY = new ConeGeometry(0.78, 1.25, 7)
const TREE_CANOPY_TOP_GEOMETRY = new ConeGeometry(0.56, 1.05, 7)
const GRASS_GEOMETRY = new ConeGeometry(0.24, 0.78, 5)
const GRASS_TUFT_GEOMETRY = new ConeGeometry(0.14, 0.52, 5)
const ROCK_GEOMETRY = new DodecahedronGeometry(0.28, 1)
const WATER_GEOMETRY = new PlaneGeometry(1.8, 1.8)
const TREE_TRUNK_MATERIAL = new MeshStandardMaterial({ color: '#70462d', roughness: 1 })
const TREE_CANOPY_MATERIAL = new MeshStandardMaterial({ color: '#245c35', roughness: 0.95 })
const GRASS_MATERIAL = new MeshStandardMaterial({ color: '#87b84d', roughness: 1 })
const ROCK_MATERIAL = new MeshStandardMaterial({ color: '#7d8583', roughness: 0.9 })
const WATER_MATERIAL = new ShaderMaterial({
  uniforms: { uTime: { value: 0 } },
  transparent: true,
  depthWrite: false,
  side: DoubleSide,
  vertexShader: `
    uniform float uTime;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      vec3 transformed = position;
      transformed.z += sin((position.x * 5.0) + uTime * 1.8) * 0.035;
      transformed.z += cos((position.y * 7.0) - uTime * 1.35) * 0.025;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    varying vec2 vUv;
    void main() {
      float rippleA = sin((vUv.x * 18.0 + vUv.y * 6.0) + uTime * 1.4);
      float rippleB = sin((vUv.x * 7.0 - vUv.y * 20.0) - uTime * 1.1);
      float ripple = smoothstep(-0.15, 0.85, (rippleA + rippleB) * 0.5);
      vec3 deep = vec3(0.035, 0.30, 0.58);
      vec3 shallow = vec3(0.18, 0.72, 0.92);
      vec3 color = mix(deep, shallow, ripple * 0.45);
      float highlight = smoothstep(0.72, 0.98, ripple);
      color += vec3(0.25, 0.35, 0.28) * highlight;
      gl_FragColor = vec4(color, 0.82);
    }
  `,
})
const DUMMY = new Matrix4()
const DUMMY_SCALE = new Vector3()

type Placement = Readonly<{ x: number; z: number; scale: number; rotation: number }>

type BiomeDetailLayerProps = Readonly<{
  visibleChunks: readonly ChunkAddress[]
  enabled?: boolean
}>

function placementKey(x: number, z: number): number {
  return Math.abs((x * 928371 + z * 523543) % 97)
}

function makePlacements(visibleChunks: readonly ChunkAddress[]) {
  const result: Record<TerrainBiome, Placement[]> = {
    grass: [],
    forest: [],
    water: [],
    road: [],
  }
  for (const address of visibleChunks) {
    const bounds = chunkBounds(address, 64)
    for (let z = bounds.minRow + 1; z < bounds.maxRowExclusive - 1; z += 3) {
      for (let x = bounds.minColumn + 1; x < bounds.maxColumnExclusive - 1; x += 3) {
        if (x >= 94 && x <= 108 && z >= 95 && z <= 105) continue
        const biome = terrainBiomeAt(x + 0.5, z + 0.5)
        const key = placementKey(x, z)
        if (biome === 'forest' && key % 2 === 0) {
          result.forest.push({ x: x + 0.5, z: z + 0.5, scale: 1.35 + (key % 4) * 0.16, rotation: (key % 8) * 0.78 })
        } else if (biome === 'grass' && key % 2 === 0) {
          result.grass.push({ x: x + 0.5, z: z + 0.5, scale: 0.9 + (key % 3) * 0.14, rotation: (key % 8) * 0.78 })
        } else if (biome === 'water' && key % 2 === 0) {
          result.water.push({ x: x + 0.5, z: z + 0.5, scale: 0.9, rotation: 0 })
        } else if (biome === 'road' && key % 7 === 0) {
          result.road.push({ x: x + 0.5, z: z + 0.5, scale: 0.65 + (key % 3) * 0.1, rotation: (key % 8) * 0.78 })
        }
      }
    }
  }
  return result
}

function InstancedProps({
  name,
  placements,
  geometry,
  material,
  y,
  rotateX = 0,
}: Readonly<{
  name: string
  placements: readonly Placement[]
  geometry: ConeGeometry | CylinderGeometry | DodecahedronGeometry | PlaneGeometry
  material: Material
  y: number
  rotateX?: number
}>) {
  const mesh = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    if (!mesh.current) return
    placements.forEach((placement, index) => {
      const matrix = DUMMY
      matrix.makeRotationY(placement.rotation)
      matrix.setPosition(placement.x, y, placement.z)
      DUMMY_SCALE.set(placement.scale, placement.scale, placement.scale)
      matrix.scale(DUMMY_SCALE)
      mesh.current!.setMatrixAt(index, matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  }, [placements, y])

  if (placements.length === 0) return null
  return (
    <instancedMesh
      ref={mesh}
      name={name}
      args={[geometry, material, placements.length]}
      rotation-x={rotateX}
      castShadow
      receiveShadow
    />
  )
}

export function BiomeDetailLayer({ visibleChunks, enabled = true }: BiomeDetailLayerProps) {
  const placements = useMemo(() => makePlacements(visibleChunks), [visibleChunks])
  const invalidate = useThree((state) => state.invalidate)
  useFrame(({ clock }) => {
    WATER_MATERIAL.uniforms.uTime!.value = clock.elapsedTime
    if (placements.water.length > 0) invalidate()
  })
  if (!enabled) return null
  return (
    <group name="biome-detail-layer">
      <InstancedProps name="biome-forest-trunks" placements={placements.forest} geometry={TREE_TRUNK_GEOMETRY} material={TREE_TRUNK_MATERIAL} y={0.34} />
      <InstancedProps name="biome-forest-canopies" placements={placements.forest} geometry={TREE_CANOPY_GEOMETRY} material={TREE_CANOPY_MATERIAL} y={0.9} />
      <InstancedProps name="biome-forest-canopy-tops" placements={placements.forest} geometry={TREE_CANOPY_TOP_GEOMETRY} material={TREE_CANOPY_MATERIAL} y={2.0} />
      <InstancedProps name="biome-grass-clumps" placements={placements.grass} geometry={GRASS_GEOMETRY} material={GRASS_MATERIAL} y={0.2} />
      <InstancedProps name="biome-grass-tufts" placements={placements.grass} geometry={GRASS_TUFT_GEOMETRY} material={GRASS_MATERIAL} y={0.2} />
      <InstancedProps name="biome-road-rocks" placements={placements.road} geometry={ROCK_GEOMETRY} material={ROCK_MATERIAL} y={0.2} />
      <InstancedProps name="biome-water-surface" placements={placements.water} geometry={WATER_GEOMETRY} material={WATER_MATERIAL} y={0.06} rotateX={-Math.PI / 2} />
    </group>
  )
}
