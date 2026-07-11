import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

const listMyCampaignsMock = vi.fn()
vi.mock('./api', () => ({
  listMyCampaigns: (...args: unknown[]) => listMyCampaignsMock(...args),
}))

import { CampaignListPage } from './CampaignListPage'

afterEach(() => {
  cleanup()
})

describe('CampaignListPage', () => {
  it('lists campaigns the user belongs to, each linking to its dashboard', async () => {
    listMyCampaignsMock.mockResolvedValueOnce([
      { id: 'c1', name: 'The Fallen Spire', dm_user_id: 'u1', created_at: 'now' },
    ])

    render(
      <MemoryRouter>
        <CampaignListPage />
      </MemoryRouter>,
    )

    const link = await screen.findByRole('link', { name: /the fallen spire/i })
    expect(link).toHaveAttribute('href', '/campaigns/c1')
  })

  it('shows an error message when the campaign list fails to load', async () => {
    listMyCampaignsMock.mockRejectedValueOnce(new Error('Network error'))

    render(
      <MemoryRouter>
        <CampaignListPage />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Network error')).toBeInTheDocument()
  })
})
