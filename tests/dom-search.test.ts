// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { HIDDEN_ATTR, HiddenRegistry } from '../src/content/registry';
import {
  decideResult,
  durationMatches,
  extractResultMeta,
  removeBadges,
  scanSearchResults,
  type FilterConfig,
} from '../src/content/search-filter';

const result = (id: string, title: string, channel: string, dur: string, desc = ''): string => `
  <ytd-video-renderer id="${id}">
    <ytd-thumbnail-overlay-time-status-renderer><span id="text">${dur}</span></ytd-thumbnail-overlay-time-status-renderer>
    <a id="video-title">${title}</a>
    <ytd-channel-name><a>${channel}</a></ytd-channel-name>
    <div class="metadata-snippet-text">${desc}</div>
  </ytd-video-renderer>`;

const cfg = (over: Partial<FilterConfig> = {}): FilterConfig => ({
  topic: 'linear algebra',
  negativeKeywords: [],
  preferredChannels: [],
  hideIrrelevant: true,
  minRelevance: 15,
  duration: 'any',
  showScores: true,
  bypass: false,
  ...over,
});

const hiddenIds = (): string[] =>
  [...document.querySelectorAll(`[${HIDDEN_ATTR}]`)].map((e) => e.id).sort();

beforeEach(() => {
  document.body.innerHTML = `<ytd-search>
    ${result('good', 'Linear Algebra Full Course', 'MathCh', '3:12:00')}
    ${result('off', 'Funny cat compilation', 'CatsTV', '10:00')}
    ${result('react', 'Linear algebra reaction', 'Reactor', '8:00')}
    ${result('short', 'Linear algebra in 30 seconds', 'QuickMath', '0:30')}
  </ytd-search>`;
});

describe('search result filtering', () => {
  it('extracts metadata from a result', () => {
    const meta = extractResultMeta(document.getElementById('good')!);
    expect(meta).toMatchObject({
      title: 'Linear Algebra Full Course',
      channel: 'MathCh',
      durationSec: 11520,
    });
  });

  it('hides irrelevant results and excluded keywords, keeps relevant ones', () => {
    scanSearchResults(
      document,
      cfg({ negativeKeywords: ['reaction'] }),
      new HiddenRegistry(document),
    );
    expect(hiddenIds()).toEqual(['off', 'react']);
  });

  it('applies duration filters and keeps unknown durations', () => {
    scanSearchResults(
      document,
      cfg({ hideIrrelevant: false, duration: 'long' }),
      new HiddenRegistry(document),
    );
    expect(hiddenIds()).toEqual(['off', 'react', 'short']);
    expect(durationMatches(null, 'long')).toBe(true);
    expect(durationMatches(239, 'short')).toBe(true);
    expect(durationMatches(600, 'medium')).toBe(true);
  });

  it('does nothing destructive when hideIrrelevant is off and shows scores with explanations', () => {
    scanSearchResults(document, cfg({ hideIrrelevant: false }), new HiddenRegistry(document));
    expect(hiddenIds()).toEqual([]);
    const badge = document.querySelector('#good [data-focustube-badge]')!;
    expect(badge.textContent).toMatch(/^Match \d+$/);
    expect(badge.getAttribute('title')).toMatch(/topic words/);
    removeBadges(document);
    expect(document.querySelector('[data-focustube-badge]')).toBeNull();
  });

  it('is idempotent: a second scan neither duplicates badges nor changes hiding', () => {
    const reg = new HiddenRegistry(document);
    scanSearchResults(document, cfg(), reg);
    const before = document.body.innerHTML;
    scanSearchResults(document, cfg(), reg);
    expect(document.body.innerHTML).toBe(before);
    expect(document.querySelectorAll('#good [data-focustube-badge]')).toHaveLength(1);
  });

  it('bypass shows everything again without removing scores', () => {
    const reg = new HiddenRegistry(document);
    scanSearchResults(document, cfg(), reg);
    expect(hiddenIds().length).toBeGreaterThan(0);
    scanSearchResults(document, cfg({ bypass: true }), reg);
    expect(hiddenIds()).toEqual([]);
  });

  it('gives the benefit of the doubt when metadata is missing', () => {
    expect(
      decideResult(
        { title: '', channel: '', description: '', durationSec: null, titleEl: null },
        cfg(),
      ).hide,
    ).toBe(false);
  });
});
