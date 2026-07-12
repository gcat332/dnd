import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BattleMap } from './battle-maps/api'
import { routeConfig } from './router'

vi.mock('./lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'user-1' } } },
      }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithOAuth: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    })),
  },
}))

const MAP_A: BattleMap = {
  id: 'map-1',
  campaign_id: 'campaign-1',
  name: 'Map A',
  created_by: 'u1',
  created_at: 'now',
  terrain: [{ id: 'fA', kind: 'wall', column: 1, row: 1, widthCells: 1, depthCells: 1, heightCells: 1 }],
}

const MAP_B: BattleMap = {
  id: 'map-2',
  campaign_id: 'campaign-1',
  name: 'Map B',
  created_by: 'u1',
  created_at: 'now',
  terrain: [
    { id: 'fB', kind: 'platform', column: 2, row: 2, widthCells: 1, depthCells: 1, heightCells: 1 },
  ],
}

vi.mock('./battle-maps/api', () => ({
  getBattleMap: vi.fn((mapId: string) =>
    Promise.resolve(mapId === 'map-1' ? MAP_A : mapId === 'map-2' ? MAP_B : null),
  ),
  listBattleMapTokens: vi.fn(() => Promise.resolve([])),
  moveToken: vi.fn(),
  setBattleMapTerrain: vi.fn(),
}))

vi.mock('./battle-map/BattleMapView', () => ({
  BattleMapView: () => <div data-testid="battle-map-view" />,
}))

async function setAuthSession(session: unknown) {
  const { supabase } = await import('./lib/supabaseClient')
  vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
    data: { session },
  } as never)
}

afterEach(() => {
  cleanup()
})

describe('routeConfig', () => {
  it('renders the login route at /login', async () => {
    const router = createMemoryRouter(routeConfig, { initialEntries: ['/login'] })
    render(<RouterProvider router={router} />)

    expect(await screen.findByText(/sign in with discord/i)).toBeInTheDocument()
  })

  it('renders the campaign list route at /campaigns when signed in', async () => {
    const router = createMemoryRouter(routeConfig, { initialEntries: ['/campaigns'] })
    render(<RouterProvider router={router} />)

    expect(await screen.findByText(/your campaigns/i)).toBeInTheDocument()
  })

  it('redirects to /login when accessing a protected route without authentication', async () => {
    await setAuthSession(null)
    const router = createMemoryRouter(routeConfig, { initialEntries: ['/campaigns'] })
    render(<RouterProvider router={router} />)

    expect(await screen.findByText(/sign in with discord/i)).toBeInTheDocument()
  })

  it('preserves the originally requested /join/:code path through the login redirect', async () => {
    await setAuthSession(null)
    const { supabase } = await import('./lib/supabaseClient')
    const router = createMemoryRouter(routeConfig, { initialEntries: ['/join/ABCD1234'] })
    render(<RouterProvider router={router} />)

    expect(await screen.findByText(/sign in with discord/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /sign in with discord/i }))

    await waitFor(() => {
      expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'discord',
        options: { redirectTo: expect.stringContaining('/join/ABCD1234') },
      })
    })
  })

  it('remounts the battle map page with fresh state when navigating directly from one map to another', async () => {
    const router = createMemoryRouter(routeConfig, {
      initialEntries: ['/campaigns/campaign-1/maps/map-1'],
    })
    render(<RouterProvider router={router} />)

    expect(await screen.findByRole('heading', { name: /map a/i })).toBeInTheDocument()
    // TerrainEditorPanel is rendered for real (not mocked) here so its internal `features`
    // state — seeded once from `map.terrain` via useState — is actually exercised. If the
    // route didn't remount on mapId change, this state would carry over from Map A to Map B.
    expect(screen.getByText(/wall/i, { selector: 'li' })).toBeInTheDocument()

    await router.navigate('/campaigns/campaign-1/maps/map-2')

    expect(await screen.findByRole('heading', { name: /map b/i })).toBeInTheDocument()
    expect(screen.getByText(/platform/i, { selector: 'li' })).toBeInTheDocument()
    expect(screen.queryByText(/wall/i, { selector: 'li' })).not.toBeInTheDocument()
  })
})
