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

type Campaign = { id: string }
type BattleMap = { id: string; terrain: unknown }
type RpcSingleResult<T> = { data: T | null; error: { message: string } | null }

const SAMPLE_TERRAIN = [
  { id: 'f1', kind: 'wall', column: 90, row: 93, widthCells: 18, depthCells: 1, heightCells: 3 },
]

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

describe('set_battle_map_terrain RPC', () => {
  let dm: Awaited<ReturnType<typeof createTestUserClient>>
  let player: Awaited<ReturnType<typeof createTestUserClient>>

  beforeAll(async () => {
    dm = await createTestUserClient(`dm-${Date.now()}@example.test`)
    player = await createTestUserClient(`player-${Date.now()}@example.test`)
  })

  afterAll(async () => {
    const { error: campaignsError } = await adminClient
      .from('campaigns')
      .delete()
      .eq('dm_user_id', dm.userId)
    if (campaignsError) throw campaignsError
    const { error: dmError } = await adminClient.auth.admin.deleteUser(dm.userId)
    if (dmError) throw dmError
    const { error: playerError } = await adminClient.auth.admin.deleteUser(player.userId)
    if (playerError) throw playerError
  })

  it('lets the DM set terrain and reads it back', async () => {
    const { data: campaign } = (await dm.client
      .rpc('create_campaign', { p_name: 'Terrain Test' })
      .single()) as RpcSingleResult<Campaign>
    const { data: map } = (await dm.client
      .rpc('create_battle_map', { p_campaign_id: campaign!.id, p_name: 'Map A' })
      .single()) as RpcSingleResult<BattleMap>

    const { data: updated, error } = (await dm.client
      .rpc('set_battle_map_terrain', { p_map_id: map!.id, p_terrain: SAMPLE_TERRAIN })
      .single()) as RpcSingleResult<BattleMap>

    expect(error).toBeNull()
    expect(updated?.terrain).toEqual(SAMPLE_TERRAIN)
  })

  it('rejects a non-DM member editing terrain', async () => {
    const { data: campaign } = (await dm.client
      .rpc('create_campaign', { p_name: 'Terrain Test 2' })
      .single()) as RpcSingleResult<Campaign>
    const { data: invitation } = (await dm.client
      .rpc('create_campaign_invitation', { p_campaign_id: campaign!.id })
      .single()) as RpcSingleResult<{ code: string }>
    await player.client.rpc('redeem_campaign_invitation', { p_code: (invitation as { code: string }).code })
    const { data: map } = (await dm.client
      .rpc('create_battle_map', { p_campaign_id: campaign!.id, p_name: 'Map B' })
      .single()) as RpcSingleResult<BattleMap>

    const { error } = await player.client.rpc('set_battle_map_terrain', {
      p_map_id: map!.id,
      p_terrain: SAMPLE_TERRAIN,
    })

    expect(error).not.toBeNull()
  })

  it('rejects a non-array terrain payload', async () => {
    const { data: campaign } = (await dm.client
      .rpc('create_campaign', { p_name: 'Terrain Test 3' })
      .single()) as RpcSingleResult<Campaign>
    const { data: map } = (await dm.client
      .rpc('create_battle_map', { p_campaign_id: campaign!.id, p_name: 'Map C' })
      .single()) as RpcSingleResult<BattleMap>

    const { error } = await dm.client.rpc('set_battle_map_terrain', {
      p_map_id: map!.id,
      p_terrain: { not: 'an array' },
    })

    expect(error).not.toBeNull()
  })
})
