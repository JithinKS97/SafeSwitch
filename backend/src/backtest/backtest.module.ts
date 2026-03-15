import { Module } from '@nestjs/common';
import { BacktestController } from './backtest.controller';
import { BacktestService } from './backtest.service';
import { BinanceModule } from '../binance/binance.module';
import { IndicatorsModule } from '../indicators/indicators.module';
import { SignalsModule } from '../signals/signals.module';

@Module({
  imports: [BinanceModule, IndicatorsModule, SignalsModule],
  controllers: [BacktestController],
  providers: [BacktestService],
})
export class BacktestModule {}
