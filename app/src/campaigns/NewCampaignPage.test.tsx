import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

const navigateMock = vi.fn()
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router')
  return { ...actual, useNavigate: () => navigateMock }
})

const createCampaignMock = vi.fn()
vi.mock('./api', () => ({
  createCampaign: (...args: unknown[]) => createCampaignMock(...args),
}))

import { NewCampaignPage } from './NewCampaignPage'

afterEach(() => {
  cleanup()
  navigateMock.mockClear()
})

describe('NewCampaignPage', () => {
  it('creates a campaign and navigates to its dashboard', async () => {
    createCampaignMock.mockResolvedValueOnce({ id: 'c1', name: 'Ashen Reach' })

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

  it('shows an error and re-enables the button when creation fails', async () => {
    createCampaignMock.mockRejectedValueOnce(new Error('Network error'))

    render(
      <MemoryRouter>
        <NewCampaignPage />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText(/campaign name/i), {
      target: { value: 'Ashen Reach' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create/i }))

    expect(await screen.findByText('Network error')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create/i })).toBeEnabled()
    expect(navigateMock).not.toHaveBeenCalled()
  })
})
