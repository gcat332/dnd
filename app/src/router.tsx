import type { RouteObject } from 'react-router'
import { Navigate, Outlet } from 'react-router'
import { LoginPage } from './auth/LoginPage'
import { useAuthSession } from './auth/useAuthSession'

function CampaignListPageStub() {
  return <div>Your Campaigns</div>
}

function NewCampaignPageStub() {
  return <div>New Campaign</div>
}

function CampaignDashboardPageStub() {
  return <div>Campaign Dashboard</div>
}

function JoinCampaignPageStub() {
  return <div>Join Campaign</div>
}

function RequireAuth() {
  const { session, loading } = useAuthSession()

  if (loading) return <div>Loading...</div>
  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}

export const routeConfig: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      { path: '/campaigns', element: <CampaignListPageStub /> },
      { path: '/campaigns/new', element: <NewCampaignPageStub /> },
      { path: '/campaigns/:campaignId', element: <CampaignDashboardPageStub /> },
      { path: '/join/:code', element: <JoinCampaignPageStub /> },
    ],
  },
]
