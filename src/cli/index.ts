#!/usr/bin/env node
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import readline from 'node:readline/promises';
import { Command } from 'commander';
import ora from 'ora';
import { simpleGit } from 'simple-git';
import { createProvider, generate, prepare } from '../engine/index.js';
import { loadConfig, resolveApiKey, saveConfig } from './config.js';

const program = new Command();

program
  .name('codocs')
  .description('Gera documentação técnica automaticamente a partir do código e do histórico Git')
  .version('0.1.0');

program
  .command('config')
  .description('Define configurações (api-key, provider, model, lang)')
  .argument('<key>', 'api-key | provider | model | lang')
  .argument('<value>')
  .action(async (key: string, value: string) => {
    const map: Record<string, string> = { 'api-key': 'apiKey', provider: 'provider', model: 'model', lang: 'lang' };
    const field = map[key];
    if (!field) {
      console.error(`Chave desconhecida: ${key}. Use: api-key, provider, model, lang`);
      process.exit(1);
    }
    await saveConfig({ [field]: value });
    console.log(`✔ ${key} salvo em ~/.codocs/config.json`);
  });

program
  .command('generate', { isDefault: true })
  .description('Gera a documentação de um repositório (pasta local ou URL git)')
  .argument('[repo]', 'caminho da pasta ou URL do repositório', '.')
  .option('--lang <lang>', 'idioma da documentação (ex: pt-BR, en). Default: auto-detect')
  .option('--out <dir>', 'diretório de saída', './codocs-output')
  .option('-y, --yes', 'pula a confirmação de estimativa', false)
  .action(async (repo: string, opts: { lang?: string; out: string; yes: boolean }) => {
    const config = await loadConfig();
    const apiKey = resolveApiKey(config);
    if (!apiKey) {
      console.error(
        'API key não configurada.\n' +
          '  codocs config api-key SUA_CHAVE\n' +
          'ou defina a variável de ambiente GEMINI_API_KEY.\n' +
          'Chave gratuita: https://aistudio.google.com/apikey',
      );
      process.exit(1);
    }

    const spinner = ora();
    let rootDir = repo;
    let tempDir: string | null = null;

    try {
      if (/^(https?:\/\/|git@)/.test(repo)) {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codocs-'));
        spinner.start(`clonando ${repo}`);
        // core.longpaths evita falha no Windows com nomes de arquivo muito longos
        await simpleGit().clone(repo, tempDir, ['--depth', '500', '-c', 'core.longpaths=true']);
        spinner.succeed('repositório clonado');
        rootDir = tempDir;
      }

      spinner.start('analisando repositório');
      const prepared = await prepare(rootDir, (msg) => (spinner.text = msg));
      const { skeleton } = prepared;
      spinner.succeed(
        `análise concluída: ${skeleton.scan.files.length} arquivos, ` +
          `${skeleton.modules.length} módulos, ` +
          `${Object.keys(skeleton.scan.languages).join(', ') || 'sem código reconhecido'}`,
      );

      const estMinutes = Math.ceil((prepared.estimatedRequests * 7) / 60);
      console.log(
        `\nEstimativa: ~${prepared.estimatedRequests} requests ao Gemini (free tier), ~${estMinutes} min.`,
      );
      if (!opts.yes) {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const answer = await rl.question('Continuar? [s/N] ');
        rl.close();
        if (!/^s(im)?$/i.test(answer.trim())) {
          console.log('Cancelado.');
          process.exit(0);
        }
      }

      const lang = opts.lang ?? config.lang ?? detectLang(skeleton.scan.readme);
      const provider = createProvider({
        provider: config.provider ?? 'gemini',
        apiKey,
        model: config.model,
      });

      spinner.start('gerando documentação');
      const outDir = path.resolve(opts.out);
      const result = await generate(prepared, provider, {
        lang,
        outDir,
        onProgress: (msg) => (spinner.text = msg),
      });

      spinner.succeed('documentação gerada');
      console.log(`\n  PDF:      ${result.pdfPath}`);
      console.log(`  Markdown: ${result.docsDir}`);
    } catch (error) {
      spinner.fail(error instanceof Error ? error.message : String(error));
      process.exit(1);
    } finally {
      if (tempDir) await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  });

function detectLang(readme: string | null): string {
  if (!readme) return 'en';
  const ptSignals = /\b(uma|não|são|função|configuração|para|como usar|instalação|exemplo)\b/gi;
  const matches = readme.match(ptSignals)?.length ?? 0;
  return matches >= 5 ? 'pt-BR' : 'en';
}

program.parseAsync();
