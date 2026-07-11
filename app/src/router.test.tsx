import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { routeConfig } from './router'

describe('routeConfig', () => {
  it('renders the login route at /login', async () => {
    const router = createMemoryRouter(routeConfig, { initialEntries: ['/login'] })
    render(<RouterProvider router={router} />)

    expect(await screen.findByText(/sign in/i)).toBeInTheDocument()
  })

  it('renders the campaign list route at /campaigns', async () => {
    const router = createMemoryRouter(routeConfig, { initialEntries: ['/campaigns'] })
    render(<RouterProvider router={router} />)

    expect(await screen.findByText(/your campaigns/i)).toBeInTheDocument()
  })
})
