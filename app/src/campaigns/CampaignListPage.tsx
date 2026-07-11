import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { type Campaign, listMyCampaigns } from './api'

export function CampaignListPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listMyCampaigns()
      .then(setCampaigns)
      .catch((listError: unknown) => {
        setError(listError instanceof Error ? listError.message : String(listError))
      })
  }, [])

  return (
    <main className="campaign-list-page">
      <h1>Your Campaigns</h1>
      {error && <div className="error-message">{error}</div>}
      <ul>
        {campaigns.map((campaign) => (
          <li key={campaign.id}>
            <Link to={`/campaigns/${campaign.id}`}>{campaign.name}</Link>
          </li>
        ))}
      </ul>
      <Link to="/campaigns/new">Start a new campaign</Link>
    </main>
  )
}
