import { Body, Controller, Delete, Get, Put } from '@nestjs/common';
import { AiKeysService } from './ai-keys.service';
import { UserId } from '../common/auth/user-id.decorator';

@Controller('ai-keys')
export class AiKeysController {
  constructor(private readonly service: AiKeysService) {}

  @Get()
  getStatus(@UserId() userId: string) {
    return this.service.getStatus(userId);
  }

  @Put()
  addOrUpdate(
    @Body('apiKey') apiKey: string,
    @Body('model') model: string,
    @UserId() userId: string,
  ) {
    return this.service.addOrUpdate(userId, apiKey.trim(), (model ?? 'openai/gpt-4o-mini').trim());
  }

  @Delete()
  remove(@UserId() userId: string) {
    return this.service.remove(userId);
  }
}
