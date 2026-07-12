import { describe, expect, it } from 'vitest'
import {
  CHARACTER_ANIMATIONS,
  EQUIPMENT_SOCKET,
  getEquipmentRecipe,
  parseCharacterPresentationState,
  type CharacterAnimationName,
  type CharacterPresentationState,
  type EquipmentSlot,
} from './contract'

describe('character presentation contract', () => {
  it('keeps the V1 animation and equipment socket sets closed', () => {
    expect(CHARACTER_ANIMATIONS).toEqual(['idle', 'move', 'attack', 'hit', 'death'])
    expect(EQUIPMENT_SOCKET).toEqual({
      mainHand: 'socket_main_hand',
      offHand: 'socket_off_hand',
      back: 'socket_back',
      head: 'socket_head',
    })

    const animation: CharacterAnimationName = 'idle'
    const slot: EquipmentSlot = 'mainHand'
    expect(animation).toBe('idle')
    expect(slot).toBe('mainHand')
  })

  it('parses a complete presentation state without changing domain values', () => {
    const result = parseCharacterPresentationState({
      recipeId: 'kaykit-knight',
      animation: 'idle',
      facingRadians: 0,
      equipment: { mainHand: 'sword', offHand: 'shield', back: null, head: 'helmet' },
    })

    expect(result).toEqual({
      ok: true,
      value: {
        recipeId: 'kaykit-knight',
        animation: 'idle',
        facingRadians: 0,
        equipment: { mainHand: 'sword', offHand: 'shield', back: null, head: 'helmet' },
      } satisfies CharacterPresentationState,
    })
  })

  it.each([
    ['unknown recipe', { recipeId: 'no-such-recipe' }],
    ['unknown animation', { recipeId: 'kaykit-knight', animation: 'run' }],
    [
      'equipment-slot mismatch',
      {
        recipeId: 'kaykit-knight',
        animation: 'idle',
        facingRadians: 0,
        equipment: { mainHand: 'shield', offHand: null, back: null, head: null },
      },
    ],
    [
      'non-finite facing',
      { recipeId: 'kaykit-knight', animation: 'idle', facingRadians: Number.NaN, equipment: {} },
    ],
    [
      'unknown equipment item',
      {
        recipeId: 'kaykit-knight',
        animation: 'idle',
        facingRadians: 0,
        equipment: { mainHand: 'laser-sword', offHand: null, back: null, head: null },
      },
    ],
  ])('rejects %s with a descriptive error', (_label, input) => {
    const result = parseCharacterPresentationState(input)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.length).toBeGreaterThan(10)
  })

  it('exposes recipes for valid equipment IDs and no recipe for unknown IDs', () => {
    expect(getEquipmentRecipe('sword')?.allowedSlots).toContain('mainHand')
    expect(getEquipmentRecipe('not-an-item')).toBeUndefined()
  })
})
