import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

const navigateMock = vi.fn()
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router')
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock('./api', () => ({
  createCampaign: vi.fn().mockResolvedValue({ id: 'c1', name: 'Ashen Reach' }),
}))

import { NewCampaignPage } from './NewCampaignPage'

describe('NewCampaignPage', () => {
  it('creates a campaign and navigates to its dashboard', async () => {
    render(
      <MemoryRouter>
        <NewCampaignPage />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText(/campaign name/i), {
      target: { value: 'Ashen Reach' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create/i }))

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/campaigns/c1'))
  })
})
