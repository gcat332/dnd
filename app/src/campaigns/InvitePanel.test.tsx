import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const createInvitationMock = vi.fn()
vi.mock('./api', () => ({
  createInvitation: (...args: unknown[]) => createInvitationMock(...args),
}))

import { InvitePanel } from './InvitePanel'

afterEach(() => {
  cleanup()
})

describe('InvitePanel', () => {
  it('generates and displays an invitation code on request', async () => {
    createInvitationMock.mockResolvedValueOnce({ code: 'ABCD1234' })

    render(<InvitePanel campaignId="c1" />)

    fireEvent.click(screen.getByRole('button', { name: /generate invite/i }))

    await waitFor(() => {
      const strongElement = screen.queryByText('ABCD1234')
      expect(strongElement).toBeInTheDocument()
    })
  })

  it('shows an error message when invite generation fails', async () => {
    createInvitationMock.mockRejectedValueOnce(new Error('Network error'))

    render(<InvitePanel campaignId="c1" />)

    fireEvent.click(screen.getByRole('button', { name: /generate invite/i }))

    expect(await screen.findByText('Network error')).toBeInTheDocument()
  })
})
