import { RouterProvider, createBrowserRouter } from 'react-router'
import { routeConfig } from './router'

const router = createBrowserRouter(routeConfig)

export function App() {
  return <RouterProvider router={router} />
}
