# SafeSwitch

An AI-powered crypto trading platform where autonomous agents practice on paper before trading with real money.

## The Idea

Most algo traders lose money by going live too fast. SafeSwitch enforces a discipline: the agent must *earn* its way into real trading by proving itself in simulation first.

**The cycle:**
1. Agent scans the market and identifies opportunities based on your risk appetite
2. Agent paper trades the selected pair, building a confidence score
3. Once confidence is high enough, you switch to live trading
4. When the target profit is hit, the agent stops — and looks for the next opportunity

## Stack

| Layer | Technology |
|---|---|
| Mobile app | Expo (React Native) + TypeScript |
| Backend | NestJS + TypeScript |
| Database | PostgreSQL (via Prisma) |
| Agent loop | BullMQ + Redis |
| Market data | Binance API |

## Project Structure

```
safeswitch/
├── app/          # Expo React Native mobile app
├── backend/      # NestJS API server
├── compose.yml   # Docker services (Postgres, Redis)
└── justfile      # Dev commands
```

## Getting Started

**Prerequisites:** Docker Desktop, Node.js, [just](https://github.com/casey/just)

```bash
# Start infrastructure (Postgres + Redis)
just db-up

# Start the backend
just server

# Start the mobile app
cd app && bun start
```

## Key Commands

```bash
just dev       # start db + backend
just db-down   # stop containers
just db-reset  # wipe database and start fresh
```
