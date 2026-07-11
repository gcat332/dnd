import { useState } from 'react'
import { createInvitation } from './api'

type InvitePanelProps = {
  campaignId: string
}

export function InvitePanel({ campaignId }: InvitePanelProps) {
  const [code, setCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    setError(null)
    try {
      const invitation = await createInvitation(campaignId)
      setCode(invitation.code)
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : String(generateError))
    }
  }

  return (
    <section className="invite-panel">
      <button type="button" onClick={handleGenerate}>
        Generate invite
      </button>
      {code && (
        <p>
          Invite code: <strong>{code}</strong> — share the code, or send{' '}
          <code>{`${window.location.origin}/join/${code}`}</code>
        </p>
      )}
      {error && <div className="error-message">{error}</div>}
    </section>
  )
}
