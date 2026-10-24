export const HIDDEN_ATTR = 'data-focustube-hidden';
export const OWN_UI_ATTR = 'data-focustube-ui';

/** Never hide something that contains the player or the app shell. */
export function safeToHide(el: Element): boolean {
  if (el.matches('html, body, ytd-app, ytd-page-manager, ytd-watch-flexy, ytd-masthead'))
    return false;
  if (el.hasAttribute(OWN_UI_ATTR)) return false;
  return !el.querySelector('video, #movie_player, #player');
}

/**
 * Tracks every element we hide so each change is reversible. Hiding is an attribute
 * (styled by one injected stylesheet), so restoring never has to guess original styles.
 */
export class HiddenRegistry {
  private owned = new Map<Element, string>();

  constructor(private readonly root: ParentNode) {}

  /** Returns true only when the element was newly hidden. */
  hide(el: Element, category: string): boolean {
    if (!safeToHide(el)) return false;
    if (this.owned.get(el) === category && el.getAttribute(HIDDEN_ATTR) === category) return false;
    el.setAttribute(HIDDEN_ATTR, category);
    this.owned.set(el, category);
    return true;
  }

  /** Restores every element of `category` that is no longer in `keep`. */
  sync(category: string, keep: Set<Element>): void {
    for (const [el, cat] of [...this.owned]) {
      if (cat !== category) continue;
      if (!el.isConnected) {
        this.owned.delete(el);
      } else if (!keep.has(el)) {
        el.removeAttribute(HIDDEN_ATTR);
        this.owned.delete(el);
      }
    }
  }

  count(category: string): number {
    let n = 0;
    for (const [el, cat] of this.owned) if (cat === category && el.isConnected) n++;
    return n;
  }

  restoreCategory(category: string): void {
    this.sync(category, new Set());
  }

  restoreAll(): void {
    this.owned.clear();
    this.root.querySelectorAll(`[${HIDDEN_ATTR}]`).forEach((el) => el.removeAttribute(HIDDEN_ATTR));
  }
}
