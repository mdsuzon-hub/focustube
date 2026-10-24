import { defaultData, defaultSettings } from './defaults';
import { migrateSettings, sanitizeData } from './sanitize';
import type { AppData, Settings } from './types';

export interface KV {
  get(keys: string | string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

export const STORAGE_KEYS = { settings: 'ft:settings', data: 'ft:data' } as const;

let override: KV | null = null;
/** Tests inject an in-memory area; production uses chrome.storage.local. */
export function setStorageArea(kv: KV | null): void {
  override = kv;
}
function area(): KV {
  return override ?? (chrome.storage.local as unknown as KV);
}

export async function loadSettings(): Promise<Settings> {
  const got = await area().get(STORAGE_KEYS.settings);
  const raw = got[STORAGE_KEYS.settings];
  return raw === undefined ? defaultSettings() : migrateSettings(raw);
}

export async function saveSettings(s: Settings): Promise<void> {
  await area().set({ [STORAGE_KEYS.settings]: s });
}

export async function loadData(): Promise<AppData> {
  const got = await area().get(STORAGE_KEYS.data);
  const raw = got[STORAGE_KEYS.data];
  return raw === undefined ? defaultData() : sanitizeData(raw);
}

export async function saveData(d: AppData): Promise<void> {
  await area().set({ [STORAGE_KEYS.data]: d });
}

export async function clearAllLocalData(): Promise<void> {
  await area().remove([STORAGE_KEYS.settings, STORAGE_KEYS.data]);
}

// Single-writer queue: every read-modify-write in one context is serialised.
let chain: Promise<unknown> = Promise.resolve();
function serialise<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.catch(() => undefined);
  return next;
}

export function updateData(fn: (d: AppData) => AppData): Promise<AppData> {
  return serialise(async () => {
    const next = fn(await loadData());
    await saveData(next);
    return next;
  });
}

export function updateSettings(fn: (s: Settings) => Settings): Promise<Settings> {
  return serialise(async () => {
    const next = fn(await loadSettings());
    await saveSettings(next);
    return next;
  });
}
