import { simpleGit } from 'simple-git';
import type { GitInsights, Hotspot } from '../types.js';

const EMPTY: GitInsights = {
  repoName: null,
  commitHash: null,
  totalCommits: 0,
  hotspots: [],
  recentSubjects: [],
  firstCommitDate: null,
  lastCommitDate: null,
};

export async function analyzeGitHistory(rootDir: string): Promise<GitInsights> {
  const git = simpleGit(rootDir);
  const isRepo = await git.checkIsRepo().catch(() => false);
  if (!isRepo) return EMPTY;

  const log = await git.log().catch(() => null);
  if (!log || log.total === 0) return EMPTY;

  // frequência de mudança por arquivo
  const raw = await git.raw(['log', '--name-only', '--pretty=format:', '--no-merges']).catch(() => '');
  const counts = new Map<string, number>();
  for (const line of raw.split('\n')) {
    const file = line.trim();
    if (!file) continue;
    counts.set(file, (counts.get(file) ?? 0) + 1);
  }

  const max = Math.max(1, ...counts.values());
  const hotspots: Hotspot[] = [...counts.entries()]
    .map(([path, commits]) => ({ path, commits, score: commits / max }))
    .sort((a, b) => b.commits - a.commits)
    .slice(0, 100);

  const remotes = await git.getRemotes(true).catch(() => []);
  const originUrl = remotes.find((r) => r.name === 'origin')?.refs.fetch ?? null;
  const repoName = originUrl
    ? originUrl.replace(/\/+$/, '').split('/').pop()?.replace(/\.git$/, '') ?? null
    : null;

  return {
    repoName,
    commitHash: log.latest?.hash ?? null,
    totalCommits: log.total,
    hotspots,
    recentSubjects: log.all.slice(0, 50).map((c) => c.message),
    firstCommitDate: log.all[log.all.length - 1]?.date ?? null,
    lastCommitDate: log.latest?.date ?? null,
  };
}
