import { GoogleGenAI } from '@google/genai';
import type { LLMProvider } from '../types.js';

const DEFAULT_MODEL = 'gemini-2.0-flash';
// free tier: margem conservadora de requests por minuto
const MIN_INTERVAL_MS = 6500;

export class GeminiProvider implements LLMProvider {
  readonly name = 'gemini';
  private client: GoogleGenAI;
  private model: string;
  private lastRequestAt = 0;

  constructor(apiKey: string, model: string = DEFAULT_MODEL) {
    this.client = new GoogleGenAI({ apiKey });
    this.model = model;
  }

  countTokensApprox(text: string): number {
    return Math.ceil(text.length / 4);
  }

  async generate(prompt: string, opts?: { system?: string }): Promise<string> {
    await this.throttle();
    let attempt = 0;
    for (;;) {
      try {
        const res = await this.client.models.generateContent({
          model: this.model,
          contents: prompt,
          config: opts?.system ? { systemInstruction: opts.system } : undefined,
        });
        return res.text ?? '';
      } catch (error) {
        attempt++;
        const msg = error instanceof Error ? error.message : String(error);
        const retryable = /429|RESOURCE_EXHAUSTED|503|UNAVAILABLE/i.test(msg);
        if (!retryable || attempt >= 4) {
          throw new Error(`Falha na chamada ao Gemini (tentativa ${attempt}): ${msg}`);
        }
        await sleep(15_000 * attempt);
      }
    }
  }

  private async throttle(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed < MIN_INTERVAL_MS) await sleep(MIN_INTERVAL_MS - elapsed);
    this.lastRequestAt = Date.now();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
