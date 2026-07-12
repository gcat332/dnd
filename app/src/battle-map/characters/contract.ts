import {
  CHARACTER_ANIMATIONS,
  EQUIPMENT_SOCKET,
  getCharacterRecipe,
  getEquipmentRecipe,
  isKnownCharacterAnimation,
  isKnownEquipmentSlot,
  type CharacterAnimationName,
  type CharacterRecipe,
  type EquipmentRecipe,
  type EquipmentSlot,
} from './characterManifest'

export { CHARACTER_ANIMATIONS, EQUIPMENT_SOCKET, getCharacterRecipe, getEquipmentRecipe }
export type { CharacterAnimationName, CharacterRecipe, EquipmentRecipe, EquipmentSlot }

export type EquippedVisuals = Readonly<{
  mainHand: string | null
  offHand: string | null
  back: string | null
  head: string | null
}>

export type CharacterPresentationState = Readonly<{
  recipeId: string
  animation: CharacterAnimationName
  facingRadians: number
  equipment: EquippedVisuals
}>

export type ParseResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; error: string }>

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isEquipmentVisuals(value: unknown): value is Readonly<Record<EquipmentSlot, unknown>> {
  if (!isRecord(value)) return false
  const slots = Object.keys(EQUIPMENT_SOCKET)
  return (
    slots.every((slot) => Object.prototype.hasOwnProperty.call(value, slot)) &&
    Object.keys(value).every((slot) => slots.includes(slot))
  )
}

export function parseCharacterPresentationState(value: unknown): ParseResult<CharacterPresentationState> {
  if (!isRecord(value)) return { ok: false, error: 'Character presentation state must be an object' }
  const recipeId = value.recipeId
  if (typeof recipeId !== 'string' || !getCharacterRecipe(recipeId)) {
    return { ok: false, error: `Unknown character recipe "${String(recipeId)}"` }
  }
  const animation = value.animation
  if (!isKnownCharacterAnimation(animation)) {
    return { ok: false, error: `Unknown character animation "${String(animation)}"` }
  }
  const facingRadians = value.facingRadians
  if (typeof facingRadians !== 'number' || !Number.isFinite(facingRadians)) {
    return { ok: false, error: 'Character facingRadians must be a finite number' }
  }
  if (!isEquipmentVisuals(value.equipment)) {
    return { ok: false, error: 'Character equipment must provide mainHand, offHand, back, and head slots' }
  }

  const equipment: Partial<Record<EquipmentSlot, string | null>> = {}
  for (const slot of Object.keys(EQUIPMENT_SOCKET)) {
    if (!isKnownEquipmentSlot(slot)) continue
    const item = value.equipment[slot]
    if (item !== null && typeof item !== 'string') {
      return { ok: false, error: `Equipment slot "${slot}" must contain an item ID or null` }
    }
    if (item === null) {
      equipment[slot] = null
      continue
    }
    const recipe = getEquipmentRecipe(item)
    if (!recipe) return { ok: false, error: `Unknown equipment item "${item}" in slot "${slot}"` }
    if (!recipe.allowedSlots.includes(slot)) {
      return { ok: false, error: `Equipment item "${item}" cannot attach to slot "${slot}"` }
    }
    equipment[slot] = item
  }

  return {
    ok: true,
    value: {
      recipeId,
      animation,
      facingRadians,
      equipment: {
        mainHand: equipment.mainHand ?? null,
        offHand: equipment.offHand ?? null,
        back: equipment.back ?? null,
        head: equipment.head ?? null,
      },
    },
  }
}

export function isCharacterPresentationState(value: unknown): value is CharacterPresentationState {
  return parseCharacterPresentationState(value).ok
}

export function assertCharacterPresentationState(value: unknown): asserts value is CharacterPresentationState {
  const result = parseCharacterPresentationState(value)
  if (!result.ok) throw new TypeError(result.error)
}
