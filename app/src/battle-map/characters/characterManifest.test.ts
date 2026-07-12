import { describe, expect, it } from 'vitest'
import {
  characterManifest,
  getCharacterRecipe,
  getEquipmentRecipe,
  parseCharacterManifest,
} from './characterManifest'

describe('character asset manifest', () => {
  it('indexes unique repository-owned character and equipment records', () => {
    const ids = [...characterManifest.characters, ...characterManifest.equipment].map(
      (record) => record.id,
    )
    const urls = [...characterManifest.characters, ...characterManifest.equipment].map(
      (record) => record.url,
    )

    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(urls).size).toBe(urls.length)
    expect(urls.every((url) => url.startsWith('/'))).toBe(true)
    expect(characterManifest.characters.every((record) => record.attackEventTime >= 0 && record.attackEventTime <= 1)).toBe(true)
    expect(getCharacterRecipe('kaykit-knight')?.url).toBe('/assets/characters/kaykit-knight.glb')
  })

  it('rejects malformed records with the offending ID in the startup error', () => {
    expect(() =>
      parseCharacterManifest({
        schemaVersion: 1,
        characters: [
          {
            id: 'bad-knight',
            role: 'player',
            url: 'relative.glb',
            rig: 'kaykit-medium',
            attackEventTime: 1.5,
          },
        ],
        equipment: [],
      }),
    ).toThrow(/bad-knight/)
  })

  it('rejects duplicate IDs and URLs instead of silently replacing an index entry', () => {
    const duplicate = {
      schemaVersion: 1,
      characters: [
        {
          id: 'same-id',
          role: 'player',
          url: '/assets/one.glb',
          rig: 'kaykit-medium',
          attackEventTime: 0.5,
        },
        {
          id: 'same-id',
          role: 'npc',
          url: '/assets/two.glb',
          rig: 'kaykit-medium',
          attackEventTime: 0.5,
        },
      ],
      equipment: [],
    }
    expect(() => parseCharacterManifest(duplicate)).toThrow(/same-id/)

    expect(() =>
      parseCharacterManifest({
        schemaVersion: 1,
        characters: [
          {
            id: 'knight',
            role: 'player',
            url: '/assets/same.glb',
            rig: 'kaykit-medium',
            attackEventTime: 0.5,
          },
        ],
        equipment: [{ id: 'sword', allowedSlots: ['mainHand'], url: '/assets/same.glb' }],
      }),
    ).toThrow(/sword|same\.glb/)
  })

  it('rejects a slot assignment the manifest cannot attach', () => {
    expect(() =>
      parseCharacterManifest({
        schemaVersion: 1,
        characters: [
          {
            id: 'knight',
            role: 'player',
            url: '/assets/knight.glb',
            rig: 'kaykit-medium',
            attackEventTime: 0.5,
          },
        ],
        equipment: [{ id: 'shield', allowedSlots: ['mainHand'], url: '/assets/shield.glb' }],
      }),
    ).not.toThrow()
    expect(getEquipmentRecipe('shield')?.allowedSlots).toEqual(['offHand'])
  })
})
