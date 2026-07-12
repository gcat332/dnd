import type { MoveIntent, TokenRenderState } from '../domain/tokens'
import { gridToWorld } from '../domain/grid'
import { useBattleMapView } from '../state/useBattleMapView'
import { TokenMesh } from '../scene/TokenMesh'
import { CharacterModel } from './CharacterModel'
import type { CharacterAnimationName, CharacterPresentationState } from './contract'
import { Component, Suspense, type ErrorInfo, type ReactNode } from 'react'

export type CharacterTokenProps = Readonly<{
  token: TokenRenderState & { character: CharacterPresentationState }
  onMoveIntent: (intent: MoveIntent) => void
  onAttackEvent?: (tokenId: string, state: CharacterPresentationState) => void
  onAnimationComplete?: (tokenId: string, animation: CharacterAnimationName) => void
}>

type FallbackProps = Readonly<{ children: ReactNode; fallback: ReactNode }>
type FallbackState = Readonly<{ failed: boolean }>

class CharacterFallbackBoundary extends Component<FallbackProps, FallbackState> {
  state: FallbackState = { failed: false }

  static getDerivedStateFromError(): FallbackState {
    return { failed: true }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // A failed optional character asset must never prevent map interaction.
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

function SelectionRing({ selected }: Readonly<{ selected: boolean }>) {
  return selected ? (
    <mesh
      name="character-selection-ring"
      rotation-x={-Math.PI / 2}
      position={[0, 0.02, 0]}
      renderOrder={2}
    >
      <ringGeometry args={[0.43, 0.5, 32]} />
      <meshBasicMaterial color="#ffe26b" transparent opacity={0.9} depthWrite={false} />
    </mesh>
  ) : null
}

export function CharacterToken({
  token,
  onMoveIntent,
  onAttackEvent,
  onAnimationComplete,
}: CharacterTokenProps) {
  const selected = useBattleMapView((state) => state.selectedTokenId === token.id)
  const point = gridToWorld(token.cell)
  const state = token.character

  return (
    <group name={`character-token-${token.id}`}>
      <TokenMesh token={token} onMoveIntent={onMoveIntent} interactiveOnly />
      <CharacterFallbackBoundary
        key={state.recipeId}
        fallback={<TokenMesh token={token} onMoveIntent={onMoveIntent} />}
      >
        <Suspense fallback={<TokenMesh token={token} onMoveIntent={onMoveIntent} />}>
          <group
            name={`character-visual-${token.id}`}
            position={[point.x, token.elevation, point.z]}
            rotation-y={state.facingRadians}
            scale={selected ? 1.12 : 1}
          >
            <SelectionRing selected={selected} />
            <CharacterModel
              state={state}
              onAttackEvent={(nextState) => onAttackEvent?.(token.id, nextState)}
              onAnimationComplete={(animation) => onAnimationComplete?.(token.id, animation)}
            />
          </group>
        </Suspense>
      </CharacterFallbackBoundary>
    </group>
  )
}
