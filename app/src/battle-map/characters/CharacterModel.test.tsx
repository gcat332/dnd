import ReactThreeTestRenderer from '@react-three/test-renderer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AnimationClip, Bone, BoxGeometry, Group, MeshStandardMaterial, Skeleton, SkinnedMesh } from 'three'
import { getCharacterRecipe, type CharacterPresentationState } from './contract'
import { CharacterModel, getAnimationLoopSettings, validateCharacterAsset } from './CharacterModel'

const { useGLTF } = vi.hoisted(() => ({ useGLTF: vi.fn() }))
vi.mock('@react-three/drei', async () => {
  const actual = await vi.importActual<typeof import('@react-three/drei')>('@react-three/drei')
  return { ...actual, useGLTF }
})

const STATE: CharacterPresentationState = {
  recipeId: 'kaykit-knight',
  animation: 'idle',
  facingRadians: 0,
  equipment: { mainHand: 'sword', offHand: 'shield', back: null, head: null },
}

function fixture() {
  const scene = new Group()
  const root = new Bone()
  root.name = 'root'
  const mesh = new SkinnedMesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial())
  mesh.add(root)
  mesh.bind(new Skeleton([root]))
  scene.add(mesh)
  for (const name of ['socket_main_hand', 'socket_off_hand', 'socket_back', 'socket_head']) {
    const socket = new Group()
    socket.name = name
    scene.add(socket)
  }
  const animations = ['idle', 'move', 'attack', 'hit', 'death'].map(
    (name) => new AnimationClip(name, 1, []),
  )
  return { scene, animations }
}

beforeEach(() => {
  useGLTF.mockReturnValue(fixture())
})

describe('getAnimationLoopSettings', () => {
  it('loops movement clips and clamps one-shot clips', () => {
    expect(getAnimationLoopSettings('idle')).toEqual({ mode: 'repeat', repetitions: Infinity })
    expect(getAnimationLoopSettings('move')).toEqual({ mode: 'repeat', repetitions: Infinity })
    expect(getAnimationLoopSettings('attack')).toEqual({ mode: 'once', repetitions: 1 })
    expect(getAnimationLoopSettings('hit')).toEqual({ mode: 'once', repetitions: 1 })
    expect(getAnimationLoopSettings('death')).toEqual({ mode: 'once', repetitions: 1 })
  })
})

describe('CharacterModel', () => {
  it('clones the loaded scene and keeps all four equipment sockets available', async () => {
    const renderer = await ReactThreeTestRenderer.create(<CharacterModel state={STATE} />)
    expect(renderer.scene.findByProps({ name: 'character-model' })).toBeDefined()
    const characterRoot = renderer.scene.findByProps({ name: 'character-model' }).instance
    const clonedScene = characterRoot.children[0]
    expect(clonedScene?.getObjectByName('socket_main_hand')).toBeDefined()
    expect(clonedScene?.getObjectByName('socket_off_hand')).toBeDefined()
    await renderer.unmount()
  })

  it('reports an asset contract error when a required clip is missing', async () => {
    expect(() => validateCharacterAsset('kaykit-knight', fixture().scene, [])).toThrow(
      /kaykit-knight.*idle/,
    )
    expect(getCharacterRecipe('kaykit-knight')).toBeDefined()
  })
})
