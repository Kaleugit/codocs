import { instance } from '@viz-js/viz';
import type { Skeleton } from '../types.js';

/** Diagrama determinístico do grafo de módulos — gerado direto do esqueleto, sem LLM */
export async function renderModuleGraph(skeleton: Skeleton): Promise<string> {
  const viz = await instance();

  const modules = skeleton.modules.slice(0, 25); // legibilidade
  const ids = new Map<string, string>();
  modules.forEach((m, i) => ids.set(m.id, `n${i}`));

  const lines: string[] = [
    'digraph G {',
    '  rankdir=LR;',
    '  node [shape=box, style="rounded,filled", fillcolor="#eef2f7", fontname="Helvetica", fontsize=11];',
    '  edge [color="#8899aa", arrowsize=0.7];',
  ];

  for (const m of modules) {
    const fill = m.hotspotScore > 0.5 ? '#fde8e8' : '#eef2f7';
    lines.push(`  ${ids.get(m.id)} [label="${escapeDot(m.id)}", fillcolor="${fill}"];`);
  }
  for (const m of modules) {
    for (const dep of m.dependsOn) {
      const to = ids.get(dep);
      if (to) lines.push(`  ${ids.get(m.id)} -> ${to};`);
    }
  }
  lines.push('}');

  return viz.renderString(lines.join('\n'), { format: 'svg' });
}

function escapeDot(s: string): string {
  return s.replace(/"/g, '\\"');
}
