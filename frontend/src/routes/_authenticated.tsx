import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import Header from '../modules/shared/components/Header'
import Footer from '../modules/shared/components/Footer'
import { getSession } from '../lib/auth.functions'
import { getStoredToken } from '../lib/auth-client'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    // Client-side navigation: check localStorage directly (avoids server function round-trip that can fail in production)
    if (typeof window !== 'undefined') {
      const token = getStoredToken()
      if (!token) {
        throw redirect({ to: '/sign-in', search: { redirect: location.pathname || '/' } })
      }
      return
    }
    // SSR (initial page load): validate session via server function using request cookies
    const session = await getSession()
    console.log('[Auth] _authenticated beforeLoad (SSR):', { hasSession: !!session, hasUser: !!session?.user })
    if (!session?.user) {
      const from = location.pathname || '/'
      throw redirect({ to: '/sign-in', search: { redirect: from } })
    }
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex-1">
        <Outlet />
      </div>
      <Footer />
    </div>
  )
}
