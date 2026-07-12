import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Token } from './tokenModel'

afterEach(() => cleanup())

vi.mock('./api', () => ({
  createToken: vi.fn(),
  deleteToken: vi.fn(),
}))

import { createToken, deleteToken } from './api'
import { TokenPalettePanel } from './TokenPalettePanel'

const GOBLIN: Token = {
  id: 't1',
  battle_map_id: 'map-1',
  label: 'Goblin',
  color: '#4f9e63',
  column: 100,
  row: 100,
  elevation: 0,
}

describe('TokenPalettePanel', () => {
  it('lists tokens with a remove control', () => {
    render(
      <TokenPalettePanel
        mapId="map-1"
        tokens={[GOBLIN]}
        onTokenAdded={vi.fn()}
        onTokenRemoved={vi.fn()}
      />,
    )
    expect(screen.getByText(/goblin/i, { selector: 'li' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument()
  })

  it('adds a token, persists via createToken, and reports the created token up', async () => {
    vi.mocked(createToken).mockResolvedValue(GOBLIN)
    const onTokenAdded = vi.fn()
    render(
      <TokenPalettePanel
        mapId="map-1"
        tokens={[]}
        onTokenAdded={onTokenAdded}
        onTokenRemoved={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText(/label/i), { target: { value: 'Goblin' } })
    fireEvent.click(screen.getByRole('button', { name: /add token/i }))

    await waitFor(() =>
      expect(createToken).toHaveBeenCalledWith('map-1', 'Goblin', expect.any(String), 100, 100),
    )
    expect(onTokenAdded).toHaveBeenCalledWith(GOBLIN)
  })

  it('removes a token via deleteToken and reports the removed id up', async () => {
    vi.mocked(deleteToken).mockResolvedValue(undefined)
    const onTokenRemoved = vi.fn()
    render(
      <TokenPalettePanel
        mapId="map-1"
        tokens={[GOBLIN]}
        onTokenAdded={vi.fn()}
        onTokenRemoved={onTokenRemoved}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /remove/i }))

    await waitFor(() => expect(deleteToken).toHaveBeenCalledWith('t1'))
    expect(onTokenRemoved).toHaveBeenCalledWith('t1')
  })

  it('shows an error when adding fails', async () => {
    vi.mocked(createToken).mockRejectedValueOnce(
      new Error('Only the current DM can add tokens to this battle map'),
    )
    const onTokenAdded = vi.fn()
    render(
      <TokenPalettePanel
        mapId="map-1"
        tokens={[]}
        onTokenAdded={onTokenAdded}
        onTokenRemoved={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText(/label/i), { target: { value: 'X' } })
    fireEvent.click(screen.getByRole('button', { name: /add token/i }))

    expect(await screen.findByText(/only the current dm can add tokens/i)).toBeInTheDocument()
    expect(onTokenAdded).not.toHaveBeenCalled()
  })
})
