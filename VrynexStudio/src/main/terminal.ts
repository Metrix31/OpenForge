import * as pty from '@lydell/node-pty';
import type { BrowserWindow } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

interface ShellProfile {
  file: string;
  args: string[];
  name: string;
}

function defaultShell(): ShellProfile {
  if (process.platform === 'win32') {
    return { file: 'powershell.exe', args: ['-NoLogo'], name: 'PowerShell' };
  }
  const fromEnv = process.env.SHELL;
  const file = fromEnv && fs.existsSync(fromEnv) ? fromEnv : fs.existsSync('/bin/bash') ? '/bin/bash' : '/bin/sh';
  return { file, args: [], name: path.basename(file) };
}

function isDirectory(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

const clamp = (n: unknown, fallback: number, min: number, max: number): number =>
  typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(min, Math.floor(n))) : fallback;

export class TerminalManager {
  private readonly sessions = new Map<number, pty.IPty>();
  private nextId = 1;

  constructor(private readonly getWindow: () => BrowserWindow | null) {}

  private send(channel: string, ...args: unknown[]): void {
    const win = this.getWindow();
    if (win && !win.isDestroyed()) win.webContents.send(channel, ...args);
  }

  create(cwd: string | null, cols: unknown, rows: unknown): { id: number; shell: string } {
    const shell = defaultShell();
    const dir = cwd && isDirectory(cwd) ? cwd : os.homedir();

    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined && key !== 'VITE_DEV_SERVER_URL') env[key] = value;
    }
    env.TERM = 'xterm-256color';
    env.COLORTERM = 'truecolor';
    env.TERM_PROGRAM = 'VyrnexStudio';

    const proc = pty.spawn(shell.file, shell.args, {
      name: 'xterm-256color',
      cols: clamp(cols, 80, 2, 500),
      rows: clamp(rows, 24, 2, 200),
      cwd: dir,
      env,
    });

    const id = this.nextId++;
    this.sessions.set(id, proc);
    proc.onData((data) => this.send('term:data', id, data));
    proc.onExit(({ exitCode }) => {
      this.sessions.delete(id);
      this.send('term:exit', id, exitCode);
    });
    return { id, shell: shell.name };
  }

  write(id: number, data: string): void {
    this.sessions.get(id)?.write(data);
  }

  resize(id: number, cols: unknown, rows: unknown): void {
    try {
      this.sessions.get(id)?.resize(clamp(cols, 80, 2, 500), clamp(rows, 24, 2, 200));
    } catch {
      /* process already exited */
    }
  }

  kill(id: number): void {
    const proc = this.sessions.get(id);
    this.sessions.delete(id);
    try {
      proc?.kill();
    } catch {
      /* already gone */
    }
  }

  killAll(): void {
    for (const id of [...this.sessions.keys()]) this.kill(id);
  }
}
