import { defineNitroConfig } from 'nitro/config'

const backend = process.env.VITE_API_URL ?? 'http://localhost:3001'

export default defineNitroConfig({
  routeRules: {
    // Proxy auth to backend so cookies are same-origin (fixes cross-site cookie blocking)
    '/api/auth/**': {
      proxy: `${backend}/api/auth/**`,
    },
  },
})
