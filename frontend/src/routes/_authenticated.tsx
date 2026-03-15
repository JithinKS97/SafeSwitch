import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { auth } from '@clerk/tanstack-react-start/server'
import Header from '../modules/shared/components/Header'
import Footer from '../modules/shared/components/Footer'

const requireAuth = createServerFn().handler(async () => {
  const { userId } = await auth()
  if (!userId) throw redirect({ to: '/sign-in' })
})

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: () => requireAuth(),
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
