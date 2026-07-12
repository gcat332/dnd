import { describe, expect, it } from 'vitest'
import {
  reducePresentationEvents,
  type CharacterPresentationEvent,
} from './presentationEvents'

const BASE: CharacterPresentationEvent = {
  id: 'attack-1',
  effectId: 'melee_slash',
  sourceTokenId: 'hero',
  targetTokenId: 'skeleton',
  source: { x: 1.5, z: 2.5 },
  target: { x: 2.5, z: 2.5 },
  startedAtMs: 1_000,
  durationMs: 500,
}

describe('reducePresentationEvents', () => {
  it('deduplicates reconnect replay by stable event ID without restarting the first event', () => {
    const replay = { ...BASE, startedAtMs: 1_100 }
    expect(reducePresentationEvents([BASE], [replay], 1_200)).toEqual([BASE])
  })

  it('orders events chronologically and deterministically for equal timestamps', () => {
    const later = { ...BASE, id: 'b', startedAtMs: 1_100 }
    const earlier = { ...BASE, id: 'a', startedAtMs: 900 }
    expect(reducePresentationEvents([], [later, earlier], 1_200).map((event) => event.id)).toEqual([
      'a',
      'b',
    ])
  })

  it('expires at the exact end timestamp', () => {
    expect(reducePresentationEvents([BASE], [], 1_500)).toEqual([])
    expect(reducePresentationEvents([BASE], [], 1_499)).toEqual([BASE])
  })

  it('rejects missing or non-finite source and target positions', () => {
    expect(() =>
      reducePresentationEvents([], [{ ...BASE, source: undefined } as never], 1_200),
    ).toThrow(/source position/i)
    expect(() =>
      reducePresentationEvents([], [{ ...BASE, target: undefined } as never], 1_200),
    ).toThrow(/target position/i)
  })

  it('does not alter the domain payload for a quality tier', () => {
    expect(reducePresentationEvents([], [BASE], 1_200)).toEqual([BASE])
  })
})
