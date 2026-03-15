import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { TradingMode } from '../common/types/enums';
import { PositionsService } from './positions.service';
import { CreatePositionDto } from './dto/create-position.dto';
import { UserId } from '../common/auth/user-id.decorator';

@Controller('positions')
export class PositionsController {
  constructor(private readonly service: PositionsService) {}

  @Get()
  findAll(@UserId() userId: string) {
    return this.service.findAll(userId);
  }

  @Get(':id')
  findById(@Param('id') id: string, @UserId() userId: string) {
    return this.service.findById(id, userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreatePositionDto, @UserId() userId: string) {
    return this.service.create(dto, userId);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  activate(@Param('id') id: string, @UserId() userId: string) {
    return this.service.activate(id, userId);
  }

  @Post(':id/reset-pnl')
  @HttpCode(HttpStatus.OK)
  resetPnl(@Param('id') id: string, @UserId() userId: string) {
    return this.service.resetPnl(id, userId);
  }

  @Patch(':id/amount')
  updateAmount(
    @Param('id') id: string,
    @Body('amount') amount: number,
    @UserId() userId: string,
  ) {
    return this.service.updateAmount(id, amount, userId);
  }

  @Patch(':id/instruction')
  updateInstruction(
    @Param('id') id: string,
    @Body('instruction') instruction: string,
    @UserId() userId: string,
  ) {
    return this.service.updateInstruction(id, instruction ?? '', userId);
  }

  @Patch(':id/mode')
  switchMode(
    @Param('id') id: string,
    @Body('mode') mode: TradingMode,
    @UserId() userId: string,
  ) {
    return this.service.switchMode(id, mode, userId);
  }

  @Post(':id/stop')
  @HttpCode(HttpStatus.OK)
  stop(@Param('id') id: string, @UserId() userId: string) {
    return this.service.stop(id, userId);
  }

  @Post(':id/pause')
  @HttpCode(HttpStatus.OK)
  pause(@Param('id') id: string, @UserId() userId: string) {
    return this.service.pause(id, userId);
  }

  @Post(':id/resume')
  @HttpCode(HttpStatus.OK)
  resume(@Param('id') id: string, @UserId() userId: string) {
    return this.service.resume(id, userId);
  }

  /** @deprecated use resume */
  @Post(':id/reopen')
  @HttpCode(HttpStatus.OK)
  reopen(@Param('id') id: string, @UserId() userId: string) {
    return this.service.resume(id, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @Param('id') id: string,
    @Query('wipeHistory') wipeHistory: string,
    @UserId() userId: string,
  ) {
    return this.service.delete(id, userId, wipeHistory === 'true');
  }
}
