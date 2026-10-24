import { activeElapsedMs, remainingMs } from '../shared/session';
import type { FocusSession } from '../shared/types';
import { formatClock } from '../shared/util';
import { BASE_CSS, createHost, h } from './dom';

export interface HudState {
  topicName: string | null;
  session: FocusSession | null;
  canGoBack: boolean;
  canQueue: boolean;
  filteredCount: number;
  bypass: boolean;
  now: number;
}

export interface HudActions {
  back: () => void;
  addToQueue: () => void;
  toggleBypass: () => void;
  pauseResume: () => void;
  exit: () => void;
}

const CSS = `${BASE_CSS}
.wrap { position: relative; display: inline-block; margin-right: 8px; }
.pill { display: inline-flex; align-items: center; gap: 8px; height: 32px; padding: 0 12px; border-radius: 16px;
  border: 1px solid #00b87a66; background: #0b0f10; color: #d8e2df; font-size: 13px; max-width: 320px; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: #00b87a; flex: none; }
.topic { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 150px; color: #9fb3ae; }
.time { font-variant-numeric: tabular-nums; color: #00b87a; }
.menu { position: absolute; right: 0; top: 38px; min-width: 220px; padding: 6px; border-radius: 12px; background: #141b1c;
  border: 1px solid #263032; box-shadow: 0 8px 24px rgba(0,0,0,.45); z-index: 10; display: flex; flex-direction: column; }
.menu[hidden] { display: none; }
.item { text-align: left; padding: 8px 10px; border: 0; border-radius: 8px; background: transparent; color: #d8e2df; font-size: 13px; }
.item:hover { background: #1d2728; }
.item[hidden] { display: none; }
.item.danger { color: #ff9a8a; }
`;

/** Compact status pill mounted inside YouTube's masthead (never over the player). */
export class Hud {
  private readonly host: HTMLElement;
  private readonly pill: HTMLButtonElement;
  private readonly topic: HTMLElement;
  private readonly time: HTMLElement;
  private readonly menu: HTMLElement;
  private readonly items: Record<keyof HudActions, HTMLButtonElement>;
  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && !this.menu.hidden) {
      this.setOpen(false);
      this.pill.focus();
    }
  };
  private readonly onDocClick = (e: MouseEvent): void => {
    if (!e.composedPath().includes(this.host)) this.setOpen(false);
  };

  constructor(
    private readonly doc: Document,
    actions: HudActions,
  ) {
    const { host, root } = createHost(doc, 'focustube-hud');
    this.host = host;
    const style = h(doc, 'style');
    style.textContent = CSS;
    this.topic = h(doc, 'span', { class: 'topic' });
    this.time = h(doc, 'span', { class: 'time' });
    this.pill = h(
      doc,
      'button',
      {
        class: 'pill',
        type: 'button',
        'aria-haspopup': 'true',
        'aria-expanded': 'false',
        'aria-label': 'FocusTube menu',
      },
      h(doc, 'span', { class: 'dot', 'aria-hidden': 'true' }),
      'FocusTube',
      this.topic,
      this.time,
    );
    const mk = (cls: string, label: string, fn: () => void): HTMLButtonElement => {
      const b = h(
        doc,
        'button',
        { class: `item ${cls}`.trim(), type: 'button', role: 'menuitem' },
        label,
      );
      b.addEventListener('click', () => {
        this.setOpen(false);
        fn();
      });
      return b;
    };
    this.items = {
      back: mk('', 'Back to search results', actions.back),
      addToQueue: mk('', 'Add this video to queue', actions.addToQueue),
      toggleBypass: mk('', 'Show filtered results', actions.toggleBypass),
      pauseResume: mk('', 'Pause session', actions.pauseResume),
      exit: mk('danger', 'Exit focus mode', actions.exit),
    };
    this.menu = h(
      doc,
      'div',
      { class: 'menu', role: 'menu', hidden: '' },
      ...Object.values(this.items),
    );
    root.append(style, h(doc, 'div', { class: 'wrap' }, this.pill, this.menu));
    this.pill.addEventListener('click', () => this.setOpen(Boolean(this.menu.hidden)));
    doc.addEventListener('keydown', this.onKey);
    doc.addEventListener('click', this.onDocClick);
  }

  private setOpen(open: boolean): void {
    this.menu.hidden = !open;
    this.pill.setAttribute('aria-expanded', String(open));
  }

  /** Re-attaches the host if YouTube re-rendered the masthead. */
  ensureMounted(): void {
    const slot = this.doc.querySelector('ytd-masthead #end');
    if (slot) {
      if (this.host.parentElement !== slot) {
        this.host.style.cssText = 'display:inline-flex;align-items:center;';
        slot.prepend(this.host);
      }
    } else if (!this.host.isConnected) {
      this.host.style.cssText = 'position:fixed;top:10px;right:200px;z-index:2100;';
      this.doc.body?.appendChild(this.host);
    }
  }

  update(s: HudState): void {
    this.topic.textContent = s.topicName ? `· ${s.topicName}` : '';
    if (s.session) {
      const left = remainingMs(s.session, s.now);
      this.time.textContent = (s.session.state === 'paused' ? 'Paused ' : '') + formatClock(left);
    } else {
      this.time.textContent = '';
    }
    this.items.back.hidden = !s.canGoBack;
    this.items.addToQueue.hidden = !s.canQueue;
    this.items.toggleBypass.hidden = s.filteredCount === 0 && !s.bypass;
    this.items.toggleBypass.textContent = s.bypass
      ? 'Hide filtered results again'
      : `Show ${s.filteredCount} filtered result${s.filteredCount === 1 ? '' : 's'}`;
    this.items.pauseResume.hidden = !s.session;
    this.items.pauseResume.textContent =
      s.session?.state === 'paused' ? 'Resume session' : 'Pause session';
    const label = s.session
      ? `FocusTube menu. Session ${s.session.state}, ${formatClock(remainingMs(s.session, s.now))} left`
      : 'FocusTube menu';
    this.pill.setAttribute('aria-label', label);
  }

  elapsedLabel(s: FocusSession, now: number): string {
    return formatClock(activeElapsedMs(s, now));
  }

  dispose(): void {
    this.doc.removeEventListener('keydown', this.onKey);
    this.doc.removeEventListener('click', this.onDocClick);
    this.host.remove();
  }
}
