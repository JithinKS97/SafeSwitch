import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { EncryptionService } from '../common/crypto/encryption.service';

function maskKey(key: string): string {
  if (key.length <= 4) return '****';
  return `...${key.slice(-4)}`;
}

@Injectable()
export class AiKeysService {
  private readonly logger = new Logger(AiKeysService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async addOrUpdate(userId: string, apiKey: string, model: string): Promise<{ hasKeys: true; apiKeyMasked: string; model: string }> {
    // Strip any non-ASCII characters (e.g. smart quotes, em dashes from copy-paste)
    const sanitized = apiKey.replace(/[^\x20-\x7E]/g, '');
    if (!sanitized) throw new Error('API key contains only invalid characters');
    apiKey = sanitized;
    const apiKeyMasked = maskKey(apiKey);
    const apiKeyEncrypted = this.encryption.encrypt(apiKey);

    await this.prisma.userAiKey.upsert({
      where: { userId },
      create: { userId, apiKey: apiKeyEncrypted, apiKeyMasked, model },
      update: { apiKey: apiKeyEncrypted, apiKeyMasked, model, updatedAt: new Date() },
    });

    this.logger.log(`AI keys updated for user ${userId}`);
    return { hasKeys: true, apiKeyMasked, model };
  }

  async remove(userId: string): Promise<void> {
    await this.prisma.userAiKey.deleteMany({ where: { userId } });
  }

  async getStatus(userId: string): Promise<{ hasKeys: boolean; apiKeyMasked?: string; model?: string }> {
    const row = await this.prisma.userAiKey.findUnique({
      where: { userId },
      select: { apiKeyMasked: true, model: true },
    });
    if (!row) return { hasKeys: false };
    return { hasKeys: true, apiKeyMasked: row.apiKeyMasked, model: row.model };
  }

  async getDecryptedKey(userId: string): Promise<{ apiKey: string; model: string } | null> {
    const row = await this.prisma.userAiKey.findUnique({ where: { userId } });
    if (!row) return null;
    try {
      const raw = this.encryption.decrypt(row.apiKey);
      const apiKey = raw.replace(/[^\x20-\x7E]/g, '').trim();
      if (!apiKey) return null;
      return { apiKey, model: row.model };
    } catch {
      return null;
    }
  }
}
