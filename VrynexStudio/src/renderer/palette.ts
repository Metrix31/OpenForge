export interface PaletteItem {
  label: string;
  detail?: string;
  keys?: string;
  run: () => unknown;
}

const MAX_RESULTS = 80;

/** Subsequence match with bonuses for consecutive characters and word starts. */
function fuzzy(query: string, text: string): number | null {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  let score = 0;
  let last = -2;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] !== q[qi]) continue;
    score += 1;
    if (i === last + 1) score += 3;
    if (i === 0 || '/\\ -_.:'.includes(t[i - 1])) score += 4;
    last = i;
    qi++;
  }
  return qi === q.length ? score - t.length * 0.01 : null;
}

function score(query: string, item: PaletteItem): number | null {
  const byLabel = fuzzy(query, item.label);
  if (byLabel !== null) return byLabel + 50;
  return item.detail ? fuzzy(query, `${item.detail}/${item.label}`) : null;
}

export class Palette {
  private items: PaletteItem[] = [];
  private shown: PaletteItem[] = [];
  private index = 0;
  private previousFocus: HTMLElement | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly input: HTMLInputElement,
    private readonly list: HTMLElement,
  ) {
    input.addEventListener('input', () => this.update());
    input.addEventListener('keydown', (e) => this.onKeyDown(e));
    root.addEventListener('mousedown', (e) => {
      if (e.target === root) {
        e.preventDefault();
        this.close();
      }
    });
    list.addEventListener('mousedown', (e) => e.preventDefault()); // keep focus in the input
    list.addEventListener('mousemove', (e) => {
      const li = (e.target as HTMLElement).closest<HTMLElement>('.palette-item');
      if (li) this.select(Number(li.dataset.index), false);
    });
    list.addEventListener('click', (e) => {
      const li = (e.target as HTMLElement).closest<HTMLElement>('.palette-item');
      if (!li) return;
      this.index = Number(li.dataset.index);
      this.accept();
    });
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  open(items: PaletteItem[], placeholder: string): void {
    this.items = items;
    this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.input.placeholder = placeholder;
    this.input.value = '';
    this.root.hidden = false;
    this.update();
    this.input.focus();
  }

  close(): void {
    if (!this.isOpen) return;
    this.root.hidden = true;
    this.items = [];
    this.shown = [];
    this.list.replaceChildren();
    if (this.previousFocus?.isConnected) this.previousFocus.focus();
    this.previousFocus = null;
  }

  private update(): void {
    const query = this.input.value.trim();
    if (!query) {
      this.shown = this.items.slice(0, MAX_RESULTS);
    } else {
      this.shown = this.items
        .map((item) => ({ item, s: score(query, item) }))
        .filter((r): r is { item: PaletteItem; s: number } => r.s !== null)
        .sort((a, b) => b.s - a.s)
        .slice(0, MAX_RESULTS)
        .map((r) => r.item);
    }
    this.index = 0;
    this.render();
  }

  private render(): void {
    if (this.shown.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'palette-empty';
      empty.textContent = 'No matching results';
      this.list.replaceChildren(empty);
      return;
    }
    this.list.replaceChildren(
      ...this.shown.map((item, i) => {
        const li = document.createElement('li');
        li.className = 'palette-item' + (i === this.index ? ' selected' : '');
        li.dataset.index = String(i);
        li.setAttribute('role', 'option');
        const label = document.createElement('span');
        label.className = 'p-label';
        label.textContent = item.label;
        li.append(label);
        if (item.detail) {
          const detail = document.createElement('span');
          detail.className = 'p-detail';
          detail.textContent = item.detail;
          li.append(detail);
        }
        if (item.keys) {
          const keys = document.createElement('span');
          keys.className = 'p-keys';
          keys.textContent = item.keys;
          li.append(keys);
        }
        return li;
      }),
    );
  }

  private select(i: number, scroll = true): void {
    this.index = i;
    Array.from(this.list.children).forEach((child, n) => child.classList.toggle('selected', n === i));
    if (scroll) this.list.children[i]?.scrollIntoView({ block: 'nearest' });
  }

  private accept(): void {
    const item = this.shown[this.index];
    if (!item) return;
    this.close(); // restores focus first, so the command can move focus itself
    void Promise.resolve()
      .then(() => item.run())
      .catch((err) => console.error(err));
  }

  private onKeyDown(e: KeyboardEvent): void {
    const count = this.shown.length;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (count) this.select((this.index + 1) % count);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (count) this.select((this.index - 1 + count) % count);
        break;
      case 'Enter':
        e.preventDefault();
        this.accept();
        break;
      case 'Escape':
        e.preventDefault();
        this.close();
        break;
    }
  }
}
