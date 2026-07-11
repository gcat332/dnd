import { beforeEach, expect, it } from 'vitest'
import { useBattleMapView } from './useBattleMapView'

beforeEach(() => {
  useBattleMapView.setState(useBattleMapView.getInitialState(), true)
})

it('preserves local interaction state when the camera changes', () => {
  useBattleMapView.getState().selectToken('token-1')
  useBattleMapView.getState().previewTokenMove('token-1', { column: 12, row: 34 })

  useBattleMapView.getState().setCamera({ x: 80, z: 90 }, 48)

  expect(useBattleMapView.getState().selectedTokenId).toBe('token-1')
  expect(useBattleMapView.getState().dragPreview).toEqual({
    tokenId: 'token-1',
    cell: { column: 12, row: 34 },
  })
})
