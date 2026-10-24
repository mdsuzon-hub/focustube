import { isSafeSelector } from '../shared/sanitize';
import { HiddenRegistry } from './registry';

const MAX_PER_SELECTOR = 200;

/** Applies user-defined hide selectors. Invalid selectors are ignored, protected elements are skipped. */
export function applyCustomRules(
  root: ParentNode,
  selectors: string[],
  registry: HiddenRegistry,
): void {
  const keep = new Set<Element>();
  for (const sel of selectors) {
    if (!isSafeSelector(sel)) continue;
    let list: Element[];
    try {
      list = [...root.querySelectorAll(sel)].slice(0, MAX_PER_SELECTOR);
    } catch {
      continue;
    }
    for (const el of list) {
      keep.add(el);
      registry.hide(el, 'custom');
    }
  }
  registry.sync('custom', keep);
}
