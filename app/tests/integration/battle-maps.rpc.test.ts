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

type Campaign = { id: string; name: string; dm_user_id: string }
type BattleMap = { id: string; campaign_id: string; name: string; created_by: string }
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

describe('battle map RPCs', () => {
  let dm: Awaited<ReturnType<typeof createTestUserClient>>
  let player: Awaited<ReturnType<typeof createTestUserClient>>

  beforeAll(async () => {
    dm = await createTestUserClient(`dm-${Date.now()}@example.test`)
    player = await createTestUserClient(`player-${Date.now()}@example.test`)
  })

  afterAll(async () => {
    const { error: dmCampaignsError } = await adminClient
      .from('campaigns')
      .delete()
      .eq('dm_user_id', dm.userId)
    if (dmCampaignsError) throw dmCampaignsError

    const { error: dmDeleteError } = await adminClient.auth.admin.deleteUser(dm.userId)
    if (dmDeleteError) throw dmDeleteError
    const { error: playerDeleteError } = await adminClient.auth.admin.deleteUser(player.userId)
    if (playerDeleteError) throw playerDeleteError
  })

  it('lets the DM create a battle map for their own campaign', async () => {
    const { data: campaign } = (await dm.client
      .rpc('create_campaign', { p_name: 'The Sunken Keep' })
      .single()) as RpcSingleResult<Campaign>

    const { data: map, error } = (await dm.client
      .rpc('create_battle_map', { p_campaign_id: campaign!.id, p_name: 'Keep — Ground Floor' })
      .single()) as RpcSingleResult<BattleMap>

    expect(error).toBeNull()
    expect(map?.name).toBe('Keep — Ground Floor')
    expect(map?.campaign_id).toBe(campaign!.id)
    expect(map?.created_by).toBe(dm.userId)
  })

  it('rejects a non-DM member creating a battle map', async () => {
    const { data: campaign } = (await dm.client
      .rpc('create_campaign', { p_name: 'Ashfall Ridge' })
      .single()) as RpcSingleResult<Campaign>
    const { data: invitation } = (await dm.client
      .rpc('create_campaign_invitation', { p_campaign_id: campaign!.id })
      .single()) as RpcSingleResult<{ code: string }>
    await player.client.rpc('redeem_campaign_invitation', { p_code: invitation!.code })

    const { error } = await player.client.rpc('create_battle_map', {
      p_campaign_id: campaign!.id,
      p_name: 'Should Not Exist',
    })

    expect(error).not.toBeNull()
  })

  it('lets a fellow campaign member (not just the DM) read a battle map', async () => {
    const { data: campaign } = (await dm.client
      .rpc('create_campaign', { p_name: 'Duskmere Hollow' })
      .single()) as RpcSingleResult<Campaign>
    const { data: invitation } = (await dm.client
      .rpc('create_campaign_invitation', { p_campaign_id: campaign!.id })
      .single()) as RpcSingleResult<{ code: string }>
    await player.client.rpc('redeem_campaign_invitation', { p_code: invitation!.code })
    await dm.client.rpc('create_battle_map', { p_campaign_id: campaign!.id, p_name: 'Hollow — Overview' })

    const { data: maps, error } = await player.client
      .from('battle_maps')
      .select('*')
      .eq('campaign_id', campaign!.id)

    expect(error).toBeNull()
    expect(maps).toHaveLength(1)
    expect(maps?.[0]?.name).toBe('Hollow — Overview')
  })
})
