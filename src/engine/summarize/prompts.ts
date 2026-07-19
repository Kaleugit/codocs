import type { GitInsights, ModuleInfo, Skeleton } from '../types.js';

const LANG_NAMES: Record<string, string> = {
  'pt-BR': 'português brasileiro',
  pt: 'português',
  en: 'English',
  es: 'español',
};

export function systemPrompt(lang: string): string {
  const langName = LANG_NAMES[lang] ?? lang;
  return [
    `Você é um redator técnico gerando documentação de software. Escreva em ${langName}.`,
    'REGRA INEGOCIÁVEL: descreva APENAS o que está nos fatos fornecidos (estrutura, símbolos, imports, trechos de código).',
    'NUNCA invente módulos, dependências, tecnologias ou comportamentos que não estejam evidenciados nos dados.',
    'Se algo não estiver claro nos dados, omita — omissão é aceitável, invenção não.',
    'Responda em Markdown puro, sem cercas de código envolvendo a resposta inteira.',
  ].join('\n');
}

export function skeletonDigest(skeleton: Skeleton, git: GitInsights): string {
  const { scan, modules, entryPoints } = skeleton;
  const langs = Object.entries(scan.languages)
    .sort((a, b) => b[1] - a[1])
    .map(([l, n]) => `${l} (${n} arquivos)`)
    .join(', ');

  const moduleLines = modules.map((m) => {
    const deps = m.dependsOn.length ? ` → depende de: ${m.dependsOn.join(', ')}` : '';
    const hot = m.hotspotScore > 0.5 ? ' [HOTSPOT]' : '';
    return `- ${m.id} (${m.files.length} arquivos)${deps}${hot}`;
  });

  return [
    `# Repositório: ${scan.name}`,
    `Linguagens: ${langs}`,
    `Entry points detectados: ${entryPoints.join(', ') || 'nenhum detectado'}`,
    `Commits: ${git.totalCommits} (${git.firstCommitDate ?? '?'} até ${git.lastCommitDate ?? '?'})`,
    '',
    '## Módulos (diretórios) e dependências:',
    ...moduleLines,
    '',
    '## Mensagens de commit recentes (contexto de evolução):',
    ...git.recentSubjects.slice(0, 20).map((s) => `- ${s}`),
  ].join('\n');
}

export function moduleDigest(mod: ModuleInfo, codeExcerpts: Record<string, string>): string {
  const parts: string[] = [`# Módulo: ${mod.id}`];
  if (mod.dependsOn.length) parts.push(`Depende de: ${mod.dependsOn.join(', ')}`);
  for (const f of mod.files) {
    parts.push(`\n## ${f.path} (${f.language})`);
    if (f.imports.length) parts.push(`Imports: ${f.imports.slice(0, 20).join(', ')}`);
    if (f.symbols.length) {
      parts.push('Símbolos:');
      for (const s of f.symbols.slice(0, 30)) {
        parts.push(`- [${s.kind}${s.exported ? ', exportado' : ''}] ${s.signature}`);
      }
    }
    const excerpt = codeExcerpts[f.path];
    if (excerpt) parts.push('Trecho de código:\n```\n' + excerpt + '\n```');
  }
  return parts.join('\n');
}

export function moduleSummaryPrompt(digest: string): string {
  return [
    'Com base APENAS nos fatos abaixo sobre um módulo de código, escreva:',
    '1. Uma linha começando com "PROPÓSITO:" resumindo o papel do módulo em uma frase.',
    '2. Uma seção em Markdown (2-4 parágrafos) explicando o que o módulo faz, seus arquivos principais e como se relaciona com suas dependências. Inclua, se relevante, o trecho de código mais representativo em um bloco de código.',
    '',
    digest,
  ].join('\n');
}

export function architecturePrompt(skeletonText: string, moduleSummaries: string): string {
  return [
    'Com base no esqueleto do repositório e nos resumos de módulos abaixo, escreva a seção "Visão Geral da Arquitetura" da documentação:',
    '- Que tipo de sistema é este e qual sua stack.',
    '- Como os módulos se organizam em camadas ou responsabilidades.',
    '- Quais são os entry points e o que acontece a partir deles.',
    'Use apenas os fatos fornecidos. 4-8 parágrafos em Markdown, com subtítulos.',
    '',
    skeletonText,
    '',
    '# Resumos dos módulos:',
    moduleSummaries,
  ].join('\n');
}

export function flowsPrompt(skeletonText: string, moduleSummaries: string): string {
  return [
    'Com base nos dados abaixo, identifique de 2 a 4 fluxos principais do sistema (ex: "o que acontece quando o usuário executa o comando X").',
    'Para CADA fluxo, produza:',
    '1. Um subtítulo "## Fluxo: {nome}"',
    '2. Um parágrafo descrevendo o fluxo passo a passo.',
    '3. Um diagrama Mermaid do tipo flowchart (```mermaid ... ```) representando o fluxo. Use APENAS nós que correspondam a módulos/arquivos reais dos dados.',
    'Sintaxe Mermaid: use "flowchart TD", ids simples sem acentos, rótulos entre colchetes.',
    '',
    skeletonText,
    '',
    '# Resumos dos módulos:',
    moduleSummaries,
  ].join('\n');
}

export function eli5Prompt(skeletonText: string, architecture: string): string {
  return [
    'Escreva a seção "ELI5" da documentação deste sistema:',
    '- 2-3 parágrafos em linguagem simples e direta, sem jargão e sem metáforas, explicando o que o sistema faz, por que existe e como as partes se conectam.',
    '- Termine com uma linha "Em uma frase: ..." resumindo tudo.',
    'Baseie-se apenas nos fatos abaixo. Não inclua título — comece direto no primeiro parágrafo.',
    '',
    skeletonText,
    '',
    architecture,
  ].join('\n');
}

export function onboardingPrompt(skeletonText: string, moduleSummaries: string, readme: string | null): string {
  return [
    'Escreva a seção "Guia de Onboarding" para um novo membro da equipe deste repositório:',
    '- "Por onde começar a ler": ordem sugerida de arquivos/módulos, partindo dos entry points.',
    '- "Setup do ambiente": APENAS se o README ou scripts fornecidos indicarem como — não invente comandos.',
    '- "Glossário": termos do domínio que aparecem nos nomes de símbolos/módulos, com definição breve.',
    'Markdown com subtítulos.',
    '',
    skeletonText,
    '',
    readme ? `# README do projeto:\n${readme.slice(0, 4000)}` : '(sem README)',
    '',
    '# Resumos dos módulos:',
    moduleSummaries,
  ].join('\n');
}
