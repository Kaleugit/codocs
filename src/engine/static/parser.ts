import path from 'node:path';
import { createRequire } from 'node:module';
import { Parser, Language, type Node } from 'web-tree-sitter';
import type { FileAnalysis, SymbolInfo } from '../types.js';

const require = createRequire(import.meta.url);

const IMPORT_NODE_TYPES = new Set([
  'import_statement',
  'import_from_statement', // python
  'import_declaration', // go, java
  'use_declaration', // rust
  'require', // ruby (via call heuristic abaixo)
  'preproc_include', // c/cpp
  'using_directive', // c#
]);

const SYMBOL_NODE_TYPES: Record<string, SymbolInfo['kind']> = {
  function_declaration: 'function',
  function_definition: 'function',
  function_item: 'function',
  method_definition: 'method',
  method_declaration: 'method',
  class_declaration: 'class',
  class_definition: 'class',
  class_specifier: 'class',
  interface_declaration: 'interface',
  type_alias_declaration: 'type',
  type_item: 'type',
  struct_item: 'class',
  struct_specifier: 'class',
  enum_declaration: 'type',
  enum_item: 'type',
  trait_item: 'interface',
  impl_item: 'class',
  module: 'class', // ruby
  lexical_declaration: 'const',
};

let initialized = false;
const languageCache = new Map<string, Language>();

async function loadLanguage(lang: string): Promise<Language | null> {
  if (!initialized) {
    await Parser.init();
    initialized = true;
  }
  const cached = languageCache.get(lang);
  if (cached) return cached;
  try {
    const wasmPath = require.resolve(`tree-sitter-wasms/out/tree-sitter-${lang}.wasm`);
    const language = await Language.load(wasmPath);
    languageCache.set(lang, language);
    return language;
  } catch {
    return null;
  }
}

function nodeName(node: Node): string | null {
  const byField = node.childForFieldName('name');
  if (byField) return byField.text;
  for (const child of node.namedChildren) {
    if (child && (child.type === 'identifier' || child.type.endsWith('identifier'))) {
      return child.text;
    }
  }
  return null;
}

function firstLine(text: string): string {
  const nl = text.indexOf('\n');
  const line = nl === -1 ? text : text.slice(0, nl);
  return line.length > 160 ? line.slice(0, 160) + '…' : line;
}

function extractImportSpecifier(node: Node): string | null {
  for (const child of node.namedChildren) {
    if (!child) continue;
    if (child.type === 'string' || child.type === 'string_literal' || child.type === 'interpreted_string_literal' || child.type === 'system_lib_string') {
      return child.text.replace(/^["'<]|[">']$/g, '');
    }
    if (child.type === 'dotted_name' || child.type === 'scoped_identifier' || child.type === 'use_wildcard' || child.type === 'scoped_use_list' || child.type === 'use_as_clause' || child.type === 'qualified_name') {
      return child.text;
    }
    if (child.type === 'import_spec_list') {
      const specs = child.namedChildren
        .filter((c): c is Node => c !== null)
        .map((c) => c.text.replace(/^["']|["']$/g, ''));
      return specs.join(',');
    }
  }
  return node.namedChildren[0]?.text ?? null;
}

function isExported(node: Node, language: string): boolean {
  if (node.parent?.type === 'export_statement') return true;
  if (language === 'go' || language === 'python') {
    const name = nodeName(node);
    if (!name) return false;
    if (language === 'go') return /^[A-Z]/.test(name);
    return !name.startsWith('_');
  }
  const text = firstLine(node.text);
  return /\b(pub|public|export)\b/.test(text);
}

export async function analyzeFile(
  relPath: string,
  content: string,
  language: string,
): Promise<FileAnalysis | null> {
  const lang = await loadLanguage(language);
  if (!lang) return null;

  const parser = new Parser();
  parser.setLanguage(lang);
  const tree = parser.parse(content);
  if (!tree) {
    parser.delete();
    return null;
  }

  const imports: string[] = [];
  const symbols: SymbolInfo[] = [];

  const visit = (node: Node, depth: number): void => {
    if (IMPORT_NODE_TYPES.has(node.type)) {
      const spec = extractImportSpecifier(node);
      if (spec) imports.push(spec);
    }

    const kind = SYMBOL_NODE_TYPES[node.type];
    // símbolos só em profundidade rasa (top-level e um nível abaixo, ex: métodos de classe)
    if (kind && depth <= 3) {
      const name = nodeName(node);
      if (name) {
        symbols.push({
          name,
          kind,
          signature: firstLine(node.text),
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          exported: isExported(node, language),
        });
      }
    }

    for (const child of node.namedChildren) {
      if (child) visit(child, depth + 1);
    }
  };

  visit(tree.rootNode, 0);
  tree.delete();
  parser.delete();

  return { path: relPath, language, imports, symbols };
}

/** Resolve um import relativo para um caminho de arquivo do repo, se possível */
export function resolveImportToPath(fromFile: string, spec: string, allFiles: Set<string>): string | null {
  if (!spec.startsWith('.')) return null;
  const dir = path.posix.dirname(fromFile);
  const base = path.posix.normalize(path.posix.join(dir, spec));
  const candidates = [
    base,
    base.replace(/\.js$/, '.ts'),
    `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.jsx`, `${base}.py`, `${base}.go`, `${base}.rs`,
    `${base}/index.ts`, `${base}/index.js`, `${base}/__init__.py`,
  ];
  for (const c of candidates) {
    if (allFiles.has(c)) return c;
  }
  return null;
}
