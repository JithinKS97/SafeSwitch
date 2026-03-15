import { Injectable, Logger } from '@nestjs/common';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  async complete(prompt: string): Promise<string> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey || apiKey === 'sk-or-your-key-here') {
      throw new Error('OPENROUTER_API_KEY is not configured');
    }

    const model = process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini';
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

    const data: { choices: Array<{ message: { content: string } }> } =
      await res.json();

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('OpenRouter returned an empty response');
    }

    return content;
  }
}
