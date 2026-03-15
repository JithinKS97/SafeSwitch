import { createAuthClient } from 'better-auth/react'
import { emailOTPClient } from 'better-auth/client/plugins'

// Use same-origin so cookies work. Vite proxy (dev) and Nitro routeRules (prod) forward /api/auth/* to backend.
const baseURL = ''
if (typeof window !== 'undefined') {
  console.log('[Auth] authClient baseURL:', baseURL || '(same-origin)', 'origin:', window.location.origin)
}
export const authClient = createAuthClient({
  baseURL,
  plugins: [emailOTPClient()],
  fetchOptions: {
    credentials: 'include',
  },
})
