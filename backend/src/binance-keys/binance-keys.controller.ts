import { Body, Controller, Delete, Get, Put, UsePipes, ValidationPipe } from '@nestjs/common';
import { BinanceKeysService } from './binance-keys.service';
import { UserId } from '../common/auth/user-id.decorator';
import { AddBinanceKeysDto } from './dto/add-binance-keys.dto';

@Controller('binance-keys')
export class BinanceKeysController {
  constructor(private readonly service: BinanceKeysService) {}

  @Get()
  getStatus(@UserId() userId: string) {
    return this.service.getStatus(userId);
  }

  @Put()
  @UsePipes(new ValidationPipe({ whitelist: true }))
  addOrUpdate(@Body() dto: AddBinanceKeysDto, @UserId() userId: string) {
    return this.service.addOrUpdate(userId, dto.apiKey.trim(), dto.apiSecret.trim());
  }

  @Delete()
  remove(@UserId() userId: string) {
    return this.service.remove(userId);
  }
}
