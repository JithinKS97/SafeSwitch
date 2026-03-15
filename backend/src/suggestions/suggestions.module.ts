import { Module } from '@nestjs/common';
import { SuggestionsController } from './suggestions.controller';
import { SuggestionsService } from './suggestions.service';
import { SuggestionsRepository } from './suggestions.repository';
import { MarketDataModule } from '../market-data/market-data.module';
import { SuggestionEngineModule } from '../suggestion-engine/suggestion-engine.module';
import { BinanceModule } from '../binance/binance.module';
import { IndicatorsModule } from '../indicators/indicators.module';
import { SignalsModule } from '../signals/signals.module';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [MarketDataModule, SuggestionEngineModule, BinanceModule, IndicatorsModule, SignalsModule, PrismaModule],
  controllers: [SuggestionsController],
  providers: [SuggestionsService, SuggestionsRepository],
})
export class SuggestionsModule {}
