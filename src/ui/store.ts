import { useCallback, useEffect, useState } from 'react';
import { defaultData, defaultSettings } from '../shared/defaults';
import { loadData, loadSettings, STORAGE_KEYS } from '../shared/storage';
import type { AppData, Settings } from '../shared/types';
import { send, type Message, type Response } from '../shared/messages';

export interface AppState {
  settings: Settings;
  data: AppData;
}

/** Reads settings + data from chrome.storage and stays live via storage.onChanged. */
export function useAppState(): { state: AppState | null; error: string | null } {
  const [state, setState] = useState<AppState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [settings, data] = await Promise.all([loadSettings(), loadData()]);
      setState({ settings, data });
      setError(null);
    } catch (e) {
      setState((prev) => prev ?? { settings: defaultSettings(), data: defaultData() });
      setError(e instanceof Error ? e.message : 'Could not read local storage.');
    }
  }, []);

  useEffect(() => {
    void load();
    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ): void => {
      if (area === 'local' && (STORAGE_KEYS.settings in changes || STORAGE_KEYS.data in changes))
        void load();
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [load]);

  return { state, error };
}

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** Applies theme + reduced-motion to <html>. */
export function useAppearance(settings: Settings | undefined): void {
  const theme = settings?.appearance.theme ?? 'dark';
  const reduced = settings?.appearance.reducedMotion ?? false;
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = (): void => {
      const resolved = theme === 'system' ? (mq.matches ? 'dark' : 'light') : theme;
      document.documentElement.setAttribute('data-theme', resolved);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
  useEffect(() => {
    document.documentElement.setAttribute('data-reduced-motion', String(reduced));
  }, [reduced]);
}

export type Notify = (kind: 'ok' | 'err', text: string) => void;

/** Sends a message and reports the outcome through the toast. */
export function useAction(notify: Notify): (msg: Message, okText?: string) => Promise<Response> {
  return useCallback(
    async (msg, okText) => {
      const res = await send(msg);
      if (!res.ok) notify('err', res.error);
      else if (okText) notify('ok', okText);
      return res;
    },
    [notify],
  );
}

export function useToast(): { notify: Notify; text: string | null; kind: 'ok' | 'err' } {
  const [toast, setToast] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);
  const notify = useCallback<Notify>((kind, text) => setToast({ kind, text }), []);
  return { notify, text: toast?.text ?? null, kind: toast?.kind ?? 'ok' };
}
