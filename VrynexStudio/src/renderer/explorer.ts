import type { DirEntry } from '../shared/types';

export interface ExplorerCallbacks {
  onOpenFile(path: string): void;
  onOpenFolder(): void;
}

const basename = (p: string) => p.split(/[\\/]/).filter(Boolean).pop() ?? p;

export class Explorer {
  private root: string | null = null;
  private readonly expanded = new Set<string>();
  private selected: string | null = null;
  private renderToken = 0;

  constructor(
    private readonly el: HTMLElement,
    private readonly cb: ExplorerCallbacks,
  ) {
    this.showEmpty();
  }

  async setRoot(root: string | null): Promise<void> {
    this.root = root;
    this.expanded.clear();
    await this.refresh();
  }

  async refresh(): Promise<void> {
    const token = ++this.renderToken;
    if (!this.root) {
      this.showEmpty();
      return;
    }
    const tree = document.createElement('div');
    const label = document.createElement('div');
    label.className = 'root-label';
    label.textContent = basename(this.root);
    label.title = this.root;
    tree.append(label);
    await this.renderDir(tree, this.root, 0, token);
    if (token !== this.renderToken) return; // a newer refresh is already running
    this.el.replaceChildren(tree);
    this.markSelected();
  }

  select(path: string | null): void {
    this.selected = path;
    this.markSelected();
  }

  private showEmpty(): void {
    const box = document.createElement('div');
    box.className = 'empty-explorer';
    box.textContent = 'No folder opened yet.';
    const btn = document.createElement('button');
    btn.textContent = 'Open Folder';
    btn.addEventListener('click', () => this.cb.onOpenFolder());
    box.append(document.createElement('br'), btn);
    this.el.replaceChildren(box);
  }

  private markSelected(): void {
    this.el.querySelectorAll<HTMLElement>('.row').forEach((row) => {
      row.classList.toggle('selected', row.dataset.path === this.selected);
    });
  }

  private async renderDir(container: HTMLElement, dirPath: string, depth: number, token: number): Promise<void> {
    const res = await window.api.readDir(dirPath);
    if (token !== this.renderToken) return;
    if (!res.ok) {
      const err = document.createElement('div');
      err.className = 'explorer-error';
      err.textContent = res.error;
      container.append(err);
      return;
    }
    for (const entry of res.entries) {
      container.append(this.createRow(entry, depth));
      if (entry.isDirectory && this.expanded.has(entry.path)) {
        const children = document.createElement('div');
        children.dataset.children = entry.path;
        container.append(children);
        await this.renderDir(children, entry.path, depth + 1, token);
      }
    }
  }

  private createRow(entry: DirEntry, depth: number): HTMLElement {
    const row = document.createElement('div');
    row.className = 'row' + (entry.isDirectory ? ' dir' : '');
    row.dataset.path = entry.path;
    row.tabIndex = 0;
    row.title = entry.path;
    row.style.paddingLeft = `${10 + depth * 14}px`;

    const chevron = document.createElement('span');
    chevron.className = 'chevron';
    chevron.textContent = entry.isDirectory ? '▶' : '';
    const name = document.createElement('span');
    name.className = 'label';
    name.textContent = entry.name;
    row.append(chevron, name);

    if (entry.isDirectory && this.expanded.has(entry.path)) row.classList.add('open');

    const activate = () => {
      if (!entry.isDirectory) this.cb.onOpenFile(entry.path);
      else void this.toggleDir(entry, row, depth);
    };
    row.addEventListener('click', activate);
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activate();
      }
    });
    return row;
  }

  private async toggleDir(entry: DirEntry, row: HTMLElement, depth: number): Promise<void> {
    const next = row.nextElementSibling as HTMLElement | null;
    const existing = next?.dataset.children === entry.path ? next : null;
    if (this.expanded.has(entry.path)) {
      this.expanded.delete(entry.path);
      row.classList.remove('open');
      existing?.remove();
      return;
    }
    this.expanded.add(entry.path);
    row.classList.add('open');
    const children = document.createElement('div');
    children.dataset.children = entry.path;
    row.after(children);
    await this.renderDir(children, entry.path, depth + 1, this.renderToken);
    this.markSelected();
  }
}
