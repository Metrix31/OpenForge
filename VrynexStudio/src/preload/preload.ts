import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron';
import type { EditorApi, MenuAction } from '../shared/types';

// Sandboxed preload: only import types from ../shared, never runtime values.

function subscribe<T extends unknown[]>(channel: string, cb: (...args: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, ...args: unknown[]) => cb(...(args as T));
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const api: EditorApi = {
  pickFiles: () => ipcRenderer.invoke('file:pick'),
  pickFolder: () => ipcRenderer.invoke('folder:pick'),
  readFile: (path) => ipcRenderer.invoke('file:read', path),
  statFile: (path) => ipcRenderer.invoke('file:stat', path),
  saveFile: (path, content) => ipcRenderer.invoke('file:save', path, content),
  saveFileAs: (content, suggestedName) => ipcRenderer.invoke('file:save-as', content, suggestedName),
  readDir: (path) => ipcRenderer.invoke('dir:read', path),
  listFiles: (root) => ipcRenderer.invoke('files:list', root),
  searchInFiles: (root, query, matchCase) => ipcRenderer.invoke('search:run', root, query, matchCase),
  confirmUnsaved: (fileName) => ipcRenderer.invoke('dialog:confirm-unsaved', fileName),
  closeWindow: () => ipcRenderer.send('window:force-close'),
  getPathForFile: (file) => webUtils.getPathForFile(file),

  termCreate: (options) => ipcRenderer.invoke('term:create', options),
  termWrite: (id, data) => ipcRenderer.send('term:write', id, data),
  termResize: (id, cols, rows) => ipcRenderer.send('term:resize', id, cols, rows),
  termKill: (id) => ipcRenderer.send('term:kill', id),
  onTermData: (cb) => subscribe<[number, string]>('term:data', cb),
  onTermExit: (cb) => subscribe<[number, number]>('term:exit', cb),

  onMenuAction: (cb) => subscribe<[MenuAction]>('menu:action', cb),
  onOpenPaths: (cb) => subscribe<[string[]]>('app:open-paths', cb),
  onCloseRequest: (cb) => subscribe<[]>('window:close-request', cb),
};

contextBridge.exposeInMainWorld('api', api);
