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

type Row = { id: string; [key: string]: unknown }
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

describe('token RPCs', () => {
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

  async function dmMap(name: string): Promise<string> {
    const { data: campaign } = (await dm.client
      .rpc('create_campaign', { p_name: name })
      .single()) as RpcSingleResult<Row>
    const { data: map } = (await dm.client
      .rpc('create_battle_map', { p_campaign_id: campaign!.id, p_name: `${name} map` })
      .single()) as RpcSingleResult<Row>
    return map!.id
  }

  it('lets the DM create, move, read, and delete a token', async () => {
    const mapId = await dmMap('Tokens A')

    const { data: token, error: createError } = (await dm.client
      .rpc('create_token', {
        p_map_id: mapId,
        p_label: 'Goblin',
        p_color: '#4f9e63',
        p_column: 100,
        p_row: 100,
      })
      .single()) as RpcSingleResult<Row>
    expect(createError).toBeNull()
    expect(token?.label).toBe('Goblin')

    const { data: moved, error: moveError } = (await dm.client
      .rpc('move_token', { p_token_id: token!.id, p_column: 105, p_row: 108 })
      .single()) as RpcSingleResult<Row>
    expect(moveError).toBeNull()
    expect(moved?.column).toBe(105)
    expect(moved?.row).toBe(108)

    const { data: rows } = await dm.client.from('tokens').select('*').eq('battle_map_id', mapId)
    expect(rows).toHaveLength(1)

    const { error: deleteError } = await dm.client.rpc('delete_token', { p_token_id: token!.id })
    expect(deleteError).toBeNull()

    const { data: afterDelete } = await dm.client.from('tokens').select('*').eq('battle_map_id', mapId)
    expect(afterDelete).toHaveLength(0)
  })

  it('rejects a non-DM member creating or moving a token', async () => {
    const mapId = await dmMap('Tokens B')
    const { data: campaignRow } = await dm.client
      .from('battle_maps')
      .select('campaign_id')
      .eq('id', mapId)
      .single()
    const { data: invitation } = (await dm.client
      .rpc('create_campaign_invitation', {
        p_campaign_id: (campaignRow as { campaign_id: string }).campaign_id,
      })
      .single()) as RpcSingleResult<{ code: string }>
    await player.client.rpc('redeem_campaign_invitation', {
      p_code: (invitation as { code: string }).code,
    })

    const { error: createError } = await player.client.rpc('create_token', {
      p_map_id: mapId,
      p_label: 'Intruder',
      p_color: '#ff0000',
      p_column: 50,
      p_row: 50,
    })
    expect(createError).not.toBeNull()

    // DM makes a token, player tries to move it → rejected.
    const { data: token } = (await dm.client
      .rpc('create_token', {
        p_map_id: mapId,
        p_label: 'Guard',
        p_color: '#4f7fbf',
        p_column: 10,
        p_row: 10,
      })
      .single()) as RpcSingleResult<Row>
    const { error: moveError } = await player.client.rpc('move_token', {
      p_token_id: token!.id,
      p_column: 11,
      p_row: 11,
    })
    expect(moveError).not.toBeNull()
  })

  it('lets a fellow campaign member read tokens (RLS), even if not DM', async () => {
    const mapId = await dmMap('Tokens C')
    const { data: campaignRow } = await dm.client
      .from('battle_maps')
      .select('campaign_id')
      .eq('id', mapId)
      .single()
    const { data: invitation } = (await dm.client
      .rpc('create_campaign_invitation', {
        p_campaign_id: (campaignRow as { campaign_id: string }).campaign_id,
      })
      .single()) as RpcSingleResult<{ code: string }>
    await player.client.rpc('redeem_campaign_invitation', {
      p_code: (invitation as { code: string }).code,
    })
    await dm.client.rpc('create_token', {
      p_map_id: mapId,
      p_label: 'Visible',
      p_color: '#d1a94f',
      p_column: 20,
      p_row: 20,
    })

    const { data: rows, error } = await player.client
      .from('tokens')
      .select('*')
      .eq('battle_map_id', mapId)
    expect(error).toBeNull()
    expect(rows).toHaveLength(1)
  })
})
