import { useAnimations, useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { AnimationAction, AnimationClip, LoopOnce, LoopRepeat, Object3D } from 'three'
import { SkeletonUtils } from 'three-stdlib'
import {
  CHARACTER_ANIMATIONS,
  EQUIPMENT_SOCKET,
  getCharacterRecipe,
  getEquipmentRecipe,
  type CharacterAnimationName,
  type CharacterPresentationState,
  type EquipmentSlot,
} from './contract'

const CROSS_FADE_SECONDS = 0.12
const INVALID_ASSET_URL = '/assets/characters/__missing__.glb'

type LoadedCharacter = Readonly<{
  scene: Object3D
  animations?: readonly AnimationClip[]
}>

export class AssetContractError extends Error {
  constructor(recipeId: string, member: string) {
    super(`Character asset contract "${recipeId}" is missing or invalid: ${member}`)
    this.name = 'AssetContractError'
  }
}

export type CharacterModelProps = Readonly<{
  state: CharacterPresentationState
  onAttackEvent?: (state: CharacterPresentationState) => void
  onAnimationComplete?: (animation: CharacterAnimationName) => void
}>

export type AnimationLoopSettings = Readonly<{
  mode: 'repeat' | 'once'
  repetitions: number
}>

export function getAnimationLoopSettings(animation: CharacterAnimationName): AnimationLoopSettings {
  return animation === 'idle' || animation === 'move'
    ? { mode: 'repeat', repetitions: Infinity }
    : { mode: 'once', repetitions: 1 }
}

export function validateCharacterAsset(recipeId: string, scene: Object3D, animations: readonly AnimationClip[]) {
  for (const animation of CHARACTER_ANIMATIONS) {
    if (!animations.some((clip) => clip.name === animation)) {
      throw new AssetContractError(recipeId, `animation "${animation}"`)
    }
  }
  for (const socket of Object.values(EQUIPMENT_SOCKET)) {
    if (!scene.getObjectByName(socket)) throw new AssetContractError(recipeId, `socket "${socket}"`)
  }
}

function loadedAsset(value: unknown): LoadedCharacter {
  if (!value || typeof value !== 'object') throw new Error('Character GLB loader returned no asset')
  const record = value as { scene?: unknown; animations?: unknown }
  if (!(record.scene instanceof Object3D)) throw new Error('Character GLB loader returned no scene')
  return {
    scene: record.scene,
    animations: Array.isArray(record.animations) ? (record.animations as AnimationClip[]) : [],
  }
}

type EquipmentAttachmentProps = Readonly<{
  itemId: string
  slot: EquipmentSlot
  parent: Object3D
}>

function EquipmentAttachment({ itemId, slot, parent }: EquipmentAttachmentProps) {
  const recipe = getEquipmentRecipe(itemId)
  const loaded = loadedAsset(useGLTF(recipe?.url ?? INVALID_ASSET_URL))
  const clone = useMemo(() => SkeletonUtils.clone(loaded.scene), [itemId, loaded.scene])
  const invalidate = useThree((state) => state.invalidate)

  if (!recipe) throw new AssetContractError(itemId, 'equipment recipe')
  if (!recipe.allowedSlots.includes(slot)) {
    throw new AssetContractError(itemId, `equipment slot "${slot}"`)
  }
  const socket = parent.getObjectByName(EQUIPMENT_SOCKET[slot])
  if (!socket) throw new AssetContractError(itemId, `socket "${EQUIPMENT_SOCKET[slot]}"`)

  useLayoutEffect(() => {
    clone.position.set(0, 0, 0)
    clone.quaternion.identity()
    clone.scale.set(1, 1, 1)
    socket.add(clone)
    invalidate()
    return () => {
      socket.remove(clone)
      invalidate()
    }
  }, [clone, invalidate, socket])

  return null
}

export function CharacterModel({ state, onAttackEvent, onAnimationComplete }: CharacterModelProps) {
  const recipe = getCharacterRecipe(state.recipeId)
  const loaded = loadedAsset(useGLTF(recipe?.url ?? INVALID_ASSET_URL))
  const scene = useMemo(() => SkeletonUtils.clone(loaded.scene), [loaded.scene])
  const animations = loaded.animations ?? []
  const sceneRef = useRef<Object3D>(null)
  const { actions, mixer } = useAnimations(animations as AnimationClip[], sceneRef)
  const invalidate = useThree((state) => state.invalidate)
  const activeAction = useRef<AnimationAction | null>(null)
  const previousTime = useRef(0)
  const attackEventFired = useRef(false)
  const animationComplete = useRef(false)

  if (!recipe) throw new AssetContractError(state.recipeId, 'character recipe')
  validateCharacterAsset(recipe.id, scene, animations)

  useEffect(() => {
    const action = actions[state.animation]
    // drei exposes lazy action getters; a root may not be bound until the next layout pass.
    if (!action) return
    const previous = activeAction.current
    if (previous && previous !== action) action.crossFadeFrom(previous, CROSS_FADE_SECONDS, false)

    const settings = getAnimationLoopSettings(state.animation)
    action.reset()
    action.setLoop(settings.mode === 'repeat' ? LoopRepeat : LoopOnce, settings.repetitions)
    action.clampWhenFinished = settings.mode === 'once'
    action.fadeIn(CROSS_FADE_SECONDS).play()
    activeAction.current = action
    previousTime.current = state.animation === 'attack' ? Number.NEGATIVE_INFINITY : 0
    attackEventFired.current = false
    animationComplete.current = false
    // The battle map intentionally uses demand rendering. Kick the first frame
    // so the mixer can advance, after which useFrame keeps the animation alive.
    invalidate()
  }, [actions, invalidate, recipe.id, state.animation])

  useEffect(() => {
    const action = actions[state.animation]
    if (!action) return
    const handleFinished = (event: { action?: AnimationAction }) => {
      if (event.action !== action || animationComplete.current) return
      animationComplete.current = true
      onAnimationComplete?.(state.animation)
    }
    mixer.addEventListener('finished', handleFinished)
    return () => mixer.removeEventListener('finished', handleFinished)
  }, [actions, mixer, onAnimationComplete, state.animation])

  useFrame(() => {
    const action = activeAction.current
    if (!action) return

    const isRepeating = state.animation === 'idle' || state.animation === 'move'
    if (action.isRunning() && (isRepeating || !animationComplete.current)) invalidate()

    if (state.animation === 'attack' && !attackEventFired.current) {
      const duration = action.getClip().duration
      const marker = recipe.attackEventTime * duration
      if (previousTime.current < marker && action.time >= marker) {
        attackEventFired.current = true
        onAttackEvent?.(state)
      }
      previousTime.current = action.time
    }
  })

  return (
    <group name="character-model">
      <primitive ref={sceneRef} object={scene} dispose={null} />
      {(Object.keys(EQUIPMENT_SOCKET) as EquipmentSlot[]).map((slot) => (
        state.equipment[slot] ? (
          <EquipmentAttachment
            key={slot}
            itemId={state.equipment[slot]}
            parent={scene}
            slot={slot}
          />
        ) : null
      ))}
    </group>
  )
}
