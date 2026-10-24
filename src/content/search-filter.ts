import { scoreRelevance } from '../shared/relevance';
import type { DurationFilter } from '../shared/types';
import { parseDurationText } from '../shared/util';
import { HIDDEN_ATTR, OWN_UI_ATTR, HiddenRegistry } from './registry';

const RESULT_SELECTOR = 'ytd-search ytd-video-renderer, ytd-search yt-lockup-view-model';
const BADGE_ATTR = 'data-focustube-badge';

export interface ResultMeta {
  title: string;
  channel: string;
  description: string;
  durationSec: number | null;
  titleEl: Element | null;
}

export interface FilterConfig {
  topic: string;
  negativeKeywords: string[];
  preferredChannels: string[];
  hideIrrelevant: boolean;
  minRelevance: number;
  duration: DurationFilter;
  showScores: boolean;
  /** When true results are scored but nothing is hidden ("show filtered results"). */
  bypass: boolean;
}

const first = (el: Element, selectors: string[]): Element | null => {
  for (const s of selectors) {
    const hit = el.querySelector(s);
    if (hit) return hit;
  }
  return null;
};
const txt = (el: Element | null): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

export function extractResultMeta(el: Element): ResultMeta {
  const titleEl = first(el, [
    '#video-title',
    'a.yt-lockup-metadata-view-model-wiz__title',
    '.yt-lockup-metadata-view-model-wiz__title',
    'h3 a',
  ]);
  const title =
    txt(titleEl) || titleEl?.getAttribute('title') || titleEl?.getAttribute('aria-label') || '';
  const channel = txt(
    first(el, [
      'ytd-channel-name a',
      'ytd-channel-name',
      '#channel-name',
      '.yt-content-metadata-view-model-wiz__metadata-text',
    ]),
  );
  const description = txt(first(el, ['.metadata-snippet-text', '#description-text']));
  const dur = txt(
    first(el, [
      'ytd-thumbnail-overlay-time-status-renderer #text',
      'ytd-thumbnail-overlay-time-status-renderer',
      '.badge-shape-wiz__text',
    ]),
  );
  return { title, channel, description, durationSec: parseDurationText(dur), titleEl };
}

export function durationMatches(sec: number | null, f: DurationFilter): boolean {
  if (f === 'any' || sec === null) return true; // unknown duration (live, missing) is never filtered
  if (f === 'short') return sec < 240;
  if (f === 'medium') return sec >= 240 && sec <= 1200;
  return sec > 1200;
}

export interface Decision {
  hide: boolean;
  reason: string;
  score: number;
  reasons: string[];
}

export function decideResult(meta: ResultMeta, cfg: FilterConfig): Decision {
  // Missing metadata: give the benefit of the doubt rather than hiding blindly.
  if (!meta.title) return { hide: false, reason: 'No title available', score: 50, reasons: [] };
  const rel = scoreRelevance(
    cfg.topic,
    { title: meta.title, channel: meta.channel, description: meta.description },
    { negativeKeywords: cfg.negativeKeywords, preferredChannels: cfg.preferredChannels },
  );
  if (rel.excluded)
    return {
      hide: true,
      reason: rel.reasons[0] ?? 'Excluded keyword',
      score: 0,
      reasons: rel.reasons,
    };
  if (!durationMatches(meta.durationSec, cfg.duration)) {
    return {
      hide: true,
      reason: 'Outside the chosen duration range',
      score: rel.score,
      reasons: rel.reasons,
    };
  }
  if (cfg.hideIrrelevant && cfg.topic.trim() && rel.score < cfg.minRelevance) {
    return {
      hide: true,
      reason: `Relevance ${rel.score} is below ${cfg.minRelevance}`,
      score: rel.score,
      reasons: rel.reasons,
    };
  }
  return { hide: false, reason: '', score: rel.score, reasons: rel.reasons };
}

function ensureBadge(meta: ResultMeta, score: number, reasons: string[]): void {
  const host = meta.titleEl?.parentElement;
  if (!host) return;
  let badge = host.querySelector(`[${BADGE_ATTR}]`);
  const label = `Match ${score}`;
  if (!badge) {
    badge = host.ownerDocument.createElement('span');
    badge.setAttribute(BADGE_ATTR, '');
    badge.setAttribute(OWN_UI_ATTR, '');
    (badge as HTMLElement).style.cssText =
      'display:inline-block;margin-left:8px;padding:1px 6px;border-radius:6px;font-size:11px;line-height:16px;background:#00b87a22;color:#00b87a;border:1px solid #00b87a55;vertical-align:middle;';
    host.appendChild(badge);
  }
  const explain = reasons.join('. ');
  if (badge.textContent !== label) badge.textContent = label;
  if (badge.getAttribute('title') !== explain) badge.setAttribute('title', explain);
  badge.setAttribute('aria-label', `${label} out of 100. ${explain}`);
}

export function removeBadges(root: ParentNode): void {
  root.querySelectorAll(`[${BADGE_ATTR}]`).forEach((b) => b.remove());
}

/** Returns how many results are currently hidden by the filter. */
export function scanSearchResults(
  root: ParentNode,
  cfg: FilterConfig,
  registry: HiddenRegistry,
): number {
  const keep = new Set<Element>();
  root.querySelectorAll(RESULT_SELECTOR).forEach((el) => {
    if (el.parentElement?.closest(RESULT_SELECTOR)) return;
    // Elements hidden by another category (Shorts, custom rules) are not ours to judge.
    const owner = el.getAttribute(HIDDEN_ATTR);
    if (owner && owner !== 'search') return;
    const meta = extractResultMeta(el);
    const decision = decideResult(meta, cfg);
    if (cfg.showScores && cfg.topic.trim() && meta.title)
      ensureBadge(meta, decision.score, decision.reasons);
    if (decision.hide && !cfg.bypass) {
      keep.add(el);
      registry.hide(el, 'search');
    }
  });
  registry.sync('search', keep);
  return registry.count('search');
}
