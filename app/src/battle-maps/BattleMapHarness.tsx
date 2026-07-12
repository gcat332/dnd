import { useState } from 'react'
import { BattleMapCanvas } from '../battle-map/BattleMapCanvas'
import type { BattleMap } from './api'
import { TerrainEditorPanel } from './TerrainEditorPanel'
import type { TerrainFeature } from './terrain'

const HARNESS_MAP: BattleMap = {
  id: 'e2e-battle-map',
  campaign_id: 'e2e-campaign',
  name: 'Browser evidence map',
  created_by: 'e2e-user',
  created_at: '2026-07-12T00:00:00.000Z',
  terrain: [
    {
      id: 'fixture-wall',
      kind: 'wall',
      column: 98,
      row: 101,
      widthCells: 3,
      depthCells: 1,
      heightCells: 3,
    },
  ],
}

/** Test-only composition used by the Playwright responsive layout checks. */
export function BattleMapHarness() {
  const [terrain, setTerrain] = useState<TerrainFeature[]>(HARNESS_MAP.terrain)
  const map = { ...HARNESS_MAP, terrain }

  return (
    <main className="battle-map-harness">
      <div className="battle-map-harness-canvas">
        <BattleMapCanvas />
      </div>
      <TerrainEditorPanel map={map} onTerrainChange={setTerrain} />
    </main>
  )
}
