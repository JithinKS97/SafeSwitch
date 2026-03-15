# SafeSwitch

An AI-powered crypto trading platform where autonomous agents practice on paper before trading with real money.

## The Idea

Most algo traders lose money by going live too fast. SafeSwitch enforces a discipline: the agent must *earn* its way into real trading by proving itself in simulation first.

**The flow:**
1. Submit your risk appetite — the agent suggests trading pairs
2. Pick the pairs you want to watch — they're added as inactive positions
3. Activate a position when ready — paper trading begins
4. Watch the confidence score build in real time
5. Switch to live trading when you're confident
6. Position closes when the profit target is hit

Suggestions are ephemeral — request fresh ones any time, since market conditions change.

## Stack

| Layer | Technology |
|---|---|
| Frontend | TanStack Start (React 19) + Tailwind CSS v4 |
| Backend | NestJS + TypeScript |
| Database | PostgreSQL + Prisma |
| Agent loop | BullMQ + Redis |
| Market data | Binance API |

## Project Structure

```
safeswitch/
├── frontend/     # TanStack Start web app
├── backend/      # NestJS API server
├── compose.yml   # Docker services (Postgres, Redis)
└── justfile      # Dev commands
```

## Getting Started

**Prerequisites:** Docker Desktop, Node.js, pnpm, [just](https://github.com/casey/just)

```bash
# Install dependencies
cd frontend && pnpm install
cd ../backend && pnpm install

# Start Postgres and write .env
just db-up
just env

# Run database migrations
cd backend && npx prisma migrate dev

# Start backend (port 3001)
just server

# Start frontend (port 3000)
just frontend
```

## Key Commands

```bash
just db-up      # start Postgres
just server     # start NestJS backend
just frontend   # start TanStack Start frontend
just db-down    # stop containers
just db-reset   # wipe database and start fresh
just env        # write backend/.env
```
