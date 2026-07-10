import { Canvas } from '@react-three/fiber'

export function BattleMapCanvas() {
  return (
    <Canvas
      data-testid="battle-map-canvas"
      orthographic
      frameloop="demand"
      camera={{ position: [0, 50, 0], rotation: [-Math.PI / 2, 0, 0], zoom: 20 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      dpr={[1, 2]}
    >
      <color attach="background" args={['#171a1f']} />
      <ambientLight intensity={1.4} />
      <directionalLight position={[8, 14, 5]} intensity={2.2} castShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#52654c" />
      </mesh>
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#c84f3d" />
      </mesh>
    </Canvas>
  )
}
