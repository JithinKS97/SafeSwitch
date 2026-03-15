import { Module } from '@nestjs/common';
import { ExecutionService } from './execution.service';
import { PositionsModule } from '../positions/positions.module';
import { BinanceModule } from '../binance/binance.module';
import { BinanceKeysModule } from '../binance-keys/binance-keys.module';

@Module({
  imports: [PositionsModule, BinanceModule, BinanceKeysModule],
  providers: [ExecutionService],
  exports: [ExecutionService],
})
export class ExecutionModule {}
