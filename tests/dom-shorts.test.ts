// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { HiddenRegistry, HIDDEN_ATTR } from '../src/content/registry';
import { findShortsTargets, scanShorts } from '../src/content/shorts';
import { applyCustomRules } from '../src/content/rules';
import { StyleManager } from '../src/content/styles';

const html = (s: string): void => {
  document.documentElement.removeAttribute('data-ft-home');
  document.body.innerHTML = s;
};
const hidden = (): Element[] => [...document.querySelectorAll(`[${HIDDEN_ATTR}]`)];

const NORMAL = `<ytd-rich-item-renderer id="normal"><a href="/watch?v=abcDEF12345">Normal video</a>
  <button id="menu">Menu</button></ytd-rich-item-renderer>`;
const SHORT = `<ytd-rich-item-renderer id="short"><ytm-shorts-lockup-view-model><a href="/shorts/zzzzzzzzzzz">A short</a></ytm-shorts-lockup-view-model></ytd-rich-item-renderer>`;

describe('Shorts filtering', () => {
  beforeEach(() => html(''));

  it('hides Short cards but never normal videos or their controls', () => {
    html(`<ytd-rich-grid-renderer id="grid">${NORMAL}${SHORT}</ytd-rich-grid-renderer>`);
    const reg = new HiddenRegistry(document);
    expect(scanShorts(document, reg)).toBe(1);
    expect(document.getElementById('short')?.hasAttribute(HIDDEN_ATTR)).toBe(true);
    expect(document.getElementById('normal')?.hasAttribute(HIDDEN_ATTR)).toBe(false);
    expect(document.getElementById('grid')?.hasAttribute(HIDDEN_ATTR)).toBe(false);
    expect(document.getElementById('menu')?.closest(`[${HIDDEN_ATTR}]`)).toBeNull();
  });

  it('climbs to the outermost single-item card, not a broad container', () => {
    html(`<ytd-item-section-renderer id="section"><ytd-video-renderer id="r"><a href="/shorts/zzzzzzzzzzz">s</a></ytd-video-renderer>
      <ytd-video-renderer id="ok"><a href="/watch?v=abcDEF12345">n</a></ytd-video-renderer></ytd-item-section-renderer>`);
    scanShorts(document, new HiddenRegistry(document));
    expect(hidden().map((e) => e.id)).toEqual(['r']);
  });

  it('hides Shorts shelves, sidebar entries and channel tabs', () => {
    html(`<ytd-rich-section-renderer id="shelf"><ytd-reel-shelf-renderer>…</ytd-reel-shelf-renderer></ytd-rich-section-renderer>
      <ytd-guide-entry-renderer id="nav"><a id="endpoint" href="/shorts/" title="Shorts">Shorts</a></ytd-guide-entry-renderer>
      <ytd-guide-entry-renderer id="home"><a href="/" title="Home">Home</a></ytd-guide-entry-renderer>
      <yt-tab-shape id="tab" tab-title="Shorts"></yt-tab-shape>
      <yt-tab-shape id="videos" tab-title="Videos"></yt-tab-shape>`);
    scanShorts(document, new HiddenRegistry(document));
    expect(
      hidden()
        .map((e) => e.id)
        .sort(),
    ).toEqual(['nav', 'shelf', 'tab']);
  });

  it('ignores Shorts links that are not inside a card (e.g. description text)', () => {
    html(`<div id="desc"><a href="/shorts/zzzzzzzzzzz">linked</a></div>`);
    expect(findShortsTargets(document)).toHaveLength(0);
  });

  it('handles dynamically loaded content on a later scan', () => {
    html(`<ytd-rich-grid-renderer id="grid">${NORMAL}</ytd-rich-grid-renderer>`);
    const reg = new HiddenRegistry(document);
    scanShorts(document, reg);
    expect(hidden()).toHaveLength(0);
    document.getElementById('grid')!.insertAdjacentHTML('beforeend', SHORT);
    scanShorts(document, reg);
    expect(hidden().map((e) => e.id)).toEqual(['short']);
  });

  it('restores a recycled card that no longer holds a Short', () => {
    html(`<ytd-rich-grid-renderer>${SHORT}</ytd-rich-grid-renderer>`);
    const reg = new HiddenRegistry(document);
    scanShorts(document, reg);
    expect(hidden()).toHaveLength(1);
    document.getElementById('short')!.innerHTML =
      '<a href="/watch?v=abcDEF12345">Now a normal video</a>';
    scanShorts(document, reg);
    expect(hidden()).toHaveLength(0);
  });

  it('never hides an element that contains the player', () => {
    html(
      `<ytd-video-renderer id="x"><a href="/shorts/zzzzzzzzzzz">s</a><video></video></ytd-video-renderer>`,
    );
    scanShorts(document, new HiddenRegistry(document));
    expect(hidden()).toHaveLength(0);
  });
});

describe('restoration when a feature is disabled', () => {
  it('restoreCategory and restoreAll undo hiding exactly', () => {
    html(`${SHORT}<div class="x" id="c"></div>`);
    const reg = new HiddenRegistry(document);
    scanShorts(document, reg);
    applyCustomRules(document, ['.x'], reg);
    expect(
      hidden()
        .map((e) => e.id)
        .sort(),
    ).toEqual(['c', 'short']);
    reg.restoreCategory('shorts');
    expect(hidden().map((e) => e.id)).toEqual(['c']);
    reg.restoreAll();
    expect(hidden()).toHaveLength(0);
  });

  it('removes custom-rule hiding when the selector is removed, and ignores bad selectors', () => {
    html('<div class="ad" id="ad"></div><div id="keep"></div>');
    const reg = new HiddenRegistry(document);
    applyCustomRules(document, ['.ad', '[[invalid', 'a{x}'], reg);
    expect(hidden().map((e) => e.id)).toEqual(['ad']);
    applyCustomRules(document, [], reg);
    expect(hidden()).toHaveLength(0);
  });

  it('style manager sets flags and fully removes the stylesheet on dispose', () => {
    const sm = new StyleManager(document);
    sm.setFlags({
      home: true,
      related: true,
      comments: false,
      endscreen: false,
      shelves: false,
      shortspage: false,
    });
    expect(document.getElementById('focustube-style')).not.toBeNull();
    expect(document.documentElement.hasAttribute('data-ft-home')).toBe(true);
    sm.setFlags({
      home: false,
      related: true,
      comments: false,
      endscreen: false,
      shelves: false,
      shortspage: false,
    });
    expect(document.documentElement.hasAttribute('data-ft-home')).toBe(false);
    sm.dispose();
    expect(document.getElementById('focustube-style')).toBeNull();
    expect(document.documentElement.hasAttribute('data-ft-related')).toBe(false);
  });
});
