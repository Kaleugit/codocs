import path from 'node:path';
import type { FileAnalysis, GitInsights, ModuleInfo, RepoScan, Skeleton } from '../types.js';
import { readRepoFile } from '../scan/scanner.js';
import { analyzeFile, resolveImportToPath } from './parser.js';

const ENTRY_POINT_HINTS = [
  /^(src\/)?(index|main|app|server|cli)\.(ts|tsx|js|jsx|py|go|rs)$/,
  /^(src\/)?(cli|bin)\/(index|main)\.(ts|js|py)$/,
  /^main\.(py|go|rs)$/,
  /^manage\.py$/,
];

function moduleIdFor(filePath: string): string {
  const dir = path.posix.dirname(filePath);
  return dir === '.' ? '(raiz)' : dir;
}

export async function buildSkeleton(
  scan: RepoScan,
  git: GitInsights,
  onProgress?: (msg: string) => void,
): Promise<Skeleton> {
  const analyses: FileAnalysis[] = [];
  const parseable = scan.files.filter((f) => f.language !== null);

  let done = 0;
  for (const file of parseable) {
    const content = await readRepoFile(scan, file.path).catch(() => null);
    if (content !== null) {
      const analysis = await analyzeFile(file.path, content, file.language!).catch(() => null);
      if (analysis) analyses.push(analysis);
    }
    done++;
    if (done % 50 === 0) onProgress?.(`análise estática: ${done}/${parseable.length} arquivos`);
  }

  const allPaths = new Set(scan.files.map((f) => f.path));
  const byModule = new Map<string, FileAnalysis[]>();
  for (const a of analyses) {
    const id = moduleIdFor(a.path);
    const list = byModule.get(id) ?? [];
    list.push(a);
    byModule.set(id, list);
  }

  const hotspotByPath = new Map(git.hotspots.map((h) => [h.path, h.score]));

  const modules: ModuleInfo[] = [];
  for (const [id, files] of byModule) {
    const dependsOn = new Set<string>();
    for (const f of files) {
      for (const imp of f.imports) {
        const resolved = resolveImportToPath(f.path, imp, allPaths);
        if (resolved) {
          const target = moduleIdFor(resolved);
          if (target !== id) dependsOn.add(target);
        }
      }
    }
    const scores = files.map((f) => hotspotByPath.get(f.path) ?? 0);
    const hotspotScore = scores.length ? Math.max(...scores) : 0;
    modules.push({ id, files, dependsOn: [...dependsOn].sort(), hotspotScore });
  }
  modules.sort((a, b) => b.hotspotScore - a.hotspotScore || a.id.localeCompare(b.id));

  const entryPoints = scan.files
    .map((f) => f.path)
    .filter((p) => ENTRY_POINT_HINTS.some((re) => re.test(p)));

  return { scan, modules, entryPoints, commitHash: git.commitHash };
}
