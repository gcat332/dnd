import { useParams } from 'react-router'
import { InvitePanel } from './InvitePanel'

export function CampaignDashboardPage() {
  const { campaignId } = useParams()

  if (!campaignId) return null

  return (
    <main className="campaign-dashboard-page">
      <h1>Campaign Dashboard</h1>
      <p>Campaign ID: {campaignId}</p>
      <InvitePanel campaignId={campaignId} />
      <p>Battle Map, Session, and Rules Content Editor views are not built yet.</p>
    </main>
  )
}
