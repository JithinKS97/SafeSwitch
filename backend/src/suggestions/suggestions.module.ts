import { Module } from '@nestjs/common';
import { SuggestionsController } from './suggestions.controller';
import { SuggestionsService } from './suggestions.service';
import { SuggestionsRepository } from './suggestions.repository';
import { MarketDataModule } from '../market-data/market-data.module';
import { SuggestionEngineModule } from '../suggestion-engine/suggestion-engine.module';

@Module({
  imports: [MarketDataModule, SuggestionEngineModule],
  controllers: [SuggestionsController],
  providers: [SuggestionsService, SuggestionsRepository],
})
export class SuggestionsModule {}
