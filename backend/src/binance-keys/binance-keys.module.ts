import { Module } from '@nestjs/common';
import { BinanceKeysController } from './binance-keys.controller';
import { BinanceKeysService } from './binance-keys.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { EncryptionService } from '../common/crypto/encryption.service';

@Module({
  imports: [PrismaModule],
  controllers: [BinanceKeysController],
  providers: [BinanceKeysService, EncryptionService],
  exports: [BinanceKeysService],
})
export class BinanceKeysModule {}
