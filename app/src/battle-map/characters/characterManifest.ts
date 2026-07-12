import rawManifest from '../../../public/assets/characters/asset-manifest.json'

export const CHARACTER_ANIMATIONS = ['idle', 'move', 'attack', 'hit', 'death'] as const
export type CharacterAnimationName = (typeof CHARACTER_ANIMATIONS)[number]

export const EQUIPMENT_SOCKET = {
  mainHand: 'socket_main_hand',
  offHand: 'socket_off_hand',
  back: 'socket_back',
  head: 'socket_head',
} as const
export type EquipmentSlot = keyof typeof EQUIPMENT_SOCKET

export type CharacterRole = 'player' | 'npc' | 'monster'

export type CharacterRecipe = Readonly<{
  id: string
  role: CharacterRole
  url: string
  rig: string
  attackEventTime: number
}>

export type EquipmentRecipe = Readonly<{
  id: string
  allowedSlots: readonly EquipmentSlot[]
  url: string
}>

export type CharacterManifest = Readonly<{
  schemaVersion: 1
  characters: readonly CharacterRecipe[]
  equipment: readonly EquipmentRecipe[]
}>

export class CharacterManifestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CharacterManifestError'
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(record: Readonly<Record<string, unknown>>, key: string, id: string): string {
  const value = record[key]
  if (typeof value !== 'string' || value.length === 0) {
    throw new CharacterManifestError(`Character manifest record "${id}": ${key} must be a non-empty string`)
  }
  return value
}

function readUrl(record: Readonly<Record<string, unknown>>, id: string): string {
  const url = readString(record, 'url', id)
  if (!url.startsWith('/') || url.startsWith('//')) {
    throw new CharacterManifestError(`Character manifest record "${id}": url must be root-relative`)
  }
  return url
}

function readId(record: Readonly<Record<string, unknown>>, fallback: string): string {
  const value = record.id
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

function isEquipmentSlot(value: unknown): value is EquipmentSlot {
  return value === 'mainHand' || value === 'offHand' || value === 'back' || value === 'head'
}

function readCharacter(value: unknown, index: number): CharacterRecipe {
  const fallback = `characters[${index}]`
  if (!isRecord(value)) throw new CharacterManifestError(`Character manifest record "${fallback}": expected an object`)
  const id = readId(value, fallback)
  const role = value.role
  if (role !== 'player' && role !== 'npc' && role !== 'monster') {
    throw new CharacterManifestError(`Character manifest record "${id}": role must be player, npc, or monster`)
  }
  const attackEventTime = value.attackEventTime
  if (typeof attackEventTime !== 'number' || !Number.isFinite(attackEventTime) || attackEventTime < 0 || attackEventTime > 1) {
    throw new CharacterManifestError(`Character manifest record "${id}": attackEventTime must be finite and within [0, 1]`)
  }
  return Object.freeze({
    id: readString(value, 'id', id),
    role,
    url: readUrl(value, id),
    rig: readString(value, 'rig', id),
    attackEventTime,
  })
}

function readEquipment(value: unknown, index: number): EquipmentRecipe {
  const fallback = `equipment[${index}]`
  if (!isRecord(value)) throw new CharacterManifestError(`Character manifest record "${fallback}": expected an object`)
  const id = readId(value, fallback)
  const rawSlots = value.allowedSlots
  if (!Array.isArray(rawSlots) || rawSlots.length === 0 || !rawSlots.every(isEquipmentSlot)) {
    throw new CharacterManifestError(`Character manifest record "${id}": allowedSlots must contain known equipment slots`)
  }
  const allowedSlots = rawSlots.slice()
  if (new Set(allowedSlots).size !== allowedSlots.length) {
    throw new CharacterManifestError(`Character manifest record "${id}": allowedSlots must not contain duplicates`)
  }
  return Object.freeze({
    id: readString(value, 'id', id),
    allowedSlots: Object.freeze(allowedSlots),
    url: readUrl(value, id),
  })
}

function readArray(value: unknown, key: 'characters' | 'equipment'): readonly unknown[] {
  if (!Array.isArray(value)) throw new CharacterManifestError(`Character manifest: ${key} must be an array`)
  return value
}

export function parseCharacterManifest(value: unknown): CharacterManifest {
  if (!isRecord(value)) throw new CharacterManifestError('Character manifest: expected an object')
  if (value.schemaVersion !== 1) {
    throw new CharacterManifestError('Character manifest: schemaVersion must be 1')
  }
  const characters = readArray(value.characters, 'characters').map(readCharacter)
  const equipment = readArray(value.equipment, 'equipment').map(readEquipment)
  const records = [...characters, ...equipment]
  const ids = new Set<string>()
  const urls = new Set<string>()
  for (const record of records) {
    if (ids.has(record.id)) throw new CharacterManifestError(`Character manifest record "${record.id}": duplicate id`)
    if (urls.has(record.url)) throw new CharacterManifestError(`Character manifest record "${record.id}": duplicate url ${record.url}`)
    ids.add(record.id)
    urls.add(record.url)
  }
  if (characters.length === 0) throw new CharacterManifestError('Character manifest: characters must not be empty')
  if (equipment.length === 0) throw new CharacterManifestError('Character manifest: equipment must not be empty')
  return Object.freeze({ schemaVersion: 1, characters: Object.freeze(characters), equipment: Object.freeze(equipment) })
}

export const validateCharacterManifest = parseCharacterManifest

// Validate repository-owned data at import time so a bad deployment fails before rendering starts.
export const characterManifest = parseCharacterManifest(rawManifest)

const characterRecipes = new Map(characterManifest.characters.map((recipe) => [recipe.id, recipe]))
const equipmentRecipes = new Map(characterManifest.equipment.map((recipe) => [recipe.id, recipe]))

export function getCharacterRecipe(id: string): CharacterRecipe | undefined {
  return characterRecipes.get(id)
}

export function getEquipmentRecipe(id: string): EquipmentRecipe | undefined {
  return equipmentRecipes.get(id)
}

export function isKnownEquipmentSlot(value: unknown): value is EquipmentSlot {
  return isEquipmentSlot(value)
}

export function isKnownCharacterAnimation(value: unknown): value is CharacterAnimationName {
  return value === 'idle' || value === 'move' || value === 'attack' || value === 'hit' || value === 'death'
}
