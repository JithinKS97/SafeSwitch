import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { AiKeysService } from '../ai-keys/ai-keys.service';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @Inject(forwardRef(() => AiKeysService))
    private readonly aiKeys: AiKeysService,
  ) {}

  async complete(prompt: string, userId?: string): Promise<string> {
    let apiKey: string;
    let model: string;

    if (userId) {
      const userKey = await this.aiKeys.getDecryptedKey(userId);
      if (userKey) {
        apiKey = userKey.apiKey;
        model = userKey.model;
      } else {
        throw new Error('No OpenRouter API key configured. Add your key in Config → AI Model.');
      }
    } else {
      throw new Error('No OpenRouter API key configured. Add your key in Config → AI Model.');
    }

    this.logger.log(`Calling OpenRouter model: ${model}`);

    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://safeswitch.app',
        'X-Title': 'SafeSwitch',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenRouter request failed: ${res.status} — ${err}`);
    }

    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('OpenRouter returned an empty response');

    return content;
  }
}
