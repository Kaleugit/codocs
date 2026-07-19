import { instance } from '@viz-js/viz';
import type { Skeleton } from '../types.js';

const PALETTES = {
  classic: { node: '#eef2f7', hot: '#fde8e8', border: '#8899aa', edge: '#8899aa', font: '#1a1a2e' },
  kindle: { node: '#efe6d0', hot: '#e7c9a8', border: '#b09a72', edge: '#b09a72', font: '#3e3226' },
};

/** Diagrama determinístico do grafo de módulos — gerado direto do esqueleto, sem LLM */
export async function renderModuleGraph(skeleton: Skeleton, theme: string = 'classic'): Promise<string> {
  const viz = await instance();
  const p = PALETTES[theme === 'kindle' ? 'kindle' : 'classic'];

  const modules = skeleton.modules.slice(0, 25); // legibilidade
  const ids = new Map<string, string>();
  modules.forEach((m, i) => ids.set(m.id, `n${i}`));

  const lines: string[] = [
    'digraph G {',
    '  rankdir=LR;',
    '  bgcolor="transparent";',
    `  node [shape=box, style="rounded,filled", fillcolor="${p.node}", color="${p.border}", fontcolor="${p.font}", fontname="Helvetica", fontsize=11];`,
    `  edge [color="${p.edge}", arrowsize=0.7];`,
  ];

  for (const m of modules) {
    const fill = m.hotspotScore > 0.5 ? p.hot : p.node;
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
