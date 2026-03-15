import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

export const getSession = createServerFn({ method: 'GET' }).handler(async () => {
  const request = getRequest()
  const cookie = request.headers.get('Cookie')
  const hasAuthCookie = cookie?.includes('better-auth') ?? false
  console.log('[Auth] getSession server:', { hasCookie: !!cookie, hasAuthCookie, API_BASE })
  const res = await fetch(`${API_BASE}/api/auth/get-session`, {
    headers: cookie ? { Cookie: cookie } : {},
    credentials: 'include',
  })
  const data = res.ok ? await res.json() : null
  console.log('[Auth] getSession result:', { ok: res.ok, hasUser: !!data?.user })
  return data
})
