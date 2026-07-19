import type {
  DocBundle,
  GitInsights,
  LLMProvider,
  ModuleInfo,
  ModuleSummary,
  Skeleton,
} from '../types.js';
import { readRepoFile } from '../scan/scanner.js';
import {
  architecturePrompt,
  eli5Prompt,
  flowsPrompt,
  moduleDigest,
  moduleSummaryPrompt,
  onboardingPrompt,
  skeletonDigest,
  systemPrompt,
} from './prompts.js';

export const MAX_MODULES_SUMMARIZED = 30;
// orçamento por hotspot: módulos quentes levam mais linhas de código no prompt
const HOT_EXCERPT_LINES = 120;
const COLD_EXCERPT_LINES = 30;

export function estimateRequests(skeleton: Skeleton): number {
  const n = Math.min(skeleton.modules.length, MAX_MODULES_SUMMARIZED);
  return n + 4; // módulos + arquitetura + fluxos + eli5 + onboarding
}

export async function summarize(
  skeleton: Skeleton,
  git: GitInsights,
  provider: LLMProvider,
  lang: string,
  onProgress?: (msg: string) => void,
): Promise<Omit<DocBundle, 'diagrams'>> {
  const system = systemPrompt(lang);
  const skeletonText = skeletonDigest(skeleton, git);

  const toSummarize = skeleton.modules.slice(0, MAX_MODULES_SUMMARIZED);
  const modules: ModuleSummary[] = [];

  for (let i = 0; i < toSummarize.length; i++) {
    const mod = toSummarize[i];
    onProgress?.(`gerando documentação: módulo ${i + 1}/${toSummarize.length} (${mod.id})`);
    const excerpts = await collectExcerpts(skeleton, mod);
    const raw = await provider.generate(moduleSummaryPrompt(moduleDigest(mod, excerpts)), {
      system,
    });
    modules.push(parseModuleSummary(mod.id, raw));
  }

  const summariesText = modules
    .map((m) => `## ${m.moduleId}\n${m.purpose}\n${m.details}`)
    .join('\n\n');

  onProgress?.('gerando visão geral da arquitetura');
  const architecture = await provider.generate(architecturePrompt(skeletonText, summariesText), { system });

  onProgress?.('gerando fluxos principais');
  const flows = await provider.generate(flowsPrompt(skeletonText, summariesText), { system });

  onProgress?.('gerando ELI5');
  const eli5 = await provider.generate(eli5Prompt(skeletonText, architecture), { system });

  onProgress?.('gerando guia de onboarding');
  const onboarding = await provider.generate(
    onboardingPrompt(skeletonText, summariesText, skeleton.scan.readme),
    { system },
  );

  return { eli5, architecture, flows, modules, onboarding };
}

async function collectExcerpts(
  skeleton: Skeleton,
  mod: ModuleInfo,
): Promise<Record<string, string>> {
  const isHot = mod.hotspotScore > 0.5;
  const maxLines = isHot ? HOT_EXCERPT_LINES : COLD_EXCERPT_LINES;
  // no orçamento frio, só o arquivo mais relevante do módulo leva trecho
  const files = isHot ? mod.files.slice(0, 3) : mod.files.slice(0, 1);

  const excerpts: Record<string, string> = {};
  for (const f of files) {
    const content = await readRepoFile(skeleton.scan, f.path).catch(() => null);
    if (content) {
      excerpts[f.path] = content.split('\n').slice(0, maxLines).join('\n');
    }
  }
  return excerpts;
}

function parseModuleSummary(moduleId: string, raw: string): ModuleSummary {
  const match = raw.match(/PROP[OÓ]SITO:\s*(.+)/i);
  const purpose = match?.[1]?.trim() ?? '';
  const details = match ? raw.replace(match[0], '').trim() : raw.trim();
  return { moduleId, purpose, details };
}
