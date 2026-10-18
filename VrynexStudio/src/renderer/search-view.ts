import type { SearchMatch } from '../shared/types';

export interface SearchViewOptions {
  getRoot(): string | null;
  openAt(path: string, line: number, column: number, length: number): void;
}

export class SearchView {
  private token = 0;
  private timer = 0;

  constructor(
    private readonly input: HTMLInputElement,
    private readonly caseButton: HTMLButtonElement,
    private readonly statusEl: HTMLElement,
    private readonly resultsEl: HTMLElement,
    private readonly opts: SearchViewOptions,
  ) {
    input.addEventListener('input', () => {
      window.clearTimeout(this.timer);
      this.timer = window.setTimeout(() => void this.run(), 350);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      window.clearTimeout(this.timer);
      void this.run();
    });
    caseButton.addEventListener('click', () => {
      caseButton.setAttribute('aria-pressed', String(caseButton.getAttribute('aria-pressed') !== 'true'));
      void this.run();
    });
  }

  focus(prefill?: string): void {
    if (prefill) this.input.value = prefill;
    this.input.focus();
    this.input.select();
    if (prefill) void this.run();
  }

  async run(): Promise<void> {
    const query = this.input.value;
    const root = this.opts.getRoot();
    const token = ++this.token;
    if (!query) {
      this.statusEl.textContent = '';
      this.resultsEl.replaceChildren();
      return;
    }
    if (!root) {
      this.statusEl.textContent = 'Open a folder to search in it.';
      this.resultsEl.replaceChildren();
      return;
    }
    this.statusEl.textContent = 'Searching…';
    const res = await window.api.searchInFiles(root, query, this.caseButton.getAttribute('aria-pressed') === 'true');
    if (token !== this.token) return; // a newer search is running
    if (!res.ok) {
      this.statusEl.textContent = res.error;
      this.resultsEl.replaceChildren();
      return;
    }
    this.render(res.matches, root, res.truncated);
  }

  private render(matches: SearchMatch[], root: string, truncated: boolean): void {
    const groups = new Map<string, SearchMatch[]>();
    for (const m of matches) {
      const list = groups.get(m.path) ?? [];
      list.push(m);
      groups.set(m.path, list);
    }
    this.statusEl.textContent = matches.length
      ? `${matches.length} result${matches.length === 1 ? '' : 's'} in ${groups.size} file${groups.size === 1 ? '' : 's'}${truncated ? ' (limited)' : ''}`
      : 'No results.';

    const nodes: HTMLElement[] = [];
    for (const [filePath, list] of groups) {
      const relative = filePath.startsWith(root) ? filePath.slice(root.length).replace(/^[\\/]/, '') : filePath;
      const name = relative.split(/[\\/]/).pop() ?? relative;
      const dir = relative.slice(0, relative.length - name.length).replace(/[\\/]$/, '');

      const header = document.createElement('div');
      header.className = 'sr-file';
      header.title = filePath;
      const nameEl = document.createElement('span');
      nameEl.textContent = name;
      const dirEl = document.createElement('span');
      dirEl.className = 'dir';
      dirEl.textContent = dir;
      const count = document.createElement('span');
      count.className = 'sr-count';
      count.textContent = String(list.length);
      header.append(nameEl, dirEl, count);
      nodes.push(header);

      for (const m of list) {
        const row = document.createElement('div');
        row.className = 'sr-match';
        const line = document.createElement('span');
        line.className = 'sr-line';
        line.textContent = String(m.line);
        const text = document.createElement('span');
        text.className = 'sr-text';
        text.textContent = m.preview;
        row.append(line, text);
        row.addEventListener('click', () => this.opts.openAt(m.path, m.line, m.column, m.length));
        nodes.push(row);
      }
    }
    this.resultsEl.replaceChildren(...nodes);
  }
}
