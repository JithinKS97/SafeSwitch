import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './common/prisma/prisma.module';
import { PositionsModule } from './positions/positions.module';
import { SuggestionsModule } from './suggestions/suggestions.module';
import { TradingAgentModule } from './agent/trading-agent.module';
import { UserModule } from './user/user.module';
import { ClerkAuthGuard } from './common/auth/clerk.guard';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    PositionsModule,
    SuggestionsModule,
    TradingAgentModule,
    UserModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ClerkAuthGuard }],
})
export class AppModule {}
