# SafeSwitch Backend

NestJS API server for the SafeSwitch trading platform.

## Stack

- **NestJS** — framework
- **Prisma** — ORM and migrations
- **PostgreSQL** — database
- **BullMQ** — job queue for trading agent loops
- **Redis** — BullMQ backing store

## Structure

```
src/
├── main.ts
├── app.module.ts
├── plans/              # Trading plan module
├── agents/             # Discovery + trading agents
├── scanner/            # Market data (Binance)
├── paper-trader/       # Simulated trade execution
└── confidence/         # Confidence scoring engine
```

## Running

```bash
pnpm install
pnpm start:dev
```

Requires `DATABASE_URL` and `REDIS_URL` environment variables. See root `justfile` for the full dev setup.
