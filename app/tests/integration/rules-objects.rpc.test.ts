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

const MECHANICS = {
  actionCost: 'action',
  resourceCost: 1,
  targeting: 'single',
  range: 6,
  damageDice: '2d6',
}

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

describe('rules object RPCs', () => {
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

  async function dmCampaign(name: string): Promise<string> {
    const { data } = (await dm.client
      .rpc('create_campaign', { p_name: name })
      .single()) as RpcSingleResult<Row>
    return data!.id
  }

  it('lets the DM create, update, read, and delete an ability', async () => {
    const campaignId = await dmCampaign('Content A')

    const { data: created, error: createError } = (await dm.client
      .rpc('create_rules_object', {
        p_campaign_id: campaignId,
        p_type: 'ability',
        p_name: 'Firebolt',
        p_description: 'A dart of flame.',
        p_mechanics: MECHANICS,
      })
      .single()) as RpcSingleResult<Row>
    expect(createError).toBeNull()
    expect(created?.name).toBe('Firebolt')
    expect(created?.source).toBe('homebrew')

    const { data: updated, error: updateError } = (await dm.client
      .rpc('update_rules_object', {
        p_id: created!.id,
        p_name: 'Frostbolt',
        p_description: 'A dart of ice.',
        p_mechanics: { ...MECHANICS, damageDice: '2d8' },
      })
      .single()) as RpcSingleResult<Row>
    expect(updateError).toBeNull()
    expect(updated?.name).toBe('Frostbolt')

    const { data: rows } = await dm.client
      .from('rules_objects')
      .select('*')
      .eq('campaign_id', campaignId)
    expect(rows).toHaveLength(1)

    const { error: deleteError } = await dm.client.rpc('delete_rules_object', { p_id: created!.id })
    expect(deleteError).toBeNull()

    const { data: afterDelete } = await dm.client
      .from('rules_objects')
      .select('*')
      .eq('campaign_id', campaignId)
    expect(afterDelete).toHaveLength(0)
  })

  it('rejects a non-DM member creating or updating content', async () => {
    const campaignId = await dmCampaign('Content B')
    const { data: invitation } = (await dm.client
      .rpc('create_campaign_invitation', { p_campaign_id: campaignId })
      .single()) as RpcSingleResult<{ code: string }>
    await player.client.rpc('redeem_campaign_invitation', {
      p_code: (invitation as { code: string }).code,
    })

    const { error: createError } = await player.client.rpc('create_rules_object', {
      p_campaign_id: campaignId,
      p_type: 'ability',
      p_name: 'Sneaky',
      p_description: '',
      p_mechanics: MECHANICS,
    })
    expect(createError).not.toBeNull()

    const { data: dmObject } = (await dm.client
      .rpc('create_rules_object', {
        p_campaign_id: campaignId,
        p_type: 'ability',
        p_name: 'Guarded',
        p_description: '',
        p_mechanics: MECHANICS,
      })
      .single()) as RpcSingleResult<Row>
    const { error: updateError } = await player.client.rpc('update_rules_object', {
      p_id: dmObject!.id,
      p_name: 'Hacked',
      p_description: '',
      p_mechanics: MECHANICS,
    })
    expect(updateError).not.toBeNull()
  })

  it('lets a fellow campaign member read rules objects (RLS), even if not DM', async () => {
    const campaignId = await dmCampaign('Content C')
    const { data: invitation } = (await dm.client
      .rpc('create_campaign_invitation', { p_campaign_id: campaignId })
      .single()) as RpcSingleResult<{ code: string }>
    await player.client.rpc('redeem_campaign_invitation', {
      p_code: (invitation as { code: string }).code,
    })
    await dm.client.rpc('create_rules_object', {
      p_campaign_id: campaignId,
      p_type: 'ability',
      p_name: 'Readable',
      p_description: '',
      p_mechanics: MECHANICS,
    })

    const { data: rows, error } = await player.client
      .from('rules_objects')
      .select('*')
      .eq('campaign_id', campaignId)
    expect(error).toBeNull()
    expect(rows).toHaveLength(1)
  })
})
