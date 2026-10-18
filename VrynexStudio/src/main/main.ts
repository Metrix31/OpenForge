import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  screen,
  type MessageBoxOptions,
  type OpenDialogOptions,
  type SaveDialogOptions,
} from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { buildMenu } from './menu';
import { errorMessage, listDir, listFiles, readTextFile, searchFiles, statMtime, writeTextFile } from './files';
import { TerminalManager } from './terminal';
import type { Result, TerminalCreateOptions, UnsavedChoice } from '../shared/types';

const devUrl = process.env.VITE_DEV_SERVER_URL;
let mainWindow: BrowserWindow | null = null;
let forceClose = false;
const terminals = new TerminalManager(() => mainWindow);

// ---------------------------------------------------------------- Window state

interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  maximized: boolean;
}

const stateFile = () => path.join(app.getPath('userData'), 'window-state.json');

function loadWindowState(): WindowState {
  const fallback: WindowState = { width: 1280, height: 820, maximized: false };
  try {
    const saved = JSON.parse(fs.readFileSync(stateFile(), 'utf-8')) as WindowState;
    const { x, y } = saved;
    if (x !== undefined && y !== undefined) {
      const visible = screen
        .getAllDisplays()
        .some(({ workArea: b }) => x >= b.x - 50 && y >= b.y - 50 && x < b.x + b.width && y < b.y + b.height);
      if (!visible) {
        delete saved.x;
        delete saved.y;
      }
    }
    return { ...fallback, ...saved };
  } catch {
    return fallback;
  }
}

function saveWindowState(win: BrowserWindow): void {
  const maximized = win.isMaximized();
  const bounds = maximized ? win.getNormalBounds() : win.getBounds();
  try {
    fs.writeFileSync(stateFile(), JSON.stringify({ ...bounds, maximized }));
  } catch {
    /* not critical */
  }
}

// ---------------------------------------------------------------- Launch arguments

function collectLaunchPaths(argv: string[], cwd = process.cwd()): string[] {
  return argv
    .slice(app.isPackaged ? 1 : 2)
    .filter((a) => !a.startsWith('-'))
    .map((a) => path.resolve(cwd, a))
    .filter((p) => {
      try {
        return fs.statSync(p).isFile();
      } catch {
        return false;
      }
    });
}

// ---------------------------------------------------------------- Window

function createWindow(): void {
  forceClose = false;
  const state = loadWindowState();

  const win = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 640,
    minHeight: 400,
    show: false,
    title: 'Vyrnex Studio',
    backgroundColor: '#0f1118',
    webPreferences: {
      // compiled JS: dist/electron/main -> dist/electron/preload
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow = win;

  if (state.maximized) win.maximize();
  win.once('ready-to-show', () => win.show());

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    const allowed = devUrl ? url.startsWith(devUrl) : url.startsWith('file://');
    if (!allowed) event.preventDefault();
  });

  // A (re)load of the renderer invalidates all terminal ids, so stop their processes.
  win.webContents.on('did-start-loading', () => terminals.killAll());
  win.webContents.once('did-finish-load', () => {
    const paths = collectLaunchPaths(process.argv);
    if (paths.length) win.webContents.send('app:open-paths', paths);
  });

  // Closing: the renderer checks for unsaved changes first.
  win.on('close', (event) => {
    saveWindowState(win);
    if (forceClose || win.webContents.isCrashed()) return;
    event.preventDefault();
    win.webContents.send('window:close-request');
  });
  win.on('closed', () => {
    terminals.killAll();
    if (mainWindow === win) mainWindow = null;
  });

  if (devUrl) void win.loadURL(devUrl);
  else void win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

// ---------------------------------------------------------------- IPC

function assertString(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`Invalid parameter: ${name}`);
}

async function guard<T extends object>(fn: () => Promise<T> | T): Promise<Result<T>> {
  try {
    return { ok: true as const, ...(await fn()) };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

const showOpen = (o: OpenDialogOptions) => (mainWindow ? dialog.showOpenDialog(mainWindow, o) : dialog.showOpenDialog(o));
const showSave = (o: SaveDialogOptions) => (mainWindow ? dialog.showSaveDialog(mainWindow, o) : dialog.showSaveDialog(o));
const showMessage = (o: MessageBoxOptions) => (mainWindow ? dialog.showMessageBox(mainWindow, o) : dialog.showMessageBox(o));

function registerIpc(): void {
  ipcMain.handle('file:pick', async (): Promise<string[]> => {
    const { canceled, filePaths } = await showOpen({ properties: ['openFile', 'multiSelections'] });
    return canceled ? [] : filePaths;
  });

  ipcMain.handle('folder:pick', async (): Promise<string | null> => {
    const { canceled, filePaths } = await showOpen({ properties: ['openDirectory'] });
    return canceled ? null : (filePaths[0] ?? null);
  });

  ipcMain.handle('file:read', (_e, filePath: unknown) =>
    guard(async () => {
      assertString(filePath, 'path');
      return { file: await readTextFile(filePath) };
    }),
  );

  ipcMain.handle('file:stat', (_e, filePath: unknown) =>
    guard(async () => {
      assertString(filePath, 'path');
      return { mtimeMs: await statMtime(filePath) };
    }),
  );

  ipcMain.handle('file:save', (_e, filePath: unknown, content: unknown) =>
    guard(async () => {
      assertString(filePath, 'path');
      if (typeof content !== 'string') throw new Error('Invalid parameter: content');
      return { mtimeMs: await writeTextFile(filePath, content) };
    }),
  );

  ipcMain.handle('file:save-as', (_e, content: unknown, suggestedName: unknown) =>
    guard(async () => {
      if (typeof content !== 'string') throw new Error('Invalid parameter: content');
      const name = typeof suggestedName === 'string' && suggestedName ? suggestedName : 'untitled.txt';
      const { canceled, filePath } = await showSave({ defaultPath: name });
      if (canceled || !filePath) return { path: null as string | null, mtimeMs: 0 };
      return { path: filePath as string | null, mtimeMs: await writeTextFile(filePath, content) };
    }),
  );

  ipcMain.handle('dir:read', (_e, dirPath: unknown) =>
    guard(async () => {
      assertString(dirPath, 'path');
      return { entries: await listDir(dirPath) };
    }),
  );

  ipcMain.handle('files:list', (_e, root: unknown) =>
    guard(async () => {
      assertString(root, 'root');
      return listFiles(root);
    }),
  );

  ipcMain.handle('search:run', (_e, root: unknown, query: unknown, matchCase: unknown) =>
    guard(async () => {
      assertString(root, 'root');
      assertString(query, 'query');
      return searchFiles(root, query, matchCase === true);
    }),
  );

  ipcMain.handle('dialog:confirm-unsaved', async (_e, fileName: unknown): Promise<UnsavedChoice> => {
    const name = typeof fileName === 'string' ? fileName : 'this file';
    const { response } = await showMessage({
      type: 'warning',
      buttons: ['Save', "Don't Save", 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      noLink: true,
      title: 'Vyrnex Studio',
      message: `Do you want to save the changes you made to "${name}"?`,
      detail: "Your changes will be lost if you don't save them.",
    });
    return (['save', 'discard', 'cancel'] as const)[response] ?? 'cancel';
  });

  // Terminal
  ipcMain.handle('term:create', (_e, options: unknown) =>
    guard(() => {
      const o = (options ?? {}) as Partial<TerminalCreateOptions>;
      return terminals.create(typeof o.cwd === 'string' ? o.cwd : null, o.cols, o.rows);
    }),
  );
  ipcMain.on('term:write', (_e, id: unknown, data: unknown) => {
    if (typeof id === 'number' && typeof data === 'string') terminals.write(id, data);
  });
  ipcMain.on('term:resize', (_e, id: unknown, cols: unknown, rows: unknown) => {
    if (typeof id === 'number') terminals.resize(id, cols, rows);
  });
  ipcMain.on('term:kill', (_e, id: unknown) => {
    if (typeof id === 'number') terminals.kill(id);
  });

  ipcMain.on('window:force-close', () => {
    forceClose = true;
    mainWindow?.close();
  });
}

// ---------------------------------------------------------------- App lifecycle

const gotLock = app.isPackaged ? app.requestSingleInstanceLock() : true;

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv, cwd) => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    const paths = collectLaunchPaths(argv, cwd);
    if (paths.length) mainWindow.webContents.send('app:open-paths', paths);
  });

  void app.whenReady().then(() => {
    registerIpc();
    Menu.setApplicationMenu(buildMenu(() => mainWindow));
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('before-quit', () => terminals.killAll());
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
