import './styles.css';
import { monaco } from './monaco-setup';
import { Explorer } from './explorer';
import { Palette, type PaletteItem } from './palette';
import { SearchView } from './search-view';
import { TerminalPanel } from './terminal-panel';
import type { MenuAction } from '../shared/types';

// ---------------------------------------------------------------- Settings

interface Settings {
  theme: 'dark' | 'light';
  wordWrap: boolean;
  minimap: boolean;
  autoSave: boolean;
  fontSize: number;
  sidebar: boolean;
  sidebarWidth: number;
  panelHeight: number;
  folder: string | null;
  session: { files: string[]; active: string | null };
}

const DEFAULTS: Settings = {
  theme: 'dark',
  wordWrap: false,
  minimap: true,
  autoSave: false,
  fontSize: 14,
  sidebar: true,
  sidebarWidth: 250,
  panelHeight: 260,
  folder: null,
  session: { files: [], active: null },
};
const SETTINGS_KEY = 'vyrnex.settings';

function loadSettings(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

const settings = loadSettings();

function persist(): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable */
  }
}

// ---------------------------------------------------------------- Helpers

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const isMac = navigator.userAgent.includes('Mac');
const isWindows = navigator.userAgent.includes('Windows');
const MOD = isMac ? 'Cmd' : 'Ctrl';
const MONO_FONT = "'Cascadia Code', 'JetBrains Mono', Consolas, 'Courier New', monospace";

const basename = (p: string) => p.split(/[\\/]/).filter(Boolean).pop() ?? p;
const samePath = (a: string, b: string) => (isWindows ? a.toLowerCase() === b.toLowerCase() : a === b);
function dirname(p: string): string {
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
  if (i < 0) return p;
  return i <= 2 ? p.slice(0, i + 1) : p.slice(0, i);
}

function languageFor(name: string): string {
  const lower = name.toLowerCase();
  const langs = monaco.languages.getLanguages();
  const byFile = langs.find((l) => l.filenames?.some((f) => f.toLowerCase() === lower));
  if (byFile) return byFile.id;
  const dot = lower.lastIndexOf('.');
  if (dot >= 0) {
    const ext = lower.slice(dot);
    const byExt = langs.find((l) => l.extensions?.includes(ext));
    if (byExt) return byExt.id;
  }
  return 'plaintext';
}

function toast(message: string, kind: 'info' | 'error' = 'info'): void {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = message;
  $('toasts').append(el);
  setTimeout(() => el.remove(), kind === 'error' ? 7000 : 3500);
}

let flashTimer: number | undefined;
function flash(message: string): void {
  const el = $('st-msg');
  el.textContent = message;
  window.clearTimeout(flashTimer);
  flashTimer = window.setTimeout(() => (el.textContent = ''), 2500);
}

// ---------------------------------------------------------------- Editor

const editor = monaco.editor.create($('editor'), {
  model: null,
  theme: settings.theme === 'dark' ? 'vyrnex-dark' : 'vyrnex-light',
  automaticLayout: true,
  fontFamily: MONO_FONT,
  fontLigatures: true,
  fontSize: settings.fontSize,
  minimap: { enabled: settings.minimap },
  wordWrap: settings.wordWrap ? 'on' : 'off',
  smoothScrolling: true,
  cursorSmoothCaretAnimation: 'on',
  renderWhitespace: 'selection',
  bracketPairColorization: { enabled: true },
  scrollBeyondLastLine: false,
  padding: { top: 10 },
});

const palette = new Palette($('palette'), $<HTMLInputElement>('palette-input'), $('palette-list'));

// ---------------------------------------------------------------- Tabs

interface Tab {
  id: number;
  path: string | null;
  name: string;
  model: monaco.editor.ITextModel;
  savedVersion: number;
  dirty: boolean;
  mtimeMs: number;
  viewState: monaco.editor.ICodeEditorViewState | null;
  subscription: monaco.IDisposable;
  saveTimer: number | undefined;
}

const tabs: Tab[] = [];
let activeTab: Tab | null = null;
let nextId = 1;
let untitledCounter = 1;

const tabsEl = $('tabs');
const explorer = new Explorer($('explorer'), {
  onOpenFile: (p) => void openPath(p),
  onOpenFolder: () => void openFolder(),
});

function createTab(name: string, path: string | null, content: string, mtimeMs: number): Tab {
  const id = nextId++;
  const uri = monaco.Uri.from({ scheme: 'vyrnex', path: `/${id}/${name}` });
  const model = monaco.editor.createModel(content, languageFor(name), uri);
  const tab: Tab = {
    id,
    path,
    name,
    model,
    savedVersion: model.getAlternativeVersionId(),
    dirty: false,
    mtimeMs,
    viewState: null,
    subscription: { dispose() {} },
    saveTimer: undefined,
  };
  tab.subscription = model.onDidChangeContent(() => {
    const dirty = model.getAlternativeVersionId() !== tab.savedVersion;
    if (dirty !== tab.dirty) {
      tab.dirty = dirty;
      renderTabs();
      updateTitle();
    }
    if (tab === activeTab) updateStatus();
    if (settings.autoSave && tab.path && tab.dirty) scheduleAutoSave(tab);
  });
  tabs.push(tab);
  return tab;
}

function scheduleAutoSave(tab: Tab): void {
  window.clearTimeout(tab.saveTimer);
  tab.saveTimer = window.setTimeout(() => {
    if (tab.dirty && tabs.includes(tab)) void save(tab);
  }, 1000);
}

function saveSession(): void {
  settings.session = {
    files: tabs.flatMap((t) => (t.path ? [t.path] : [])),
    active: activeTab?.path ?? null,
  };
  persist();
}

function activate(tab: Tab): void {
  if (activeTab && activeTab !== tab) activeTab.viewState = editor.saveViewState();
  activeTab = tab;
  editor.setModel(tab.model);
  if (tab.viewState) editor.restoreViewState(tab.viewState);
  editor.focus();
  explorer.select(tab.path);
  renderTabs();
  updateTitle();
  updateStatus();
  saveSession();
}

function renderTabs(): void {
  document.body.classList.toggle('has-tabs', tabs.length > 0);
  tabsEl.replaceChildren(
    ...tabs.map((tab) => {
      const el = document.createElement('div');
      el.className = 'tab' + (tab === activeTab ? ' active' : '') + (tab.dirty ? ' dirty' : '');
      el.setAttribute('role', 'tab');
      el.setAttribute('aria-selected', String(tab === activeTab));
      el.title = tab.path ?? tab.name;

      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = tab.name;

      const close = document.createElement('button');
      close.className = 'close';
      close.textContent = '×';
      close.title = `Close (${MOD}+W)`;
      close.setAttribute('aria-label', `Close ${tab.name}`);
      close.addEventListener('click', (e) => {
        e.stopPropagation();
        void closeTab(tab);
      });

      el.append(name, close);
      el.addEventListener('click', () => activate(tab));
      el.addEventListener('auxclick', (e) => {
        if (e.button === 1) void closeTab(tab);
      });
      return el;
    }),
  );
  tabsEl.querySelector('.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function updateTitle(): void {
  document.title = activeTab ? `${activeTab.dirty ? '● ' : ''}${activeTab.name} — Vyrnex Studio` : 'Vyrnex Studio';
}

function updateStatus(): void {
  const model = editor.getModel();
  const pos = editor.getPosition();
  $('st-pos').textContent = pos && model ? `Ln ${pos.lineNumber}, Col ${pos.column}` : 'Ln –, Col –';
  $('st-eol').textContent = model ? (model.getEOL() === '\r\n' ? 'CRLF' : 'LF') : 'LF';
  $<HTMLSelectElement>('st-lang').value = model ? model.getLanguageId() : 'plaintext';
  const sel = editor.getSelection();
  const length = model && sel && !sel.isEmpty() ? model.getValueLengthInRange(sel) : 0;
  $('st-sel').textContent = length ? `${length} selected` : '';
  $('st-autosave').hidden = !settings.autoSave;
}

// ---------------------------------------------------------------- Files

async function openPath(filePath: string, opts: { silent?: boolean; activate?: boolean } = {}): Promise<Tab | null> {
  const shouldActivate = opts.activate ?? true;
  const find = () => tabs.find((t) => t.path && samePath(t.path, filePath));
  const existing = find();
  if (existing) {
    if (shouldActivate) activate(existing);
    return existing;
  }

  const res = await window.api.readFile(filePath);
  if (!res.ok) {
    if (!opts.silent) toast(`Could not open "${basename(filePath)}": ${res.error}`, 'error');
    return null;
  }

  const raced = find();
  if (raced) {
    if (shouldActivate) activate(raced);
    return raced;
  }

  // Replace a pristine, empty "Untitled" tab
  const pristine =
    shouldActivate && tabs.length === 1 && !tabs[0].path && !tabs[0].dirty && tabs[0].model.getValueLength() === 0
      ? tabs[0]
      : null;
  const tab = createTab(res.file.name, res.file.path, res.file.content, res.file.mtimeMs);
  if (shouldActivate) activate(tab);
  else renderTabs();
  if (pristine) removeTab(pristine);
  return tab;
}

async function openAt(filePath: string, line: number, column: number, length: number): Promise<void> {
  const tab = await openPath(filePath);
  if (!tab) return;
  editor.revealLineInCenter(line);
  editor.setSelection(new monaco.Range(line, column, line, column + length));
  editor.focus();
}

async function openFiles(): Promise<void> {
  for (const p of await window.api.pickFiles()) await openPath(p);
}

function newFile(): void {
  activate(createTab(`Untitled-${untitledCounter++}`, null, '', 0));
}

function markSaved(tab: Tab, version: number): void {
  tab.savedVersion = version;
  tab.dirty = tab.model.getAlternativeVersionId() !== version;
  renderTabs();
  updateTitle();
}

async function save(tab: Tab): Promise<boolean> {
  if (!tab.path) return saveAs(tab);
  const content = tab.model.getValue();
  const version = tab.model.getAlternativeVersionId();
  const res = await window.api.saveFile(tab.path, content);
  if (!res.ok) {
    toast(`Could not save "${tab.name}": ${res.error}`, 'error');
    return false;
  }
  tab.mtimeMs = res.mtimeMs;
  markSaved(tab, version);
  flash(`Saved "${tab.name}"`);
  return true;
}

async function saveAs(tab: Tab): Promise<boolean> {
  const content = tab.model.getValue();
  const version = tab.model.getAlternativeVersionId();
  const res = await window.api.saveFileAs(content, tab.name);
  if (!res.ok) {
    toast(`Save failed: ${res.error}`, 'error');
    return false;
  }
  if (res.path === null) return false; // cancelled

  const newPath = res.path;
  const other = tabs.find((t) => t !== tab && t.path && samePath(t.path, newPath));
  if (other) removeTab(other); // the overwritten file was already open

  tab.path = newPath;
  tab.name = basename(newPath);
  tab.mtimeMs = res.mtimeMs;
  monaco.editor.setModelLanguage(tab.model, languageFor(tab.name));
  markSaved(tab, version);
  explorer.select(newPath);
  if (settings.folder) void explorer.refresh();
  updateStatus();
  saveSession();
  flash(`Saved "${tab.name}"`);
  return true;
}

async function saveAll(): Promise<void> {
  for (const tab of tabs.filter((t) => t.dirty)) {
    if (!(await save(tab))) return;
  }
}

function removeTab(tab: Tab): void {
  const index = tabs.indexOf(tab);
  if (index === -1) return;
  tabs.splice(index, 1);
  window.clearTimeout(tab.saveTimer);
  if (activeTab === tab) {
    const next = tabs[Math.min(index, tabs.length - 1)];
    if (next) {
      activate(next);
    } else {
      activeTab = null;
      editor.setModel(null);
      explorer.select(null);
      renderTabs();
      updateTitle();
      updateStatus();
      saveSession();
    }
  } else {
    renderTabs();
    saveSession();
  }
  tab.subscription.dispose();
  tab.model.dispose();
}

/** Asks about unsaved changes. Returns false if the user cancelled. */
async function confirmDiscardOrSave(tab: Tab): Promise<boolean> {
  if (!tab.dirty) return true;
  activate(tab);
  const choice = await window.api.confirmUnsaved(tab.name);
  if (choice === 'cancel') return false;
  if (choice === 'save') return save(tab);
  return true;
}

async function closeTab(tab: Tab): Promise<boolean> {
  if (!(await confirmDiscardOrSave(tab))) return false;
  removeTab(tab);
  return true;
}

// Reload unmodified tabs whose files changed on disk (e.g. after a git checkout)
let checkingExternal = false;
async function checkExternalChanges(): Promise<void> {
  if (checkingExternal) return;
  checkingExternal = true;
  try {
    for (const tab of [...tabs]) {
      if (!tab.path) continue;
      const stat = await window.api.statFile(tab.path);
      if (!stat.ok || stat.mtimeMs === tab.mtimeMs) continue;
      if (tab.dirty) {
        tab.mtimeMs = stat.mtimeMs;
        toast(`"${tab.name}" changed on disk. Saving will overwrite those changes.`, 'error');
        continue;
      }
      const res = await window.api.readFile(tab.path);
      if (!res.ok || tab.dirty || !tabs.includes(tab)) continue;
      const model = tab.model;
      model.pushStackElement();
      model.pushEditOperations([], [{ range: model.getFullModelRange(), text: res.file.content }], () => null);
      model.pushStackElement();
      tab.mtimeMs = res.file.mtimeMs;
      markSaved(tab, model.getAlternativeVersionId());
      flash(`Reloaded "${tab.name}" from disk`);
    }
  } finally {
    checkingExternal = false;
  }
}
window.addEventListener('focus', () => void checkExternalChanges());

// ---------------------------------------------------------------- Folder & sidebar views

const searchView = new SearchView(
  $<HTMLInputElement>('search-input'),
  $<HTMLButtonElement>('search-case'),
  $('search-status'),
  $('search-results'),
  { getRoot: () => settings.folder, openAt: (p, l, c, n) => void openAt(p, l, c, n) },
);

function setSidebarView(view: 'explorer' | 'search'): void {
  document.body.classList.toggle('view-search', view === 'search');
  document.querySelectorAll<HTMLElement>('.view-tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === view)));
}

function showSidebar(): void {
  if (settings.sidebar) return;
  settings.sidebar = true;
  document.body.classList.add('has-sidebar');
  persist();
}

async function setFolder(folderPath: string | null): Promise<void> {
  settings.folder = folderPath;
  persist();
  $('st-folder').textContent = folderPath ?? '';
  $('st-folder').title = folderPath ?? '';
  if (folderPath) showSidebar();
  await explorer.setRoot(folderPath);
  explorer.select(activeTab?.path ?? null);
}

async function openFolder(): Promise<void> {
  const folder = await window.api.pickFolder();
  if (folder) await setFolder(folder);
}

function toggleSidebar(): void {
  settings.sidebar = !settings.sidebar;
  document.body.classList.toggle('has-sidebar', settings.sidebar);
  persist();
}

function focusSearch(): void {
  showSidebar();
  setSidebarView('search');
  const sel = editor.getSelection();
  const model = editor.getModel();
  const selected = model && sel && !sel.isEmpty() ? model.getValueInRange(sel) : '';
  searchView.focus(selected && !selected.includes('\n') ? selected : undefined);
}

// ---------------------------------------------------------------- Terminal

const terminals = new TerminalPanel({
  host: $('terminals'),
  tabs: $('term-tabs'),
  fontFamily: MONO_FONT,
  fontSize: Math.max(8, settings.fontSize - 1),
  theme: settings.theme,
  getCwd: () => settings.folder ?? (activeTab?.path ? dirname(activeTab.path) : null),
  onEmpty: () => {
    hidePanel();
    if (activeTab) editor.focus();
  },
  onError: (message) => toast(message, 'error'),
});

const panelVisible = () => document.body.classList.contains('has-panel');
const hidePanel = () => document.body.classList.remove('has-panel');

async function showTerminal(): Promise<void> {
  document.body.classList.add('has-panel');
  if (terminals.count === 0) {
    await terminals.create();
  } else {
    terminals.fitActive();
    terminals.focus();
  }
}

async function toggleTerminal(): Promise<void> {
  if (panelVisible() && terminals.hasFocus()) {
    hidePanel();
    if (activeTab) editor.focus();
  } else if (panelVisible()) {
    terminals.focus();
  } else {
    await showTerminal();
  }
}

async function newTerminal(): Promise<void> {
  document.body.classList.add('has-panel');
  await terminals.create();
}

// ---------------------------------------------------------------- View

function applyTheme(): void {
  document.documentElement.dataset.theme = settings.theme;
  monaco.editor.setTheme(settings.theme === 'dark' ? 'vyrnex-dark' : 'vyrnex-light');
  terminals.setTheme(settings.theme);
}

function setFontSize(size: number): void {
  settings.fontSize = Math.min(40, Math.max(8, size));
  editor.updateOptions({ fontSize: settings.fontSize });
  terminals.setFontSize(Math.max(8, settings.fontSize - 1));
  persist();
  flash(`Font size ${settings.fontSize}`);
}

function runEditorAction(id: string): void {
  if (!activeTab) return;
  editor.focus();
  editor.trigger('menu', id, null);
}

// ---------------------------------------------------------------- Commands

const actions: Record<MenuAction, () => void | Promise<unknown>> = {
  'new-file': newFile,
  'open-file': openFiles,
  'open-folder': openFolder,
  'close-folder': () => setFolder(null),
  save: () => (activeTab ? save(activeTab) : undefined),
  'save-as': () => (activeTab ? saveAs(activeTab) : undefined),
  'save-all': saveAll,
  'close-tab': () => (activeTab ? closeTab(activeTab) : undefined),
  'quick-open': quickOpen,
  'command-palette': openCommandPalette,
  find: () => runEditorAction('actions.find'),
  replace: () => runEditorAction('editor.action.startFindReplace'),
  'goto-line': () => runEditorAction('editor.action.gotoLine'),
  'find-in-files': focusSearch,
  'toggle-sidebar': toggleSidebar,
  'toggle-terminal': toggleTerminal,
  'new-terminal': newTerminal,
  'kill-terminal': () => terminals.killActive(),
  'toggle-word-wrap': () => {
    settings.wordWrap = !settings.wordWrap;
    editor.updateOptions({ wordWrap: settings.wordWrap ? 'on' : 'off' });
    persist();
    flash(`Word wrap ${settings.wordWrap ? 'on' : 'off'}`);
  },
  'toggle-minimap': () => {
    settings.minimap = !settings.minimap;
    editor.updateOptions({ minimap: { enabled: settings.minimap } });
    persist();
  },
  'toggle-auto-save': () => {
    settings.autoSave = !settings.autoSave;
    persist();
    updateStatus();
    flash(`Auto save ${settings.autoSave ? 'on' : 'off'}`);
    if (settings.autoSave) void saveAll();
  },
  'toggle-theme': () => {
    settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
    applyTheme();
    persist();
  },
  'zoom-in': () => setFontSize(settings.fontSize + 1),
  'zoom-out': () => setFontSize(settings.fontSize - 1),
  'zoom-reset': () => setFontSize(DEFAULTS.fontSize),
};

const appCommands: { label: string; keys?: string; action: MenuAction }[] = [
  { label: 'File: New File', keys: `${MOD}+N`, action: 'new-file' },
  { label: 'File: Open File…', keys: `${MOD}+O`, action: 'open-file' },
  { label: 'File: Open Folder…', keys: `${MOD}+Shift+O`, action: 'open-folder' },
  { label: 'File: Close Folder', action: 'close-folder' },
  { label: 'File: Save', keys: `${MOD}+S`, action: 'save' },
  { label: 'File: Save As…', keys: `${MOD}+Shift+S`, action: 'save-as' },
  { label: 'File: Save All', keys: `${MOD}+Alt+S`, action: 'save-all' },
  { label: 'File: Toggle Auto Save', action: 'toggle-auto-save' },
  { label: 'File: Close Tab', keys: `${MOD}+W`, action: 'close-tab' },
  { label: 'Go to File…', keys: `${MOD}+P`, action: 'quick-open' },
  { label: 'Search: Find in Files', keys: `${MOD}+Shift+F`, action: 'find-in-files' },
  { label: 'View: Toggle Sidebar', keys: `${MOD}+B`, action: 'toggle-sidebar' },
  { label: 'View: Toggle Word Wrap', keys: 'Alt+Z', action: 'toggle-word-wrap' },
  { label: 'View: Toggle Minimap', action: 'toggle-minimap' },
  { label: 'View: Toggle Light/Dark Theme', action: 'toggle-theme' },
  { label: 'View: Zoom In', keys: `${MOD}+=`, action: 'zoom-in' },
  { label: 'View: Zoom Out', keys: `${MOD}+-`, action: 'zoom-out' },
  { label: 'View: Reset Zoom', keys: `${MOD}+0`, action: 'zoom-reset' },
  { label: 'Terminal: Toggle Terminal', keys: `${MOD}+J`, action: 'toggle-terminal' },
  { label: 'Terminal: New Terminal', keys: `${MOD}+Shift+J`, action: 'new-terminal' },
  { label: 'Terminal: Kill Active Terminal', action: 'kill-terminal' },
];

function openCommandPalette(): void {
  const items: PaletteItem[] = appCommands.map((c) => ({ label: c.label, keys: c.keys, run: () => actions[c.action]() }));
  if (activeTab) {
    for (const action of editor.getSupportedActions()) {
      if (!action.label || action.id === 'editor.action.quickCommand' || !action.isSupported()) continue;
      items.push({
        label: `Editor: ${action.label}`,
        run: () => {
          editor.focus();
          return action.run();
        },
      });
    }
  }
  palette.open(items, 'Type a command…');
}

async function quickOpen(): Promise<void> {
  const root = settings.folder;
  if (!root) {
    toast('Open a folder first to use Go to File.');
    return;
  }
  const res = await window.api.listFiles(root);
  if (!res.ok) {
    toast(res.error, 'error');
    return;
  }
  const open = new Set(tabs.flatMap((t) => (t.path ? [t.path] : [])));
  const items: PaletteItem[] = res.files
    .map((p) => {
      const relative = p.startsWith(root) ? p.slice(root.length).replace(/^[\\/]/, '') : p;
      const name = basename(p);
      return {
        path: p,
        label: name,
        detail: relative.slice(0, relative.length - name.length).replace(/[\\/]$/, ''),
        run: () => openPath(p),
      };
    })
    .sort((a, b) => Number(open.has(b.path)) - Number(open.has(a.path)));
  palette.open(items, res.truncated ? 'Go to file… (list limited to 20,000 files)' : 'Go to file…');
}

// ---------------------------------------------------------------- Keyboard shortcuts

interface Shortcut {
  keys: string[];
  mod?: boolean; // default true
  shift?: boolean;
  anyShift?: boolean;
  alt?: boolean;
  inTerminal?: boolean;
  action: MenuAction;
}

// Handled here (not via menu accelerators) so the terminal keeps keys like Ctrl+W or Ctrl+B.
const shortcuts: Shortcut[] = [
  { keys: ['n'], action: 'new-file' },
  { keys: ['o'], action: 'open-file' },
  { keys: ['o'], shift: true, action: 'open-folder' },
  { keys: ['s'], action: 'save' },
  { keys: ['s'], shift: true, action: 'save-as' },
  { keys: ['s'], alt: true, action: 'save-all' },
  { keys: ['w'], action: 'close-tab' },
  { keys: ['p'], action: 'quick-open' },
  { keys: ['p'], shift: true, action: 'command-palette', inTerminal: true },
  { keys: ['f1'], mod: false, action: 'command-palette', inTerminal: true },
  { keys: ['f'], shift: true, action: 'find-in-files' },
  { keys: ['b'], action: 'toggle-sidebar' },
  { keys: ['j', '`'], action: 'toggle-terminal', inTerminal: true },
  { keys: ['j', '`', '~'], shift: true, action: 'new-terminal', inTerminal: true },
  { keys: ['z'], mod: false, alt: true, action: 'toggle-word-wrap' },
  { keys: ['=', '+'], anyShift: true, action: 'zoom-in' },
  { keys: ['-'], action: 'zoom-out' },
  { keys: ['0'], action: 'zoom-reset' },
];

function matches(e: KeyboardEvent, s: Shortcut): boolean {
  const modDown = isMac ? e.metaKey : e.ctrlKey;
  const needsMod = s.mod ?? true;
  if (needsMod ? !modDown : e.ctrlKey || e.metaKey) return false;
  if (!s.anyShift && !!s.shift !== e.shiftKey) return false;
  if (!!s.alt !== e.altKey) return false;
  return s.keys.includes(e.key.toLowerCase());
}

window.addEventListener(
  'keydown',
  (e) => {
    if (palette.isOpen) return;
    const inTerminal = (e.target as Element | null)?.closest?.('#panel') != null;

    // Cycle tabs: Ctrl+Tab / Ctrl+Shift+Tab / Ctrl+PageUp / Ctrl+PageDown
    if (e.ctrlKey && !inTerminal && tabs.length > 1 && activeTab) {
      const forward = e.key === 'Tab' ? !e.shiftKey : e.key === 'PageDown';
      const backward = e.key === 'Tab' ? e.shiftKey : e.key === 'PageUp';
      if (forward || backward) {
        e.preventDefault();
        const i = tabs.indexOf(activeTab);
        activate(tabs[(i + (forward ? 1 : -1) + tabs.length) % tabs.length]);
        return;
      }
    }

    const shortcut = shortcuts.find((s) => matches(e, s));
    if (!shortcut || (inTerminal && !shortcut.inTerminal)) return;
    e.preventDefault();
    e.stopPropagation();
    void actions[shortcut.action]();
  },
  true,
);

// ---------------------------------------------------------------- Wiring

window.api.onMenuAction((action) => void actions[action]?.());
window.api.onOpenPaths((paths) => {
  void (async () => {
    for (const p of paths) await openPath(p);
  })();
});

// Closing the window: resolve unsaved tabs first
window.api.onCloseRequest(() => {
  void (async () => {
    for (const tab of tabs.filter((t) => t.dirty)) {
      if (!(await confirmDiscardOrSave(tab))) return;
    }
    window.api.closeWindow();
  })();
});

document.querySelectorAll<HTMLElement>('[data-action]').forEach((btn) => {
  btn.addEventListener('click', () => void actions[btn.dataset.action as MenuAction]?.());
});
document.querySelectorAll<HTMLElement>('.view-tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (btn.dataset.view === 'search') focusSearch();
    else setSidebarView('explorer');
  });
});
$('btn-open-folder').addEventListener('click', () => void openFolder());
$('btn-refresh').addEventListener('click', () => void explorer.refresh());
$('term-new').addEventListener('click', () => void newTerminal());
$('term-hide').addEventListener('click', () => {
  hidePanel();
  if (activeTab) editor.focus();
});
$('st-terminal').addEventListener('click', () => void toggleTerminal());

// Status bar
editor.onDidChangeCursorPosition(updateStatus);
editor.onDidChangeCursorSelection(updateStatus);
$('st-pos').addEventListener('click', () => runEditorAction('editor.action.gotoLine'));
$('st-eol').addEventListener('click', () => {
  const model = editor.getModel();
  if (!model) return;
  const crlf = model.getEOL() === '\r\n';
  model.pushEOL(crlf ? monaco.editor.EndOfLineSequence.LF : monaco.editor.EndOfLineSequence.CRLF);
});

const langSelect = $<HTMLSelectElement>('st-lang');
const languages = [...monaco.languages.getLanguages()].sort((a, b) =>
  (a.aliases?.[0] ?? a.id).localeCompare(b.aliases?.[0] ?? b.id),
);
for (const lang of languages) {
  const option = document.createElement('option');
  option.value = lang.id;
  option.textContent = lang.aliases?.[0] ?? lang.id;
  langSelect.append(option);
}
langSelect.addEventListener('change', () => {
  const model = editor.getModel();
  if (model) monaco.editor.setModelLanguage(model, langSelect.value);
  editor.focus();
});

// Scroll the tab strip horizontally with the mouse wheel
tabsEl.addEventListener(
  'wheel',
  (e) => {
    if (e.deltaY === 0) return;
    e.preventDefault();
    tabsEl.scrollLeft += e.deltaY;
  },
  { passive: false },
);

// Drag handles: sidebar width and panel height
function startDrag(handle: HTMLElement, onMove: (ev: MouseEvent) => void): void {
  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    document.body.classList.add('resizing');
    handle.classList.add('dragging');
    const up = () => {
      document.body.classList.remove('resizing');
      handle.classList.remove('dragging');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', up);
      persist();
      terminals.fitActive();
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', up);
  });
}

startDrag($('splitter'), (ev) => {
  settings.sidebarWidth = Math.min(600, Math.max(160, ev.clientX));
  document.documentElement.style.setProperty('--sidebar-width', `${settings.sidebarWidth}px`);
});
startDrag($('panel-splitter'), (ev) => {
  const bottom = $('statusbar').getBoundingClientRect().top;
  settings.panelHeight = Math.min(window.innerHeight - 220, Math.max(100, Math.round(bottom - ev.clientY)));
  document.documentElement.style.setProperty('--panel-height', `${settings.panelHeight}px`);
});

// Drag & drop of files and folders
let dragDepth = 0;
const hasFiles = (e: DragEvent) => Boolean(e.dataTransfer?.types.includes('Files'));
document.addEventListener('dragenter', (e) => {
  if (!hasFiles(e)) return;
  dragDepth++;
  document.body.classList.add('dragging');
});
document.addEventListener('dragleave', () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) document.body.classList.remove('dragging');
});
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  document.body.classList.remove('dragging');
  // DataTransfer can only be read synchronously
  const dropped = Array.from(e.dataTransfer?.items ?? []).flatMap((item) => {
    const file = item.getAsFile();
    const p = file ? window.api.getPathForFile(file) : '';
    return p ? [{ path: p, isDir: item.webkitGetAsEntry()?.isDirectory ?? false }] : [];
  });
  void (async () => {
    for (const item of dropped) {
      if (item.isDir) await setFolder(item.path);
      else await openPath(item.path);
    }
  })();
});

// ---------------------------------------------------------------- Start

async function restoreSession(): Promise<void> {
  if (settings.folder) await setFolder(settings.folder);
  const { files, active } = settings.session;
  for (const p of files) await openPath(p, { silent: true, activate: false });
  const target = tabs.find((t) => t.path && active && samePath(t.path, active)) ?? tabs[0];
  if (target) activate(target);
}

applyTheme();
document.body.classList.toggle('has-sidebar', settings.sidebar);
document.documentElement.style.setProperty('--sidebar-width', `${settings.sidebarWidth}px`);
document.documentElement.style.setProperty('--panel-height', `${settings.panelHeight}px`);
renderTabs();
updateStatus();
void restoreSession();
