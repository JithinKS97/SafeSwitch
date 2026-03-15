import { Module } from '@nestjs/common';
import { TradingAgentService } from './trading-agent.service';
import { AgentController } from './agent.controller';
import { PairJournalsController } from './pair-journals.controller';
import { AgentJournalRepository } from './agent-journal.repository';
import { AgentInstructionRepository } from './agent-instruction.repository';
import { PairKnowledgeModule } from '../pair-knowledge/pair-knowledge.module';
import { BinanceModule } from '../binance/binance.module';
import { AiModule } from '../ai/ai.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { PositionsModule } from '../positions/positions.module';
import { ExecutionModule } from '../execution/execution.module';

@Module({
  imports: [BinanceModule, AiModule, PrismaModule, PositionsModule, ExecutionModule, PairKnowledgeModule],
  providers: [TradingAgentService, AgentJournalRepository, AgentInstructionRepository],
  controllers: [AgentController, PairJournalsController],
})
export class TradingAgentModule {}
