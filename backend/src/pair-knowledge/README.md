# Pair Knowledge (Proprietary Module)

Confidence + knowledge building per trading pair.

## Interfaces

- **`PairKnowledgeEngine`** — addEntry, findForUser, findByPair, findForPairs
- **`ConfidenceCalculator`** — calculate(outcomes) → 0–100

## Swapping the confidence formula

In `pair-knowledge.module.ts`:

```ts
{
  provide: CONFIDENCE_CALCULATOR,
  useClass: YourConfidenceCalculator,  // implements ConfidenceCalculator
}
```

## Files

- `pair-knowledge.interface.ts` — Contract
- `confidence-calculator.interface.ts` — Confidence formula contract
- `default-confidence-calculator.service.ts` — Current formula (winRate, avgPnl, trade count)
- Improve: add time in market, drawdown recovery, consistency metrics
