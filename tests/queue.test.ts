import { describe, expect, it } from 'vitest';
import * as Q from '../src/shared/queue';
import type { Queue, VideoMeta } from '../src/shared/types';
import { T0 } from './helpers';

const v = (id: string, extra: Partial<VideoMeta> = {}): VideoMeta => ({
  videoId: id,
  url: `https://www.youtube.com/watch?v=${id}`,
  title: `Video ${id}`,
  ...extra,
});
const A = 'aaaaaaaaaaa';
const B = 'bbbbbbbbbbb';
const C = 'ccccccccccc';

function base(): Queue[] {
  let qs = Q.createQueue([], 'Study', T0, 'q1');
  qs = Q.addItem(qs, 'q1', v(A, { durationSec: 600 }), null, T0);
  qs = Q.addItem(qs, 'q1', v(B, { durationSec: 300 }), null, T0);
  qs = Q.addItem(qs, 'q1', v(C), 't1', T0);
  return qs;
}

describe('queue operations', () => {
  it('creates, renames and deletes queues; rejects empty names', () => {
    let qs = Q.createQueue([], '  Algorithms  ', T0, 'q1');
    expect(qs[0]?.name).toBe('Algorithms');
    expect(Q.createQueue(qs, '   ', T0)).toBe(qs);
    qs = Q.renameQueue(qs, 'q1', 'Graphs');
    expect(qs[0]?.name).toBe('Graphs');
    expect(Q.deleteQueue(qs, 'q1')).toEqual([]);
  });
  it('adds items once and keeps topic association', () => {
    const qs = base();
    expect(qs[0]?.items.map((i) => i.videoId)).toEqual([A, B, C]);
    expect(qs[0]?.items[2]?.topicId).toBe('t1');
    expect(Q.addItem(qs, 'q1', v(A), null, T0)[0]?.items).toHaveLength(3);
  });
  it('removes and reorders', () => {
    let qs = Q.moveItem(base(), 'q1', C, 0);
    expect(qs[0]?.items.map((i) => i.videoId)).toEqual([C, A, B]);
    qs = Q.moveItem(qs, 'q1', C, 99);
    expect(qs[0]?.items.map((i) => i.videoId)).toEqual([A, B, C]);
    qs = Q.removeItem(qs, 'q1', B);
    expect(qs[0]?.items.map((i) => i.videoId)).toEqual([A, C]);
  });
  it('tracks progress and computes remaining duration with unknowns', () => {
    let qs = Q.updateProgress(base(), A, { positionSec: 200 }, T0);
    const q = qs[0]!;
    expect(q.items[0]?.lastWatchedAt).toBe(T0);
    expect(Q.remainingSeconds(q)).toEqual({ seconds: 400 + 300, unknownCount: 1 });
    qs = Q.markCompleted(qs, A, true, T0);
    expect(Q.remainingSeconds(qs[0]!)).toEqual({ seconds: 300, unknownCount: 1 });
    expect(Q.completionRatio(qs[0])).toMatchObject({ done: 1, total: 3 });
    expect(Q.nextItem(qs[0]!)?.videoId).toBe(B);
  });
  it('fills a placeholder title from playback but never overwrites a real one', () => {
    let qs = Q.addItem(Q.createQueue([], 'Q', T0, 'q1'), 'q1', v(A, { title: '' }), null, T0);
    expect(qs[0]?.items[0]?.title).toBe(`YouTube video ${A}`);
    qs = Q.updateProgress(qs, A, { title: 'Real title' }, T0);
    expect(qs[0]?.items[0]?.title).toBe('Real title');
    qs = Q.updateProgress(qs, A, { title: 'Other' }, T0);
    expect(qs[0]?.items[0]?.title).toBe('Real title');
  });
});
