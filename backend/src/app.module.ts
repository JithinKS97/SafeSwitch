import { Module } from '@nestjs/common';
import { PrismaModule } from './common/prisma/prisma.module';
import { PositionsModule } from './positions/positions.module';

@Module({
  imports: [PrismaModule, PositionsModule],
})
export class AppModule {}
