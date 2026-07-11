import { useParams } from 'react-router'

export function CampaignDashboardPage() {
  const { campaignId } = useParams()

  return (
    <main className="campaign-dashboard-page">
      <h1>Campaign Dashboard</h1>
      <p>Campaign ID: {campaignId}</p>
      <p>Battle Map, Session, and Rules Content Editor views are not built yet.</p>
    </main>
  )
}
