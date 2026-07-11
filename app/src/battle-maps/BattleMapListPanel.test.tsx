import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => cleanup())

vi.mock('./api', () => ({
  listCampaignBattleMaps: vi.fn().mockResolvedValue([
    { id: 'map-1', campaign_id: 'campaign-1', name: 'Keep — Ground Floor', created_by: 'u1', created_at: 'now' },
  ]),
  createBattleMap: vi.fn().mockResolvedValue({
    id: 'map-2',
    campaign_id: 'campaign-1',
    name: 'Keep — Cellar',
    created_by: 'u1',
    created_at: 'now',
  }),
}))

import { BattleMapListPanel } from './BattleMapListPanel'

describe('BattleMapListPanel', () => {
  it('lists existing battle maps, each linking to its viewer route', async () => {
    render(
      <MemoryRouter>
        <BattleMapListPanel campaignId="campaign-1" />
      </MemoryRouter>,
    )

    const link = await screen.findByRole('link', { name: /keep — ground floor/i })
    expect(link).toHaveAttribute('href', '/campaigns/campaign-1/maps/map-1')
  })

  it('creates a new battle map and shows it in the list', async () => {
    render(
      <MemoryRouter>
        <BattleMapListPanel campaignId="campaign-1" />
      </MemoryRouter>,
    )

    await screen.findByRole('link', { name: /keep — ground floor/i })

    fireEvent.change(screen.getByLabelText(/map name/i), { target: { value: 'Keep — Cellar' } })
    fireEvent.click(screen.getByRole('button', { name: /create map/i }))

    await waitFor(() =>
      expect(screen.getByRole('link', { name: /keep — cellar/i })).toBeInTheDocument(),
    )
  })

  it('shows an error message when creating a battle map fails', async () => {
    const { createBattleMap } = await import('./api')
    vi.mocked(createBattleMap).mockRejectedValueOnce(
      new Error('Only the current DM can create a battle map for this campaign'),
    )

    render(
      <MemoryRouter>
        <BattleMapListPanel campaignId="campaign-1" />
      </MemoryRouter>,
    )

    await screen.findByRole('link', { name: /keep — ground floor/i })
    fireEvent.change(screen.getByLabelText(/map name/i), { target: { value: 'Nope' } })
    fireEvent.click(screen.getByRole('button', { name: /create map/i }))

    expect(
      await screen.findByText(/only the current dm can create a battle map/i),
    ).toBeInTheDocument()
  })

  it('shows an error message when the initial battle map list fails to load', async () => {
    const { listCampaignBattleMaps } = await import('./api')
    vi.mocked(listCampaignBattleMaps).mockRejectedValueOnce(new Error('Network error'))

    render(
      <MemoryRouter>
        <BattleMapListPanel campaignId="campaign-1" />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/failed to load battle maps: network error/i)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /keep — ground floor/i })).not.toBeInTheDocument()
  })
})
