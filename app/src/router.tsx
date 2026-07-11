import type { RouteObject } from 'react-router'
import { Navigate, Outlet, useLocation } from 'react-router'
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

export const routeConfig: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      { path: '/campaigns', element: <CampaignListPage /> },
      { path: '/campaigns/new', element: <NewCampaignPage /> },
      { path: '/campaigns/:campaignId', element: <CampaignDashboardPage /> },
      { path: '/campaigns/:campaignId/maps/:mapId', element: <BattleMapPage /> },
      { path: '/join/:code', element: <JoinCampaignPage /> },
    ],
  },
]
