import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const SUPABASE_URL = 'http://127.0.0.1:54321'
// This is the well-known local-dev service_role key printed by `supabase start`;
// verify it matches your local output before running this test.
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY = process.env.SUPABASE_ANON_KEY

if (!SERVICE_ROLE_KEY || !ANON_KEY) {
  throw new Error(
    'Set SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY (from `supabase start` output) before running npm run test:db',
  )
}

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function createTestUserClient(email: string) {
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password: 'test-password-123',
    email_confirm: true,
  })
  if (error) throw error

  const client = createClient(SUPABASE_URL, ANON_KEY)
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password: 'test-password-123',
  })
  if (signInError) throw signInError

  return { client, userId: data.user.id }
}

describe('campaign foundation RPCs', () => {
  let dm: Awaited<ReturnType<typeof createTestUserClient>>
  let player: Awaited<ReturnType<typeof createTestUserClient>>

  beforeAll(async () => {
    dm = await createTestUserClient(`dm-${Date.now()}@example.test`)
    player = await createTestUserClient(`player-${Date.now()}@example.test`)
  })

  afterAll(async () => {
    await adminClient.auth.admin.deleteUser(dm.userId)
    await adminClient.auth.admin.deleteUser(player.userId)
  })

  it('creates a campaign with the caller as DM', async () => {
    const { data, error } = await dm.client.rpc('create_campaign', { p_name: 'The Fallen Spire' })

    expect(error).toBeNull()
    expect(data?.name).toBe('The Fallen Spire')
    expect(data?.dm_user_id).toBe(dm.userId)
  })

  it('lets only the DM create an invitation for their campaign', async () => {
    const { data: campaign } = await dm.client
      .rpc('create_campaign', { p_name: 'Ashen Reach' })
      .single()

    const { data: invitation, error } = await dm.client.rpc('create_campaign_invitation', {
      p_campaign_id: campaign!.id,
    })

    expect(error).toBeNull()
    expect(invitation?.code).toHaveLength(8)

    const { error: forbiddenError } = await player.client.rpc('create_campaign_invitation', {
      p_campaign_id: campaign!.id,
    })

    expect(forbiddenError).not.toBeNull()
  })

  it('lets a player redeem a valid invitation code and become a member', async () => {
    const { data: campaign } = await dm.client
      .rpc('create_campaign', { p_name: 'The Hollow Court' })
      .single()
    const { data: invitation } = await dm.client
      .rpc('create_campaign_invitation', { p_campaign_id: campaign!.id })
      .single()

    const { data: membership, error } = await player.client.rpc('redeem_campaign_invitation', {
      p_code: invitation!.code,
    })

    expect(error).toBeNull()
    expect(membership?.role).toBe('player')
    expect(membership?.campaign_id).toBe(campaign!.id)
  })

  it('rejects redeeming the same invitation twice by the same player', async () => {
    const { data: campaign } = await dm.client
      .rpc('create_campaign', { p_name: 'Duskwatch Hold' })
      .single()
    const { data: invitation } = await dm.client
      .rpc('create_campaign_invitation', { p_campaign_id: campaign!.id })
      .single()

    await player.client.rpc('redeem_campaign_invitation', { p_code: invitation!.code })
    const { error } = await player.client.rpc('redeem_campaign_invitation', {
      p_code: invitation!.code,
    })

    expect(error).not.toBeNull()
  })
})
