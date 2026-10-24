import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/shared/defaults';
import { buildExport, parseImport } from '../src/shared/import-export';
import { parseMessage } from '../src/shared/messages';
import * as Q from '../src/shared/queue';
import { T0 } from './helpers';

const goodQueues = Q.addItem(
  Q.createQueue([], 'Q', T0, 'q1'),
  'q1',
  { videoId: 'abcDEF12345', url: '', title: 'x' },
  null,
  T0,
);
const exp = buildExport(
  DEFAULT_SETTINGS,
  [{ id: 't', name: 'Topic', createdAt: T0, lastUsedAt: T0 }],
  goodQueues,
  new Date(T0),
);

describe('import validation', () => {
  it('round-trips a valid export', () => {
    const r = parseImport(JSON.stringify(exp));
    expect(r.ok).toBe(true);
    expect(r.queues?.[0]?.items[0]?.videoId).toBe('abcDEF12345');
    expect(r.topics).toHaveLength(1);
    expect(r.settings).toEqual(DEFAULT_SETTINGS);
  });
  it('rejects invalid JSON, foreign files and newer versions', () => {
    expect(parseImport('{nope').ok).toBe(false);
    expect(parseImport('{"app":"other"}').ok).toBe(false);
    expect(parseImport(JSON.stringify({ ...exp, exportVersion: 99 })).ok).toBe(false);
    expect(parseImport('[]').ok).toBe(false);
  });
  it('rejects oversized input and empty files', () => {
    expect(parseImport('x'.repeat(2_100_000)).ok).toBe(false);
    expect(parseImport(JSON.stringify({ app: 'focustube', exportVersion: 1 })).ok).toBe(false);
  });
  it('skips invalid entries instead of trusting them, and never executes content', () => {
    const evil = {
      ...exp,
      topics: [{ id: 'a', name: '<img src=x onerror=alert(1)>' }, 42, null],
      queues: [
        {
          id: 'q',
          name: 'ok',
          items: [
            { videoId: 'bad' },
            {
              videoId: 'abcDEF12345',
              url: 'javascript:alert(1)',
              thumbnailUrl: 'https://evil.example/x.png',
            },
          ],
        },
      ],
      settings: { ...exp.settings, mode: 'hacked', advanced: { customHideSelectors: ['a{b}'] } },
    };
    const r = parseImport(JSON.stringify(evil));
    expect(r.ok).toBe(true);
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.queues?.[0]?.items).toHaveLength(1);
    expect(r.queues?.[0]?.items[0]?.url).toBe('https://www.youtube.com/watch?v=abcDEF12345');
    expect(r.queues?.[0]?.items[0]?.thumbnailUrl).toBeUndefined();
    expect(r.settings?.mode).toBe('balanced');
    expect(r.settings?.advanced.customHideSelectors).toEqual([]);
  });
});

describe('message validation', () => {
  it('accepts well-formed messages', () => {
    expect(parseMessage({ type: 'SESSION_OP', op: { op: 'start', minutes: 25 } })).toMatchObject({
      type: 'SESSION_OP',
    });
    expect(
      parseMessage({
        type: 'QUEUE_OP',
        op: { op: 'add', video: { videoId: 'abcDEF12345', title: 't' } },
      }),
    ).not.toBeNull();
  });
  it('rejects malformed or unknown messages', () => {
    expect(parseMessage(null)).toBeNull();
    expect(parseMessage({ type: 'NOPE' })).toBeNull();
    expect(
      parseMessage({ type: 'QUEUE_OP', op: { op: 'add', video: { videoId: 'bad' } } }),
    ).toBeNull();
    expect(
      parseMessage({ type: 'PLAYBACK', update: { videoId: 'abcDEF12345', deltaSeconds: 'x' } }),
    ).toBeNull();
    expect(parseMessage({ type: 'SHORTS_BLOCKED', count: -1 })).toBeNull();
    expect(parseMessage({ type: 'SETTINGS_UPDATE', patch: 'x' })).toBeNull();
  });
});
