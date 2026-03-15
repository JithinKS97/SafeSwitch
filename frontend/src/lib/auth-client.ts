import { createAuthClient } from 'better-auth/react'
import { emailOTPClient } from 'better-auth/client/plugins'

const AUTH_TOKEN_KEY = 'auth_token'
const AUTH_TOKEN_COOKIE = 'auth_token'
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(AUTH_TOKEN_KEY)
}

export function setStoredToken(token: string | null): void {
  if (typeof window === 'undefined') return
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token)
    document.cookie = `${AUTH_TOKEN_COOKIE}=${token}; path=/; max-age=2592000; samesite=lax`
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    document.cookie = `${AUTH_TOKEN_COOKIE}=; path=/; max-age=0`
  }
}

const customFetch: typeof fetch = (input, init) => {
  const token = getStoredToken()
  const headers = new Headers(init?.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return fetch(input, { ...init, headers, credentials: 'include' })
}

export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [emailOTPClient()],
  fetchOptions: {
    customFetchImpl: customFetch,
  },
})
