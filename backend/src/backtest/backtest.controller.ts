import { Body, Controller, Post, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { BacktestService } from './backtest.service';
import type { BacktestConfig, BacktestResult } from './backtest.types';

@Controller('backtest')
export class BacktestController {
  constructor(private readonly service: BacktestService) {}

  @Post('run')
  @HttpCode(HttpStatus.OK)
  async run(@Body() body: Partial<BacktestConfig>): Promise<BacktestResult> {
    const pairs = body.pairs;
    if (!Array.isArray(pairs) || pairs.length === 0) {
      throw new BadRequestException('pairs must be a non-empty array');
    }
    if (pairs.length > 10) {
      throw new BadRequestException('Maximum 10 pairs per backtest run');
    }
    const daysBack = Math.min(Math.max(body.daysBack ?? 30, 7), 90);
    const riskAppetite = (['LOW', 'MEDIUM', 'HIGH'] as const).includes(body.riskAppetite as any)
      ? (body.riskAppetite as 'LOW' | 'MEDIUM' | 'HIGH')
      : 'MEDIUM';
    const direction = (['LONG', 'SHORT', 'BOTH'] as const).includes(body.direction as any)
      ? (body.direction as 'LONG' | 'SHORT' | 'BOTH')
      : 'BOTH';

    return this.service.run({ pairs, daysBack, riskAppetite, direction });
  }
}
