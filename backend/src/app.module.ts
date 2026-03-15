import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './common/prisma/prisma.module';
import { PositionsModule } from './positions/positions.module';
import { SuggestionsModule } from './suggestions/suggestions.module';
import { ClerkAuthGuard } from './common/auth/clerk.guard';

@Module({
  imports: [PrismaModule, PositionsModule, SuggestionsModule],
  providers: [{ provide: APP_GUARD, useClass: ClerkAuthGuard }],
})
export class AppModule {}
