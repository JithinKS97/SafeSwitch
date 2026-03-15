import { createFileRoute } from '@tanstack/react-router'
import { SignIn } from '@clerk/tanstack-react-start'

export const Route = createFileRoute('/sign-in')({
  component: SignInPage,
})

const FEATURES = [
  {
    icon: '◎',
    title: 'AI-powered pair selection',
    desc: 'Set your risk appetite and let the agent find the best trading pairs from live market data.',
  },
  {
    icon: '⬡',
    title: 'Paper trade with confidence',
    desc: 'Simulate trades and track performance before committing real capital.',
  },
  {
    icon: '↗',
    title: 'Switch when ready',
    desc: 'Graduate from paper to live trading only when your confidence level is green.',
  },
]

function SignInPage() {
  return (
    <div className="flex min-h-screen">
      {/* Left — brand & features */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-zinc-950 text-white px-16 py-14">
        <div>
          <span className="text-xs font-semibold tracking-widest uppercase text-zinc-500">
            SafeSwitch
          </span>
          <h1 className="mt-8 text-4xl font-semibold leading-tight tracking-tight">
            Paper to live trading,<br />
            <span className="text-zinc-400">on your terms.</span>
          </h1>
          <p className="mt-4 text-sm text-zinc-400 leading-relaxed max-w-sm">
            An AI agent analyses the market, suggests trading pairs matched to your risk level,
            and builds confidence through paper trading — so you switch to live only when you're ready.
          </p>
        </div>

        <div className="space-y-6">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex gap-4">
              <span className="text-lg text-zinc-500 mt-0.5">{f.icon}</span>
              <div>
                <p className="text-sm font-medium text-zinc-200">{f.title}</p>
                <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-zinc-700">
          SafeSwitch — paper to live trading
        </p>
      </div>

      {/* Right — auth */}
      <div className="flex flex-1 flex-col items-center justify-center px-8 bg-white dark:bg-zinc-950">
        {/* Mobile brand */}
        <div className="mb-8 text-center lg:hidden">
          <p className="text-xs font-semibold tracking-widest uppercase text-zinc-400">SafeSwitch</p>
          <h2 className="mt-2 text-2xl font-semibold">Paper to live trading</h2>
        </div>
        <SignIn routing="hash" />
      </div>
    </div>
  )
}
