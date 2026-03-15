# Suggestion Engine (Proprietary Module)

Generates trading pair suggestions from market data and risk appetite.

## Interface

- **`SuggestionEngine.suggest(input)`** — Returns `{ analysis, suggestions }`
- Input: `riskPct`, `riskAppetite`, `marketData[]`

## Swapping the implementation

In `suggestion-engine.module.ts`:

```ts
{
  provide: SUGGESTION_ENGINE,
  useClass: YourCustomSuggestionEngine,  // implements SuggestionEngine
}
```

## Files

- `suggestion-engine.interface.ts` — Contract (do not change without coordination)
- `default-suggestion-engine.service.ts` — Current implementation (AI + fallback)
- Improve: prompt design, parsing, fallback logic, or replace with rules-based engine
