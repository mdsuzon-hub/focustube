// Shared domain models. Every persisted shape lives here.

export type FocusMode = 'study' | 'research' | 'balanced';
export type ThemeChoice = 'dark' | 'light' | 'system';
export type DurationFilter = 'any' | 'short' | 'medium' | 'long';
export type UploadDateFilter = 'any' | 'today' | 'week' | 'month' | 'year';

export interface Settings {
  schemaVersion: number;
  /** Master switch. When false the content script restores every change it made. */
  enabled: boolean;
  mode: FocusMode;
  shorts: { block: boolean; redirectDirect: boolean };
  focus: {
    hideEndScreen: boolean;
    hideComments: boolean;
    showHud: boolean;
    showHomePanel: boolean;
  };
  search: {
    negativeKeywords: string[];
    preferredChannels: string[];
    hideIrrelevant: boolean;
    /** 0-100. Results scoring below this are hidden when hideIrrelevant is on. */
    minRelevance: number;
    applyInAllModes: boolean;
    showScores: boolean;
    duration: DurationFilter;
    uploadDate: UploadDateFilter;
    keepHistory: boolean;
  };
  queue: { showThumbnails: boolean; autoMarkComplete: boolean };
  analytics: {
    enabled: boolean;
    dailyGoalMinutes: number;
    weeklyGoalMinutes: number;
    streaks: boolean;
    trackBlockedEvents: boolean;
    historyDays: number;
  };
  notifications: { sessionComplete: boolean; breakReminders: boolean; breakEveryMinutes: number };
  appearance: { theme: ThemeChoice; reducedMotion: boolean };
  advanced: { customHideSelectors: string[] };
}

export interface Topic {
  id: string;
  name: string;
  createdAt: number;
  lastUsedAt: number;
}

export interface VideoMeta {
  videoId: string;
  url: string;
  title: string;
  channel?: string;
  thumbnailUrl?: string;
  durationSec?: number;
}

export interface QueueItem {
  videoId: string;
  url: string;
  title: string;
  thumbnailUrl?: string;
  durationSec?: number;
  topicId: string | null;
  positionSec: number;
  completed: boolean;
  addedAt: number;
  lastWatchedAt: number | null;
}

export interface Queue {
  id: string;
  name: string;
  createdAt: number;
  items: QueueItem[];
}

export interface FocusSession {
  id: string;
  topicName: string | null;
  topicLocked: boolean;
  plannedMs: number;
  startedAt: number;
  state: 'running' | 'paused';
  pausedAt: number | null;
  pausedTotalMs: number;
  /** Absolute wall-clock deadline while running; null while paused. */
  deadlineAt: number | null;
  queueTarget: number | null;
  /** Measured playback seconds while this session was active. */
  watchSeconds: number;
  videosCompleted: number;
}

export interface SessionSummary {
  id: string;
  topicName: string | null;
  plannedMs: number;
  activeMs: number;
  watchSeconds: number;
  videosCompleted: number;
  state: 'completed' | 'stopped';
  startedAt: number;
  endedAt: number;
}

export interface DailyStats {
  date: string; // YYYY-MM-DD, local time
  watchSeconds: number;
  videosStarted: number;
  videosCompleted: number;
  sessionsCompleted: number;
  shortsBlocked: number;
  byTopic: Record<string, number>;
}

export type ActivityType =
  | 'video_start'
  | 'video_complete'
  | 'session_start'
  | 'session_complete'
  | 'session_stop'
  | 'queue_add';

export interface ActivityEvent {
  id: string;
  ts: number;
  type: ActivityType;
  label: string;
  videoId?: string;
}

export interface AppData {
  schemaVersion: number;
  topics: Topic[];
  activeTopicId: string | null;
  queues: Queue[];
  activeQueueId: string | null;
  session: FocusSession | null;
  sessionHistory: SessionSummary[];
  daily: Record<string, DailyStats>;
  activity: ActivityEvent[];
  searchHistory: string[];
  lastSearchUrl: string | null;
}

export interface PlaybackUpdate {
  videoId: string;
  title?: string;
  channel?: string;
  thumbnailUrl?: string;
  /** Measured seconds of playback since the previous update. */
  deltaSeconds: number;
  positionSec: number;
  durationSec?: number;
  started?: boolean;
  completed?: boolean;
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends (infer U)[] ? U[] : T[K] extends object ? DeepPartial<T[K]> : T[K];
};
