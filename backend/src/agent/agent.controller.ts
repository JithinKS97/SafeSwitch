import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { TradingAgentService } from './trading-agent.service';
import { AgentInstructionRepository } from './agent-instruction.repository';
import { UserId } from '../common/auth/user-id.decorator';
import type { CycleResult, SchedulerStatus } from './trading-agent.service';

@Controller('agent')
export class AgentController {
  constructor(
    private readonly agent: TradingAgentService,
    private readonly instructionRepo: AgentInstructionRepository,
  ) {}

  @Get('status')
  getStatus(): SchedulerStatus {
    return this.agent.getSchedulerStatus();
  }

  @Patch('scheduler')
  @HttpCode(HttpStatus.OK)
  setScheduler(@Body('enabled') enabled: unknown): SchedulerStatus {
    if (typeof enabled !== 'boolean') {
      throw new BadRequestException('enabled must be a boolean');
    }
    this.agent.setSchedulerEnabled(enabled);
    return this.agent.getSchedulerStatus();
  }

  @Post('run')
  @HttpCode(HttpStatus.OK)
  run(@UserId() userId: string): Promise<CycleResult> {
    return this.agent.runCycleForUser(userId);
  }

  @Get('instruction')
  getInstruction(@UserId() userId: string): Promise<{ instruction: string }> {
    return this.instructionRepo.get(userId).then((instruction) => ({ instruction }));
  }

  @Patch('instruction')
  @HttpCode(HttpStatus.OK)
  setInstruction(
    @UserId() userId: string,
    @Body('instruction') instruction: string | undefined,
  ): Promise<{ instruction: string }> {
    const text = typeof instruction === 'string' ? instruction : '';
    return this.instructionRepo.set(userId, text).then((instruction) => ({ instruction }));
  }

  }
