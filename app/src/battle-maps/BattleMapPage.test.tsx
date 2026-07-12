import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./api', () => ({
  getBattleMap: vi.fn(),
  listBattleMapTokens: vi.fn(),
  moveToken: vi.fn(),
  setBattleMapTerrain: vi.fn(),
}))

const battleMapViewProps = vi.fn()
vi.mock('../battle-map/BattleMapView', () => ({
  BattleMapView: (props: unknown) => {
    battleMapViewProps(props)
    return <div data-testid="battle-map-view" />
  },
}))

vi.mock('./TerrainEditorPanel', () => ({
  TerrainEditorPanel: () => <div data-testid="terrain-editor-panel" />,
}))

import { getBattleMap, listBattleMapTokens } from './api'
import { BattleMapPage } from './BattleMapPage'

function renderAt(mapId: string) {
  return render(
    <MemoryRouter initialEntries={[`/campaigns/campaign-1/maps/${mapId}`]}>
      <Routes>
        <Route path="/campaigns/:campaignId/maps/:mapId" element={<BattleMapPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('BattleMapPage', () => {
  beforeEach(() => {
    vi.mocked(getBattleMap).mockClear()
    vi.mocked(listBattleMapTokens).mockReset().mockResolvedValue([])
    battleMapViewProps.mockClear()
  })

  afterEach(() => {
    cleanup()
  })
  it('shows the map name and mounts the 3D viewer once loaded', async () => {
    vi.mocked(getBattleMap).mockResolvedValue({
      id: 'map-1',
      campaign_id: 'campaign-1',
      name: 'Keep — Ground Floor',
      created_by: 'u1',
      created_at: 'now',
      terrain: [],
    })

    renderAt('map-1')

    expect(await screen.findByRole('heading', { name: /keep — ground floor/i })).toBeInTheDocument()
    expect(screen.getByTestId('battle-map-view')).toBeInTheDocument()
    expect(screen.getByTestId('terrain-editor-panel')).toBeInTheDocument()
  })

  it('shows a not-found message when no map matches the id', async () => {
    vi.mocked(getBattleMap).mockResolvedValue(null)

    renderAt('missing-map')

    expect(await screen.findByText(/battle map not found/i)).toBeInTheDocument()
    expect(screen.queryByTestId('battle-map-view')).not.toBeInTheDocument()
  })

  it('shows an error message instead of loading forever when the map fails to load', async () => {
    vi.mocked(getBattleMap).mockRejectedValue(new Error('Row level security denied access'))

    renderAt('map-1')

    expect(
      await screen.findByText(/failed to load battle map: row level security denied access/i),
    ).toBeInTheDocument()
    expect(screen.queryByText(/loading map/i)).not.toBeInTheDocument()
    expect(screen.queryByTestId('battle-map-view')).not.toBeInTheDocument()
  })

  it('loads the map tokens and passes them to the battle map view', async () => {
    vi.mocked(getBattleMap).mockResolvedValue({
      id: 'map-1',
      campaign_id: 'c1',
      name: 'Map A',
      created_by: 'u1',
      created_at: 'now',
      terrain: [],
    })
    vi.mocked(listBattleMapTokens).mockResolvedValue([
      {
        id: 't1',
        battle_map_id: 'map-1',
        label: 'Goblin',
        color: '#4f9e63',
        column: 100,
        row: 100,
        elevation: 0,
      },
    ])

    renderAt('map-1')

    await screen.findByTestId('battle-map-view')
    await waitFor(() => {
      const lastCall = battleMapViewProps.mock.calls.at(-1)?.[0] as { tokens: unknown[] }
      expect(lastCall.tokens).toHaveLength(1)
    })
  })
})
