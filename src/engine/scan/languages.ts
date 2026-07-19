const EXT_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.mts': 'typescript',
  '.cts': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.rb': 'ruby',
  '.php': 'php',
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.hpp': 'cpp',
  '.cs': 'c_sharp',
  '.kt': 'kotlin',
  '.swift': 'swift',
  '.scala': 'scala',
  '.lua': 'lua',
  '.ex': 'elixir',
  '.exs': 'elixir',
};

export function detectLanguage(filePath: string): string | null {
  const dot = filePath.lastIndexOf('.');
  if (dot === -1) return null;
  return EXT_TO_LANGUAGE[filePath.slice(dot).toLowerCase()] ?? null;
}

export const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  'target',
  'vendor',
  '__pycache__',
  '.venv',
  'venv',
  '.next',
  '.nuxt',
  'coverage',
  '.idea',
  '.vscode',
  'codocs-output',
]);

export const MAX_FILE_BYTES = 512 * 1024;
