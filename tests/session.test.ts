import { describe, expect, it } from 'vitest';
import {
  STALE_PAUSE_MS,
  activeElapsedMs,
  nextBreakAt,
  pauseSession,
  recoverSession,
  remainingMs,
  resumeSession,
  startSession,
} from '../src/shared/session';
import { MIN, T0 } from './helpers';

const start = (minutes = 25) => startSession({ now: T0, minutes, topicName: 'Rust', id: 's1' });

describe('focus sessions', () => {
  it('derives elapsed/remaining purely from persisted timestamps', () => {
    const s = start();
    expect(s.deadlineAt).toBe(T0 + 25 * MIN);
    expect(remainingMs(s, T0 + 10 * MIN)).toBe(15 * MIN);
  });
  it('pause freezes time and resume extends the deadline', () => {
    const paused = pauseSession(start(), T0 + 10 * MIN);
    expect(paused.deadlineAt).toBeNull();
    expect(remainingMs(paused, T0 + 500 * MIN)).toBe(15 * MIN);
    const resumed = resumeSession(paused, T0 + 40 * MIN);
    expect(resumed.deadlineAt).toBe(T0 + 55 * MIN);
    expect(activeElapsedMs(resumed, T0 + 45 * MIN)).toBe(15 * MIN);
  });
  it('clamps custom durations', () => {
    expect(start(0).plannedMs).toBe(MIN);
    expect(start(99999).plannedMs).toBe(480 * MIN);
  });
});

describe('session recovery after service-worker suspension / restart', () => {
  it('keeps a still-running session untouched', () => {
    const r = recoverSession(start(), T0 + 5 * MIN);
    expect(r.session?.id).toBe('s1');
    expect(r.summary).toBeNull();
  });
  it('completes an expired session once, ending at the true deadline', () => {
    const r = recoverSession(start(), T0 + 26 * MIN);
    expect(r.session).toBeNull();
    expect(r.summary).toMatchObject({
      state: 'completed',
      endedAt: T0 + 25 * MIN,
      activeMs: 25 * MIN,
    });
    expect(r.notify).toBe(true);
  });
  it('does not notify for a session that ended long ago (browser was closed)', () => {
    const r = recoverSession(start(), T0 + 8 * 3600_000);
    expect(r.summary?.state).toBe('completed');
    expect(r.notify).toBe(false);
  });
  it('accounts for paused time when deciding expiry', () => {
    const resumed = resumeSession(pauseSession(start(), T0 + 10 * MIN), T0 + 30 * MIN);
    expect(recoverSession(resumed, T0 + 40 * MIN).session).not.toBeNull();
    expect(recoverSession(resumed, T0 + 50 * MIN).summary?.state).toBe('completed');
  });
  it('closes an abandoned paused session safely as stopped', () => {
    const paused = pauseSession(start(), T0 + 5 * MIN);
    expect(recoverSession(paused, T0 + 6 * MIN).session).not.toBeNull();
    const stale = recoverSession(paused, T0 + 5 * MIN + STALE_PAUSE_MS + 1);
    expect(stale.session).toBeNull();
    expect(stale.summary).toMatchObject({ state: 'stopped', activeMs: 5 * MIN });
  });
  it('is idempotent and null-safe', () => {
    expect(recoverSession(null, T0)).toEqual({ session: null, summary: null, notify: false });
  });
});

describe('break reminders', () => {
  it('schedules the next break mark inside the session only', () => {
    expect(nextBreakAt(start(60), T0 + 10 * MIN, 25)).toBe(T0 + 25 * MIN);
    expect(nextBreakAt(start(60), T0 + 26 * MIN, 25)).toBe(T0 + 50 * MIN);
    expect(nextBreakAt(start(60), T0 + 51 * MIN, 25)).toBeNull();
    expect(nextBreakAt(pauseSession(start(), T0), T0, 25)).toBeNull();
  });
});
