import { Module } from '@nestjs/common';
import { PrismaModule } from './common/prisma/prisma.module';
import { PositionsModule } from './positions/positions.module';
import { SuggestionsModule } from './suggestions/suggestions.module';

@Module({
  imports: [PrismaModule, PositionsModule, SuggestionsModule],
})
export class AppModule {}
