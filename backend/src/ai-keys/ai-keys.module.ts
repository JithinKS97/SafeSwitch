import { Module } from '@nestjs/common';
import { AiKeysController } from './ai-keys.controller';
import { AiKeysService } from './ai-keys.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { EncryptionService } from '../common/crypto/encryption.service';

@Module({
  imports: [PrismaModule],
  controllers: [AiKeysController],
  providers: [AiKeysService, EncryptionService],
  exports: [AiKeysService],
})
export class AiKeysModule {}
