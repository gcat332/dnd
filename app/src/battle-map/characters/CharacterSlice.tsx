import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { gridToWorld, type GridCell } from '../domain/grid'
import type { TokenRenderState } from '../domain/tokens'
import {
  reducePresentationEvents,
  type CharacterEffectId,
  type CharacterPresentationEvent,
} from '../effects/presentationEvents'
import type { CharacterAnimationName, CharacterPresentationState, EquippedVisuals } from './contract'

const EMPTY_EVENTS: readonly CharacterPresentationEvent[] = []
const EMPTY_TOKENS: readonly TokenRenderState[] = []
const EMPTY_DIAGNOSTICS: CharacterSliceDiagnostics = {
  loadedRecipeIds: [],
  currentAnimations: {},
  equippedIds: {},
  emittedEventIds: [],
  activeEventIds: [],
  mixerCount: 0,
  assetErrorCount: 0,
  optionalFallbackCount: 0,
  animationTransitions: 0,
}

type FixtureDefinition = Readonly<{
  id: string
  label: string
  recipeId: string
  cell: GridCell
  color: string
  equipment: EquippedVisuals
}>

const FIXTURES: readonly FixtureDefinition[] = [
  {
    id: 'character-knight',
    label: 'Knight',
    recipeId: 'kaykit-knight',
    cell: { column: 98, row: 100 },
    color: '#4fb3ff',
    equipment: { mainHand: 'sword', offHand: 'shield', back: null, head: 'helmet' },
  },
  {
    id: 'character-mage',
    label: 'Mage',
    recipeId: 'kaykit-mage',
    cell: { column: 101, row: 100 },
    color: '#c58cff',
    equipment: { mainHand: 'staff', offHand: null, back: null, head: null },
  },
  {
    id: 'character-skeleton',
    label: 'Skeleton',
    recipeId: 'kaykit-skeleton',
    cell: { column: 104, row: 100 },
    color: '#ffcf66',
    equipment: { mainHand: 'axe', offHand: null, back: null, head: null },
  },
]

const ANIMATION_SEQUENCE: readonly CharacterAnimationName[] = ['idle', 'move', 'attack', 'hit', 'death']

export type CharacterSliceDiagnostics = Readonly<{
  loadedRecipeIds: readonly string[]
  currentAnimations: Readonly<Record<string, CharacterAnimationName>>
  equippedIds: Readonly<Record<string, EquippedVisuals>>
  emittedEventIds: readonly string[]
  activeEventIds: readonly string[]
  mixerCount: number
  assetErrorCount: number
  optionalFallbackCount: number
  animationTransitions: number
}>

export type CharacterSliceState = Readonly<{
  tokens: readonly TokenRenderState[]
  presentationEvents: readonly CharacterPresentationEvent[]
  diagnostics: CharacterSliceDiagnostics
}>

type SliceAction =
  | Readonly<{ type: 'animation'; tokenId: string; animation: CharacterAnimationName }>
  | Readonly<{ type: 'equipment'; tokenId: string; equipment: Partial<EquippedVisuals> }>
  | Readonly<{ type: 'effect'; effectId: CharacterEffectId; sourceTokenId: string; targetTokenId: string | null; id?: string }>
  | Readonly<{ type: 'reset' }>

function characterState(fixture: FixtureDefinition): CharacterPresentationState {
  return {
    recipeId: fixture.recipeId,
    animation: 'idle',
    facingRadians: 0,
    equipment: fixture.equipment,
  }
}

function fixtureTokens(stress: boolean): readonly TokenRenderState[] {
  const base = FIXTURES.map((fixture) => ({
    id: fixture.id,
    label: fixture.label,
    cell: fixture.cell,
    elevation: 0,
    color: fixture.color,
    visible: true,
    character: characterState(fixture),
  }))
  if (!stress) return base
  return Array.from({ length: 40 }, (_, index) => {
    const fixture = FIXTURES[index % FIXTURES.length]!
    const row = Math.floor(index / 10)
    const column = 94 + (index % 10)
    return {
      ...base[index % base.length]!,
      id: `character-stress-${index + 1}`,
      label: `${fixture.label} ${index + 1}`,
      cell: { column, row: 96 + row },
      character: characterState(fixture),
    }
  })
}

function tokenState(token: TokenRenderState): CharacterPresentationState | null {
  return token.character ?? null
}

function parseAction(value: unknown): SliceAction | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (record.type === 'reset') return { type: 'reset' }
  if (typeof record.type !== 'string') return null
  if (
    record.type === 'animation' &&
    typeof record.tokenId === 'string' &&
    ANIMATION_SEQUENCE.includes(record.animation as CharacterAnimationName)
  ) {
    return { type: 'animation', tokenId: record.tokenId, animation: record.animation as CharacterAnimationName }
  }
  if (
    record.type === 'equipment' &&
    typeof record.tokenId === 'string' &&
    record.equipment &&
    typeof record.equipment === 'object'
  ) {
    return { type: 'equipment', tokenId: record.tokenId, equipment: record.equipment as Partial<EquippedVisuals> }
  }
  if (
    record.type === 'effect' &&
    typeof record.effectId === 'string' &&
    typeof record.sourceTokenId === 'string' &&
    (record.targetTokenId === null || typeof record.targetTokenId === 'string')
  ) {
    return {
      type: 'effect',
      effectId: record.effectId as CharacterEffectId,
      sourceTokenId: record.sourceTokenId,
      targetTokenId: record.targetTokenId,
      id: typeof record.id === 'string' ? record.id : undefined,
    }
  }
  return null
}

function makeEvent(
  effectId: CharacterEffectId,
  sourceTokenId: string,
  targetTokenId: string | null,
  id: string,
  nowMs: number,
  tokens: readonly TokenRenderState[],
): CharacterPresentationEvent | null {
  const sourceToken = tokens.find((token) => token.id === sourceTokenId)
  const targetToken = targetTokenId ? tokens.find((token) => token.id === targetTokenId) : sourceToken
  if (!sourceToken || !targetToken) return null
  return {
    id,
    effectId,
    sourceTokenId,
    targetTokenId,
    source: gridToWorld(sourceToken.cell),
    target: gridToWorld(targetToken.cell),
    startedAtMs: nowMs,
    durationMs: effectId === 'fire_projectile' ? 850 : 620,
  }
}

function actionEvent(action: SliceAction, sequence: number, nowMs: number, tokens: readonly TokenRenderState[]) {
  if (action.type !== 'effect') return null
  return makeEvent(
    action.effectId,
    action.sourceTokenId,
    action.targetTokenId,
    action.id ?? `character-slice-${action.effectId}-${sequence}`,
    nowMs,
    tokens,
  )
}

function applyAction(
  action: SliceAction,
  current: CharacterSliceState,
  sequence: number,
): CharacterSliceState {
  if (action.type === 'reset') {
    return createSliceState(false)
  }
  const nowMs = Date.now()
  let nextTokens = current.tokens
  let transitions = current.diagnostics.animationTransitions
  if (action.type === 'animation') {
    nextTokens = current.tokens.map((token) => {
      const state = tokenState(token)
      if (token.id !== action.tokenId || !state) return token
      transitions += 1
      return { ...token, character: { ...state, animation: action.animation } }
    })
  } else if (action.type === 'equipment') {
    nextTokens = current.tokens.map((token) => {
      const state = tokenState(token)
      if (token.id !== action.tokenId || !state) return token
      return { ...token, character: { ...state, equipment: { ...state.equipment, ...action.equipment } } }
    })
  }

  const event = actionEvent(action, sequence, nowMs, nextTokens)
  const nextEvents = event
    ? reducePresentationEvents(current.presentationEvents, [event], nowMs)
    : reducePresentationEvents(current.presentationEvents, [], nowMs)
  const emittedEventIds = event && !current.diagnostics.emittedEventIds.includes(event.id)
    ? [...current.diagnostics.emittedEventIds, event.id]
    : current.diagnostics.emittedEventIds
  const currentAnimations: Record<string, CharacterAnimationName> = {}
  const equippedIds: Record<string, EquippedVisuals> = {}
  for (const token of nextTokens) {
    if (!token.character) continue
    currentAnimations[token.id] = token.character.animation
    equippedIds[token.id] = token.character.equipment
  }
  return {
    tokens: nextTokens,
    presentationEvents: nextEvents,
    diagnostics: {
      ...current.diagnostics,
      currentAnimations,
      equippedIds,
      emittedEventIds,
      activeEventIds: nextEvents.map((candidate) => candidate.id),
      mixerCount: nextTokens.filter((token) => token.character).length,
      animationTransitions: transitions,
    },
  }
}

function createSliceState(stress: boolean): CharacterSliceState {
  const tokens = fixtureTokens(stress)
  const currentAnimations: Record<string, CharacterAnimationName> = {}
  const equippedIds: Record<string, EquippedVisuals> = {}
  for (const token of tokens) {
    if (!token.character) continue
    currentAnimations[token.id] = token.character.animation
    equippedIds[token.id] = token.character.equipment
  }
  return {
    tokens,
    presentationEvents: EMPTY_EVENTS,
    diagnostics: {
      loadedRecipeIds: [...new Set(tokens.flatMap((token) => token.character?.recipeId ?? []))],
      currentAnimations,
      equippedIds,
      emittedEventIds: [],
      activeEventIds: [],
      mixerCount: tokens.filter((token) => token.character).length,
      assetErrorCount: 0,
      optionalFallbackCount: 0,
      animationTransitions: 0,
    },
  }
}

export function characterSliceEnabled(search = typeof window === 'undefined' ? '' : window.location.search): boolean {
  return new URLSearchParams(search).get('characters') === '1'
}

export function useCharacterSlice(enabled: boolean): CharacterSliceState {
  const stress = enabled && (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('stress') === '1')
  const [slice, setSlice] = useState<CharacterSliceState>(() => (enabled ? createSliceState(stress) : {
    tokens: EMPTY_TOKENS,
    presentationEvents: EMPTY_EVENTS,
    diagnostics: EMPTY_DIAGNOSTICS,
  }))
  const sequence = useRef(0)
  const scheduled = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const dispatch = useCallback((action: SliceAction) => {
    setSlice((current) => {
      sequence.current += 1
      return applyAction(action, current, sequence.current)
    })
  }, [])

  useEffect(() => {
    if (!enabled) return undefined
    const sequenceActions: readonly SliceAction[] = [
      { type: 'animation', tokenId: 'character-knight', animation: 'move' },
      { type: 'animation', tokenId: 'character-mage', animation: 'attack' },
      { type: 'effect', effectId: 'fire_projectile', sourceTokenId: 'character-mage', targetTokenId: 'character-skeleton', id: 'character-slice-fire-1' },
      { type: 'animation', tokenId: 'character-skeleton', animation: 'hit' },
      { type: 'equipment', tokenId: 'character-knight', equipment: { mainHand: 'axe', back: 'sword', offHand: 'shield', head: 'helmet' } },
      { type: 'animation', tokenId: 'character-knight', animation: 'attack' },
      { type: 'effect', effectId: 'melee_slash', sourceTokenId: 'character-knight', targetTokenId: 'character-skeleton', id: 'character-slice-slash-1' },
      { type: 'animation', tokenId: 'character-skeleton', animation: 'death' },
      { type: 'effect', effectId: 'hit_burst', sourceTokenId: 'character-mage', targetTokenId: 'character-skeleton', id: 'character-slice-hit-1' },
      { type: 'effect', effectId: 'heal_pulse', sourceTokenId: 'character-mage', targetTokenId: 'character-knight', id: 'character-slice-heal-1' },
    ]
    let index = 0
    const run = () => {
      const action = sequenceActions[index % sequenceActions.length]!
      index += 1
      dispatch(action)
      scheduled.current = setTimeout(run, 720)
    }
    scheduled.current = setTimeout(run, 450)
    const handleAction = (event: Event) => {
      const action = parseAction((event as CustomEvent<unknown>).detail)
      if (action) dispatch(action)
    }
    window.addEventListener('battle-map:character-slice', handleAction)
    return () => {
      if (scheduled.current !== undefined) clearTimeout(scheduled.current)
      window.removeEventListener('battle-map:character-slice', handleAction)
    }
  }, [dispatch, enabled])

  return enabled ? slice : { tokens: EMPTY_TOKENS, presentationEvents: EMPTY_EVENTS, diagnostics: EMPTY_DIAGNOSTICS }
}

export function CharacterSliceDiagnostics({ diagnostics }: Readonly<{ diagnostics: CharacterSliceDiagnostics }>) {
  return (
    <output
      hidden
      data-testid="character-slice-diagnostics"
      data-loaded-recipe-ids={diagnostics.loadedRecipeIds.join(',')}
      data-current-animations={JSON.stringify(diagnostics.currentAnimations)}
      data-equipped-ids={JSON.stringify(diagnostics.equippedIds)}
      data-emitted-event-ids={diagnostics.emittedEventIds.join(',')}
      data-active-event-ids={diagnostics.activeEventIds.join(',')}
      data-mixer-count={diagnostics.mixerCount}
      data-asset-error-count={diagnostics.assetErrorCount}
      data-optional-fallback-count={diagnostics.optionalFallbackCount}
      data-animation-transitions={diagnostics.animationTransitions}
    />
  )
}

export function CharacterSlice({ enabled, diagnostics }: Readonly<{ enabled: boolean; diagnostics?: CharacterSliceDiagnostics }>) {
  const state = useCharacterSlice(enabled)
  return enabled ? <CharacterSliceDiagnostics diagnostics={diagnostics ?? state.diagnostics} /> : null
}
