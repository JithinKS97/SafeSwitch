import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { EncryptionService } from '../common/crypto/encryption.service';
import { BadRequestException } from '@nestjs/common';

function maskKey(key: string): string {
  if (key.length <= 4) return '****';
  return `...${key.slice(-4)}`;
}

@Injectable()
export class BinanceKeysService {
  private readonly logger = new Logger(BinanceKeysService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async addOrUpdate(userId: string, apiKey: string, apiSecret: string): Promise<{ hasKeys: true; apiKeyMasked: string }> {
    const apiKeyMasked = maskKey(apiKey);
    const apiSecretEncrypted = this.encryption.encrypt(apiSecret);

    await this.prisma.userBinanceKey.upsert({
      where: { userId },
      create: { userId, apiKey, apiSecretEncrypted, apiKeyMasked },
      update: { apiKey, apiSecretEncrypted, apiKeyMasked, updatedAt: new Date() },
    });

    this.logger.log(`Binance keys updated for user ${userId}`);
    return { hasKeys: true, apiKeyMasked };
  }

  async remove(userId: string): Promise<void> {
    await this.prisma.userBinanceKey.deleteMany({ where: { userId } });
    this.logger.log(`Binance keys removed for user ${userId}`);
  }

  async getStatus(userId: string): Promise<{ hasKeys: boolean; apiKeyMasked?: string }> {
    const row = await this.prisma.userBinanceKey.findUnique({
      where: { userId },
      select: { apiKeyMasked: true },
    });
    if (!row) return { hasKeys: false };
    return { hasKeys: true, apiKeyMasked: row.apiKeyMasked };
  }

  async getDecryptedKeys(userId: string): Promise<{ apiKey: string; apiSecret: string } | null> {
    const row = await this.prisma.userBinanceKey.findUnique({
      where: { userId },
    });
    if (!row) return null;
    try {
      const apiSecret = this.encryption.decrypt(row.apiSecretEncrypted);
      return { apiKey: row.apiKey, apiSecret };
    } catch (err) {
      this.logger.error(`Failed to decrypt Binance keys for user ${userId}: ${(err as Error).message}`);
      return null;
    }
  }
}
