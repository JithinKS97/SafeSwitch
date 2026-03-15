import { Link } from '@tanstack/react-router'
import { UserButton, useAuth } from '@clerk/tanstack-react-start'
import { Skeleton } from '../../../components/ui/skeleton'

export default function Header() {
  const { isLoaded } = useAuth()

  return (
    <header className="sticky top-0 z-50 bg-white/90 dark:bg-zinc-950/90 backdrop-blur border-b border-zinc-200 dark:border-zinc-800">
      <nav className="page-wrap flex items-center justify-between px-4 py-3">
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
        {isLoaded ? (
          <UserButton />
        ) : (
          <Skeleton className="size-8 rounded-full" />
        )}
      </nav>
    </header>
  )
}
