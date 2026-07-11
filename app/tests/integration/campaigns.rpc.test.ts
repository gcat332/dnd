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

// The guard above proves these are defined at runtime, but TypeScript can't carry that
// narrowing into the closures below (module-level `const`s aren't narrowed inside nested
// functions), so a `!` assertion here is honest rather than a suppression.
const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY!)

// Local shapes for the untyped `.rpc()` responses below: with no generated `Database` type
// passed to `createClient()`, Postgrest infers RPC response `data` as `{}`, so property
// access needs a cast. These describe only the fields this test file reads.
type Campaign = { id: string; name: string; dm_user_id: string }
type Invitation = { id: string; code: string }
type Membership = { role: string; campaign_id: string }
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

describe('campaign foundation RPCs', () => {
  let dm: Awaited<ReturnType<typeof createTestUserClient>>
  let player: Awaited<ReturnType<typeof createTestUserClient>>

  beforeAll(async () => {
    dm = await createTestUserClient(`dm-${Date.now()}@example.test`)
    player = await createTestUserClient(`player-${Date.now()}@example.test`)
  })

  afterAll(async () => {
    // `campaigns.dm_user_id` and `campaign_invitations.created_by` reference
    // `public.profiles(id)` with no `on delete cascade`/`on delete set null`, and
    // `profiles.id` cascades from `auth.users.id`. So deleting the DM's auth user
    // directly would hit a foreign-key violation against any campaigns rows they
    // still own. Delete those campaigns first (service-role client bypasses RLS);
    // `campaign_memberships` and `campaign_invitations` both reference
    // `campaigns.id` with `on delete cascade`, so this cleans those up too.
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

  it('creates a campaign with the caller as DM', async () => {
    const { data, error } = (await dm.client.rpc('create_campaign', {
      p_name: 'The Fallen Spire',
    })) as RpcSingleResult<Campaign>

    expect(error).toBeNull()
    expect(data?.name).toBe('The Fallen Spire')
    expect(data?.dm_user_id).toBe(dm.userId)
  })

  it('lets only the DM create an invitation for their campaign', async () => {
    const { data: campaign } = (await dm.client
      .rpc('create_campaign', { p_name: 'Ashen Reach' })
      .single()) as RpcSingleResult<Campaign>

    const { data: invitation, error } = (await dm.client.rpc('create_campaign_invitation', {
      p_campaign_id: campaign!.id,
    })) as RpcSingleResult<Invitation>

    expect(error).toBeNull()
    expect(invitation?.code).toHaveLength(8)

    const { error: forbiddenError } = (await player.client.rpc('create_campaign_invitation', {
      p_campaign_id: campaign!.id,
    })) as RpcSingleResult<Invitation>

    expect(forbiddenError).not.toBeNull()
  })

  it('lets a player redeem a valid invitation code and become a member', async () => {
    const { data: campaign } = (await dm.client
      .rpc('create_campaign', { p_name: 'The Hollow Court' })
      .single()) as RpcSingleResult<Campaign>
    const { data: invitation } = (await dm.client
      .rpc('create_campaign_invitation', { p_campaign_id: campaign!.id })
      .single()) as RpcSingleResult<Invitation>

    const { data: membership, error } = (await player.client.rpc('redeem_campaign_invitation', {
      p_code: invitation!.code,
    })) as RpcSingleResult<Membership>

    expect(error).toBeNull()
    expect(membership?.role).toBe('player')
    expect(membership?.campaign_id).toBe(campaign!.id)
  })

  it('rejects redeeming the same invitation twice by the same player', async () => {
    const { data: campaign } = (await dm.client
      .rpc('create_campaign', { p_name: 'Duskwatch Hold' })
      .single()) as RpcSingleResult<Campaign>
    const { data: invitation } = (await dm.client
      .rpc('create_campaign_invitation', { p_campaign_id: campaign!.id })
      .single()) as RpcSingleResult<Invitation>

    await player.client.rpc('redeem_campaign_invitation', { p_code: invitation!.code })
    const { error } = (await player.client.rpc('redeem_campaign_invitation', {
      p_code: invitation!.code,
    })) as RpcSingleResult<Membership>

    expect(error).not.toBeNull()
  })
})
