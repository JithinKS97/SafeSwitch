import { Module, forwardRef } from '@nestjs/common';
import { ExecutionService } from './execution.service';
import { PositionsModule } from '../positions/positions.module';
import { BinanceModule } from '../binance/binance.module';
import { BinanceKeysModule } from '../binance-keys/binance-keys.module';

@Module({
  imports: [forwardRef(() => PositionsModule), BinanceModule, BinanceKeysModule],
  providers: [ExecutionService],
  exports: [ExecutionService],
})
export class ExecutionModule {}
