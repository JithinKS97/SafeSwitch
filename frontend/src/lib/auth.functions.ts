import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

function getTokenFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null
  const match = cookieHeader.match(/auth_token=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

export const getSession = createServerFn({ method: 'GET' })
  .validator((token: string | null) => token)
  .handler(async (token) => {
    const request = getRequest()
    const cookie = request.headers.get('Cookie')
    const tokenToUse = token ?? getTokenFromCookie(cookie)
    const headers: Record<string, string> = cookie ? { Cookie: cookie } : {}
    if (tokenToUse) headers['Authorization'] = `Bearer ${tokenToUse}`
    console.log('[Auth] getSession server:', { hasCookie: !!cookie, hasToken: !!token, API_BASE })
    const res = await fetch(`${API_BASE}/api/auth/get-session`, {
      headers,
      credentials: 'include',
    })
    const data = res.ok ? await res.json() : null
    console.log('[Auth] getSession result:', { ok: res.ok, hasUser: !!data?.user })
    return data
  })
