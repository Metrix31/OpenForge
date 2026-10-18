import fs from 'node:fs/promises';
import path from 'node:path';
import type { DirEntry, OpenedFile, SearchMatch } from '../shared/types';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const MAX_SEARCH_FILE_SIZE = 1024 * 1024; // 1 MB
const MAX_WALK_FILES = 20000;
const HIDDEN = new Set(['.git', '.DS_Store', 'Thumbs.db']);
const IGNORED_DIRS = new Set([
  'node_modules', '.git', '.hg', '.svn', 'dist', 'release', 'out', 'build',
  'target', '__pycache__', '.venv', '.next', '.cache', 'coverage',
]);

export function errorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    switch (String((err as NodeJS.ErrnoException).code)) {
      case 'ENOENT': return 'The file or folder does not exist (anymore).';
      case 'EACCES':
      case 'EPERM': return 'Permission denied. Check the file permissions or whether another program has it open.';
      case 'EBUSY': return 'The file is in use by another program.';
      case 'ENOSPC': return 'Not enough disk space.';
      case 'EISDIR': return 'This is a folder, not a file.';
    }
  }
  return err instanceof Error ? err.message : String(err);
}

export async function statMtime(filePath: string): Promise<number> {
  return (await fs.stat(filePath)).mtimeMs;
}

export async function readTextFile(filePath: string): Promise<OpenedFile> {
  const stat = await fs.stat(filePath);
  if (!stat.isFile()) throw new Error('This is not a file.');
  if (stat.size > MAX_FILE_SIZE) {
    throw new Error(`The file is too large (${(stat.size / 1048576).toFixed(1)} MB, limit 25 MB).`);
  }
  const buffer = await fs.readFile(filePath);
  if (buffer.subarray(0, 8000).includes(0)) throw new Error('Binary files cannot be opened in the text editor.');
  let content = buffer.toString('utf-8');
  if (content.charCodeAt(0) === 0xfeff) content = content.slice(1); // strip BOM
  return { path: filePath, name: path.basename(filePath), content, mtimeMs: stat.mtimeMs };
}

/** Writes to a temp file first and renames it, so a crash never leaves a half-written file. Returns the new mtime. */
export async function writeTextFile(filePath: string, content: string): Promise<number> {
  const tmp = `${filePath}.${process.pid}.tmp`;
  try {
    await fs.writeFile(tmp, content, 'utf-8');
    await fs.rename(tmp, filePath);
  } catch {
    await fs.rm(tmp, { force: true }).catch(() => undefined);
    await fs.writeFile(filePath, content, 'utf-8'); // fallback: write directly
  }
  return statMtime(filePath);
}

export async function listDir(dirPath: string): Promise<DirEntry[]> {
  const items = await fs.readdir(dirPath, { withFileTypes: true });
  return items
    .filter((i) => !HIDDEN.has(i.name))
    .map((i) => ({ name: i.name, path: path.join(dirPath, i.name), isDirectory: i.isDirectory() }))
    .sort(
      (a, b) =>
        Number(b.isDirectory) - Number(a.isDirectory) ||
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }),
    );
}

async function* walk(root: string): AsyncGenerator<string> {
  const stack = [root];
  let count = 0;
  while (stack.length > 0) {
    const dir = stack.pop() as string;
    let items;
    try {
      items = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const item of items) {
      if (item.isDirectory()) {
        if (!IGNORED_DIRS.has(item.name)) stack.push(path.join(dir, item.name));
      } else if (item.isFile()) {
        yield path.join(dir, item.name);
        if (++count >= MAX_WALK_FILES) return;
      }
    }
  }
}

export async function listFiles(root: string): Promise<{ files: string[]; truncated: boolean }> {
  const files: string[] = [];
  for await (const file of walk(root)) files.push(file);
  return { files, truncated: files.length >= MAX_WALK_FILES };
}

/** Plain-text search, one result per matching line. */
export async function searchFiles(
  root: string,
  query: string,
  matchCase: boolean,
  maxMatches = 500,
): Promise<{ matches: SearchMatch[]; truncated: boolean }> {
  const matches: SearchMatch[] = [];
  const needle = matchCase ? query : query.toLowerCase();
  for await (const file of walk(root)) {
    let buffer: Buffer;
    try {
      const stat = await fs.stat(file);
      if (stat.size > MAX_SEARCH_FILE_SIZE) continue;
      buffer = await fs.readFile(file);
    } catch {
      continue;
    }
    if (buffer.subarray(0, 4000).includes(0)) continue;
    const lines = buffer.toString('utf-8').split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const hay = matchCase ? lines[i] : lines[i].toLowerCase();
      const idx = hay.indexOf(needle);
      if (idx === -1) continue;
      matches.push({ path: file, line: i + 1, column: idx + 1, length: query.length, preview: lines[i].trim().slice(0, 200) });
      if (matches.length >= maxMatches) return { matches, truncated: true };
    }
  }
  return { matches, truncated: false };
}
