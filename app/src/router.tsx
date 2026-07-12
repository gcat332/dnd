import type { RouteObject } from 'react-router'
import { Navigate, Outlet, useLocation, useParams } from 'react-router'
import { LoginPage } from './auth/LoginPage'
import { useAuthSession } from './auth/useAuthSession'
import { BattleMapPage } from './battle-maps/BattleMapPage'
import { CampaignDashboardPage } from './campaigns/CampaignDashboardPage'
import { CampaignListPage } from './campaigns/CampaignListPage'
import { JoinCampaignPage } from './campaigns/JoinCampaignPage'
import { NewCampaignPage } from './campaigns/NewCampaignPage'

function RequireAuth() {
  const { session, loading } = useAuthSession()
  const location = useLocation()

  if (loading) return <div>Loading...</div>
  if (!session) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  return <Outlet />
}

// BattleMapPage (and TerrainEditorPanel beneath it) seed their state from the loaded map via
// useState. Keying on `mapId` forces a full remount when navigating directly from one map's
// route to another's, so state is always re-seeded from the newly loaded map instead of
// carrying over stale data (or, worse, writing one map's terrain onto another).
function BattleMapRoute() {
  const { mapId } = useParams()
  return <BattleMapPage key={mapId} />
}

export const routeConfig: RouteObject[] = [
  ...(import.meta.env.VITE_BATTLE_MAP_HARNESS === '1'
    ? [
        {
          path: '/',
          lazy: async () => {
            const { BattleMapCanvas } = await import('./battle-map/BattleMapCanvas')
            return { Component: BattleMapCanvas }
          },
        },
        {
          path: '/__harness',
          lazy: async () => {
            const { BattleMapHarness } = await import('./battle-maps/BattleMapHarness')
            return { Component: BattleMapHarness }
          },
        },
      ]
    : []),
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      { path: '/campaigns', element: <CampaignListPage /> },
      { path: '/campaigns/new', element: <NewCampaignPage /> },
      { path: '/campaigns/:campaignId', element: <CampaignDashboardPage /> },
      { path: '/campaigns/:campaignId/maps/:mapId', element: <BattleMapRoute /> },
      { path: '/join/:code', element: <JoinCampaignPage /> },
    ],
  },
]
