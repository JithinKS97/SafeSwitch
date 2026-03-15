import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { authClient } from '../lib/auth-client'

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
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'email' | 'otp'>('email')

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      console.log('[Auth] sendVerificationOtp request:', { email })
      const { error: err } = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: 'sign-in',
      })
      console.log('[Auth] sendVerificationOtp response:', { hasError: !!err, error: err })
      if (err) {
        const msg =
          err.message ??
          (typeof err === 'object' && 'status' in err
            ? `API returned ${(err as { status?: number }).status}`
            : 'Failed to send code')
        throw new Error(msg)
      }
      setStep('otp')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      setError(
        msg === 'Failed to fetch'
          ? 'Cannot reach backend. Run backend (pnpm run start:dev in backend/) and frontend (pnpm dev in frontend/).'
          : msg
      )
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      console.log('[Auth] signIn.emailOtp request:', { email, otpLength: otp.length })
      const { data, error: err } = await authClient.signIn.emailOtp({
        email,
        otp,
      })
      console.log('[Auth] signIn.emailOtp response:', { hasData: !!data, hasError: !!err, error: err })
      if (err) {
        const msg = err.message ?? 'Invalid or expired code'
        throw new Error(msg)
      }
      if (data) {
        console.log('[Auth] signIn success, navigating to /')
        navigate({ to: '/' })
      } else {
        console.log('[Auth] signIn returned no data, not navigating')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      setError(msg === 'Failed to fetch' ? 'Cannot reach backend. Is it running on port 3001?' : msg)
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    setStep('email')
    setOtp('')
    setError(null)
  }

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

      {/* Right — auth form */}
      <div className="flex flex-1 flex-col items-center justify-center px-8 bg-white dark:bg-zinc-950">
        <div className="mb-8 text-center lg:hidden">
          <p className="text-xs font-semibold tracking-widest uppercase text-zinc-400">SafeSwitch</p>
          <h2 className="mt-2 text-2xl font-semibold">Paper to live trading</h2>
        </div>

        <div className="w-full max-w-sm">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-6">
            Sign in
          </h2>
          {step === 'email' ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <label className="block">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="mt-1 w-full rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                />
              </label>
              {error && (
                <div className="space-y-1">
                  <p className="text-sm text-red-500">{error}</p>
                  <p className="text-xs text-zinc-500">
                    Run backend and frontend. Check backend terminal for OTP if email doesn&apos;t arrive.
                  </p>
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded bg-zinc-900 dark:bg-zinc-100 px-4 py-2.5 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 disabled:opacity-50"
              >
                {loading ? '…' : 'Send code'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Enter the 6-digit code sent to {email}
              </p>
              <label className="block">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Code</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  required
                  autoFocus
                  className="mt-1 w-full rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-mono text-center text-lg tracking-widest"
                />
              </label>
              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full rounded bg-zinc-900 dark:bg-zinc-100 px-4 py-2.5 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 disabled:opacity-50"
              >
                {loading ? '…' : 'Sign in'}
              </button>
              <button
                type="button"
                onClick={handleBack}
                disabled={loading}
                className="w-full text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-400"
              >
                Use a different email
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
