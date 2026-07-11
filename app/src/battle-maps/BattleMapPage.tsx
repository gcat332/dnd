import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { BattleMapView } from '../battle-map/BattleMapView'
import { type BattleMap, getBattleMap } from './api'

export function BattleMapPage() {
  const { mapId } = useParams()
  const [map, setMap] = useState<BattleMap | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!mapId) return
    setLoading(true)
    setError(null)
    getBattleMap(mapId)
      .then((result) => {
        setMap(result)
        setLoading(false)
      })
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : String(loadError))
        setLoading(false)
      })
  }, [mapId])

  if (loading) return <div>Loading map...</div>
  if (error) return <div className="error-message">Failed to load battle map: {error}</div>
  if (!map) return <div>Battle map not found.</div>

  return (
    <main className="battle-map-page">
      <h1>{map.name}</h1>
      <BattleMapView />
    </main>
  )
}
