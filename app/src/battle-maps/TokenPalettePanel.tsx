import { useState } from 'react'
import { createToken, deleteToken } from './api'
import type { Token } from './tokenModel'

type TokenPalettePanelProps = {
  mapId: string
  tokens: Token[]
  onTokenAdded: (token: Token) => void
  onTokenRemoved: (tokenId: string) => void
}

const DEFAULT_CELL = { column: 100, row: 100 }
const DEFAULT_COLOR = '#4f7fbf'

export function TokenPalettePanel({ mapId, tokens, onTokenAdded, onTokenRemoved }: TokenPalettePanelProps) {
  const [label, setLabel] = useState('')
  const [color, setColor] = useState(DEFAULT_COLOR)
  const [error, setError] = useState<string | null>(null)

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      const created = await createToken(mapId, label, color, DEFAULT_CELL.column, DEFAULT_CELL.row)
      onTokenAdded(created)
      setLabel('')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function handleRemove(id: string) {
    setError(null)
    try {
      await deleteToken(id)
      onTokenRemoved(id)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <section className="token-palette-panel">
      <h2>Tokens</h2>
      <ul>
        {tokens.map((token) => (
          <li key={token.id}>
            {token.label} at ({token.column}, {token.row})
            <button type="button" onClick={() => void handleRemove(token.id)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={handleAdd}>
        <label htmlFor="token-label">Label</label>
        <input id="token-label" value={label} onChange={(event) => setLabel(event.target.value)} required />
        <label htmlFor="token-color">Color</label>
        <input
          id="token-color"
          type="color"
          value={color}
          onChange={(event) => setColor(event.target.value)}
        />
        <button type="submit">Add token</button>
      </form>
      {error && <div className="error-message">{error}</div>}
    </section>
  )
}
