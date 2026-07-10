import { PlaneGeometry, ShaderMaterial } from 'three'
import { MAP_SIZE_CELLS } from '../domain/grid'

const GRID_GEOMETRY = new PlaneGeometry(1, 1)
const GRID_MATERIAL = new ShaderMaterial({
  transparent: true,
  depthWrite: false,
  vertexShader: `
    varying vec3 vWorld;

    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorld = worldPosition.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,
  fragmentShader: `
    varying vec3 vWorld;

    void main() {
      float lineX = 1.0 - step(0.035, min(fract(vWorld.x), 1.0 - fract(vWorld.x)));
      float lineZ = 1.0 - step(0.035, min(fract(vWorld.z), 1.0 - fract(vWorld.z)));
      float alpha = max(lineX, lineZ) * 0.42;
      gl_FragColor = vec4(vec3(0.08), alpha);
    }
  `,
})

export function ProceduralGrid() {
  return (
    <mesh
      name="procedural-grid"
      position={[MAP_SIZE_CELLS / 2, 0.025, MAP_SIZE_CELLS / 2]}
      rotation={[-Math.PI / 2, 0, 0]}
      scale={[MAP_SIZE_CELLS, MAP_SIZE_CELLS, 1]}
      renderOrder={2}
    >
      <primitive object={GRID_GEOMETRY} attach="geometry" />
      <primitive object={GRID_MATERIAL} attach="material" />
    </mesh>
  )
}
