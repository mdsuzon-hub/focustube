export interface RouteWatcherOptions {
  doc: Document;
  win: Window;
  pollMs?: number;
}

type NavigationLike = EventTarget;

/**
 * Detects YouTube SPA navigation with three independent signals: YouTube's own
 * navigation events, history/Navigation API events, and a cheap URL poll as a safety net.
 */
export class RouteWatcher {
  private last: string;
  private poll: ReturnType<typeof setInterval> | null = null;
  private readonly handler = (): void => this.check();
  private readonly docEvents = ['yt-navigate-finish', 'yt-page-data-updated'];

  constructor(
    private readonly o: RouteWatcherOptions,
    private readonly onChange: (href: string, previous: string) => void,
  ) {
    this.last = o.win.location.href;
  }

  start(): void {
    for (const e of this.docEvents) this.o.doc.addEventListener(e, this.handler);
    this.o.win.addEventListener('popstate', this.handler);
    this.nav()?.addEventListener('navigatesuccess', this.handler);
    this.poll = setInterval(this.handler, this.o.pollMs ?? 1000);
  }

  private nav(): NavigationLike | undefined {
    return (this.o.win as unknown as { navigation?: NavigationLike }).navigation;
  }

  check(): void {
    const href = this.o.win.location.href;
    if (href === this.last) return;
    const prev = this.last;
    this.last = href;
    this.onChange(href, prev);
  }

  stop(): void {
    for (const e of this.docEvents) this.o.doc.removeEventListener(e, this.handler);
    this.o.win.removeEventListener('popstate', this.handler);
    this.nav()?.removeEventListener('navigatesuccess', this.handler);
    if (this.poll !== null) clearInterval(this.poll);
    this.poll = null;
  }
}
