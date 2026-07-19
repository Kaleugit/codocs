import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { DocBundle, Skeleton } from '../types.js';

export interface AssembledDocs {
  /** Markdown por arquivo lógico — a semente da documentação viva */
  markdownFiles: Record<string, string>;
  /** Documento único concatenado para renderização */
  fullMarkdown: string;
}

export function assembleDocs(skeleton: Skeleton, bundle: DocBundle): AssembledDocs {
  const { scan } = skeleton;
  const date = new Date().toISOString().slice(0, 10);
  const hash = skeleton.commitHash ? skeleton.commitHash.slice(0, 10) : 'sem-git';

  const cover = [
    '<!--codocs-logo-->',
    '',
    `# ${scan.name}`,
    '',
    `**Documentação técnica gerada por codocs**`,
    '',
    `- Data do snapshot: ${date}`,
    `- Commit analisado: \`${hash}\``,
    `- Arquivos analisados: ${scan.files.length}`,
    '',
  ].join('\n');

  const modulesMd = bundle.modules
    .map((m) => `## ${m.moduleId}\n\n${m.purpose ? `> ${m.purpose}\n\n` : ''}${m.details}`)
    .join('\n\n---\n\n');

  const stats = buildStats(skeleton);

  const markdownFiles: Record<string, string> = {
    'eli5.md': `# ELI5\n\n${stripLeadingHeading(bundle.eli5, 'eli5')}`,
    'onboarding.md': `# Guia de Onboarding\n\n${stripLeadingHeading(bundle.onboarding, 'onboarding')}`,
    'arquitetura.md': `# Visão Geral da Arquitetura\n\n${stripLeadingHeading(bundle.architecture, 'arquitetura')}\n\n## Grafo de módulos\n\n<!--diagram:module-graph-->`,
    'fluxos.md': `# Fluxos Principais\n\n${stripLeadingHeading(bundle.flows, 'fluxos')}`,
    'modulos.md': `# Módulos\n\n${modulesMd}`,
    'apendice.md': `# Apêndice\n\n${stats}`,
  };

  const fullMarkdown = [
    cover,
    markdownFiles['eli5.md'],
    markdownFiles['onboarding.md'],
    markdownFiles['arquitetura.md'],
    markdownFiles['fluxos.md'],
    markdownFiles['modulos.md'],
    markdownFiles['apendice.md'],
  ].join('\n\n<div class="page-break"></div>\n\n');

  return { markdownFiles, fullMarkdown };
}

const SECTION_TITLE_HINTS: Record<string, RegExp> = {
  eli5: /eli.?5|cinco anos|five/i,
  onboarding: /onboarding|guia/i,
  arquitetura: /arquitetura|architecture|vis[aã]o/i,
  fluxos: /fluxos|flows/i,
};

/** Remove título duplicado no início da resposta do LLM (a seção já tem título fixo) */
function stripLeadingHeading(content: string, section: string): string {
  const trimmed = content.trim();
  const match = trimmed.match(/^#{1,3}\s+(.+)\n+/);
  if (!match) return trimmed;
  const hint = SECTION_TITLE_HINTS[section];
  if (hint && !hint.test(match[1])) return trimmed;
  return trimmed.slice(match[0].length).trim();
}

function buildStats(skeleton: Skeleton): string {
  const { scan, modules } = skeleton;
  const langs = Object.entries(scan.languages)
    .sort((a, b) => b[1] - a[1])
    .map(([l, n]) => `| ${l} | ${n} |`)
    .join('\n');

  const hot = modules
    .filter((m) => m.hotspotScore > 0)
    .slice(0, 15)
    .map((m) => `| ${m.id} | ${(m.hotspotScore * 100).toFixed(0)}% |`)
    .join('\n');

  return [
    '## Linguagens',
    '',
    '| Linguagem | Arquivos |',
    '|---|---|',
    langs,
    '',
    '## Hotspots (módulos com maior frequência de mudança)',
    '',
    '| Módulo | Intensidade |',
    '|---|---|',
    hot || '| (sem histórico Git) | — |',
  ].join('\n');
}

export async function writeMarkdownFiles(outDir: string, docs: AssembledDocs): Promise<void> {
  const docsDir = path.join(outDir, 'docs');
  await fs.mkdir(docsDir, { recursive: true });
  for (const [name, content] of Object.entries(docs.markdownFiles)) {
    await fs.writeFile(path.join(docsDir, name), content, 'utf-8');
  }
}
