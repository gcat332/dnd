import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BattleMap } from './api'

afterEach(() => cleanup())

vi.mock('./api', () => ({
  setBattleMapTerrain: vi.fn(),
}))

import { setBattleMapTerrain } from './api'
import { TerrainEditorPanel } from './TerrainEditorPanel'

const WALL = {
  id: 'w1',
  kind: 'wall' as const,
  column: 90,
  row: 93,
  widthCells: 18,
  depthCells: 1,
  heightCells: 3,
}

const MAP: BattleMap = {
  id: 'map-1',
  campaign_id: 'c1',
  name: 'Map A',
  created_by: 'u1',
  created_at: 'now',
  terrain: [WALL],
}

describe('TerrainEditorPanel', () => {
  it('lists existing features with a remove control', () => {
    render(<TerrainEditorPanel map={MAP} onTerrainChange={vi.fn()} />)
    // Scoped to the <li>: the kind <select> also has a "wall" <option>, which would
    // otherwise make this an ambiguous match (both contain the substring "wall").
    expect(screen.getByText(/wall/i, { selector: 'li' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument()
  })

  it('adds a feature, persists via setBattleMapTerrain, and reports the new list up', async () => {
    vi.mocked(setBattleMapTerrain).mockResolvedValue({ ...MAP, terrain: [WALL] })
    const onTerrainChange = vi.fn()
    render(<TerrainEditorPanel map={{ ...MAP, terrain: [] }} onTerrainChange={onTerrainChange} />)

    fireEvent.change(screen.getByLabelText(/column/i), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText(/row/i), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText(/width/i), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText(/depth/i), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText(/height/i), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: /add feature/i }))

    await waitFor(() => expect(setBattleMapTerrain).toHaveBeenCalledWith('map-1', expect.any(Array)))
    expect(onTerrainChange).toHaveBeenCalled()
  })

  it('shows an error when the save fails', async () => {
    vi.mocked(setBattleMapTerrain).mockRejectedValueOnce(
      new Error("Only the current DM can edit this battle map's terrain"),
    )
    render(<TerrainEditorPanel map={{ ...MAP, terrain: [] }} onTerrainChange={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/column/i), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText(/row/i), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText(/width/i), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText(/depth/i), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText(/height/i), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: /add feature/i }))

    expect(await screen.findByText(/only the current dm can edit/i)).toBeInTheDocument()
  })
})
