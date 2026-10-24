import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, defaultData } from '../src/shared/defaults';
import {
  mergeSettings,
  migrateSettings,
  sanitizeData,
  sanitizeSettings,
} from '../src/shared/sanitize';
import {
  loadData,
  loadSettings,
  saveData,
  saveSettings,
  setStorageArea,
  updateSettings,
} from '../src/shared/storage';
import { memoryKV } from './helpers';

afterEach(() => setStorageArea(null));

describe('settings persistence', () => {
  it('returns safe defaults when storage is empty', async () => {
    setStorageArea(memoryKV());
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(await loadData()).toEqual(defaultData());
  });
  it('round-trips saved settings and serialises concurrent updates', async () => {
    setStorageArea(memoryKV());
    await saveSettings({ ...DEFAULT_SETTINGS, mode: 'study' });
    await Promise.all([
      updateSettings((s) => mergeSettings(s, { focus: { hideComments: true } })),
      updateSettings((s) => mergeSettings(s, { shorts: { redirectDirect: false } })),
    ]);
    const s = await loadSettings();
    expect(s.mode).toBe('study');
    expect(s.focus.hideComments).toBe(true);
    expect(s.shorts.redirectDirect).toBe(false);
  });
  it('validates stored data: bad types fall back to defaults', () => {
    const s = sanitizeSettings({
      enabled: 'yes',
      mode: 'chaos',
      analytics: { dailyGoalMinutes: -5, historyDays: 99999 },
    });
    expect(s.enabled).toBe(true);
    expect(s.mode).toBe('balanced');
    expect(s.analytics.dailyGoalMinutes).toBe(0);
    expect(s.analytics.historyDays).toBe(365);
  });
  it('rejects unsafe custom selectors', () => {
    const s = sanitizeSettings({
      advanced: { customHideSelectors: ['#ok', 'a{color:red}', '<script>', 'x'.repeat(300)] },
    });
    expect(s.advanced.customHideSelectors).toEqual(['#ok']);
  });
  it('ignores prototype pollution keys in patches', () => {
    const polluted = JSON.parse('{"__proto__":{"enabled":false},"constructor":{"x":1}}');
    const s = mergeSettings(DEFAULT_SETTINGS, polluted);
    expect(s.enabled).toBe(true);
    expect(({} as Record<string, unknown>).enabled).toBeUndefined();
  });
});

describe('settings migration', () => {
  it('migrates the legacy v0 flat shape', () => {
    const s = migrateSettings({ focusMode: 'research', blockShorts: false, theme: 'light' });
    expect(s.mode).toBe('research');
    expect(s.shorts.block).toBe(false);
    expect(s.schemaVersion).toBe(1);
  });
  it('is a no-op for current data and tolerates garbage', () => {
    expect(migrateSettings(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
    expect(migrateSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(migrateSettings('nope')).toEqual(DEFAULT_SETTINGS);
  });
});

describe('data validation', () => {
  it('drops malformed queue items and unknown active ids', async () => {
    const d = sanitizeData({
      activeTopicId: 'ghost',
      queues: [
        {
          id: 'q1',
          name: 'Q',
          items: [{ videoId: 'abcDEF12345', title: 'ok' }, { videoId: 'bad' }, null],
        },
      ],
      daily: { 'not-a-date': { watchSeconds: 5 }, '2026-10-24': { watchSeconds: 90 } },
    });
    expect(d.activeTopicId).toBeNull();
    expect(d.queues[0]?.items).toHaveLength(1);
    expect(Object.keys(d.daily)).toEqual(['2026-10-24']);
    setStorageArea(memoryKV());
    await saveData(d);
    expect((await loadData()).queues[0]?.items[0]?.videoId).toBe('abcDEF12345');
  });
});
