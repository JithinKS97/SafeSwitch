# SafeSwitch Frontend

TanStack Start (React 19) web app for the SafeSwitch trading platform.

## Stack

- **TanStack Start** — SSR React framework
- **TanStack Router** — file-based routing
- **TanStack Query** — server state and caching
- **Tailwind CSS v4** — styling
- **Better Auth** — email OTP authentication

## Running

```bash
pnpm install
pnpm dev
```

Runs on port **3000**. Expects the backend API at `http://localhost:8080` by default.

To point at a different backend, set `VITE_API_URL` in `frontend/.env`:

```
VITE_API_URL=http://localhost:8080
```

## Structure

```
src/
├── routes/
│   ├── __root.tsx              # Root layout (header, toaster)
│   ├── _authenticated.tsx      # Auth guard — redirects to /sign-in if not logged in
│   ├── index.tsx               # Positions page
│   ├── suggest.tsx             # Suggest pairs page
│   └── sign-in.tsx             # Email OTP sign-in
├── modules/
│   ├── positions/
│   │   ├── PositionsPage.tsx   # Positions list + scheduler controls
│   │   └── components/
│   │       ├── PositionRow.tsx     # Single position row + all modals
│   │       ├── ConfigModal.tsx     # Unified settings modal (AI + Binance keys)
│   │       ├── ConfidenceBar.tsx   # Confidence score progress bar
│   │       └── ...
│   ├── suggest/
│   │   └── SuggestPage.tsx     # Market analysis + suggestion table
│   └── shared/
│       ├── api/index.ts        # API client (all endpoints)
│       └── components/
│           ├── Header.tsx      # Nav + Config button
│           └── Footer.tsx
└── lib/
    ├── auth-client.ts          # Better Auth client
    └── auth.functions.ts       # Server functions for session/token
```

## Pages

### Positions (`/`)
- Lists all active and past positions with status, direction, amount, and PnL
- Scheduler controls (pause/resume, run now, next run time)
- Global goal/instruction for the agent
- Per-row actions: Journal, Instruction, Go live, Pause, Reset PnL, Delete

### Suggest (`/suggest`)
- Risk slider (1–10) to set risk appetite
- Analyse market button — requires OpenRouter key to be configured
- Suggestion table with pair, direction, duration, reason, and Add button
- Past run history in the left sidebar — click any to reload it, refresh to re-run

## Config Modal

The **Config** button in the top-right header opens the unified settings modal:

**AI Model tab** (required to use the app):
- OpenRouter API key (`sk-or-...`)
- Model selection dropdown

**Binance API tab** (optional, for live trading):
- Binance API key + secret

## Development

```bash
pnpm dev        # start dev server
pnpm build      # production build
pnpm test       # run Vitest tests
pnpm lint       # Biome lint
pnpm format     # Biome format
```
