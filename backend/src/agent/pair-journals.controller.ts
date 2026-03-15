import { Controller, Get, Inject, Param } from '@nestjs/common';
import { PAIR_KNOWLEDGE_ENGINE, type PairKnowledgeEngine } from '../pair-knowledge/pair-knowledge.interface';
import { UserId } from '../common/auth/user-id.decorator';

@Controller('pair-journals')
export class PairJournalsController {
  constructor(
    @Inject(PAIR_KNOWLEDGE_ENGINE) private readonly pairKnowledge: PairKnowledgeEngine,
  ) {}

  @Get()
  findAll(@UserId() userId: string) {
    return this.pairKnowledge.findForUser(userId);
  }

  @Get(':pair')
  findByPair(@UserId() userId: string, @Param('pair') pair: string) {
    return this.pairKnowledge.findByPair(userId, decodeURIComponent(pair));
  }
}
