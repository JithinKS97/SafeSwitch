# SafeSwitch Backend

NestJS API server for the SafeSwitch trading platform.

## Stack

- **NestJS** — framework
- **Prisma** — ORM and migrations
- **PostgreSQL** — database
- **OpenRouter** — AI inference (user-supplied key, any model)
- **Binance API** — market data and live order execution
- **CoinGecko API** — top coins list for suggestions

## Running

```bash
pnpm install
npx prisma migrate dev
pnpm start:dev
```

Requires `DATABASE_URL` in `backend/.env`. Run `just env` from the root to generate it.

The server listens on port **8080** by default (or `$PORT` if set).

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string |
| `ENCRYPTION_KEY` | Production | 32+ char secret for encrypting stored API keys |

> OpenRouter and Binance API keys are stored **per-user** in the database (encrypted). They are set through the app UI — not environment variables.

## Structure

```
src/
├── main.ts
├── app.module.ts
├── agent/                  # Trading agent — decision engine + scheduler
├── signals/                # Signal engine (0–100 score per pair)
├── indicators/             # RSI, EMA, MACD, Bollinger, ADX, ATR, regression
├── suggestion-engine/      # AI pair suggestions
├── pair-knowledge/         # Per-pair journal, confidence, AI summariser
├── positions/              # Position CRUD and lifecycle
├── suggestions/            # Suggestion snapshot storage
├── ai/                     # OpenRouter client
├── ai-keys/                # Per-user OpenRouter key management
├── binance-keys/           # Per-user Binance key management
├── backtest/               # Historical signal replay engine
├── user/                   # User data management
└── common/                 # Auth, Prisma, encryption, filters
```

## Key API Endpoints

### Positions
| Method | Path | Description |
|---|---|---|
| `GET` | `/positions` | List all positions |
| `POST` | `/positions` | Create a new position |
| `POST` | `/positions/:id/activate` | Activate (start paper trading) |
| `PATCH` | `/positions/:id/mode` | Switch between PAPER and LIVE |
| `PATCH` | `/positions/:id/amount` | Set the live trading amount (USDT) |
| `PATCH` | `/positions/:id/instruction` | Set per-pair instruction |
| `POST` | `/positions/:id/stop` | Stop the position |
| `POST` | `/positions/:id/pause` | Pause agent management |
| `POST` | `/positions/:id/resume` | Resume to Watching |
| `POST` | `/positions/:id/reset-pnl` | Zero out the running PnL |
| `DELETE` | `/positions/:id` | Delete position (`?wipeHistory=true` to also wipe journal) |

### Suggestions
| Method | Path | Description |
|---|---|---|
| `POST` | `/suggestions` | Generate suggestions for a risk level |
| `GET` | `/suggestions` | List past snapshot summaries |
| `GET` | `/suggestions/:id` | Get a full snapshot |
| `POST` | `/suggestions/:id/refresh` | Re-run with fresh market data |
| `DELETE` | `/suggestions/:id` | Delete a snapshot |

### Agent
| Method | Path | Description |
|---|---|---|
| `GET` | `/agent/status` | Scheduler status + next run time |
| `PATCH` | `/agent/scheduler` | Enable/disable the scheduler |
| `POST` | `/agent/run` | Trigger an immediate agent cycle |
| `GET` | `/agent/instruction` | Get the global instruction |
| `PATCH` | `/agent/instruction` | Set the global instruction |

### Config
| Method | Path | Description |
|---|---|---|
| `GET` | `/ai-keys` | OpenRouter key status (masked) |
| `PUT` | `/ai-keys` | Add or update OpenRouter key + model |
| `DELETE` | `/ai-keys` | Remove OpenRouter key |
| `GET` | `/binance-keys` | Binance key status (masked) |
| `PUT` | `/binance-keys` | Add or update Binance key + secret |
| `DELETE` | `/binance-keys` | Remove Binance keys |

### Pair Journals
| Method | Path | Description |
|---|---|---|
| `GET` | `/pair-journals` | List all pair journals |
| `GET` | `/pair-journals/:pair` | Get journal for a specific pair |

### Backtest
| Method | Path | Description |
|---|---|---|
| `POST` | `/backtest/run` | Run a historical signal replay |

### User
| Method | Path | Description |
|---|---|---|
| `DELETE` | `/user/data` | Wipe all user data |

## Database Migrations

```bash
# Apply pending migrations
npx prisma migrate dev

# Regenerate the Prisma client after schema changes
npx prisma generate

# Open Prisma Studio (database browser)
npx prisma studio
```

## Backtest API

```json
POST /backtest/run
{
  "pairs": ["BTC/USDT", "ETH/USDT"],
  "daysBack": 30,
  "riskAppetite": "MEDIUM",
  "direction": "BOTH"
}
```

- `pairs` — max 10
- `daysBack` — 7–90
- `riskAppetite` — `LOW` | `MEDIUM` | `HIGH`
- `direction` — `LONG` | `SHORT` | `BOTH`

Returns win rates by signal label, market regime, and score band, plus `summary.suggestedThresholds` for data-driven entry tuning.
