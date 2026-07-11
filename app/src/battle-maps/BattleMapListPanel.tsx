import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { type BattleMap, createBattleMap, listCampaignBattleMaps } from './api'

type BattleMapListPanelProps = {
  campaignId: string
}

export function BattleMapListPanel({ campaignId }: BattleMapListPanelProps) {
  const [maps, setMaps] = useState<BattleMap[]>([])
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    setLoadError(null)
    listCampaignBattleMaps(campaignId)
      .then(setMaps)
      .catch((listError: unknown) => {
        setLoadError(listError instanceof Error ? listError.message : String(listError))
      })
  }, [campaignId])

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      const map = await createBattleMap(campaignId, name)
      setMaps((current) => [map, ...current])
      setName('')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <section className="battle-map-list-panel">
      <h2>Battle Maps</h2>
      {loadError && <div className="error-message">Failed to load battle maps: {loadError}</div>}
      <ul>
        {maps.map((map) => (
          <li key={map.id}>
            <Link to={`/campaigns/${campaignId}/maps/${map.id}`}>{map.name}</Link>
          </li>
        ))}
      </ul>
      <form onSubmit={handleCreate}>
        <label htmlFor="battle-map-name">Map name</label>
        <input id="battle-map-name" value={name} onChange={(event) => setName(event.target.value)} required />
        <button type="submit">Create map</button>
      </form>
      {error && <div className="error-message">{error}</div>}
    </section>
  )
}
