import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { PrismaModule } from './common/prisma/prisma.module';
import { PositionsModule } from './positions/positions.module';
import { SuggestionsModule } from './suggestions/suggestions.module';
import { TradingAgentModule } from './agent/trading-agent.module';
import { UserModule } from './user/user.module';
import { BinanceKeysModule } from './binance-keys/binance-keys.module';
import { AiKeysModule } from './ai-keys/ai-keys.module';
import { BacktestModule } from './backtest/backtest.module';
import { auth } from './lib/auth';

@Module({
  imports: [
    AuthModule.forRoot({
      auth,
      bodyParser: {
        json: { limit: '2mb' },
        urlencoded: { limit: '2mb', extended: true },
      },
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    PositionsModule,
    SuggestionsModule,
    TradingAgentModule,
    UserModule,
    BinanceKeysModule,
    AiKeysModule,
    BacktestModule,
  ],
})
export class AppModule {}
