import path from 'node:path';
import type { GenerateOptions, LLMProvider, Skeleton } from './types.js';
import { scanRepo } from './scan/scanner.js';
import { analyzeGitHistory } from './git/history.js';
import { buildSkeleton } from './static/skeleton.js';
import { estimateRequests, summarize } from './summarize/summarizer.js';
import { renderModuleGraph } from './diagrams/structural.js';
import { assembleDocs, writeMarkdownFiles } from './pdf/assemble.js';
import { renderPdf } from './pdf/render.js';

export * from './types.js';
export { createProvider, type ProviderConfig } from './llm/index.js';
export { estimateRequests };

export interface PreparedRepo {
  skeleton: Skeleton;
  estimatedRequests: number;
}

/** Fase 1 — análise local (sem LLM): scan + git + esqueleto */
export async function prepare(rootDir: string, onProgress?: (msg: string) => void): Promise<PreparedRepo> {
  onProgress?.('escaneando repositório');
  const scan = await scanRepo(rootDir);
  if (scan.files.filter((f) => f.language).length === 0) {
    throw new Error('Nenhum arquivo de código reconhecido no diretório informado.');
  }

  onProgress?.('analisando histórico Git');
  const git = await analyzeGitHistory(rootDir);
  if (git.repoName) scan.name = git.repoName;

  onProgress?.('montando esqueleto (análise estática)');
  const skeleton = await buildSkeleton(scan, git, onProgress);

  return { skeleton, estimatedRequests: estimateRequests(skeleton) };
}

/** Fase 2 — geração (LLM + diagramas + markdown + PDF) */
export async function generate(
  prepared: PreparedRepo,
  provider: LLMProvider,
  opts: GenerateOptions,
): Promise<{ pdfPath: string; docsDir: string }> {
  const { skeleton } = prepared;
  const git = await analyzeGitHistory(skeleton.scan.rootDir);

  const bundle = await summarize(skeleton, git, provider, opts.lang, opts.onProgress);

  opts.onProgress?.('gerando grafo de módulos');
  const moduleGraph = await renderModuleGraph(skeleton);

  const docs = assembleDocs(skeleton, { ...bundle, diagrams: { 'module-graph': moduleGraph } });
  await writeMarkdownFiles(opts.outDir, docs);

  const pdfPath = path.join(opts.outDir, `${skeleton.scan.name}-docs.pdf`);
  await renderPdf(docs.fullMarkdown, { 'module-graph': moduleGraph }, pdfPath, opts.onProgress);

  return { pdfPath, docsDir: path.join(opts.outDir, 'docs') };
}
