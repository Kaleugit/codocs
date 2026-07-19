import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { marked } from 'marked';
import puppeteer from 'puppeteer';

const require = createRequire(import.meta.url);

const PRINT_CSS = `
  @page { size: A4; margin: 22mm 18mm; }
  * { box-sizing: border-box; }
  body {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 11pt; line-height: 1.55; color: #1a1a2e;
    max-width: 100%;
  }
  h1 { font-size: 22pt; border-bottom: 2px solid #1a1a2e; padding-bottom: 6pt; margin-top: 0; }
  h2 { font-size: 15pt; margin-top: 18pt; color: #16213e; }
  h3 { font-size: 12.5pt; color: #16213e; }
  code, pre { font-family: 'Consolas', 'Courier New', monospace; font-size: 9pt; }
  pre {
    background: #f4f6f8; border: 1px solid #dde3ea; border-radius: 4px;
    padding: 10px; overflow-x: hidden; white-space: pre-wrap; word-wrap: break-word;
  }
  code { background: #f4f6f8; padding: 1px 4px; border-radius: 3px; }
  pre code { background: none; padding: 0; }
  blockquote { border-left: 3px solid #4a5568; margin-left: 0; padding-left: 12px; color: #4a5568; font-style: italic; }
  table { border-collapse: collapse; width: 100%; font-size: 10pt; }
  th, td { border: 1px solid #cbd5e0; padding: 5px 8px; text-align: left; }
  th { background: #eef2f7; }
  svg { max-width: 100%; height: auto; }
  .diagram { text-align: center; margin: 14pt 0; }
  .page-break { page-break-after: always; }
  .mermaid { text-align: center; }
`;

export async function renderPdf(
  fullMarkdown: string,
  diagrams: Record<string, string>,
  outPdfPath: string,
  onProgress?: (msg: string) => void,
): Promise<void> {
  let html = await marked.parse(fullMarkdown);

  // injeta diagramas SVG determinísticos nos placeholders
  for (const [name, svg] of Object.entries(diagrams)) {
    html = html.replace(`<!--diagram:${name}-->`, `<div class="diagram">${svg}</div>`);
  }

  const mermaidJs = await fs.readFile(
    require.resolve('mermaid/dist/mermaid.min.js'),
    'utf-8',
  );

  const page_ = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${PRINT_CSS}</style></head>
<body>
${html}
<script>${mermaidJs}</script>
<script>
  // valida e renderiza blocos mermaid; blocos inválidos são removidos (nunca inventamos diagramas quebrados)
  (async () => {
    const blocks = document.querySelectorAll('pre code.language-mermaid');
    let i = 0;
    for (const code of blocks) {
      const pre = code.parentElement;
      const source = code.textContent;
      try {
        const { svg } = await mermaid.render('mmd' + (i++), source);
        const div = document.createElement('div');
        div.className = 'diagram';
        div.innerHTML = svg;
        pre.replaceWith(div);
      } catch (e) {
        pre.remove();
      }
    }
    window.__mermaidDone = true;
  })();
  mermaid.initialize({ startOnLoad: false, theme: 'neutral' });
</script>
</body>
</html>`;

  onProgress?.('renderizando PDF');
  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(page_, { waitUntil: 'load' });
    await page
      .waitForFunction('window.__mermaidDone === true', { timeout: 30_000 })
      .catch(() => onProgress?.('aviso: renderização de diagramas mermaid excedeu o tempo'));
    await fs.mkdir(path.dirname(outPdfPath), { recursive: true });
    await page.pdf({
      path: outPdfPath,
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate:
        '<div style="width:100%;text-align:center;font-size:8pt;color:#888;">' +
        '<span class="pageNumber"></span> / <span class="totalPages"></span></div>',
    });
  } finally {
    await browser.close();
  }
}
