// Types only: safe to import from main, preload and renderer (`import type`).

export interface OpenedFile {
  path: string;
  name: string;
  content: string;
  mtimeMs: number;
}

export interface DirEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

export interface SearchMatch {
  path: string;
  line: number;
  column: number;
  length: number;
  preview: string;
}

export type Result<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

export type UnsavedChoice = 'save' | 'discard' | 'cancel';

export interface TerminalCreateOptions {
  cwd: string | null;
  cols: number;
  rows: number;
}

export type MenuAction =
  | 'new-file'
  | 'open-file'
  | 'open-folder'
  | 'close-folder'
  | 'save'
  | 'save-as'
  | 'save-all'
  | 'close-tab'
  | 'quick-open'
  | 'command-palette'
  | 'find'
  | 'replace'
  | 'goto-line'
  | 'find-in-files'
  | 'toggle-sidebar'
  | 'toggle-terminal'
  | 'new-terminal'
  | 'kill-terminal'
  | 'toggle-word-wrap'
  | 'toggle-minimap'
  | 'toggle-auto-save'
  | 'toggle-theme'
  | 'zoom-in'
  | 'zoom-out'
  | 'zoom-reset';

export interface EditorApi {
  pickFiles(): Promise<string[]>;
  pickFolder(): Promise<string | null>;
  readFile(path: string): Promise<Result<{ file: OpenedFile }>>;
  statFile(path: string): Promise<Result<{ mtimeMs: number }>>;
  saveFile(path: string, content: string): Promise<Result<{ mtimeMs: number }>>;
  /** `path: null` means the dialog was cancelled. */
  saveFileAs(content: string, suggestedName: string): Promise<Result<{ path: string | null; mtimeMs: number }>>;
  readDir(path: string): Promise<Result<{ entries: DirEntry[] }>>;
  listFiles(root: string): Promise<Result<{ files: string[]; truncated: boolean }>>;
  searchInFiles(root: string, query: string, matchCase: boolean): Promise<Result<{ matches: SearchMatch[]; truncated: boolean }>>;
  confirmUnsaved(fileName: string): Promise<UnsavedChoice>;
  closeWindow(): void;
  getPathForFile(file: File): string;

  termCreate(options: TerminalCreateOptions): Promise<Result<{ id: number; shell: string }>>;
  termWrite(id: number, data: string): void;
  termResize(id: number, cols: number, rows: number): void;
  termKill(id: number): void;
  onTermData(cb: (id: number, data: string) => void): () => void;
  onTermExit(cb: (id: number, exitCode: number) => void): () => void;

  onMenuAction(cb: (action: MenuAction) => void): () => void;
  onOpenPaths(cb: (paths: string[]) => void): () => void;
  onCloseRequest(cb: () => void): () => void;
}
