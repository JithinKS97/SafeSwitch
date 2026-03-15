import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { SuggestionsService } from './suggestions.service';
import { GetSuggestionsDto } from './dto/get-suggestions.dto';
import { UserId } from '../common/auth/user-id.decorator';
import type { SnapshotSummary, SuggestionsResponse } from './suggestions.types';

@Controller('suggestions')
export class SuggestionsController {
  constructor(private readonly service: SuggestionsService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  getSuggestions(
    @Body() dto: GetSuggestionsDto,
    @UserId() userId: string,
  ): Promise<SuggestionsResponse> {
    return this.service.getSuggestions(dto.riskPct, userId);
  }

  @Get()
  getHistory(@UserId() userId: string): Promise<SnapshotSummary[]> {
    return this.service.getHistory(userId);
  }

  @Get(':id')
  async getById(
    @Param('id') id: string,
    @UserId() userId: string,
  ): Promise<SuggestionsResponse> {
    const result = await this.service.getById(id, userId);
    if (!result) throw new NotFoundException(`Snapshot ${id} not found`);
    return result;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id') id: string, @UserId() userId: string): Promise<void> {
    return this.service.delete(id, userId);
  }
}
