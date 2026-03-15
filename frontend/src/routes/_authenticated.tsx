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
    // SSR (initial page load / hard refresh): if auth_token cookie is present, trust it.
    // A full getSession() round-trip to the backend can fail on SSR causing false logouts.
    // If the token is truly expired, subsequent API calls will return 401 and the user
    // will be prompted to sign in at that point.
    const session = await getSession().catch(() => null)
    if (session?.user) return

    // No valid session from API — only redirect if no cookie token exists either
    // (handles the case where SSR→API connectivity fails but user is legitimately logged in)
    const { getCookieToken } = await import('../lib/auth.functions')
    const cookieToken = await getCookieToken().catch(() => null)
    if (cookieToken) return

    throw redirect({ to: '/sign-in', search: { redirect: location.pathname || '/' } })
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
