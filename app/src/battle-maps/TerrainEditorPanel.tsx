import { useState } from 'react'
import { setBattleMapTerrain, type BattleMap } from './api'
import { isValidTerrainFeature, TERRAIN_KINDS, type TerrainFeature, type TerrainKind } from './terrain'

type TerrainEditorPanelProps = {
  map: BattleMap
  onTerrainChange: (features: TerrainFeature[]) => void
}

let featureCounter = 0
function nextFeatureId(): string {
  featureCounter += 1
  return `feat-${Date.now()}-${featureCounter}`
}

export function TerrainEditorPanel({ map, onTerrainChange }: TerrainEditorPanelProps) {
  const [features, setFeatures] = useState<TerrainFeature[]>(map.terrain)
  const [kind, setKind] = useState<TerrainKind>('wall')
  const [column, setColumn] = useState(0)
  const [row, setRow] = useState(0)
  const [widthCells, setWidthCells] = useState(1)
  const [depthCells, setDepthCells] = useState(1)
  const [heightCells, setHeightCells] = useState(1)
  const [error, setError] = useState<string | null>(null)

  async function persist(next: TerrainFeature[]) {
    setError(null)
    try {
      const saved = await setBattleMapTerrain(map.id, next)
      setFeatures(saved.terrain)
      onTerrainChange(saved.terrain)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault()
    const candidate: TerrainFeature = {
      id: nextFeatureId(),
      kind,
      column,
      row,
      widthCells,
      depthCells,
      heightCells,
    }
    if (!isValidTerrainFeature(candidate)) {
      setError('That feature does not fit on the map (check position and size).')
      return
    }
    await persist([...features, candidate])
  }

  async function handleRemove(id: string) {
    await persist(features.filter((feature) => feature.id !== id))
  }

  return (
    <section className="terrain-editor-panel">
      <h2>Terrain</h2>
      <ul>
        {features.map((feature) => (
          <li key={feature.id}>
            {feature.kind} at ({feature.column}, {feature.row}) —{' '}
            {feature.widthCells}×{feature.depthCells}, h{feature.heightCells}
            <button type="button" onClick={() => void handleRemove(feature.id)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={handleAdd}>
        <label htmlFor="terrain-kind">Kind</label>
        <select
          id="terrain-kind"
          value={kind}
          onChange={(event) => setKind(event.target.value as TerrainKind)}
        >
          {TERRAIN_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <label htmlFor="terrain-column">Column</label>
        <input
          id="terrain-column"
          type="number"
          value={column}
          onChange={(event) => setColumn(Number(event.target.value))}
        />
        <label htmlFor="terrain-row">Row</label>
        <input
          id="terrain-row"
          type="number"
          value={row}
          onChange={(event) => setRow(Number(event.target.value))}
        />
        <label htmlFor="terrain-width">Width</label>
        <input
          id="terrain-width"
          type="number"
          value={widthCells}
          onChange={(event) => setWidthCells(Number(event.target.value))}
        />
        <label htmlFor="terrain-depth">Depth</label>
        <input
          id="terrain-depth"
          type="number"
          value={depthCells}
          onChange={(event) => setDepthCells(Number(event.target.value))}
        />
        <label htmlFor="terrain-height">Height</label>
        <input
          id="terrain-height"
          type="number"
          value={heightCells}
          onChange={(event) => setHeightCells(Number(event.target.value))}
        />
        <button type="submit">Add feature</button>
      </form>
      {error && <div className="error-message">{error}</div>}
    </section>
  )
}
