import type { WorldPoint } from '../domain/grid'

export const CHARACTER_EFFECT_IDS = [
  'melee_slash',
  'fire_projectile',
  'hit_burst',
  'heal_pulse',
] as const

export type CharacterEffectId = (typeof CHARACTER_EFFECT_IDS)[number]

/**
 * A transient, accepted presentation fact. Rules outcomes deliberately do not
 * cross this boundary: the renderer only receives where and when to show an
 * effect, never why an action succeeded.
 */
export type CharacterPresentationEvent = Readonly<{
  id: string
  effectId: CharacterEffectId
  sourceTokenId: string
  targetTokenId: string | null
  source: WorldPoint
  target: WorldPoint
  startedAtMs: number
  durationMs: number
}>

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isWorldPoint(value: unknown): value is WorldPoint {
  if (!isRecord(value)) return false
  return (
    typeof value.x === 'number' &&
    Number.isFinite(value.x) &&
    typeof value.z === 'number' &&
    Number.isFinite(value.z)
  )
}

function isEffectId(value: unknown): value is CharacterEffectId {
  return typeof value === 'string' && (CHARACTER_EFFECT_IDS as readonly string[]).includes(value)
}

/** Throws a descriptive error for malformed events before they reach Three. */
export function assertCharacterPresentationEvent(
  value: unknown,
): asserts value is CharacterPresentationEvent {
  if (!isRecord(value)) throw new TypeError('Character presentation event must be an object')
  if (typeof value.id !== 'string' || value.id.length === 0) {
    throw new TypeError('Character presentation event id must be a non-empty string')
  }
  if (!isEffectId(value.effectId)) {
    throw new TypeError(`Unknown character presentation effect "${String(value.effectId)}"`)
  }
  if (typeof value.sourceTokenId !== 'string' || value.sourceTokenId.length === 0) {
    throw new TypeError('Character presentation event sourceTokenId must be a non-empty string')
  }
  if (value.targetTokenId !== null && (typeof value.targetTokenId !== 'string' || value.targetTokenId.length === 0)) {
    throw new TypeError('Character presentation event targetTokenId must be a non-empty string or null')
  }
  if (!isWorldPoint(value.source)) {
    throw new TypeError('Character presentation event source position must have finite x and z')
  }
  if (!isWorldPoint(value.target)) {
    throw new TypeError('Character presentation event target position must have finite x and z')
  }
  if (typeof value.startedAtMs !== 'number' || !Number.isFinite(value.startedAtMs)) {
    throw new TypeError('Character presentation event startedAtMs must be finite')
  }
  if (typeof value.durationMs !== 'number' || !Number.isFinite(value.durationMs) || value.durationMs <= 0) {
    throw new TypeError('Character presentation event durationMs must be positive and finite')
  }
}

export function isCharacterPresentationEvent(value: unknown): value is CharacterPresentationEvent {
  try {
    assertCharacterPresentationEvent(value)
    return true
  } catch {
    return false
  }
}

export function parseCharacterPresentationEvent(value: unknown): CharacterPresentationEvent {
  assertCharacterPresentationEvent(value)
  return value
}

export function presentationEventProgress(event: CharacterPresentationEvent, nowMs: number): number {
  assertCharacterPresentationEvent(event)
  if (!Number.isFinite(nowMs)) throw new RangeError('Presentation event clock must be finite')
  return Math.min(1, Math.max(0, (nowMs - event.startedAtMs) / event.durationMs))
}

function comparePresentationEvents(
  left: CharacterPresentationEvent,
  right: CharacterPresentationEvent,
): number {
  if (left.startedAtMs !== right.startedAtMs) return left.startedAtMs - right.startedAtMs
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0
}

/**
 * Merge accepted events from the local stream and reconnect replay. Existing
 * IDs win so replay cannot restart an effect that is already on screen.
 */
export function reducePresentationEvents(
  current: readonly CharacterPresentationEvent[],
  incoming: readonly CharacterPresentationEvent[],
  nowMs: number,
): readonly CharacterPresentationEvent[] {
  if (!Number.isFinite(nowMs)) throw new RangeError('Presentation event clock must be finite')

  const byId = new Map<string, CharacterPresentationEvent>()
  for (const event of [...current, ...incoming]) {
    assertCharacterPresentationEvent(event)
    if (nowMs >= event.startedAtMs + event.durationMs) continue
    if (!byId.has(event.id)) byId.set(event.id, event)
  }
  return [...byId.values()].sort(comparePresentationEvents)
}
