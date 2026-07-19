import type { LLMProvider } from '../types.js';
import { GeminiProvider } from './gemini.js';

export interface ProviderConfig {
  provider: string;
  apiKey: string;
  model?: string;
}

export function createProvider(config: ProviderConfig): LLMProvider {
  switch (config.provider) {
    case 'gemini':
      return new GeminiProvider(config.apiKey, config.model);
    default:
      throw new Error(
        `Provider desconhecido: "${config.provider}". Disponíveis: gemini`,
      );
  }
}
