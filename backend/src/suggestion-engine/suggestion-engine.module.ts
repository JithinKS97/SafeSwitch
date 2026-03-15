import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { SUGGESTION_ENGINE } from './suggestion-engine.interface';
import { DefaultSuggestionEngineService } from './default-suggestion-engine.service';

/**
 * Suggestion Engine — proprietary module.
 *
 * Provides trading pair suggestions. Swap the implementation by changing
 * the provider binding below.
 */
@Module({
  imports: [AiModule],
  providers: [
    {
      provide: SUGGESTION_ENGINE,
      useClass: DefaultSuggestionEngineService,
    },
  ],
  exports: [SUGGESTION_ENGINE],
})
export class SuggestionEngineModule {}
