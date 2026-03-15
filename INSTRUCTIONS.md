# SafeSwitch — How to Use

## Overview

SafeSwitch is an AI-powered crypto trading platform that runs a trading agent on your behalf. The agent analyses market signals mathematically and trades on paper first — you only go live when you're confident in the results.

---

## Getting Started

### 1. Start the app

```bash
just db-up       # start Postgres
just server      # start backend (port 3001)
just frontend    # start frontend (port 3000)
```

Then open [http://localhost:3000](http://localhost:3000) and sign in with your email OTP.

---

## Core Flow

### Step 1 — Get suggestions

Go to **Suggest pairs** and set your risk level (1–10 slider):

- **1–3** — Conservative. Large caps (BTC, ETH), multi-day holds, minimal drawdown risk.
- **4–6** — Moderate. Swing trades on mid/large caps, hours to a few days.
- **7–10** — Aggressive. Small caps, meme coins, short-term, high volatility.

Click **Analyse market**. The engine fetches live data for the top 30 coins, scores each one using technical indicators, and the AI picks the best fits for your risk level.

Click **Add** on any suggestion to add it to your positions.

> You can **Refresh** an existing analysis at any time to re-run it with fresh market data.

---

### Step 2 — Watch the agent work

Go to **Positions**. Every pair starts in **Watching** status — the agent monitors it but hasn't entered yet.

The agent runs on a schedule (default every 15 minutes). Each cycle it:
1. Computes signal scores (0–100) for every pair using RSI, EMA, MACD, Bollinger Bands, ADX, volume, and 4h trend
2. Enters a position when the score exceeds your risk threshold
3. Exits when the signal reverses, momentum fades near resistance/support, or the 4h trend turns against you
4. Writes a journal entry explaining what the math showed

You can also click **Run now** to trigger a cycle immediately.

---

### Step 3 — Build confidence

Each pair has a **confidence score** (shown as a % badge next to the pair name). It starts at 0 and builds from real trade outcomes:

- Win rate × 60 points
- Average PnL × 2 points
- Trade count bonus (up to 20 points)

Click the pair name to open the **Journal** — a full history of every ENTER, EXIT, and OBSERVE decision with the indicator state at each point.

---

### Step 4 — Go live

When a pair's confidence reaches **70%+**, the **Go live** button glows amber — the agent is signalling it has earned enough trust on that pair.

Click **★ Go live**, enter the USDT amount you want to commit, and confirm. The agent will now place real orders via your Binance API keys.

> **Note:** Make sure you've added your Binance API keys first (Settings → "Add Binance API keys").

---

## Instructions

You can guide the agent's behaviour at two levels:

### Global instruction (applies to all pairs)
Click **"Set your goal / instruction"** on the positions page.

Examples:
- `"Be conservative this week"`
- `"Only enter on strong signals"`
- `"I want quick profits, exit early"`

### Per-pair instruction (applies to one pair only)
Click **Instruction** on any position row.

Examples:
- `"Hold longer on this pair"`
- `"Be aggressive, I want faster entries"`
- `"Quick profit, exit at first sign of reversal"`

### What instructions actually do

Instructions affect the signal score thresholds in the decision engine:

| Keyword | Effect |
|---|---|
| `conservative` / `cautious` / `careful` | Requires stronger signal to enter (+10 threshold), exits sooner (+5 exit) |
| `aggressive` / `bold` | Enters on weaker signals (−8 threshold) |
| `strong signal` / `high confidence` | Only enters on very strong signals (+8 threshold) |
| `quick profit` / `exit quickly` / `scalp` | Exits sooner when momentum fades (+10 exit threshold) |
| `hold longer` / `hold` / `patient` | Holds through dips, exits only on strong reversals (−10 exit threshold) |
| `quick` | Enters more freely for short trades (−5 threshold) |

Pair-level instructions take priority over the global instruction.

---

## Position Actions

| Action | What it does |
|---|---|
| **Journal** | View full agent history for this pair |
| **Instruction** | Set a per-pair instruction |
| **Go live** | Switch to live trading (prompts for amount) |
| **Paper** | Switch back to paper trading |
| **Reset PnL** | Zero out the running PnL (journal kept) |
| **Pause** | Stop the agent managing this pair |
| **Resume** | Put the pair back into Watching |
| **Delete** | Remove the position (choose to keep or wipe history) |

---

## Backtest

Before trusting a pair with real money, run a backtest:

```
POST /backtest/run
{
  "pairs": ["BTC/USDT", "ETH/USDT"],
  "daysBack": 30,
  "riskAppetite": "MEDIUM",
  "direction": "BOTH"
}
```

- Up to 10 pairs, 7–90 days of history
- Zero AI calls — pure math replay
- Returns win rate broken down by signal label, market regime, and score band
- `summary.suggestedThresholds` gives data-driven entry threshold recommendations

---

## Key Concepts

**Signal score (0–100):** How strongly the math supports a trade. Composed of trend (EMA), momentum (MACD), oscillator (RSI + Bollinger), regression model, and volume. ADX regime detection shifts the weights between trending and ranging markets.

**4h gate:** A LONG signal in a 4h bearish trend gets penalised 8–18 points. Prevents entering a 1h setup that contradicts the dominant higher-timeframe direction.

**Confidence score:** Built from actual paper trade outcomes for that pair. Confidence ≥ 70% = ready for live. Confidence survives position deletion — re-adding the same pair picks up where it left off.

**Paper vs Live:** Paper trading tracks P&L in simulation with no real orders. Live trading places real Binance orders. Always paper trade first.
