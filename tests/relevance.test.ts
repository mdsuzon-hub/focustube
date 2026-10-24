import { describe, expect, it } from 'vitest';
import { rankResults, scoreRelevance, tokenize } from '../src/shared/relevance';

const none = { negativeKeywords: [], preferredChannels: [] };

describe('relevance scoring', () => {
  it('tokenizes without stopwords and normalises plurals', () => {
    expect(tokenize('How to build the Neural Networks')).toEqual(['build', 'neural', 'network']);
  });
  it('scores an exact title match highest and explains why', () => {
    const r = scoreRelevance('linear algebra', { title: 'Linear Algebra Full Course' }, none);
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(r.reasons.join(' ')).toMatch(/Exact topic phrase/);
  });
  it('gives partial credit for partial matches and none for unrelated titles', () => {
    const partial = scoreRelevance('linear algebra', { title: 'Algebra basics' }, none);
    const unrelated = scoreRelevance('linear algebra', { title: 'Funniest cats 2026' }, none);
    expect(partial.score).toBeGreaterThan(unrelated.score);
    expect(unrelated.score).toBe(0);
  });
  it('excludes negative keywords on word boundaries', () => {
    const o = { negativeKeywords: ['reaction'], preferredChannels: [] };
    expect(scoreRelevance('physics', { title: 'Physics reaction video' }, o).excluded).toBe(true);
    expect(scoreRelevance('physics', { title: 'Overreaction to physics' }, o).excluded).toBe(false);
  });
  it('boosts preferred channels', () => {
    const base = scoreRelevance('calculus', { title: 'Calculus intro', channel: 'Random' }, none);
    const boosted = scoreRelevance(
      'calculus',
      { title: 'Calculus intro', channel: '3Blue1Brown' },
      {
        negativeKeywords: [],
        preferredChannels: ['3blue1brown'],
      },
    );
    expect(boosted.score).toBe(base.score + 10);
  });
  it('is neutral with no topic and ranks stably', () => {
    expect(scoreRelevance('', { title: 'Anything' }, none).score).toBe(50);
    const ranked = rankResults(
      'rust',
      [{ title: 'Cooking' }, { title: 'Rust ownership' }, { title: 'Baking' }],
      none,
    );
    expect(ranked.map((r) => r.item.title)).toEqual(['Rust ownership', 'Cooking', 'Baking']);
  });
});
