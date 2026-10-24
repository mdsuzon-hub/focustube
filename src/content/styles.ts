import { HIDDEN_ATTR } from './registry';

const STYLE_ID = 'focustube-style';

export type Flag = 'home' | 'related' | 'comments' | 'endscreen' | 'shelves' | 'shortspage';

const FLAG_ATTR: Record<Flag, string> = {
  home: 'data-ft-home',
  related: 'data-ft-related',
  comments: 'data-ft-comments',
  endscreen: 'data-ft-endscreen',
  shelves: 'data-ft-shelves',
  shortspage: 'data-ft-shortspage',
};

// Every rule is gated by an attribute on <html>, so removing the attribute (or the
// stylesheet) fully reverts the page. Selectors are scoped to specific page regions.
export const CSS = `
[${HIDDEN_ATTR}] { display: none !important; }
html[data-ft-home] ytd-browse[page-subtype="home"] ytd-rich-grid-renderer { display: none !important; }
html[data-ft-related] ytd-watch-flexy #related { display: none !important; }
html[data-ft-comments] ytd-watch-flexy ytd-comments#comments { display: none !important; }
html[data-ft-endscreen] .html5-video-player .ytp-endscreen-content,
html[data-ft-endscreen] .html5-video-player .ytp-ce-element,
html[data-ft-endscreen] .html5-video-player .ytp-fullscreen-grid { display: none !important; }
html[data-ft-shelves] ytd-browse[page-subtype="home"] ytd-rich-section-renderer,
html[data-ft-shelves] ytd-search ytd-horizontal-card-list-renderer { display: none !important; }
html[data-ft-shortspage] ytd-shorts { display: none !important; }
`;

export class StyleManager {
  constructor(private readonly doc: Document) {}

  private ensureStyle(): void {
    if (this.doc.getElementById(STYLE_ID)) return;
    const style = this.doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    (this.doc.head ?? this.doc.documentElement).appendChild(style);
  }

  setFlags(flags: Record<Flag, boolean>): void {
    this.ensureStyle();
    const root = this.doc.documentElement;
    for (const [flag, on] of Object.entries(flags) as Array<[Flag, boolean]>) {
      if (on) root.setAttribute(FLAG_ATTR[flag], '');
      else root.removeAttribute(FLAG_ATTR[flag]);
    }
  }

  dispose(): void {
    const root = this.doc.documentElement;
    for (const attr of Object.values(FLAG_ATTR)) root.removeAttribute(attr);
    this.doc.getElementById(STYLE_ID)?.remove();
  }
}
