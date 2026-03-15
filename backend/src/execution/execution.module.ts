import { Module } from '@nestjs/common';
import { ExecutionService } from './execution.service';
import { PositionsModule } from '../positions/positions.module';

@Module({
  imports: [PositionsModule],
  providers: [ExecutionService],
  exports: [ExecutionService],
})
export class ExecutionModule {}
