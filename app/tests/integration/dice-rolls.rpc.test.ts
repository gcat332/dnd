import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const SUPABASE_URL = 'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY = process.env.SUPABASE_ANON_KEY

if (!SERVICE_ROLE_KEY || !ANON_KEY) {
  throw new Error(
    'Set SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY (from `supabase status`) before running npm run test:db',
  )
}

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

type DiceRollRow = {
  id: string
  roller_id: string
  results: number[]
  modifier: number
  total: number
  notation: string
}
type RpcSingleResult<T> = { data: T | null; error: { message: string } | null }

async function createTestUserClient(email: string) {
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password: 'test-password-123',
    email_confirm: true,
  })
  if (error) throw error
  const client = createClient(SUPABASE_URL, ANON_KEY!)
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password: 'test-password-123',
  })
  if (signInError) throw signInError
  return { client, userId: data.user.id }
}

describe('roll_dice RPC', () => {
  let dm: Awaited<ReturnType<typeof createTestUserClient>>
  let player: Awaited<ReturnType<typeof createTestUserClient>>
  let outsider: Awaited<ReturnType<typeof createTestUserClient>>

  beforeAll(async () => {
    dm = await createTestUserClient(`dm-${Date.now()}@example.test`)
    player = await createTestUserClient(`player-${Date.now()}@example.test`)
    outsider = await createTestUserClient(`outsider-${Date.now()}@example.test`)
  })

  afterAll(async () => {
    const { error: campaignsError } = await adminClient
      .from('campaigns')
      .delete()
      .eq('dm_user_id', dm.userId)
    if (campaignsError) throw campaignsError
    await adminClient.auth.admin.deleteUser(dm.userId)
    await adminClient.auth.admin.deleteUser(player.userId)
    await adminClient.auth.admin.deleteUser(outsider.userId)
  })

  async function dmCampaignWithPlayer(name: string): Promise<string> {
    const { data: campaign } = (await dm.client
      .rpc('create_campaign', { p_name: name })
      .single()) as RpcSingleResult<{ id: string }>
    const { data: invitation } = (await dm.client
      .rpc('create_campaign_invitation', { p_campaign_id: campaign!.id })
      .single()) as RpcSingleResult<{ code: string }>
    await player.client.rpc('redeem_campaign_invitation', {
      p_code: (invitation as { code: string }).code,
    })
    return campaign!.id
  }

  it('lets a member roll, computing the result server-side within bounds', async () => {
    const campaignId = await dmCampaignWithPlayer('Dice A')

    const { data: roll, error } = (await player.client
      .rpc('roll_dice', { p_campaign_id: campaignId, p_count: 3, p_sides: 6, p_modifier: 2 })
      .single()) as RpcSingleResult<DiceRollRow>

    expect(error).toBeNull()
    expect(roll?.roller_id).toBe(player.userId)
    expect(roll?.results).toHaveLength(3)
    for (const die of roll!.results) {
      expect(die).toBeGreaterThanOrEqual(1)
      expect(die).toBeLessThanOrEqual(6)
    }
    const sum = roll!.results.reduce((a, b) => a + b, 0)
    expect(roll?.total).toBe(sum + 2)
    expect(roll?.notation).toBe('3d6+2')
  })

  it('rejects a non-member (outsider) rolling in the campaign', async () => {
    const campaignId = await dmCampaignWithPlayer('Dice B')

    const { error } = await outsider.client.rpc('roll_dice', {
      p_campaign_id: campaignId,
      p_count: 1,
      p_sides: 20,
      p_modifier: 0,
    })
    expect(error).not.toBeNull()
  })

  it('rejects an unsupported die size', async () => {
    const campaignId = await dmCampaignWithPlayer('Dice C')
    const { error } = await dm.client.rpc('roll_dice', {
      p_campaign_id: campaignId,
      p_count: 1,
      p_sides: 7,
      p_modifier: 0,
    })
    expect(error).not.toBeNull()
  })

  it('lets a fellow member read the campaign roll history (RLS)', async () => {
    const campaignId = await dmCampaignWithPlayer('Dice D')
    await dm.client.rpc('roll_dice', { p_campaign_id: campaignId, p_count: 1, p_sides: 20, p_modifier: 0 })

    const { data: rows, error } = await player.client
      .from('dice_rolls')
      .select('*')
      .eq('campaign_id', campaignId)
    expect(error).toBeNull()
    expect(rows).toHaveLength(1)
  })
})
