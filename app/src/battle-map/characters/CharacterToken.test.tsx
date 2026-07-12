import ReactThreeTestRenderer from '@react-three/test-renderer'
import { beforeEach, expect, it, vi } from 'vitest'
import type { TokenRenderState } from '../domain/tokens'
import { useBattleMapView } from '../state/useBattleMapView'
import { CharacterToken } from './CharacterToken'

vi.mock('./CharacterModel', () => ({
  CharacterModel: ({ state }: { state: { recipeId: string } }) => (
    <group name="character-model-mock" userData={{ recipeId: state.recipeId }} />
  ),
}))

const TOKEN: TokenRenderState = {
  id: 'character-1',
  label: 'Knight',
  cell: { column: 10, row: 12 },
  elevation: 2,
  color: '#37ff78',
  visible: true,
  character: {
    recipeId: 'kaykit-knight',
    animation: 'idle',
    facingRadians: Math.PI / 2,
    equipment: { mainHand: 'sword', offHand: 'shield', back: null, head: null },
  },
}

beforeEach(() => {
  useBattleMapView.setState(useBattleMapView.getInitialState(), true)
})

it('positions the character at its grid cell and keeps an invisible stable hit target', async () => {
  const renderer = await ReactThreeTestRenderer.create(
    <CharacterToken
      token={TOKEN as TokenRenderState & { character: NonNullable<TokenRenderState['character']> }}
      onMoveIntent={vi.fn()}
    />,
  )
  const visual = renderer.scene.findByProps({ name: `character-visual-${TOKEN.id}` })
  expect(visual.instance.position.toArray()).toEqual([10.5, 2, 12.5])
  expect(visual.instance.rotation.y).toBeCloseTo(Math.PI / 2)
  expect(renderer.scene.findByProps({ name: `token-${TOKEN.id}` })).toBeDefined()
  await renderer.unmount()
})
