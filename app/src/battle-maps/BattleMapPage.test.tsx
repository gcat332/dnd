import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./api', () => ({
  getBattleMap: vi.fn(),
}))

vi.mock('../battle-map/BattleMapView', () => ({
  BattleMapView: () => <div data-testid="battle-map-view" />,
}))

import { getBattleMap } from './api'
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
})
