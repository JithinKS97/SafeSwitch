import { Link } from '@tanstack/react-router'
import { authClient } from '../../../lib/auth-client'

export default function Header() {
  const { data: session, isPending } = authClient.useSession()

  return (
    <header className="sticky top-0 z-50 bg-white/90 dark:bg-zinc-950/90 backdrop-blur border-b border-zinc-200 dark:border-zinc-800">
      <nav className="page-wrap flex items-center justify-between px-2 py-3 sm:px-4">
        <div className="flex items-center gap-4 text-sm">
          <Link
            to="/"
            className="text-zinc-500 dark:text-zinc-400 no-underline hover:text-zinc-900 dark:hover:text-zinc-100 transition [&.active]:text-zinc-900 dark:[&.active]:text-zinc-100 [&.active]:font-medium"
          >
            Positions
          </Link>
          <Link
            to="/suggest"
            className="text-zinc-500 dark:text-zinc-400 no-underline hover:text-zinc-900 dark:hover:text-zinc-100 transition [&.active]:text-zinc-900 dark:[&.active]:text-zinc-100 [&.active]:font-medium"
          >
            Suggest
          </Link>
        </div>
        {!isPending && session?.user ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[120px]">
              {session.user.email}
            </span>
            <button
              onClick={() => authClient.signOut({ callbackURL: '/sign-in' })}
              className="rounded border border-zinc-200 dark:border-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="h-8 w-20 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
        )}
      </nav>
    </header>
  )
}
