import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { BattleMapView } from '../battle-map/BattleMapView'
import type { MoveIntent } from '../battle-map/domain/tokens'
import { type BattleMap, getBattleMap, listBattleMapTokens, moveToken } from './api'
import type { TerrainFeature } from './terrain'
import { TerrainEditorPanel } from './TerrainEditorPanel'
import { type Token, tokenToRenderState } from './tokenModel'

export function BattleMapPage() {
  const { mapId } = useParams()
  const [map, setMap] = useState<BattleMap | null>(null)
  const [terrain, setTerrain] = useState<TerrainFeature[]>([])
  const [tokens, setTokens] = useState<Token[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [moveError, setMoveError] = useState<string | null>(null)
  const tokensRef = useRef<Token[]>(tokens)

  useEffect(() => {
    tokensRef.current = tokens
  }, [tokens])

  useEffect(() => {
    if (!mapId) return
    setLoading(true)
    setError(null)
    Promise.all([getBattleMap(mapId), listBattleMapTokens(mapId)])
      .then(([mapResult, tokenResult]) => {
        setMap(mapResult)
        setTerrain(mapResult?.terrain ?? [])
        setTokens(tokenResult)
        setLoading(false)
      })
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : String(loadError))
        setLoading(false)
      })
  }, [mapId])

  const handleMoveIntent = useCallback((intent: MoveIntent) => {
    setMoveError(null)
    const previousToken = tokensRef.current.find((token) => token.id === intent.tokenId)
    setTokens((current) =>
      current.map((token) =>
        token.id === intent.tokenId
          ? { ...token, column: intent.to.column, row: intent.to.row }
          : token,
      ),
    )
    moveToken(intent.tokenId, intent.to.column, intent.to.row)
      .then((saved) => {
        setTokens((current) => current.map((token) => (token.id === saved.id ? saved : token)))
      })
      .catch((err: unknown) => {
        setMoveError(err instanceof Error ? err.message : String(err))
        if (!previousToken) return
        setTokens((current) =>
          current.map((token) => (token.id === previousToken.id ? previousToken : token)),
        )
      })
  }, [])

  if (loading) return <div>Loading map...</div>
  if (error) return <div className="error-message">Failed to load battle map: {error}</div>
  if (!map) return <div>Battle map not found.</div>

  return (
    <main className="battle-map-page">
      <h1>{map.name}</h1>
      {moveError && <div className="error-message">Couldn't move token: {moveError}</div>}
      <BattleMapView
        terrain={terrain}
        tokens={tokens.map(tokenToRenderState)}
        onMoveIntent={handleMoveIntent}
      />
      <TerrainEditorPanel map={map} onTerrainChange={setTerrain} />
    </main>
  )
}
