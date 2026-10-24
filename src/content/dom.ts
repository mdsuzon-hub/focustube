import { OWN_UI_ATTR } from './registry';

export function h<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  props: Record<string, string> = {},
  ...children: Array<Node | string>
): HTMLElementTagNameMap[K] {
  const el = doc.createElement(tag);
  for (const [k, v] of Object.entries(props)) el.setAttribute(k, v);
  for (const c of children) el.append(c);
  return el;
}

/** Creates a shadow-root host so our UI never inherits (or leaks) YouTube's CSS. */
export function createHost(doc: Document, id: string): { host: HTMLElement; root: ShadowRoot } {
  const host = doc.createElement('div');
  host.id = id;
  host.setAttribute(OWN_UI_ATTR, '');
  return { host, root: host.attachShadow({ mode: 'open' }) };
}

export const BASE_CSS = `
:host { all: initial; font-family: "Space Grotesk", Inter, system-ui, sans-serif; }
* { box-sizing: border-box; }
button { font: inherit; cursor: pointer; }
button:focus-visible, input:focus-visible { outline: 2px solid #00b87a; outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
`;
