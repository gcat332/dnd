import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

const navigateMock = vi.fn()
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router')
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock('./api', () => ({
  redeemInvitation: vi.fn().mockResolvedValue({ campaignId: 'c1' }),
}))

import { JoinCampaignPage } from './JoinCampaignPage'

describe('JoinCampaignPage', () => {
  it('redeems the code from the URL and navigates to the campaign', async () => {
    render(
      <MemoryRouter initialEntries={['/join/ABCD1234']}>
        <Routes>
          <Route path="/join/:code" element={<JoinCampaignPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/campaigns/c1'))
  })

  it('shows an error message when redemption fails', async () => {
    const { redeemInvitation } = await import('./api')
    vi.mocked(redeemInvitation).mockRejectedValueOnce(new Error('Invitation code not found'))

    render(
      <MemoryRouter initialEntries={['/join/BADCODE1']}>
        <Routes>
          <Route path="/join/:code" element={<JoinCampaignPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText(/invitation code not found/i)).toBeInTheDocument()
  })
})
