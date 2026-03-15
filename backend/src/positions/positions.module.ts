import { Module, forwardRef } from '@nestjs/common';
import { PositionsController } from './positions.controller';
import { PositionsService } from './positions.service';
import { PositionsRepository } from './positions.repository';
import { BinanceModule } from '../binance/binance.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { ExecutionModule } from '../execution/execution.module';

@Module({
  imports: [BinanceModule, PrismaModule, forwardRef(() => ExecutionModule)],
  controllers: [PositionsController],
  providers: [PositionsService, PositionsRepository],
  exports: [PositionsService, PositionsRepository],
})
export class PositionsModule {}
