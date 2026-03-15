import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LEN = 32;
const IV_LEN = 16;
const SALT_LEN = 32;
const TAG_LEN = 16;

@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor() {
    const secret = process.env.ENCRYPTION_KEY || 'dev-only-change-in-production-min-32-chars';
    if (secret.length < 32 && process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_KEY must be set in production (e.g. openssl rand -hex 32)');
    }
    this.key = scryptSync(secret, 'safeswitch-salt', KEY_LEN);
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  decrypt(ciphertext: string): string {
    const buf = Buffer.from(ciphertext, 'base64');
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const encrypted = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final('utf8');
  }
}
