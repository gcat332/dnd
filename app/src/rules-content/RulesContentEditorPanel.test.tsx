import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RulesObject } from './rulesObject'

afterEach(() => cleanup())

vi.mock('./api', () => ({
  listCampaignRulesObjects: vi.fn(),
  createAbility: vi.fn(),
  deleteRulesObject: vi.fn(),
}))

import { createAbility, deleteRulesObject, listCampaignRulesObjects } from './api'
import { RulesContentEditorPanel } from './RulesContentEditorPanel'

const FIREBOLT: RulesObject = {
  id: 'r1',
  campaign_id: 'c1',
  type: 'ability',
  source: 'homebrew',
  name: 'Firebolt',
  description: 'A dart of flame.',
  mechanics: { actionCost: 'action', resourceCost: 1, targeting: 'single', range: 6, damageDice: '2d6' },
}

describe('RulesContentEditorPanel', () => {
  it('lists existing abilities', async () => {
    vi.mocked(listCampaignRulesObjects).mockResolvedValue([FIREBOLT])
    render(<RulesContentEditorPanel campaignId="c1" />)
    expect(await screen.findByText(/firebolt/i, { selector: 'li' })).toBeInTheDocument()
  })

  it('creates an ability and shows it in the list', async () => {
    vi.mocked(listCampaignRulesObjects).mockResolvedValue([])
    vi.mocked(createAbility).mockResolvedValue(FIREBOLT)
    render(<RulesContentEditorPanel campaignId="c1" />)

    fireEvent.change(await screen.findByLabelText(/ability name/i), { target: { value: 'Firebolt' } })
    fireEvent.click(screen.getByRole('button', { name: /add ability/i }))

    await waitFor(() =>
      expect(createAbility).toHaveBeenCalledWith('c1', 'Firebolt', expect.any(String), expect.objectContaining({ actionCost: expect.any(String) })),
    )
    expect(await screen.findByText(/firebolt/i, { selector: 'li' })).toBeInTheDocument()
  })

  it('removes an ability', async () => {
    vi.mocked(listCampaignRulesObjects).mockResolvedValue([FIREBOLT])
    vi.mocked(deleteRulesObject).mockResolvedValue(undefined)
    render(<RulesContentEditorPanel campaignId="c1" />)

    fireEvent.click(await screen.findByRole('button', { name: /remove/i }))

    await waitFor(() => expect(deleteRulesObject).toHaveBeenCalledWith('r1'))
  })

  it('shows an error when create fails', async () => {
    vi.mocked(listCampaignRulesObjects).mockResolvedValue([])
    vi.mocked(createAbility).mockRejectedValueOnce(
      new Error('Only the current DM can create content for this campaign'),
    )
    render(<RulesContentEditorPanel campaignId="c1" />)

    fireEvent.change(await screen.findByLabelText(/ability name/i), { target: { value: 'X' } })
    fireEvent.click(screen.getByRole('button', { name: /add ability/i }))

    expect(await screen.findByText(/only the current dm can create content/i)).toBeInTheDocument()
  })

  it('does not create ability if mechanics are out of range', async () => {
    vi.mocked(listCampaignRulesObjects).mockResolvedValue([])
    vi.mocked(createAbility).mockClear()
    render(<RulesContentEditorPanel campaignId="c1" />)

    fireEvent.change(await screen.findByLabelText(/ability name/i), { target: { value: 'Bad Ability' } })
    fireEvent.change(await screen.findByLabelText(/range \(cells\)/i), { target: { value: '999' } })
    fireEvent.click(screen.getByRole('button', { name: /add ability/i }))

    expect(createAbility).not.toHaveBeenCalled()
    expect(await screen.findByText(/ability mechanics are out of the allowed range/i)).toBeInTheDocument()
  })
})
