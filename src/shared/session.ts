import type { FocusSession, SessionSummary } from './types';
import { clamp, newId } from './util';

export const PRESET_MINUTES = [15, 25, 45, 60] as const;
export const MIN_SESSION_MINUTES = 1;
export const MAX_SESSION_MINUTES = 480;
/** A session paused this long is treated as abandoned and closed safely. */
export const STALE_PAUSE_MS = 12 * 3600_000;
/** If a session ended longer ago than this (browser was closed) don't pop a notification. */
export const STALE_NOTIFY_MS = 5 * 60_000;

export interface StartOptions {
  now: number;
  minutes: number;
  topicName: string | null;
  topicLocked?: boolean;
  queueTarget?: number | null;
  id?: string;
}

export function startSession(o: StartOptions): FocusSession {
  const minutes = clamp(Math.round(o.minutes), MIN_SESSION_MINUTES, MAX_SESSION_MINUTES);
  const plannedMs = minutes * 60_000;
  return {
    id: o.id ?? newId(),
    topicName: o.topicName,
    topicLocked: o.topicLocked ?? false,
    plannedMs,
    startedAt: o.now,
    state: 'running',
    pausedAt: null,
    pausedTotalMs: 0,
    deadlineAt: o.now + plannedMs,
    queueTarget: o.queueTarget && o.queueTarget > 0 ? Math.floor(o.queueTarget) : null,
    watchSeconds: 0,
    videosCompleted: 0,
  };
}

/** Active (non-paused) time, derived only from persisted timestamps. */
export function activeElapsedMs(s: FocusSession, now: number): number {
  const ref = s.state === 'paused' && s.pausedAt !== null ? s.pausedAt : now;
  return clamp(ref - s.startedAt - s.pausedTotalMs, 0, Number.MAX_SAFE_INTEGER);
}

export function remainingMs(s: FocusSession, now: number): number {
  return Math.max(0, s.plannedMs - activeElapsedMs(s, now));
}

export function pauseSession(s: FocusSession, now: number): FocusSession {
  if (s.state !== 'running') return s;
  return { ...s, state: 'paused', pausedAt: now, deadlineAt: null };
}

export function resumeSession(s: FocusSession, now: number): FocusSession {
  if (s.state !== 'paused' || s.pausedAt === null) return s;
  const pausedTotalMs = s.pausedTotalMs + Math.max(0, now - s.pausedAt);
  const resumed = { ...s, state: 'running' as const, pausedAt: null, pausedTotalMs };
  return { ...resumed, deadlineAt: now + remainingMs(resumed, now) };
}

export function finalizeSession(
  s: FocusSession,
  endedAt: number,
  state: 'completed' | 'stopped',
): SessionSummary {
  return {
    id: s.id,
    topicName: s.topicName,
    plannedMs: s.plannedMs,
    activeMs:
      state === 'completed' ? s.plannedMs : Math.min(s.plannedMs, activeElapsedMs(s, endedAt)),
    watchSeconds: s.watchSeconds,
    videosCompleted: s.videosCompleted,
    state,
    startedAt: s.startedAt,
    endedAt,
  };
}

export interface RecoverResult {
  session: FocusSession | null;
  summary: SessionSummary | null;
  /** Whether a completion notification is still worth showing. */
  notify: boolean;
}

/**
 * Called on every service-worker wake, browser start and alarm. Pure function of
 * persisted state, so it is safe no matter how often or how late it runs.
 */
export function recoverSession(s: FocusSession | null, now: number): RecoverResult {
  if (!s) return { session: null, summary: null, notify: false };
  if (s.state === 'running') {
    if (remainingMs(s, now) > 0) return { session: s, summary: null, notify: false };
    const endedAt = s.startedAt + s.pausedTotalMs + s.plannedMs;
    return {
      session: null,
      summary: finalizeSession(s, Math.min(endedAt, now), 'completed'),
      notify: now - endedAt < STALE_NOTIFY_MS,
    };
  }
  if (s.pausedAt !== null && now - s.pausedAt > STALE_PAUSE_MS) {
    return { session: null, summary: finalizeSession(s, s.pausedAt, 'stopped'), notify: false };
  }
  return { session: s, summary: null, notify: false };
}

/** Timestamp of the next break reminder, or null when none fits before the deadline. */
export function nextBreakAt(s: FocusSession, now: number, everyMinutes: number): number | null {
  if (s.state !== 'running') return null;
  const every = everyMinutes * 60_000;
  if (every <= 0) return null;
  const elapsed = activeElapsedMs(s, now);
  const nextMark = (Math.floor(elapsed / every) + 1) * every;
  if (nextMark >= s.plannedMs) return null;
  return now + (nextMark - elapsed);
}
