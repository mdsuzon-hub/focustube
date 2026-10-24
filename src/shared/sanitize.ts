import {
  CURRENT_DATA_VERSION,
  CURRENT_SETTINGS_VERSION,
  DEFAULT_SETTINGS,
  LIMITS,
} from './defaults';
import { defaultData } from './defaults';
import type {
  ActivityEvent,
  AppData,
  DailyStats,
  DeepPartial,
  FocusSession,
  Queue,
  QueueItem,
  SessionSummary,
  Settings,
  Topic,
} from './types';
import { clamp, isRecord } from './util';
import { isVideoId } from './urls';

const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d);
const num = (v: unknown, d: number, min: number, max: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? clamp(v, min, max) : d;
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], d: T): T =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : d;
const text = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
const rec = (v: unknown): Record<string, unknown> => (isRecord(v) ? v : {});

function strList(v: unknown, maxItems: number, maxLen: number, fallback: string[] = []): string[] {
  if (!Array.isArray(v)) return [...fallback];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of v) {
    const s = text(item, maxLen);
    if (s && !seen.has(s.toLowerCase())) {
      seen.add(s.toLowerCase());
      out.push(s);
    }
    if (out.length >= maxItems) break;
  }
  return out;
}

/** Selectors are applied with querySelectorAll; reject anything that is not a plain selector. */
export function isSafeSelector(s: string): boolean {
  return s.length > 0 && s.length <= 200 && !/[{};<>\\]/.test(s);
}

// ---------- Settings ----------

export function sanitizeSettings(raw: unknown): Settings {
  const r = rec(raw);
  const d = DEFAULT_SETTINGS;
  const shorts = rec(r.shorts);
  const focus = rec(r.focus);
  const search = rec(r.search);
  const queue = rec(r.queue);
  const analytics = rec(r.analytics);
  const notif = rec(r.notifications);
  const look = rec(r.appearance);
  const adv = rec(r.advanced);
  return {
    schemaVersion: CURRENT_SETTINGS_VERSION,
    enabled: bool(r.enabled, d.enabled),
    mode: oneOf(r.mode, ['study', 'research', 'balanced'] as const, d.mode),
    shorts: {
      block: bool(shorts.block, d.shorts.block),
      redirectDirect: bool(shorts.redirectDirect, d.shorts.redirectDirect),
    },
    focus: {
      hideEndScreen: bool(focus.hideEndScreen, d.focus.hideEndScreen),
      hideComments: bool(focus.hideComments, d.focus.hideComments),
      showHud: bool(focus.showHud, d.focus.showHud),
      showHomePanel: bool(focus.showHomePanel, d.focus.showHomePanel),
    },
    search: {
      negativeKeywords: strList(search.negativeKeywords, LIMITS.keywords, 60),
      preferredChannels: strList(search.preferredChannels, LIMITS.keywords, 80),
      hideIrrelevant: bool(search.hideIrrelevant, d.search.hideIrrelevant),
      minRelevance: num(search.minRelevance, d.search.minRelevance, 0, 100),
      applyInAllModes: bool(search.applyInAllModes, d.search.applyInAllModes),
      showScores: bool(search.showScores, d.search.showScores),
      duration: oneOf(search.duration, ['any', 'short', 'medium', 'long'] as const, 'any'),
      uploadDate: oneOf(
        search.uploadDate,
        ['any', 'today', 'week', 'month', 'year'] as const,
        'any',
      ),
      keepHistory: bool(search.keepHistory, d.search.keepHistory),
    },
    queue: {
      showThumbnails: bool(queue.showThumbnails, d.queue.showThumbnails),
      autoMarkComplete: bool(queue.autoMarkComplete, d.queue.autoMarkComplete),
    },
    analytics: {
      enabled: bool(analytics.enabled, d.analytics.enabled),
      dailyGoalMinutes: Math.round(
        num(analytics.dailyGoalMinutes, d.analytics.dailyGoalMinutes, 0, 1440),
      ),
      weeklyGoalMinutes: Math.round(
        num(analytics.weeklyGoalMinutes, d.analytics.weeklyGoalMinutes, 0, 10080),
      ),
      streaks: bool(analytics.streaks, d.analytics.streaks),
      trackBlockedEvents: bool(analytics.trackBlockedEvents, d.analytics.trackBlockedEvents),
      historyDays: Math.round(num(analytics.historyDays, d.analytics.historyDays, 7, 365)),
    },
    notifications: {
      sessionComplete: bool(notif.sessionComplete, d.notifications.sessionComplete),
      breakReminders: bool(notif.breakReminders, d.notifications.breakReminders),
      breakEveryMinutes: Math.round(
        num(notif.breakEveryMinutes, d.notifications.breakEveryMinutes, 5, 120),
      ),
    },
    appearance: {
      theme: oneOf(look.theme, ['dark', 'light', 'system'] as const, d.appearance.theme),
      reducedMotion: bool(look.reducedMotion, d.appearance.reducedMotion),
    },
    advanced: {
      customHideSelectors: strList(adv.customHideSelectors, LIMITS.selectors, 1000).filter(
        isSafeSelector,
      ),
    },
  };
}

type Migration = (o: Record<string, unknown>) => Record<string, unknown>;

/** MIGRATIONS[i] upgrades a schema-version-i object to version i+1. */
const SETTINGS_MIGRATIONS: Migration[] = [
  // v0 -> v1: flat `focusMode`/`blockShorts` keys became `mode` and `shorts.block`.
  (o) => {
    const out = { ...o };
    if (typeof out.focusMode === 'string' && out.mode === undefined) out.mode = out.focusMode;
    if (typeof out.blockShorts === 'boolean')
      out.shorts = { ...rec(out.shorts), block: out.blockShorts };
    delete out.focusMode;
    delete out.blockShorts;
    return out;
  },
];

export function migrateSettings(raw: unknown): Settings {
  let obj = { ...rec(raw) };
  const version =
    typeof obj.schemaVersion === 'number' ? Math.max(0, Math.floor(obj.schemaVersion)) : 0;
  for (let v = version; v < CURRENT_SETTINGS_VERSION; v++) {
    const step = SETTINGS_MIGRATIONS[v];
    if (step) obj = step(obj);
  }
  return sanitizeSettings(obj);
}

function deepMerge(base: unknown, patch: unknown): unknown {
  if (!isRecord(base) || !isRecord(patch)) return patch === undefined ? base : patch;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (k === '__proto__' || k === 'constructor') continue;
    out[k] = isRecord(v) ? deepMerge(base[k], v) : v;
  }
  return out;
}

export function mergeSettings(current: Settings, patch: DeepPartial<Settings>): Settings {
  return sanitizeSettings(deepMerge(current, patch));
}

// ---------- App data ----------

export function sanitizeTopic(raw: unknown): Topic | null {
  const r = rec(raw);
  const name = text(r.name, LIMITS.topicNames);
  const id = text(r.id, 80);
  if (!name || !id) return null;
  const createdAt = num(r.createdAt, 0, 0, Number.MAX_SAFE_INTEGER);
  return {
    id,
    name,
    createdAt,
    lastUsedAt: num(r.lastUsedAt, createdAt, 0, Number.MAX_SAFE_INTEGER),
  };
}

export function sanitizeQueueItem(raw: unknown): QueueItem | null {
  const r = rec(raw);
  if (!isVideoId(r.videoId)) return null;
  const videoId = r.videoId;
  const dur =
    typeof r.durationSec === 'number' && r.durationSec > 0
      ? Math.min(r.durationSec, 86400)
      : undefined;
  const thumb = text(r.thumbnailUrl, 300);
  return {
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    title: text(r.title, 200) ?? `YouTube video ${videoId}`,
    ...(thumb && /^https:\/\/i\.ytimg\.com\//.test(thumb) ? { thumbnailUrl: thumb } : {}),
    ...(dur !== undefined ? { durationSec: dur } : {}),
    topicId: text(r.topicId, 80),
    positionSec: num(r.positionSec, 0, 0, 86400),
    completed: bool(r.completed, false),
    addedAt: num(r.addedAt, 0, 0, Number.MAX_SAFE_INTEGER),
    lastWatchedAt: typeof r.lastWatchedAt === 'number' ? r.lastWatchedAt : null,
  };
}

export function sanitizeQueue(raw: unknown): Queue | null {
  const r = rec(raw);
  const id = text(r.id, 80);
  const name = text(r.name, 80);
  if (!id || !name) return null;
  const seen = new Set<string>();
  const items: QueueItem[] = [];
  for (const it of Array.isArray(r.items) ? r.items : []) {
    const item = sanitizeQueueItem(it);
    if (item && !seen.has(item.videoId)) {
      seen.add(item.videoId);
      items.push(item);
    }
    if (items.length >= LIMITS.itemsPerQueue) break;
  }
  return { id, name, createdAt: num(r.createdAt, 0, 0, Number.MAX_SAFE_INTEGER), items };
}

function sanitizeSession(raw: unknown): FocusSession | null {
  const r = rec(raw);
  const id = text(r.id, 80);
  if (!id || (r.state !== 'running' && r.state !== 'paused')) return null;
  const plannedMs = num(r.plannedMs, 0, 0, 24 * 3600_000);
  if (plannedMs < 60_000 || typeof r.startedAt !== 'number') return null;
  const paused = r.state === 'paused';
  return {
    id,
    topicName: text(r.topicName, LIMITS.topicNames),
    topicLocked: bool(r.topicLocked, false),
    plannedMs,
    startedAt: r.startedAt,
    state: r.state,
    pausedAt: paused ? (typeof r.pausedAt === 'number' ? r.pausedAt : r.startedAt) : null,
    pausedTotalMs: num(r.pausedTotalMs, 0, 0, Number.MAX_SAFE_INTEGER),
    deadlineAt: paused ? null : typeof r.deadlineAt === 'number' ? r.deadlineAt : null,
    queueTarget:
      typeof r.queueTarget === 'number' && r.queueTarget > 0 ? Math.floor(r.queueTarget) : null,
    watchSeconds: num(r.watchSeconds, 0, 0, Number.MAX_SAFE_INTEGER),
    videosCompleted: Math.floor(num(r.videosCompleted, 0, 0, 100000)),
  };
}

function sanitizeSummary(raw: unknown): SessionSummary | null {
  const r = rec(raw);
  const id = text(r.id, 80);
  if (!id || typeof r.startedAt !== 'number' || typeof r.endedAt !== 'number') return null;
  return {
    id,
    topicName: text(r.topicName, LIMITS.topicNames),
    plannedMs: num(r.plannedMs, 0, 0, Number.MAX_SAFE_INTEGER),
    activeMs: num(r.activeMs, 0, 0, Number.MAX_SAFE_INTEGER),
    watchSeconds: num(r.watchSeconds, 0, 0, Number.MAX_SAFE_INTEGER),
    videosCompleted: Math.floor(num(r.videosCompleted, 0, 0, 100000)),
    state: r.state === 'completed' ? 'completed' : 'stopped',
    startedAt: r.startedAt,
    endedAt: r.endedAt,
  };
}

function sanitizeDaily(raw: unknown): Record<string, DailyStats> {
  const out: Record<string, DailyStats> = {};
  for (const [key, val] of Object.entries(rec(raw))) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
    const r = rec(val);
    const byTopic: Record<string, number> = {};
    for (const [t, secs] of Object.entries(rec(r.byTopic)).slice(0, 60)) {
      if (typeof secs === 'number' && secs > 0) byTopic[t.slice(0, LIMITS.topicNames)] = secs;
    }
    out[key] = {
      date: key,
      watchSeconds: num(r.watchSeconds, 0, 0, 86400),
      videosStarted: Math.floor(num(r.videosStarted, 0, 0, 100000)),
      videosCompleted: Math.floor(num(r.videosCompleted, 0, 0, 100000)),
      sessionsCompleted: Math.floor(num(r.sessionsCompleted, 0, 0, 100000)),
      shortsBlocked: Math.floor(num(r.shortsBlocked, 0, 0, 10_000_000)),
      byTopic,
    };
  }
  return out;
}

const ACTIVITY_TYPES = [
  'video_start',
  'video_complete',
  'session_start',
  'session_complete',
  'session_stop',
  'queue_add',
] as const;

function sanitizeActivity(raw: unknown): ActivityEvent[] {
  const out: ActivityEvent[] = [];
  for (const it of Array.isArray(raw) ? raw : []) {
    const r = rec(it);
    const id = text(r.id, 80);
    const label = text(r.label, 200);
    if (!id || !label || typeof r.ts !== 'number') continue;
    out.push({
      id,
      ts: r.ts,
      type: oneOf(r.type, ACTIVITY_TYPES, 'video_start'),
      label,
      ...(isVideoId(r.videoId) ? { videoId: r.videoId } : {}),
    });
  }
  return out.slice(-LIMITS.activity);
}

export function sanitizeData(raw: unknown): AppData {
  const r = rec(raw);
  const base = defaultData();
  const topics = (Array.isArray(r.topics) ? r.topics : [])
    .map(sanitizeTopic)
    .filter((t): t is Topic => t !== null)
    .slice(0, LIMITS.topics);
  const queues = (Array.isArray(r.queues) ? r.queues : [])
    .map(sanitizeQueue)
    .filter((q): q is Queue => q !== null)
    .slice(0, LIMITS.queues);
  const activeTopic = text(r.activeTopicId, 80);
  const activeQueue = text(r.activeQueueId, 80);
  const lastSearch = text(r.lastSearchUrl, 500);
  return {
    ...base,
    schemaVersion: CURRENT_DATA_VERSION,
    topics,
    activeTopicId: topics.some((t) => t.id === activeTopic) ? activeTopic : null,
    queues,
    activeQueueId: queues.some((q) => q.id === activeQueue) ? activeQueue : (queues[0]?.id ?? null),
    session: sanitizeSession(r.session),
    sessionHistory: (Array.isArray(r.sessionHistory) ? r.sessionHistory : [])
      .map(sanitizeSummary)
      .filter((s): s is SessionSummary => s !== null)
      .slice(-LIMITS.sessionHistory),
    daily: sanitizeDaily(r.daily),
    activity: sanitizeActivity(r.activity),
    searchHistory: strList(r.searchHistory, LIMITS.searchHistory, 120),
    lastSearchUrl:
      lastSearch && /^https:\/\/www\.youtube\.com\/results\?/.test(lastSearch) ? lastSearch : null,
  };
}
