import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./api', () => ({
  listMyCampaigns: vi.fn().mockResolvedValue([
    { id: 'c1', name: 'The Fallen Spire', dm_user_id: 'u1', created_at: 'now' },
  ]),
}))

import { CampaignListPage } from './CampaignListPage'

describe('CampaignListPage', () => {
  it('lists campaigns the user belongs to, each linking to its dashboard', async () => {
    render(
      <MemoryRouter>
        <CampaignListPage />
      </MemoryRouter>,
    )

    const link = await screen.findByRole('link', { name: /the fallen spire/i })
    expect(link).toHaveAttribute('href', '/campaigns/c1')
  })
})
