import { HiddenRegistry } from './registry';

/**
 * Single-item containers only. Climbing through these never reaches a container
 * that holds several videos or any controls, so legitimate neighbours stay visible.
 */
export const CARD_SELECTOR = [
  'ytd-video-renderer',
  'ytd-grid-video-renderer',
  'ytd-rich-item-renderer',
  'ytd-compact-video-renderer',
  'ytd-reel-item-renderer',
  'ytm-shorts-lockup-view-model',
  'yt-lockup-view-model',
  'ytd-rich-grid-media',
].join(',');

const NAV_ENTRY =
  'yt-tab-shape, tp-yt-paper-tab, ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer';
const CHANNEL_SHORTS = /^\/(?:@[^/]+|channel\/[^/]+|c\/[^/]+|user\/[^/]+)\/shorts\/?$/;

export function isShortsHref(href: string | null): boolean {
  if (!href) return false;
  try {
    const u = new URL(href, 'https://www.youtube.com');
    if (u.hostname !== 'www.youtube.com' && u.hostname !== 'youtube.com') return false;
    return /^\/shorts(\/|$)/.test(u.pathname) || CHANNEL_SHORTS.test(u.pathname);
  } catch {
    return false;
  }
}

export function outermostCard(el: Element): Element | null {
  let card = el.closest(CARD_SELECTOR);
  if (!card) return null;
  for (;;) {
    const parent: Element | null = card.parentElement?.closest(CARD_SELECTOR) ?? null;
    if (!parent) return card;
    card = parent;
  }
}

export interface Target {
  el: Element;
  reason: string;
}

/** Combines several independent signals; none of them alone is trusted to be stable. */
export function findShortsTargets(root: ParentNode): Target[] {
  const found = new Map<Element, string>();
  const add = (el: Element | null, reason: string): void => {
    if (el && !found.has(el)) found.set(el, reason);
  };

  // 1. Dedicated Shorts shelves.
  root
    .querySelectorAll('ytd-reel-shelf-renderer, ytd-rich-shelf-renderer[is-shorts]')
    .forEach((shelf) => {
      add(shelf.closest('ytd-rich-section-renderer') ?? shelf, 'shelf');
    });

  // 2. Any card (or nav entry / tab) whose link points at Shorts.
  root.querySelectorAll('a[href*="/shorts"]').forEach((a) => {
    if (!isShortsHref(a.getAttribute('href'))) return;
    const card = outermostCard(a);
    if (card) return add(card, 'card-link');
    add(a.closest(NAV_ENTRY), 'nav-link');
  });

  // 3. Thumbnail overlay badge.
  root
    .querySelectorAll('ytd-thumbnail-overlay-time-status-renderer[overlay-style="SHORTS"]')
    .forEach((badge) => add(outermostCard(badge), 'card-badge'));

  // 4. Tabs and nav entries identified by their visible label (English UI only).
  root.querySelectorAll('yt-tab-shape, tp-yt-paper-tab').forEach((tab) => {
    const label = (tab.getAttribute('tab-title') ?? tab.textContent ?? '').trim();
    if (label === 'Shorts') add(tab, 'tab-label');
  });
  root
    .querySelectorAll('ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer')
    .forEach((entry) => {
      const title =
        entry.getAttribute('aria-label') ?? entry.querySelector('a')?.getAttribute('title');
      if (title === 'Shorts') add(entry, 'nav-label');
    });

  return [...found].map(([el, reason]) => ({ el, reason }));
}

/** Hides Shorts and restores anything that stopped qualifying. Returns newly hidden count. */
export function scanShorts(root: ParentNode, registry: HiddenRegistry): number {
  const targets = findShortsTargets(root);
  const keep = new Set<Element>();
  let fresh = 0;
  for (const t of targets) {
    keep.add(t.el);
    if (registry.hide(t.el, 'shorts')) fresh++;
  }
  registry.sync('shorts', keep);
  return fresh;
}
