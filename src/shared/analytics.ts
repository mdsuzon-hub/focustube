import { LIMITS } from './defaults';
import type { ActivityEvent, ActivityType, AppData, DailyStats } from './types';
import { addDays, dateKey, newId } from './util';

export function emptyDay(date: string): DailyStats {
  return {
    date,
    watchSeconds: 0,
    videosStarted: 0,
    videosCompleted: 0,
    sessionsCompleted: 0,
    shortsBlocked: 0,
    byTopic: {},
  };
}

function withDay(d: AppData, key: string, fn: (day: DailyStats) => DailyStats): AppData {
  const day = d.daily[key] ?? emptyDay(key);
  return { ...d, daily: { ...d.daily, [key]: fn(day) } };
}

export function pushActivity(
  d: AppData,
  type: ActivityType,
  label: string,
  ts: number,
  videoId?: string,
): AppData {
  const ev: ActivityEvent = {
    id: newId(),
    ts,
    type,
    label: label.slice(0, 200),
    ...(videoId ? { videoId } : {}),
  };
  return { ...d, activity: [...d.activity, ev].slice(-LIMITS.activity) };
}

/** Whether an event of this type for this video already happened within windowMs. */
export function seenRecently(
  d: AppData,
  type: ActivityType,
  videoId: string,
  now: number,
  windowMs: number,
): boolean {
  return d.activity.some((a) => a.type === type && a.videoId === videoId && now - a.ts < windowMs);
}

export function addWatchTime(
  d: AppData,
  ts: number,
  seconds: number,
  topicName: string | null,
): AppData {
  if (seconds <= 0) return d;
  return withDay(d, dateKey(ts), (day) => ({
    ...day,
    watchSeconds: Math.min(86400, day.watchSeconds + seconds),
    byTopic: topicName
      ? { ...day.byTopic, [topicName]: (day.byTopic[topicName] ?? 0) + seconds }
      : day.byTopic,
  }));
}

export function bumpDay(
  d: AppData,
  ts: number,
  field: 'videosStarted' | 'videosCompleted' | 'sessionsCompleted' | 'shortsBlocked',
  by = 1,
): AppData {
  return withDay(d, dateKey(ts), (day) => ({ ...day, [field]: day[field] + by }));
}

export function pruneHistory(d: AppData, keepDays: number, now: number): AppData {
  const cutoff = addDays(dateKey(now), -keepDays);
  const daily: Record<string, DailyStats> = {};
  for (const [k, v] of Object.entries(d.daily)) if (k >= cutoff) daily[k] = v;
  return { ...d, daily };
}

export function lastDays(d: AppData, endKey: string, days: number): DailyStats[] {
  const out: DailyStats[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const k = addDays(endKey, -i);
    out.push(d.daily[k] ?? emptyDay(k));
  }
  return out;
}

export function totalSeconds(days: DailyStats[]): number {
  return days.reduce((a, x) => a + x.watchSeconds, 0);
}

/**
 * Consecutive days (ending today, or yesterday if today has not reached the goal yet)
 * on which measured watch time met the daily goal. A goal of 0 disables streaks.
 */
export function computeStreak(d: AppData, goalMinutes: number, todayKey: string): number {
  if (goalMinutes <= 0) return 0;
  const goal = goalMinutes * 60;
  let key = todayKey;
  if ((d.daily[key]?.watchSeconds ?? 0) < goal) key = addDays(key, -1);
  let n = 0;
  while ((d.daily[key]?.watchSeconds ?? 0) >= goal && n < 3650) {
    n++;
    key = addDays(key, -1);
  }
  return n;
}

export function goalProgress(seconds: number, goalMinutes: number): number {
  if (goalMinutes <= 0) return 0;
  return Math.min(1, seconds / (goalMinutes * 60));
}

export function topicBreakdown(days: DailyStats[]): Array<{ topic: string; seconds: number }> {
  const acc = new Map<string, number>();
  for (const day of days)
    for (const [t, s] of Object.entries(day.byTopic)) acc.set(t, (acc.get(t) ?? 0) + s);
  return [...acc.entries()]
    .map(([topic, seconds]) => ({ topic, seconds }))
    .sort((a, b) => b.seconds - a.seconds);
}
