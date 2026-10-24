import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { handleMessage, recoverInData } from '../src/background/handlers';
import { loadData, loadSettings, setStorageArea } from '../src/shared/storage';
import { MIN, T0, memoryKV } from './helpers';

beforeEach(() => setStorageArea(memoryKV()));
afterEach(() => setStorageArea(null));

describe('background handlers (integration over in-memory storage)', () => {
  it('runs a session: start, pause, resume, then recovers as completed after "worker suspension"', async () => {
    await handleMessage({ type: 'TOPIC_SAVE', name: 'Operating systems' }, T0);
    expect(
      (
        await handleMessage(
          { type: 'SESSION_OP', op: { op: 'start', minutes: 25, topicLocked: true } },
          T0,
        )
      ).ok,
    ).toBe(true);
    expect(
      (await handleMessage({ type: 'SESSION_OP', op: { op: 'start', minutes: 25 } }, T0)).ok,
    ).toBe(false);
    await handleMessage({ type: 'SESSION_OP', op: { op: 'pause' } }, T0 + 5 * MIN);
    await handleMessage({ type: 'SESSION_OP', op: { op: 'resume' } }, T0 + 15 * MIN);
    // Worker is "suspended"; nothing runs in memory. Later any wake-up recovers from storage alone.
    const res = await handleMessage({ type: 'SESSION_RECOVER' }, T0 + 36 * MIN);
    expect(res).toMatchObject({
      ok: true,
      data: { state: 'completed', topicName: 'Operating systems' },
    });
    const d = await loadData();
    expect(d.session).toBeNull();
    expect(d.sessionHistory).toHaveLength(1);
    expect(Object.values(d.daily)[0]?.sessionsCompleted).toBe(1);
    expect(await handleMessage({ type: 'SESSION_RECOVER' }, T0 + 37 * MIN)).toMatchObject({
      ok: true,
      data: null,
    });
  });

  it('locks the topic while a locked session is running', async () => {
    await handleMessage({ type: 'TOPIC_SAVE', name: 'A' }, T0);
    const d0 = await loadData();
    await handleMessage({ type: 'TOPIC_SAVE', name: 'B' }, T0);
    await handleMessage({ type: 'TOPIC_ACTIVATE', id: d0.topics[0]!.id }, T0);
    await handleMessage(
      { type: 'SESSION_OP', op: { op: 'start', minutes: 15, topicLocked: true } },
      T0,
    );
    const res = await handleMessage({ type: 'TOPIC_ACTIVATE', id: null }, T0);
    expect(res.ok).toBe(false);
    expect((await loadData()).activeTopicId).toBe(d0.topics[0]!.id);
  });

  it('stopping or exiting focus never traps the user and archives the session', async () => {
    await handleMessage({ type: 'SESSION_OP', op: { op: 'start', minutes: 25 } }, T0);
    await handleMessage({ type: 'EXIT_FOCUS' }, T0 + 3 * MIN);
    expect((await loadSettings()).enabled).toBe(false);
    const d = await loadData();
    expect(d.session).toBeNull();
    expect(d.sessionHistory[0]).toMatchObject({ state: 'stopped', activeMs: 3 * MIN });
  });

  it('recoverInData is a no-op without a session', async () => {
    const d = await loadData();
    expect(recoverInData(d, T0).data).toBe(d);
  });

  it('manages queues end to end and rejects duplicates', async () => {
    const video = { videoId: 'abcDEF12345', url: '', title: 'Lecture' };
    expect((await handleMessage({ type: 'QUEUE_OP', op: { op: 'add', video } }, T0)).ok).toBe(true);
    expect((await handleMessage({ type: 'QUEUE_OP', op: { op: 'add', video } }, T0)).ok).toBe(
      false,
    );
    const d = await loadData();
    expect(d.queues).toHaveLength(1);
    await handleMessage(
      { type: 'QUEUE_OP', op: { op: 'complete', videoId: video.videoId, completed: true } },
      T0,
    );
    expect((await loadData()).queues[0]?.items[0]?.completed).toBe(true);
  });

  it('records playback only when analytics allow it, and respects the shorts tracking switch', async () => {
    await handleMessage(
      { type: 'SETTINGS_UPDATE', patch: { analytics: { trackBlockedEvents: false } } },
      T0,
    );
    await handleMessage({ type: 'SHORTS_BLOCKED', count: 5 }, T0);
    expect(Object.keys((await loadData()).daily)).toHaveLength(0);
    await handleMessage(
      { type: 'SETTINGS_UPDATE', patch: { analytics: { trackBlockedEvents: true } } },
      T0,
    );
    await handleMessage({ type: 'SHORTS_BLOCKED', count: 5 }, T0);
    expect(Object.values((await loadData()).daily)[0]?.shortsBlocked).toBe(5);
  });

  it('only stores genuine YouTube search URLs and honours the history setting', async () => {
    const bad = await handleMessage(
      { type: 'SEARCH_RECORD', query: 'x', url: 'https://evil.example/results?search_query=x' },
      T0,
    );
    expect(bad.ok).toBe(false);
    const url = 'https://www.youtube.com/results?search_query=rust';
    await handleMessage({ type: 'SEARCH_RECORD', query: 'rust', url }, T0);
    expect((await loadData()).searchHistory).toEqual(['rust']);
    await handleMessage({ type: 'SETTINGS_UPDATE', patch: { search: { keepHistory: false } } }, T0);
    await handleMessage(
      {
        type: 'SEARCH_RECORD',
        query: 'go',
        url: 'https://www.youtube.com/results?search_query=go',
      },
      T0,
    );
    const d = await loadData();
    expect(d.searchHistory).toEqual([]);
    expect(d.lastSearchUrl).toContain('go');
  });

  it('imports valid files and deletes everything on request', async () => {
    const file = JSON.stringify({
      app: 'focustube',
      exportVersion: 1,
      settings: { mode: 'study' },
      topics: [{ id: 't', name: 'T', createdAt: 1 }],
    });
    expect((await handleMessage({ type: 'DATA_IMPORT', json: file }, T0)).ok).toBe(true);
    expect((await loadSettings()).mode).toBe('study');
    expect((await loadData()).topics).toHaveLength(1);
    expect((await handleMessage({ type: 'DATA_IMPORT', json: '{}' }, T0)).ok).toBe(false);
    await handleMessage({ type: 'DATA_DELETE_ALL' }, T0);
    expect((await loadData()).topics).toHaveLength(0);
    expect((await loadSettings()).mode).toBe('balanced');
  });
});
