import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { SuggestionsService } from './suggestions.service';
import { GetSuggestionsDto } from './dto/get-suggestions.dto';
import type { Suggestion } from './suggestions.types';

@Controller('suggestions')
export class SuggestionsController {
  constructor(private readonly service: SuggestionsService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  getSuggestions(@Body() dto: GetSuggestionsDto): Suggestion[] {
    return this.service.getSuggestions(dto.riskAppetite);
  }
}
