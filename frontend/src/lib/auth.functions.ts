import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

export const getSession = createServerFn({ method: 'GET' }).handler(async () => {
  const request = getRequest()
  const cookie = request.headers.get('Cookie')
  const res = await fetch(`${API_BASE}/api/auth/get-session`, {
    headers: cookie ? { Cookie: cookie } : {},
    credentials: 'include',
  })
  if (!res.ok) return null
  return res.json()
})
