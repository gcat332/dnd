import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { type Campaign, listMyCampaigns } from './api'

export function CampaignListPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])

  useEffect(() => {
    void listMyCampaigns().then(setCampaigns)
  }, [])

  return (
    <main className="campaign-list-page">
      <h1>Your Campaigns</h1>
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
