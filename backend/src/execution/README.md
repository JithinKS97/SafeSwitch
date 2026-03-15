# Execution Layer

All order entry and exit flows through `ExecutionService` so we can support both paper and live trading from a single code path.

## Current (Paper)

- **Enter**: Updates position in DB with entry price. No exchange order.
- **Exit**: Updates position in DB with PnL and close reason. No exchange order.

## Future (Live)

When `position.mode === 'LIVE'`:

1. **Enter**: Place market order on Binance (BUY for LONG, SELL for SHORT), then update DB with fill price and `orderId`.
2. **Exit**: Place market order to close (SELL for LONG, BUY for SHORT), then update DB with PnL and `orderId`.

## Prerequisites for Live

- `BINANCE_API_KEY` and `BINANCE_SECRET` in `.env`
- BinanceService extended with `placeMarketOrder(symbol, side, quantity)`
- Position `amount` used to compute quantity (or store quantity when entering)
