import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { redeemInvitation } from './api'

export function JoinCampaignPage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!code) return
    redeemInvitation(code)
      .then((result) => navigate(`/campaigns/${result.campaignId}`))
      .catch((err: Error) => setError(err.message))
  }, [code, navigate])

  if (error) {
    return (
      <main className="join-campaign-page">
        <h1>Couldn't join</h1>
        <p>{error}</p>
      </main>
    )
  }

  return (
    <main className="join-campaign-page">
      <h1>Joining campaign...</h1>
    </main>
  )
}
