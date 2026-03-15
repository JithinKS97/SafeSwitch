import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { PAIR_KNOWLEDGE_ENGINE } from './pair-knowledge.interface';
import { CONFIDENCE_CALCULATOR } from './confidence-calculator.interface';
import { KNOWLEDGE_SUMMARIZER } from './knowledge-summarizer.interface';
import { PairKnowledgeEngineService } from './pair-knowledge.service';
import { DefaultConfidenceCalculatorService } from './default-confidence-calculator.service';
import { DefaultKnowledgeSummarizerService } from './default-knowledge-summarizer.service';

/**
 * Pair Knowledge — proprietary module.
 *
 * Handles confidence + knowledge building per pair. Swap implementations to improve.
 */
@Module({
  imports: [PrismaModule, AiModule],
  providers: [
    {
      provide: CONFIDENCE_CALCULATOR,
      useClass: DefaultConfidenceCalculatorService,
    },
    {
      provide: KNOWLEDGE_SUMMARIZER,
      useClass: DefaultKnowledgeSummarizerService,
    },
    {
      provide: PAIR_KNOWLEDGE_ENGINE,
      useClass: PairKnowledgeEngineService,
    },
  ],
  exports: [PAIR_KNOWLEDGE_ENGINE],
})
export class PairKnowledgeModule {}
