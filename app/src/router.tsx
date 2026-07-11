import type { RouteObject } from 'react-router'

function LoginPageStub() {
  return <div>Sign in with Discord</div>
}

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

export const routeConfig: RouteObject[] = [
  { path: '/login', element: <LoginPageStub /> },
  { path: '/campaigns', element: <CampaignListPageStub /> },
  { path: '/campaigns/new', element: <NewCampaignPageStub /> },
  { path: '/campaigns/:campaignId', element: <CampaignDashboardPageStub /> },
  { path: '/join/:code', element: <JoinCampaignPageStub /> },
]
