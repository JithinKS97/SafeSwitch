import { Injectable, Logger } from '@nestjs/common';
import { PositionsRepository } from '../positions/positions.repository';
import { CloseReason } from '../common/types/enums';
import type { EnterResult, ExitResult } from './execution.types';

/**
 * ExecutionService abstracts order entry and exit.
 * - PAPER: Updates DB only (simulated fills at current price).
 * - LIVE: Will place real orders on Binance, then update DB.
 *
 * All agent and manual actions flow through this service so we can
 * add live trading without changing callers.
 */
@Injectable()
export class ExecutionService {
  private readonly logger = new Logger(ExecutionService.name);

  constructor(private readonly positions: PositionsRepository) {}

  /**
   * Enter a position (activate from Watching → Open).
   * PAPER: Update DB with entry price.
   * LIVE: Place market order on exchange, then update DB with fill.
   */
  async enter(
    positionId: string,
    entryPrice: number,
    mode: 'PAPER' | 'LIVE',
  ): Promise<EnterResult> {
    if (mode === 'LIVE') {
      // TODO: Implement live order execution via Binance API
      // 1. Load position (pair, direction, amount)
      // 2. Place market order: BUY for LONG, SELL for SHORT
      // 3. Update position with fill price and orderId
      this.logger.warn('Live trading not yet implemented — skipping execution');
      throw new Error('Live trading is not yet implemented');
    }

    await this.positions.activateByAgent(positionId, entryPrice);
    return { success: true, mode: 'PAPER', entryPrice };
  }

  /**
   * Exit a position (close Open → Completed/Stopped).
   * PAPER: Update DB with PnL and close reason.
   * LIVE: Place market order to close, then update DB with fill.
   */
  async exit(
    positionId: string,
    reason: CloseReason,
    pnl: number,
    currentPrice: number,
    mode: 'PAPER' | 'LIVE',
  ): Promise<ExitResult> {
    if (mode === 'LIVE') {
      // TODO: Implement live order execution via Binance API
      // 1. Load position (pair, direction, quantity)
      // 2. Place market order to close: SELL for LONG, BUY for SHORT
      // 3. Update position with PnL, close reason, orderId
      this.logger.warn('Live trading not yet implemented — skipping execution');
      throw new Error('Live trading is not yet implemented');
    }

    await this.positions.closeByAgent(positionId, reason, pnl, currentPrice);
    return { success: true, mode: 'PAPER', pnl, currentPrice, reason };
  }
}
