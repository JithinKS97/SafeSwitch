# SafeSwitch

An AI-powered crypto trading platform where autonomous agents practice on paper before trading with real money.

## The Idea

Most algo traders lose money by going live too fast. SafeSwitch enforces a discipline: the agent must *earn* its way into real trading by proving itself in simulation first.

**The flow:**
1. Add your OpenRouter API key — the AI needs it to analyse markets
2. Get suggestions based on your risk appetite
3. Add pairs to watch — the agent monitors them in paper mode
4. Confidence builds from real trade outcomes
5. When confidence reaches 70%, switch to live with a real USDT amount
6. Position closes when the profit target is hit or you stop it manually

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

Then open `http://localhost:3000` and sign in with your email OTP.

---

## How to Use

### Step 1 — Configure your API keys

Click **Config** in the top-right header.

**AI Model tab** (required):
- Paste your OpenRouter API key (`sk-or-...`) from `openrouter.ai/keys`
- Select a model from the dropdown (GPT-4o Mini is a good default — fast and cheap)
- Save — you won't be able to run analysis until this is done

**Binance API tab** (optional, needed for live trading):
- Add your Binance API key + secret
- Create keys at Binance → API Management, enable Spot trading
- You can skip this until you're ready to go live

---

### Step 2 — Get pair suggestions

Go to **Suggest** in the nav.

Set your risk level (1–10):
- **1–3** — Conservative. BTC, ETH, multi-day holds, minimal drawdown risk.
- **4–6** — Moderate. Swing trades on mid/large caps, hours to a few days.
- **7–10** — Aggressive. Small caps, meme coins, short-term, high volatility.

Click **Analyse market**. The engine:
1. Fetches top 30 coins from CoinGecko
2. Scores each with technical indicators (RSI, EMA, MACD, Bollinger, ADX, volume, regression)
3. Sends the ranked results to the AI, which picks the best fits for your risk level

Click **Add** on any suggestion to add it to your positions — no amount needed yet.

You can also **Refresh** any past analysis to re-run it with fresh market data.

---

### Step 3 — Watch the agent work

Go to **Positions**.

Every pair starts in **Watching** status. The agent runs on a schedule (default every 15 minutes). Each cycle it:
1. Computes signal scores (0–100) for every pair
2. Enters when the score exceeds your risk threshold
3. Exits when the signal reverses, momentum fades, or the 4h trend turns against you
4. Writes a journal entry explaining what the math showed

Click **Run now** to trigger a cycle immediately.

Click the pair name to open the **Journal** — every ENTER, EXIT, and OBSERVE decision with the full indicator state.

---

### Step 4 — Build confidence

Each pair has a **confidence score** (% badge next to the pair name). It starts at 0 and builds from real trade outcomes:

- Win rate × 60 points
- Average PnL × 2 points
- Trade count bonus (up to 20 points)

Confidence **survives position deletion** — re-adding the same pair picks up where it left off.

---

### Step 5 — Go live

When confidence reaches **70%+**, the **Go live** button glows amber with a star — the agent has earned enough trust on that pair.

Click **★ Go live**, enter the USDT amount to commit, confirm. The agent places real orders via Binance from that point on.

> Make sure you've added your Binance API keys (Config → Binance API) before going live.

To switch back: click **Paper** on the position row.

---

## Instructions

You can guide the agent's behaviour at two levels.

### Global instruction (all pairs)

Click **"Set your goal / instruction"** on the Positions page.

Examples:
- `"Be conservative this week"`
- `"Only enter on strong signals"`
- `"I want quick profits, exit early"`

### Per-pair instruction (one pair only)

Click **Instruction** on any position row.

Examples:
- `"Hold longer on this pair"`
- `"Be aggressive, I want faster entries"`

### What instructions do

Instructions shift the signal score thresholds in the decision engine:

| Keyword | Effect |
|---|---|
| `conservative` / `cautious` / `careful` | Requires stronger signal to enter (+10), exits sooner (+5) |
| `aggressive` / `bold` | Enters on weaker signals (−8) |
| `strong signal` / `high confidence` | Only enters on very strong signals (+8) |
| `quick profit` / `exit quickly` / `scalp` | Exits sooner when momentum fades (+10 exit) |
| `hold longer` / `hold` / `patient` | Holds through dips, exits only on strong reversals (−10 exit) |
| `quick` | Enters more freely for short trades (−5) |

Pair-level instructions take priority over the global instruction.

---

## Position Actions

| Action | What it does |
|---|---|
| **Journal** | View full agent history and indicator snapshots for this pair |
| **Instruction** | Set a per-pair trading instruction |
| **★ Go live** | Switch to live trading — prompts for USDT amount |
| **Paper** | Switch back to paper trading |
| **Reset PnL** | Zero out the running PnL (journal and confidence kept) |
| **Pause** | Stop the agent managing this pair |
| **Resume** | Put the pair back into Watching |
| **Delete** | Remove the position — choose to keep or wipe journal history |

---

## Key Commands

```bash
just db-up      # start Postgres
just server     # start NestJS backend (port 8080)
just frontend   # start TanStack Start frontend (port 3000)
just db-down    # stop containers
just db-reset   # wipe database and start fresh
just env        # write backend/.env
```

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | TanStack Start (React 19) + Tailwind CSS v4 |
| Backend | NestJS + TypeScript |
| Database | PostgreSQL + Prisma |
| AI | OpenRouter (user-supplied key, any model) |
| Market data | Binance API + CoinGecko API |

---

## Analysis & Decision Engine

The core of SafeSwitch is a two-layer system: a **pure-math signal engine** that scores every pair numerically, and an **AI agent** that reads those scores, the indicator breakdown, and the historical journal to reason about each decision.

### Signal Engine

Every pair is scored 0–100 for both LONG and SHORT directions using only mathematical indicators — no AI involved at this stage.

**Indicators computed per pair:**

| Indicator | What it measures |
|---|---|
| RSI(14) | Momentum oscillator — overbought/oversold |
| EMA(20) / EMA(50) | Fast/slow trend direction and crossover |
| MACD(12, 26, 9) | Momentum shift via histogram direction and magnitude |
| Bollinger Bands(20, 2) | Price position relative to volatility envelope |
| ATR(14) | Absolute volatility |
| ADX(14) | Trend strength — distinguishes trending from ranging markets |
| Volume ratio | Current volume vs 20-period average |
| Linear regression (50-candle) | Slope, R² fit, predicted next close |
| Swing pivot S/R | True support/resistance from swing highs/lows |

**Signal labels:** `STRONG_BUY` (≥78) · `BUY` (≥62) · `NEUTRAL` (40–62) · `SELL` (25–40) · `STRONG_SELL` (<25)

**ADX regime detection** dynamically shifts indicator weights. In trending markets (ADX ≥ 25), trend-following signals dominate. In ranging markets (ADX < 20), mean-reversion oscillators take precedence.

### Multi-Timeframe Analysis

Each 1h signal is enriched with a 4h context block:
- LONG signal in a 4h bearish trend → penalty of 8–18 points (scaled by 4h ADX)
- LONG signal in a 4h bullish trend → bonus of 3–8 points

This prevents entering a 1h setup that contradicts the dominant higher-timeframe trend.

### Pair Knowledge System

Every decision is logged with a **math snapshot** — the exact indicator state at decision time. Over time this builds a per-pair journal that the AI reads to identify what patterns have historically worked.

Each journal includes:
- **Summarised knowledge** — AI observations from all past cycles
- **Confidence score** — derived from historical exit outcomes
- **Entry math snapshots** — indicator state at every decision

### Backtest Engine

Replays the signal engine against historical Binance candles — zero AI calls, zero cost.

```
POST /backtest/run
{
  "pairs": ["BTC/USDT", "ETH/USDT"],
  "daysBack": 30,
  "riskAppetite": "MEDIUM",
  "direction": "BOTH"
}
```

Returns win rates broken down by signal label, market regime, and score band. `summary.suggestedThresholds` gives data-driven entry threshold recommendations.

Limits: max 10 pairs, 7–90 days.
