import { OWN_UI_ATTR } from './registry';

export interface ObserverOptions {
  delayMs?: number;
  maxWaitMs?: number;
}

function isOwn(node: Node): boolean {
  return (
    node instanceof Element &&
    (node.hasAttribute(OWN_UI_ATTR) || !!node.closest(`[${OWN_UI_ATTR}]`))
  );
}

/** Debounced MutationObserver that ignores our own DOM changes and cleans up fully. */
export class DebouncedObserver {
  private mo: MutationObserver | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private firstAt = 0;

  constructor(
    private readonly target: Node,
    private readonly callback: () => void,
    private readonly opts: ObserverOptions = {},
  ) {}

  start(): void {
    if (this.mo) return;
    this.mo = new MutationObserver((records) => {
      const relevant = records.some((r) => {
        if (r.type === 'attributes') return !isOwn(r.target);
        return [...r.addedNodes].some((n) => n.nodeType === 1 && !isOwn(n));
      });
      if (relevant) this.schedule();
    });
    this.mo.observe(this.target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['href'],
    });
  }

  private schedule(): void {
    const delay = this.opts.delayMs ?? 150;
    const maxWait = this.opts.maxWaitMs ?? 600;
    const now = Date.now();
    if (this.timer === null) this.firstAt = now;
    else clearTimeout(this.timer);
    const wait = Math.max(0, Math.min(delay, this.firstAt + maxWait - now));
    this.timer = setTimeout(() => {
      this.timer = null;
      this.callback();
    }, wait);
  }

  get active(): boolean {
    return this.mo !== null;
  }

  disconnect(): void {
    this.mo?.disconnect();
    this.mo = null;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
}
