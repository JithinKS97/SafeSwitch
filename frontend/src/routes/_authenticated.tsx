import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import Header from '../modules/shared/components/Header'
import Footer from '../modules/shared/components/Footer'
import { getSession } from '../lib/auth.functions'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async () => {
    const session = await getSession()
    console.log('[Auth] _authenticated beforeLoad:', { hasSession: !!session, hasUser: !!session?.user })
    if (!session?.user) throw redirect({ to: '/sign-in' })
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
