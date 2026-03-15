import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

function getTokenFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null
  const match = cookieHeader.match(/auth_token=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

export const getCookieToken = createServerFn({ method: 'GET' }).handler(async () => {
  const request = getRequest()
  const cookie = request.headers.get('Cookie')
  return getTokenFromCookie(cookie)
})

export const getSession = createServerFn({ method: 'GET' }).handler(async () => {
  const request = getRequest()
  const cookie = request.headers.get('Cookie')
  const token = getTokenFromCookie(cookie)
  const headers: Record<string, string> = cookie ? { Cookie: cookie } : {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${API_BASE}/api/auth/get-session`, {
    headers,
    credentials: 'include',
  })
  const data = res.ok ? await res.json() : null
  return data
})
