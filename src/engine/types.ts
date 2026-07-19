export interface FileEntry {
  /** Caminho relativo à raiz do repo, com "/" como separador */
  path: string;
  language: string | null;
  sizeBytes: number;
  lines: number;
}

export interface RepoScan {
  rootDir: string;
  name: string;
  files: FileEntry[];
  languages: Record<string, number>; // linguagem -> nº de arquivos
  readme: string | null;
}

export interface SymbolInfo {
  name: string;
  kind: 'function' | 'class' | 'method' | 'interface' | 'type' | 'const';
  signature: string;
  startLine: number;
  endLine: number;
  exported: boolean;
}

export interface FileAnalysis {
  path: string;
  language: string;
  imports: string[]; // caminhos/especificadores importados
  symbols: SymbolInfo[];
}

export interface ModuleInfo {
  /** Diretório que agrupa os arquivos, ex: "src/engine/scan" */
  id: string;
  files: FileAnalysis[];
  /** ids de módulos dos quais este depende */
  dependsOn: string[];
  hotspotScore: number;
}

export interface Skeleton {
  scan: RepoScan;
  modules: ModuleInfo[];
  entryPoints: string[];
  commitHash: string | null;
}

export interface Hotspot {
  path: string;
  commits: number;
  score: number; // normalizado 0..1
}

export interface GitInsights {
  /** Nome do repositório derivado do remote origin, se existir */
  repoName: string | null;
  commitHash: string | null;
  totalCommits: number;
  hotspots: Hotspot[];
  recentSubjects: string[]; // mensagens de commit recentes (contexto de "porquês")
  firstCommitDate: string | null;
  lastCommitDate: string | null;
}

export interface LLMProvider {
  readonly name: string;
  generate(prompt: string, opts?: { system?: string }): Promise<string>;
  /** Nº estimado de requests que o pipeline fará — usado na estimativa pré-execução */
  countTokensApprox(text: string): number;
}

export interface ModuleSummary {
  moduleId: string;
  purpose: string;
  details: string; // markdown
}

export interface DocBundle {
  eli5: string;
  architecture: string;
  flows: string;
  modules: ModuleSummary[];
  onboarding: string;
  /** SVGs prontos, por nome lógico */
  diagrams: Record<string, string>;
}

export interface GenerateOptions {
  lang: string; // ex: "pt-BR", "en"
  outDir: string;
  onProgress?: (msg: string) => void;
}
