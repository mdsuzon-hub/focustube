import type { AppData, Settings } from './types';

export const CURRENT_SETTINGS_VERSION = 1;
export const CURRENT_DATA_VERSION = 1;

export const LIMITS = {
  topics: 50,
  queues: 20,
  itemsPerQueue: 200,
  activity: 100,
  sessionHistory: 50,
  searchHistory: 30,
  topicNames: 80,
  keywords: 50,
  selectors: 30,
  importBytes: 2_000_000,
} as const;

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: CURRENT_SETTINGS_VERSION,
  enabled: true,
  mode: 'balanced',
  shorts: { block: true, redirectDirect: true },
  focus: { hideEndScreen: true, hideComments: false, showHud: true, showHomePanel: true },
  search: {
    negativeKeywords: [],
    preferredChannels: [],
    hideIrrelevant: false,
    minRelevance: 15,
    applyInAllModes: false,
    showScores: true,
    duration: 'any',
    uploadDate: 'any',
    keepHistory: true,
  },
  queue: { showThumbnails: true, autoMarkComplete: true },
  analytics: {
    enabled: true,
    dailyGoalMinutes: 60,
    weeklyGoalMinutes: 300,
    streaks: true,
    trackBlockedEvents: true,
    historyDays: 90,
  },
  notifications: { sessionComplete: true, breakReminders: false, breakEveryMinutes: 25 },
  appearance: { theme: 'dark', reducedMotion: false },
  advanced: { customHideSelectors: [] },
};

export function defaultSettings(): Settings {
  return structuredClone(DEFAULT_SETTINGS);
}

export function defaultData(): AppData {
  return {
    schemaVersion: CURRENT_DATA_VERSION,
    topics: [],
    activeTopicId: null,
    queues: [],
    activeQueueId: null,
    session: null,
    sessionHistory: [],
    daily: {},
    activity: [],
    searchHistory: [],
    lastSearchUrl: null,
  };
}
