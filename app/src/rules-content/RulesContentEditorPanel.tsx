import { useEffect, useState } from 'react'
import { AbilityForm } from './AbilityForm'
import { createAbility, deleteRulesObject, listCampaignRulesObjects, updateAbility } from './api'
import { emptyAbilityMechanics, isValidAbilityMechanics, type AbilityMechanics, type RulesObject } from './rulesObject'

type RulesContentEditorPanelProps = {
  campaignId: string
}

export function RulesContentEditorPanel({ campaignId }: RulesContentEditorPanelProps) {
  const [objects, setObjects] = useState<RulesObject[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
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

  function resetForm() {
    setEditingId(null)
    setName('')
    setDescription('')
    setMechanics(emptyAbilityMechanics())
  }

  function startEditing(object: RulesObject) {
    setError(null)
    setEditingId(object.id)
    setName(object.name)
    setDescription(object.description)
    setMechanics(object.mechanics)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    if (!isValidAbilityMechanics(mechanics)) {
      setError('Ability mechanics are out of the allowed range (check cost, range, and damage dice).')
      return
    }
    try {
      if (editingId) {
        const saved = await updateAbility(editingId, name, description, mechanics)
        setObjects((current) => current.map((object) => (object.id === saved.id ? saved : object)))
      } else {
        const created = await createAbility(campaignId, name, description, mechanics)
        setObjects((current) => [...current, created])
      }
      resetForm()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function handleRemove(id: string) {
    setError(null)
    try {
      await deleteRulesObject(id)
      setObjects((current) => current.filter((object) => object.id !== id))
      if (editingId === id) resetForm()
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
            <button type="button" onClick={() => startEditing(object)}>
              Edit
            </button>
            <button type="button" onClick={() => void handleRemove(object.id)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={handleSubmit}>
        <AbilityForm
          name={name}
          description={description}
          mechanics={mechanics}
          onNameChange={setName}
          onDescriptionChange={setDescription}
          onMechanicsChange={setMechanics}
        />
        <button type="submit">{editingId ? 'Save changes' : 'Add ability'}</button>
        {editingId && (
          <button type="button" onClick={resetForm}>
            Cancel
          </button>
        )}
      </form>
      {error && <div className="error-message">{error}</div>}
    </section>
  )
}
