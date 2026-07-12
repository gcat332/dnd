import { useEffect, useState } from 'react'
import { AbilityForm } from './AbilityForm'
import { createAbility, deleteRulesObject, listCampaignRulesObjects } from './api'
import { emptyAbilityMechanics, isValidAbilityMechanics, type AbilityMechanics, type RulesObject } from './rulesObject'

type RulesContentEditorPanelProps = {
  campaignId: string
}

export function RulesContentEditorPanel({ campaignId }: RulesContentEditorPanelProps) {
  const [objects, setObjects] = useState<RulesObject[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [mechanics, setMechanics] = useState<AbilityMechanics>(emptyAbilityMechanics)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listCampaignRulesObjects(campaignId)
      .then(setObjects)
      .catch((loadError: unknown) =>
        setError(loadError instanceof Error ? loadError.message : String(loadError)),
      )
  }, [campaignId])

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    if (!isValidAbilityMechanics(mechanics)) {
      setError('Ability mechanics are out of the allowed range (check cost, range, and damage dice).')
      return
    }
    try {
      const created = await createAbility(campaignId, name, description, mechanics)
      setObjects((current) => [...current, created])
      setName('')
      setDescription('')
      setMechanics(emptyAbilityMechanics())
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function handleRemove(id: string) {
    setError(null)
    try {
      await deleteRulesObject(id)
      setObjects((current) => current.filter((object) => object.id !== id))
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <section className="rules-content-editor-panel">
      <h2>Abilities</h2>
      <ul>
        {objects.map((object) => (
          <li key={object.id}>
            {object.name} — {object.mechanics.actionCost}, {object.mechanics.targeting}, range{' '}
            {object.mechanics.range}
            {object.mechanics.damageDice ? `, ${object.mechanics.damageDice}` : ''}
            <button type="button" onClick={() => void handleRemove(object.id)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={handleCreate}>
        <AbilityForm
          name={name}
          description={description}
          mechanics={mechanics}
          onNameChange={setName}
          onDescriptionChange={setDescription}
          onMechanicsChange={setMechanics}
        />
        <button type="submit">Add ability</button>
      </form>
      {error && <div className="error-message">{error}</div>}
    </section>
  )
}
