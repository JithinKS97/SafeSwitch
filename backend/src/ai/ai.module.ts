import { Module, forwardRef } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiKeysModule } from '../ai-keys/ai-keys.module';

@Module({
  imports: [forwardRef(() => AiKeysModule)],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
