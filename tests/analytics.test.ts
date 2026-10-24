import { describe, expect, it } from 'vitest';
import {
  computeStreak,
  goalProgress,
  lastDays,
  pruneHistory,
  topicBreakdown,
  totalSeconds,
} from '../src/shared/analytics';
import { defaultData } from '../src/shared/defaults';
import { applyPlaybackUpdate, isCompleted } from '../src/shared/playback';
import * as Q from '../src/shared/queue';
import type { AppData } from '../src/shared/types';
import { dateKey } from '../src/shared/util';
import { startSession } from '../src/shared/session';
import { MIN, T0 } from './helpers';

const ID = 'abcDEF12345';
const opts = { now: T0, analyticsEnabled: true, autoMarkComplete: true };

function withQueue(): AppData {
  const d = defaultData();
  return {
    ...d,
    topics: [{ id: 't1', name: 'Physics', createdAt: T0, lastUsedAt: T0 }],
    activeTopicId: 't1',
    queues: Q.addItem(
      Q.createQueue([], 'Q', T0, 'q1'),
      'q1',
      { videoId: ID, url: '', title: '', durationSec: 600 },
      't1',
      T0,
    ),
    activeQueueId: 'q1',
  };
}

describe('playback progress updates', () => {
  it('records measured time by topic and updates queue position', () => {
    const d = applyPlaybackUpdate(
      withQueue(),
      { videoId: ID, deltaSeconds: 30, positionSec: 120, title: 'Lecture 1', started: true },
      opts,
    );
    const day = d.daily[dateKey(T0)]!;
    expect(day.watchSeconds).toBe(30);
    expect(day.byTopic).toEqual({ Physics: 30 });
    expect(day.videosStarted).toBe(1);
    expect(d.queues[0]?.items[0]).toMatchObject({ positionSec: 120, title: 'Lecture 1' });
  });
  it('deduplicates start and completion events', () => {
    let d = withQueue();
    const start = { videoId: ID, deltaSeconds: 5, positionSec: 5, started: true };
    d = applyPlaybackUpdate(applyPlaybackUpdate(d, start, opts), start, { ...opts, now: T0 + MIN });
    expect(d.daily[dateKey(T0)]?.videosStarted).toBe(1);
    const end = {
      videoId: ID,
      deltaSeconds: 1,
      positionSec: 599,
      durationSec: 600,
      completed: true,
    };
    d = applyPlaybackUpdate(applyPlaybackUpdate(d, end, opts), end, { ...opts, now: T0 + 2 * MIN });
    expect(d.daily[dateKey(T0)]?.videosCompleted).toBe(1);
    expect(d.queues[0]?.items[0]?.completed).toBe(true);
  });
  it('caps absurd deltas and ignores NaN', () => {
    const d = applyPlaybackUpdate(
      withQueue(),
      { videoId: ID, deltaSeconds: 99999, positionSec: 1 },
      opts,
    );
    expect(d.daily[dateKey(T0)]?.watchSeconds).toBe(120);
    const n = applyPlaybackUpdate(
      withQueue(),
      { videoId: ID, deltaSeconds: NaN, positionSec: 1 },
      opts,
    );
    expect(n.daily[dateKey(T0)]).toBeUndefined();
  });
  it('still saves queue progress but no stats when analytics are off', () => {
    const d = applyPlaybackUpdate(
      withQueue(),
      { videoId: ID, deltaSeconds: 30, positionSec: 77, started: true },
      { ...opts, analyticsEnabled: false },
    );
    expect(d.daily).toEqual({});
    expect(d.activity).toEqual([]);
    expect(d.queues[0]?.items[0]?.positionSec).toBe(77);
  });
  it('adds measured time and finished videos to a running session', () => {
    let d: AppData = {
      ...withQueue(),
      session: startSession({ now: T0, minutes: 25, topicName: 'Physics', id: 's1' }),
    };
    d = applyPlaybackUpdate(
      d,
      { videoId: ID, deltaSeconds: 60, positionSec: 599, durationSec: 600, completed: true },
      opts,
    );
    expect(d.session).toMatchObject({ watchSeconds: 60, videosCompleted: 1 });
  });
  it('detects completion near the end only for real durations', () => {
    expect(isCompleted(598, 600)).toBe(true);
    expect(isCompleted(300, 600)).toBe(false);
    expect(isCompleted(5, 6)).toBe(false);
    expect(isCompleted(5, undefined)).toBe(false);
  });
});

describe('summaries, goals and streaks', () => {
  function days(secs: Record<string, number>): AppData {
    const d = defaultData();
    for (const [k, s] of Object.entries(secs))
      d.daily[k] = {
        date: k,
        watchSeconds: s,
        videosStarted: 0,
        videosCompleted: 0,
        sessionsCompleted: 0,
        shortsBlocked: 0,
        byTopic: { A: s },
      };
    return d;
  }
  it('builds a zero-filled window and totals it', () => {
    const w = lastDays(days({ '2026-10-24': 600, '2026-10-22': 300 }), '2026-10-24', 7);
    expect(w).toHaveLength(7);
    expect(totalSeconds(w)).toBe(900);
    expect(topicBreakdown(w)).toEqual([{ topic: 'A', seconds: 900 }]);
  });
  it('computes streaks without penalising a not-yet-finished today', () => {
    const d = days({
      '2026-10-24': 100,
      '2026-10-23': 3600,
      '2026-10-22': 3600,
      '2026-10-20': 3600,
    });
    expect(computeStreak(d, 60, '2026-10-24')).toBe(2);
    expect(computeStreak(days({ '2026-10-24': 3600, '2026-10-23': 3600 }), 60, '2026-10-24')).toBe(
      2,
    );
    expect(computeStreak(d, 0, '2026-10-24')).toBe(0);
  });
  it('clamps goal progress and prunes old days', () => {
    expect(goalProgress(7200, 60)).toBe(1);
    expect(goalProgress(10, 0)).toBe(0);
    const pruned = pruneHistory(
      days({ '2026-10-24': 1, '2026-01-01': 1 }),
      30,
      new Date(2026, 9, 24, 12).getTime(),
    );
    expect(Object.keys(pruned.daily)).toEqual(['2026-10-24']);
  });
});
