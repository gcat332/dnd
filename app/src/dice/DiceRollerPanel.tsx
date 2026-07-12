import { useEffect, useState } from 'react'
import { rollDice, listRecentRolls } from './api'
import { parseDiceNotation, type DiceRoll } from './diceNotation'

type DiceRollerPanelProps = {
  campaignId: string
}

export function DiceRollerPanel({ campaignId }: DiceRollerPanelProps) {
  const [rolls, setRolls] = useState<DiceRoll[]>([])
  const [notation, setNotation] = useState('1d20')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listRecentRolls(campaignId)
      .then(setRolls)
      .catch((loadError: unknown) =>
        setError(loadError instanceof Error ? loadError.message : String(loadError)),
      )
  }, [campaignId])

  async function handleRoll(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const parsed = parseDiceNotation(notation)
    if (!parsed) {
      setError(`"${notation}" is not a valid dice roll (try e.g. 2d6+3).`)
      return
    }
    try {
      const roll = await rollDice(campaignId, parsed)
      setRolls((current) => [roll, ...current])
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <section className="dice-roller-panel">
      <h2>Dice</h2>
      <form onSubmit={handleRoll}>
        <label htmlFor="dice-notation">Dice notation</label>
        <input
          id="dice-notation"
          value={notation}
          onChange={(event) => setNotation(event.target.value)}
        />
        <button type="submit">Roll</button>
      </form>
      {error && <div className="error-message">{error}</div>}
      <ul>
        {rolls.map((roll) => (
          <li key={roll.id}>
            {roll.notation}: [{roll.results.join(', ')}]
            {roll.modifier !== 0 ? ` ${roll.modifier > 0 ? '+' : ''}${roll.modifier}` : ''} = {roll.total}
          </li>
        ))}
      </ul>
    </section>
  )
}
