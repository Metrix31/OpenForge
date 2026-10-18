import { Terminal, type ITheme } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

type ThemeName = 'dark' | 'light';

const THEMES: Record<ThemeName, ITheme> = {
  dark: {
    background: '#14161f', foreground: '#d3d7e2', cursor: '#d3d7e2', cursorAccent: '#14161f',
    selectionBackground: 'rgba(130, 150, 200, 0.35)',
    black: '#1b1e2a', red: '#f0707f', green: '#8fcf8c', yellow: '#e5c07b',
    blue: '#6ea8ff', magenta: '#c792ea', cyan: '#56c8d8', white: '#d3d7e2',
    brightBlack: '#5b6278', brightRed: '#ff8c99', brightGreen: '#a6e3a1', brightYellow: '#f2d58f',
    brightBlue: '#8bbcff', brightMagenta: '#d7aaf5', brightCyan: '#7ad9e6', brightWhite: '#ffffff',
  },
  light: {
    background: '#fafbfd', foreground: '#272b38', cursor: '#272b38', cursorAccent: '#fafbfd',
    selectionBackground: 'rgba(80, 110, 190, 0.25)',
    black: '#272b38', red: '#c0392b', green: '#2e7d32', yellow: '#9a6700',
    blue: '#1f5fbf', magenta: '#8e44ad', cyan: '#0e7490', white: '#bfc4d1',
    brightBlack: '#667088', brightRed: '#d9534f', brightGreen: '#3a9a40', brightYellow: '#b7791f',
    brightBlue: '#3b7de0', brightMagenta: '#a45bc4', brightCyan: '#1592b0', brightWhite: '#ffffff',
  },
};

interface Session {
  id: number;
  title: string;
  term: Terminal;
  fit: FitAddon;
  el: HTMLElement;
}

export interface TerminalPanelOptions {
  host: HTMLElement;
  tabs: HTMLElement;
  fontFamily: string;
  fontSize: number;
  theme: ThemeName;
  getCwd: () => string | null;
  onEmpty: () => void;
  onError: (message: string) => void;
}

export class TerminalPanel {
  private readonly sessions: Session[] = [];
  private active: Session | null = null;
  private readonly pending = new Map<number, string[]>();
  private readonly earlyExit = new Map<number, number>();
  private readonly closed = new Set<number>();
  private fontSize: number;
  private theme: ThemeName;
  private fitFrame = 0;

  constructor(private readonly opts: TerminalPanelOptions) {
    this.fontSize = opts.fontSize;
    this.theme = opts.theme;
    window.api.onTermData((id, data) => this.onData(id, data));
    window.api.onTermExit((id, code) => this.onExit(id, code));
    new ResizeObserver(() => this.scheduleFit()).observe(opts.host);
  }

  get count(): number {
    return this.sessions.length;
  }

  hasFocus(): boolean {
    return this.opts.host.contains(document.activeElement);
  }

  focus(): void {
    this.active?.term.focus();
  }

  fitActive(): void {
    const { host } = this.opts;
    if (!this.active || host.clientWidth === 0 || host.clientHeight === 0) return;
    try {
      this.active.fit.fit();
    } catch {
      /* not measurable yet */
    }
  }

  setTheme(theme: ThemeName): void {
    this.theme = theme;
    for (const s of this.sessions) s.term.options.theme = THEMES[theme];
  }

  setFontSize(size: number): void {
    this.fontSize = size;
    for (const s of this.sessions) s.term.options.fontSize = size;
    this.scheduleFit();
  }

  async create(): Promise<void> {
    const term = new Terminal({
      fontFamily: this.opts.fontFamily,
      fontSize: this.fontSize,
      lineHeight: 1.1,
      cursorBlink: true,
      scrollback: 5000,
      theme: THEMES[this.theme],
    });
    const fit = new FitAddon();
    term.loadAddon(fit);

    const el = document.createElement('div');
    el.className = 'term-instance active';
    this.sessions.forEach((s) => s.el.classList.remove('active'));
    this.opts.host.append(el);
    term.open(el);
    try {
      fit.fit();
    } catch {
      /* not measurable yet */
    }
    this.installHandlers(term, el);

    const res = await window.api.termCreate({ cwd: this.opts.getCwd(), cols: term.cols, rows: term.rows });
    if (!res.ok) {
      term.dispose();
      el.remove();
      this.active?.el.classList.add('active');
      this.opts.onError(`Could not start the terminal: ${res.error}`);
      if (this.sessions.length === 0) this.opts.onEmpty();
      return;
    }

    const session: Session = { id: res.id, title: res.shell, term, fit, el };
    this.sessions.push(session);
    term.onData((data) => window.api.termWrite(session.id, data));
    term.onResize(({ cols, rows }) => window.api.termResize(session.id, cols, rows));
    this.activate(session);

    for (const chunk of this.pending.get(res.id) ?? []) term.write(chunk);
    this.pending.delete(res.id);
    const exitCode = this.earlyExit.get(res.id);
    if (exitCode !== undefined) {
      this.earlyExit.delete(res.id);
      this.onExit(res.id, exitCode);
    }
  }

  killActive(): void {
    if (this.active) this.close(this.active);
  }

  private installHandlers(term: Terminal, el: HTMLElement): void {
    const copy = () => {
      void navigator.clipboard.writeText(term.getSelection());
      term.clearSelection();
    };
    const paste = () => {
      void navigator.clipboard.readText().then((text) => term.paste(text)).catch(() => undefined);
    };

    term.attachCustomKeyEventHandler((ev) => {
      if (ev.type !== 'keydown') return true;
      const key = ev.key.toLowerCase();
      const isCopy = (ev.metaKey && key === 'c') || (ev.ctrlKey && key === 'c' && (ev.shiftKey || term.hasSelection()));
      const isPaste = (ev.metaKey || ev.ctrlKey) && key === 'v';
      if (isCopy) {
        ev.preventDefault();
        if (term.hasSelection()) copy();
        return false;
      }
      if (isPaste) {
        ev.preventDefault();
        paste();
        return false;
      }
      return true; // Ctrl+C without selection stays an interrupt
    });

    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (term.hasSelection()) copy();
      else paste();
    });
  }

  private onData(id: number, data: string): void {
    if (this.closed.has(id)) return;
    const session = this.sessions.find((s) => s.id === id);
    if (session) {
      session.term.write(data);
      return;
    }
    const buffer = this.pending.get(id) ?? [];
    buffer.push(data);
    this.pending.set(id, buffer);
  }

  private onExit(id: number, code: number): void {
    if (this.closed.has(id)) return;
    const session = this.sessions.find((s) => s.id === id);
    if (!session) {
      this.earlyExit.set(id, code);
      return;
    }
    if (code === 0) {
      this.remove(session);
    } else {
      session.term.write(`\r\n\x1b[2m[Process exited with code ${code}]\x1b[0m\r\n`);
    }
  }

  private activate(session: Session): void {
    this.active = session;
    this.sessions.forEach((s) => s.el.classList.toggle('active', s === session));
    this.renderTabs();
    this.fitActive();
    session.term.focus();
  }

  private close(session: Session): void {
    this.closed.add(session.id);
    window.api.termKill(session.id);
    this.remove(session);
  }

  private remove(session: Session): void {
    const index = this.sessions.indexOf(session);
    if (index === -1) return;
    this.sessions.splice(index, 1);
    session.term.dispose();
    session.el.remove();
    if (this.active === session) {
      this.active = null;
      const next = this.sessions[Math.min(index, this.sessions.length - 1)];
      if (next) this.activate(next);
    }
    this.renderTabs();
    if (this.sessions.length === 0) this.opts.onEmpty();
  }

  private renderTabs(): void {
    const numbered = this.sessions.length > 1;
    this.opts.tabs.replaceChildren(
      ...this.sessions.map((session, i) => {
        const tab = document.createElement('div');
        tab.className = 'term-tab' + (session === this.active ? ' active' : '');
        tab.setAttribute('role', 'tab');
        const name = document.createElement('span');
        name.textContent = numbered ? `${i + 1}: ${session.title}` : session.title;
        const close = document.createElement('button');
        close.className = 'close';
        close.textContent = '×';
        close.title = 'Kill Terminal';
        close.setAttribute('aria-label', 'Kill terminal');
        close.addEventListener('click', (e) => {
          e.stopPropagation();
          this.close(session);
        });
        tab.append(name, close);
        tab.addEventListener('click', () => this.activate(session));
        return tab;
      }),
    );
  }

  private scheduleFit(): void {
    cancelAnimationFrame(this.fitFrame);
    this.fitFrame = requestAnimationFrame(() => this.fitActive());
  }
}
