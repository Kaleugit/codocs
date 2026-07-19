import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface CliConfig {
  apiKey?: string;
  provider?: string;
  model?: string;
  lang?: string;
}

const CONFIG_DIR = path.join(os.homedir(), '.codocs');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

export async function loadConfig(): Promise<CliConfig> {
  try {
    return JSON.parse(await fs.readFile(CONFIG_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

export async function saveConfig(patch: Partial<CliConfig>): Promise<void> {
  const current = await loadConfig();
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(CONFIG_PATH, JSON.stringify({ ...current, ...patch }, null, 2), 'utf-8');
}

export function resolveApiKey(config: CliConfig): string | null {
  return process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? config.apiKey ?? null;
}
