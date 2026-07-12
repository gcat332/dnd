import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DiceRoll } from './diceNotation'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

vi.mock('./api', () => ({
  rollDice: vi.fn(),
  listRecentRolls: vi.fn(),
}))

import { listRecentRolls, rollDice } from './api'
import { DiceRollerPanel } from './DiceRollerPanel'

const ROLL: DiceRoll = {
  id: 'd1',
  campaign_id: 'c1',
  roller_id: 'u1',
  notation: '2d6+3',
  results: [4, 5],
  modifier: 3,
  total: 12,
  created_at: 'now',
}

describe('DiceRollerPanel', () => {
  it('shows the recent roll history on load', async () => {
    vi.mocked(listRecentRolls).mockResolvedValue([ROLL])
    render(<DiceRollerPanel campaignId="c1" />)
    expect(await screen.findByText(/2d6\+3/)).toBeInTheDocument()
    expect(screen.getByText(/12/)).toBeInTheDocument()
  })

  it('rolls a valid notation and prepends the result', async () => {
    vi.mocked(listRecentRolls).mockResolvedValue([])
    vi.mocked(rollDice).mockResolvedValue(ROLL)
    render(<DiceRollerPanel campaignId="c1" />)

    fireEvent.change(screen.getByLabelText(/dice notation/i), { target: { value: '2d6+3' } })
    fireEvent.click(screen.getByRole('button', { name: /roll/i }))

    await waitFor(() =>
      expect(rollDice).toHaveBeenCalledWith('c1', { count: 2, sides: 6, modifier: 3 }),
    )
    expect(await screen.findByText(/2d6\+3/)).toBeInTheDocument()
  })

  it('shows a validation error for bad notation without calling the API', async () => {
    vi.mocked(listRecentRolls).mockResolvedValue([])
    render(<DiceRollerPanel campaignId="c1" />)

    fireEvent.change(screen.getByLabelText(/dice notation/i), { target: { value: '2d7' } })
    fireEvent.click(screen.getByRole('button', { name: /roll/i }))

    expect(await screen.findByText(/not a valid dice roll/i)).toBeInTheDocument()
    expect(rollDice).not.toHaveBeenCalled()
  })

  it('surfaces a server error', async () => {
    vi.mocked(listRecentRolls).mockResolvedValue([])
    vi.mocked(rollDice).mockRejectedValueOnce(
      new Error('Only a member of this campaign can roll dice here'),
    )
    render(<DiceRollerPanel campaignId="c1" />)

    fireEvent.change(screen.getByLabelText(/dice notation/i), { target: { value: '1d20' } })
    fireEvent.click(screen.getByRole('button', { name: /roll/i }))

    expect(await screen.findByText(/only a member of this campaign can roll/i)).toBeInTheDocument()
  })
})
