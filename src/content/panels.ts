import { BASE_CSS, createHost, h } from './dom';

const PANEL_CSS = `${BASE_CSS}
.card { margin: 48px auto; max-width: 560px; padding: 28px; border-radius: 16px; background: #141b1c; color: #d8e2df;
  border: 1px solid #263032; }
h2 { margin: 0 0 6px; font-size: 22px; font-weight: 600; }
p { margin: 0 0 16px; color: #9fb3ae; font-size: 14px; line-height: 1.5; }
form { display: flex; gap: 8px; }
input { flex: 1; height: 40px; padding: 0 12px; border-radius: 10px; border: 1px solid #34413f; background: #0b0f10; color: #d8e2df; font-size: 14px; }
.go { height: 40px; padding: 0 16px; border: 0; border-radius: 10px; background: #00b87a; color: #04140d; font-weight: 600; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.chip { padding: 6px 12px; border-radius: 999px; border: 1px solid #34413f; background: transparent; color: #d8e2df; font-size: 13px; }
.chip:hover { border-color: #00b87a; }
.link { margin-top: 18px; padding: 0; border: 0; background: none; color: #9fb3ae; font-size: 13px; text-decoration: underline; }
`;

export interface HomePanelActions {
  search: (query: string) => void;
  exit: () => void;
}

/** Replaces the hidden home-page recommendations with a topic search box (inline, not an overlay). */
export class HomePanel {
  private host: HTMLElement | null = null;
  private input: HTMLInputElement | null = null;
  private chips: HTMLElement | null = null;
  private chipKey = '';

  constructor(
    private readonly doc: Document,
    private readonly actions: HomePanelActions,
  ) {}

  private build(): HTMLElement {
    const { host, root } = createHost(this.doc, 'focustube-home');
    const style = h(this.doc, 'style');
    style.textContent = PANEL_CSS;
    this.input = h(this.doc, 'input', {
      type: 'search',
      placeholder: 'What are you learning today?',
      'aria-label': 'Topic to search',
    });
    const form = h(
      this.doc,
      'form',
      {},
      this.input,
      h(this.doc, 'button', { class: 'go', type: 'submit' }, 'Search'),
    );
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = this.input?.value.trim();
      if (q) this.actions.search(q);
    });
    this.chips = h(this.doc, 'div', { class: 'chips' });
    const exit = h(
      this.doc,
      'button',
      { class: 'link', type: 'button' },
      'Exit focus mode and show YouTube as usual',
    );
    exit.addEventListener('click', this.actions.exit);
    root.append(
      style,
      h(
        this.doc,
        'div',
        { class: 'card', role: 'region', 'aria-label': 'FocusTube study mode' },
        h(this.doc, 'h2', {}, 'Study Mode is on'),
        h(this.doc, 'p', {}, 'Recommendations are hidden. Search for what you want to learn.'),
        form,
        this.chips,
        exit,
      ),
    );
    return host;
  }

  show(topics: string[], activeTopic: string | null): void {
    const grid = this.doc.querySelector('ytd-browse[page-subtype="home"] ytd-rich-grid-renderer');
    if (!grid?.parentElement) return;
    if (!this.host) this.host = this.build();
    if (this.host.nextElementSibling !== grid) grid.parentElement.insertBefore(this.host, grid);
    const key = topics.join('\u0000');
    if (key !== this.chipKey && this.chips) {
      this.chipKey = key;
      this.chips.replaceChildren(
        ...topics.slice(0, 8).map((t) => {
          const b = h(this.doc, 'button', { class: 'chip', type: 'button' }, t);
          b.addEventListener('click', () => this.actions.search(t));
          return b;
        }),
      );
    }
    if (this.input && !this.input.value && activeTopic && this.doc.activeElement !== this.input)
      this.input.value = activeTopic;
  }

  hide(): void {
    this.host?.remove();
  }

  dispose(): void {
    this.host?.remove();
    this.host = null;
  }
}

const MSG_CSS = `${BASE_CSS}
.msg { position: fixed; top: 96px; left: 50%; transform: translateX(-50%); z-index: 2200; max-width: 420px; padding: 20px 24px;
  border-radius: 14px; background: #141b1c; color: #d8e2df; border: 1px solid #00b87a66; box-shadow: 0 12px 32px rgba(0,0,0,.5); }
h2 { margin: 0 0 6px; font-size: 17px; font-weight: 600; }
p { margin: 0 0 14px; font-size: 14px; color: #9fb3ae; line-height: 1.5; }
.row { display: flex; gap: 8px; }
button { padding: 8px 14px; border-radius: 10px; border: 1px solid #34413f; background: transparent; color: #d8e2df; font-size: 13px; }
button.primary { background: #00b87a; border-color: #00b87a; color: #04140d; font-weight: 600; }
`;

/** Small accessible notice shown when a direct Shorts URL cannot be converted to a watch URL. */
export class BlockedMessage {
  private host: HTMLElement | null = null;

  constructor(
    private readonly doc: Document,
    private readonly actions: { back: () => void; home: () => void },
  ) {}

  show(): void {
    if (this.host?.isConnected) return;
    const { host, root } = createHost(this.doc, 'focustube-blocked');
    const style = h(this.doc, 'style');
    style.textContent = MSG_CSS;
    const back = h(this.doc, 'button', { type: 'button', class: 'primary' }, 'Go back');
    const home = h(this.doc, 'button', { type: 'button' }, 'YouTube home');
    back.addEventListener('click', this.actions.back);
    home.addEventListener('click', this.actions.home);
    root.append(
      style,
      h(
        this.doc,
        'div',
        { class: 'msg', role: 'alert' },
        h(this.doc, 'h2', {}, 'Shorts are blocked by FocusTube'),
        h(this.doc, 'p', {}, 'This Short can’t be opened as a regular video.'),
        h(this.doc, 'div', { class: 'row' }, back, home),
      ),
    );
    this.doc.body?.appendChild(host);
    this.host = host;
    back.focus();
  }

  hide(): void {
    this.host?.remove();
    this.host = null;
  }
}
