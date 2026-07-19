import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { FileEntry, RepoScan } from '../types.js';
import { detectLanguage, IGNORED_DIRS, MAX_FILE_BYTES } from './languages.js';

export async function scanRepo(rootDir: string): Promise<RepoScan> {
  const absRoot = path.resolve(rootDir);
  const files: FileEntry[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.env.example') {
        if (entry.isDirectory()) continue;
      }
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        await walk(full);
      } else if (entry.isFile()) {
        const stat = await fs.stat(full);
        if (stat.size > MAX_FILE_BYTES) continue;
        const rel = path.relative(absRoot, full).split(path.sep).join('/');
        const language = detectLanguage(rel);
        let lines = 0;
        if (language !== null) {
          const content = await fs.readFile(full, 'utf-8').catch(() => '');
          lines = content.length === 0 ? 0 : content.split('\n').length;
        }
        files.push({ path: rel, language, sizeBytes: stat.size, lines });
      }
    }
  }

  await walk(absRoot);

  const languages: Record<string, number> = {};
  for (const f of files) {
    if (f.language) languages[f.language] = (languages[f.language] ?? 0) + 1;
  }

  const readmeEntry = files.find((f) => /^readme(\.md|\.txt)?$/i.test(f.path));
  const readme = readmeEntry
    ? await fs.readFile(path.join(absRoot, readmeEntry.path), 'utf-8').catch(() => null)
    : null;

  return {
    rootDir: absRoot,
    name: path.basename(absRoot),
    files,
    languages,
    readme,
  };
}

export async function readRepoFile(scan: RepoScan, relPath: string): Promise<string> {
  return fs.readFile(path.join(scan.rootDir, relPath), 'utf-8');
}
