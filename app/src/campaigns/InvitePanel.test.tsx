import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./api', () => ({
  createInvitation: vi.fn().mockResolvedValue({ code: 'ABCD1234' }),
}))

import { InvitePanel } from './InvitePanel'

describe('InvitePanel', () => {
  it('generates and displays an invitation code on request', async () => {
    render(<InvitePanel campaignId="c1" />)

    fireEvent.click(screen.getByRole('button', { name: /generate invite/i }))

    await waitFor(() => {
      const strongElement = screen.queryByText('ABCD1234')
      expect(strongElement).toBeInTheDocument()
    })
  })
})
