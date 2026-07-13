import { useAnimations, useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { DoubleSide, LoopRepeat, Mesh, MeshStandardMaterial, Object3D, type AnimationClip } from 'three'
import { SkeletonUtils } from 'three-stdlib'

const DRAGON_URL = '/assets/environment/quaternius-dragon.glb'
const FLYING_CLIP = 'DragonArmature|Dragon_Flying'

export function PrototypeDragon() {
  const loaded = useGLTF(DRAGON_URL)
  const scene = useMemo(() => SkeletonUtils.clone(loaded.scene), [loaded.scene])
  const sceneRef = useRef<Object3D>(null)
  const { actions, mixer } = useAnimations(loaded.animations as AnimationClip[], sceneRef)
  const invalidate = useThree((state) => state.invalidate)

  useEffect(() => {
    scene.traverse((object) => {
      if ('castShadow' in object) object.castShadow = true
      if ('receiveShadow' in object) object.receiveShadow = true
      if (object instanceof Mesh) {
        const name = object.name.toLowerCase()
        const color = name.includes('wing') ? '#5c326f'
          : name.includes('belly') ? '#c27a48'
            : name.includes('eye') ? '#ffd45a'
              : name.includes('claw') ? '#e6d4a4'
                : '#a4434c'
        object.material = new MeshStandardMaterial({ color, roughness: 0.78, side: DoubleSide })
      }
    })
    const action = actions[FLYING_CLIP]
    if (!action) return
    action.reset().setLoop(LoopRepeat, Infinity).play()
    invalidate()
    return () => {
      action.stop()
    }
  }, [actions, invalidate, scene])

  useFrame(() => {
    if (mixer.time > 0) invalidate()
  })

  return (
    <group name="prototype-dragon" position={[108.5, 0, 100.5]} scale={0.78} rotation-y={-0.35}>
      <primitive ref={sceneRef} object={scene} dispose={null} />
    </group>
  )
}

useGLTF.preload(DRAGON_URL)
