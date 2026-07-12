import { ACTION_COSTS, TARGETINGS, type AbilityMechanics } from './rulesObject'

type AbilityFormProps = {
  name: string
  description: string
  mechanics: AbilityMechanics
  onNameChange: (name: string) => void
  onDescriptionChange: (description: string) => void
  onMechanicsChange: (mechanics: AbilityMechanics) => void
}

export function AbilityForm({
  name,
  description,
  mechanics,
  onNameChange,
  onDescriptionChange,
  onMechanicsChange,
}: AbilityFormProps) {
  function setField<K extends keyof AbilityMechanics>(key: K, value: AbilityMechanics[K]) {
    onMechanicsChange({ ...mechanics, [key]: value })
  }

  return (
    <div className="ability-form">
      <label htmlFor="ability-name">Ability name</label>
      <input id="ability-name" value={name} onChange={(e) => onNameChange(e.target.value)} required />

      <label htmlFor="ability-description">Description</label>
      <textarea
        id="ability-description"
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
      />

      <label htmlFor="ability-action-cost">Action cost</label>
      <select
        id="ability-action-cost"
        value={mechanics.actionCost}
        onChange={(e) => setField('actionCost', e.target.value as AbilityMechanics['actionCost'])}
      >
        {ACTION_COSTS.map((cost) => (
          <option key={cost} value={cost}>
            {cost}
          </option>
        ))}
      </select>

      <label htmlFor="ability-resource-cost">Resource cost</label>
      <input
        id="ability-resource-cost"
        type="number"
        value={mechanics.resourceCost}
        onChange={(e) => setField('resourceCost', Number(e.target.value))}
      />

      <label htmlFor="ability-targeting">Targeting</label>
      <select
        id="ability-targeting"
        value={mechanics.targeting}
        onChange={(e) => setField('targeting', e.target.value as AbilityMechanics['targeting'])}
      >
        {TARGETINGS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      <label htmlFor="ability-range">Range (cells)</label>
      <input
        id="ability-range"
        type="number"
        value={mechanics.range}
        onChange={(e) => setField('range', Number(e.target.value))}
      />

      <label htmlFor="ability-damage-dice">Damage dice (e.g. 2d6, blank for none)</label>
      <input
        id="ability-damage-dice"
        value={mechanics.damageDice}
        onChange={(e) => setField('damageDice', e.target.value)}
      />
    </div>
  )
}
