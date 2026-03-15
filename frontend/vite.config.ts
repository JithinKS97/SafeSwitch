import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import tsconfigPaths from 'vite-tsconfig-paths'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const backend = process.env.VITE_API_URL ?? 'http://localhost:3001'

const config = defineConfig({
  server: {
    proxy: {
      '/api': {
        target: backend,
        changeOrigin: true,
        secure: false,
      },
      '/positions': backend,
      '/suggestions': backend,
      '/user': backend,
      '/agent': backend,
      '/pair-journals': backend,
      '/binance-keys': backend,
    },
  },
  plugins: [
    devtools(),
    nitro({ rollupConfig: { external: [/^@sentry\//] } }),
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
