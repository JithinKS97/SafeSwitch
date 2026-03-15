import { createAuthClient } from 'better-auth/react'
import { emailOTPClient } from 'better-auth/client/plugins'

// Hit backend directly; Vite proxy returns 404 for /api with TanStack Start + Nitro
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'
export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [emailOTPClient()],
  fetchOptions: {
    credentials: 'include',
  },
})
