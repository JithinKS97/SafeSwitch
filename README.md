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

Suggestions are ephemeral — request fresh ones any time, or refresh an existing snapshot for updated signals.

## Stack

| Layer | Technology |
|---|---|
| Frontend | TanStack Start (React 19) + Tailwind CSS v4 |
| Backend | NestJS + TypeScript |
| Database | PostgreSQL + Prisma |
| Market data | Binance API + CoinGecko API |

## Project Structure

```
safeswitch/
├── frontend/     # TanStack Start web app
├── backend/      # NestJS API server
├── compose.yml   # Docker services (Postgres)
└── justfile      # Dev commands
```

---

## Analysis & Decision Engine

The core of SafeSwitch is a two-layer system: a **pure-math signal engine** that scores every pair numerically, and an **AI agent** that reads those scores, the indicator breakdown, and the historical journal to reason about each decision.

### Signal Engine (`src/signals/`)

Every pair is scored 0–100 for both LONG and SHORT directions using only mathematical indicators — no AI involved at this stage. The score drives decision thresholds; the AI explains them.

**Indicators computed per pair (`src/indicators/`):**

| Indicator | What it measures |
|---|---|
| RSI(14) | Momentum oscillator — overbought/oversold via Wilder's smoothed formula |
| EMA(20) / EMA(50) | Fast/slow trend direction and crossover |
| MACD(12, 26, 9) | Momentum shift via histogram direction and magnitude |
| Bollinger Bands(20, 2) | Price position relative to volatility envelope |
| ATR(14) | Absolute volatility via Wilder's smoothed Average True Range |
| ADX(14) | Trend strength via Wilder's DMI — distinguishes trending from ranging markets |
| Volume ratio | Current volume vs 20-period average |
| Linear regression (50-candle) | Slope, R² fit quality, and predicted next close |
| Swing pivot S/R | True support/resistance from swing highs/lows (5-candle pivot detection over last 100 candles) |

**Signal scoring components:**

| Component | What it measures | Weight (trending) | Weight (ranging) |
|---|---|---|---|
| Trend | EMA cross alignment + gap conviction | 30% | 15% |
| Momentum | MACD histogram direction and scale | 25% | 15% |
| Oscillator | RSI + Bollinger position (oversold/overbought) | 15% | 30% |
| Model | Regression slope, R², predicted price, S/R proximity | 20% | 25% |
| Volume | Volume ratio vs average (conviction amplifier) | 10% | 15% |

**ADX regime detection** dynamically shifts these weights. In a trending market (ADX ≥ 25), trend-following signals dominate. In a ranging market (ADX < 20), mean-reversion oscillators take precedence. Using a MACD crossover in sideways chop is a known failure mode — ADX prevents it.

**Signal labels:** `STRONG_BUY` (≥78) · `BUY` (≥62) · `NEUTRAL` (40–62) · `SELL` (25–40) · `STRONG_SELL` (<25)

### Multi-Timeframe Analysis

Each pair's 1h worksheet is enriched with a 4h context block before scoring:

- **4h EMA trend** — overall directional bias from the higher timeframe
- **4h ADX** — whether the 4h trend is strong or weak

The signal engine applies a 4h gate to the final score:
- LONG signal in a 4h **bearish** trend → penalty of 8–18 points (scaled by 4h ADX strength)
- LONG signal in a 4h **bullish** trend → bonus of 3–8 points
- Opposing strong 4h trend (ADX > 30) → maximum penalty

This prevents entering a 1h setup that contradicts the dominant trend on the higher timeframe — one of the most common reasons retail signals fail.

### Data Quality

- **200 candles of 1h data** per pair — enough for all indicators to initialise properly (EMA50 needs 50+, Wilder's ATR/ADX need 28+, MACD needs 35+)
- **100 candles of 4h data** for higher-timeframe context
- Candles fetched fresh every agent cycle; worksheets persisted to the database so they're available outside of agent cycles

### Pair Knowledge System (`src/pair-knowledge/`)

Every decision the agent makes is logged with a **math snapshot** — a compact record of the exact indicator state at decision time (RSI, EMA trend, ADX regime, MACD histogram, Bollinger position, regression slope, 4h trend). Over time, this builds a per-pair journal that the agent reads back to identify what indicator patterns have historically worked on that pair.

Each pair journal includes:
- **Accumulated knowledge** — AI-summarised observations from all past cycles
- **Confidence score** — derived from historical exit outcomes (win rate weighted by PnL)
- **Entry math snapshots** — indicator state at every ENTER, EXIT, and OBSERVE decision

### Suggestion Engine (`src/suggestion-engine/`)

When generating pair suggestions, the engine:
1. Fetches top 30 coins from CoinGecko
2. Fetches 200 candles of 1h + 100 candles of 4h data from Binance for each coin (parallelised, 5 at a time)
3. Computes the full worksheet and enriches with 4h context
4. Scores each coin via the signal engine
5. **Pre-ranks by signal score** before sending to the LLM — the LLM sees the strongest signals first, with the full score breakdown
6. LLM selects 3 suggestions appropriate to the risk appetite, explaining *why* each signal fits

Suggestions can be refreshed at any time via `POST /suggestions/:id/refresh` — re-runs the full pipeline with fresh market data for the same risk level.

### Modular Architecture

All engines implement clean interfaces with NestJS DI tokens, making each independently replaceable:

| Token | Interface | Default implementation |
|---|---|---|
| `SIGNAL_ENGINE` | `src/signals/signal-engine.interface.ts` | `DefaultSignalEngineService` |
| `SUGGESTION_ENGINE` | `src/suggestion-engine/suggestion-engine.interface.ts` | `DefaultSuggestionEngineService` |
| `PAIR_KNOWLEDGE_ENGINE` | `src/pair-knowledge/pair-knowledge.interface.ts` | `PairKnowledgeEngineService` |
| `CONFIDENCE_CALCULATOR` | `src/pair-knowledge/confidence-calculator.interface.ts` | — |
| `KNOWLEDGE_SUMMARIZER` | `src/pair-knowledge/knowledge-summarizer.interface.ts` | — |

Swap any implementation by changing a single line in the module's provider binding.

---

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

# Start backend (port 8080)
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
