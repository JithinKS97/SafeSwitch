import { Injectable, Logger } from '@nestjs/common';
import { PositionsRepository } from '../positions/positions.repository';
import { BinanceService } from '../binance/binance.service';
import { BinanceKeysService } from '../binance-keys/binance-keys.service';
import { CloseReason } from '../common/types/enums';
import type { EnterResult, ExitResult } from './execution.types';

/**
 * ExecutionService abstracts order entry and exit.
 * - PAPER: Updates DB only (simulated fills at current price).
 * - LIVE: Places real orders on Binance, then updates DB.
 *
 * All agent and manual actions flow through this service.
 */
@Injectable()
export class ExecutionService {
  private readonly logger = new Logger(ExecutionService.name);

  constructor(
    private readonly positions: PositionsRepository,
    private readonly binance: BinanceService,
    private readonly binanceKeys: BinanceKeysService,
  ) {}

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
      const pos = await this.positions.findByIdForExecution(positionId);
      if (!pos) throw new Error(`Position ${positionId} not found`);
      if (pos.direction === 'SHORT') {
        throw new Error('LIVE mode does not support SHORT on Binance spot (futures required)');
      }

      const keys = await this.binanceKeys.getDecryptedKeys(pos.userId);
      if (!keys) throw new Error('Binance API keys not configured. Add keys in settings.');

      // amount is in USDT; quantity = amount / price (base asset)
      const quantity = pos.amount / entryPrice;
      if (quantity <= 0) throw new Error(`Invalid quantity for ${pos.pair}: ${quantity}`);

      this.logger.log(`[LIVE] Placing BUY ${pos.pair} qty=${quantity.toFixed(8)} ($${pos.amount})`);
      const { fillPrice, fillQty } = await this.binance.placeSpotMarketOrder(
        keys.apiKey,
        keys.apiSecret,
        pos.pair,
        'BUY',
        quantity,
      );

      this.logger.log(`[LIVE] Filled ${pos.pair} @ ${fillPrice} qty=${fillQty}`);
      await this.positions.activateByAgentWithLive(positionId, fillPrice, fillQty);
      return { success: true, mode: 'LIVE', entryPrice: fillPrice };
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
      const pos = await this.positions.findByIdForExecution(positionId);
      if (!pos) throw new Error(`Position ${positionId} not found`);
      if (pos.direction === 'SHORT') {
        throw new Error('LIVE mode does not support SHORT on Binance spot (futures required)');
      }

      const liveQty = pos.liveQuantity;
      if (!liveQty || liveQty <= 0) {
        throw new Error(`Position ${positionId} has no liveQuantity (corrupt state)`);
      }

      const keys = await this.binanceKeys.getDecryptedKeys(pos.userId);
      if (!keys) throw new Error('Binance API keys not configured. Add keys in settings.');

      this.logger.log(`[LIVE] Placing SELL ${pos.pair} qty=${liveQty} (close: ${reason})`);
      const { fillPrice } = await this.binance.placeSpotMarketOrder(
        keys.apiKey,
        keys.apiSecret,
        pos.pair,
        'SELL',
        liveQty,
      );

      const actualPnl =
        pos.entryPrice != null
          ? ((fillPrice - pos.entryPrice) / pos.entryPrice) * 100
          : pnl;

      this.logger.log(`[LIVE] Closed ${pos.pair} @ ${fillPrice} pnl=${actualPnl.toFixed(2)}%`);
      await this.positions.closeByAgent(positionId, reason, actualPnl, fillPrice);
      return { success: true, mode: 'LIVE', pnl: actualPnl, currentPrice: fillPrice, reason };
    }

    await this.positions.closeByAgent(positionId, reason, pnl, currentPrice);
    return { success: true, mode: 'PAPER', pnl, currentPrice, reason };
  }
}
