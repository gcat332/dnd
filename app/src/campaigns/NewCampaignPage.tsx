import { useState } from 'react'
import { useNavigate } from 'react-router'
import { createCampaign } from './api'

export function NewCampaignPage() {
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const campaign = await createCampaign(name)
      navigate(`/campaigns/${campaign.id}`)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError))
      setSubmitting(false)
    }
  }

  return (
    <main className="new-campaign-page">
      <h1>New Campaign</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="campaign-name">Campaign name</label>
        <input
          id="campaign-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
        <button type="submit" disabled={submitting}>
          Create
        </button>
      </form>
      {error && <div className="error-message">{error}</div>}
    </main>
  )
}
