// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DebouncedObserver } from '../src/content/observer';
import { PlaybackTracker } from '../src/content/playback';
import { RouteWatcher } from '../src/content/route';
import type { PlaybackUpdate } from '../src/shared/types';

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<div id="root"></div>';
});
afterEach(() => vi.useRealTimers());

describe('MutationObserver cleanup', () => {
  it('debounces bursts into one callback', async () => {
    const cb = vi.fn();
    const obs = new DebouncedObserver(document.body, cb, { delayMs: 100, maxWaitMs: 500 });
    obs.start();
    for (let i = 0; i < 20; i++)
      document.getElementById('root')!.appendChild(document.createElement('p'));
    await vi.advanceTimersByTimeAsync(0);
    expect(cb).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(150);
    expect(cb).toHaveBeenCalledTimes(1);
    obs.disconnect();
  });
  it('ignores our own UI mutations', async () => {
    const cb = vi.fn();
    const obs = new DebouncedObserver(document.body, cb, { delayMs: 10 });
    obs.start();
    const own = document.createElement('div');
    own.setAttribute('data-focustube-ui', '');
    document.body.appendChild(own);
    await vi.advanceTimersByTimeAsync(50);
    expect(cb).not.toHaveBeenCalled();
    obs.disconnect();
  });
  it('disconnect stops callbacks and cancels a pending one', async () => {
    const cb = vi.fn();
    const obs = new DebouncedObserver(document.body, cb, { delayMs: 100 });
    obs.start();
    document.body.appendChild(document.createElement('p'));
    await vi.advanceTimersByTimeAsync(0);
    obs.disconnect();
    expect(obs.active).toBe(false);
    document.body.appendChild(document.createElement('p'));
    await vi.advanceTimersByTimeAsync(500);
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('SPA route changes', () => {
  function fakeWin(href: string) {
    const loc = { href };
    const target = new EventTarget();
    const win = Object.assign(target, { location: loc }) as unknown as Window;
    return { win, loc };
  }
  it('fires once per URL change via YouTube events, popstate and the poll fallback', async () => {
    const { win, loc } = fakeWin('https://www.youtube.com/');
    const onChange = vi.fn();
    const w = new RouteWatcher({ doc: document, win, pollMs: 1000 }, onChange);
    w.start();
    loc.href = 'https://www.youtube.com/watch?v=abcDEF12345';
    document.dispatchEvent(new Event('yt-navigate-finish'));
    document.dispatchEvent(new Event('yt-navigate-finish'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(
      'https://www.youtube.com/watch?v=abcDEF12345',
      'https://www.youtube.com/',
    );
    loc.href = 'https://www.youtube.com/results?search_query=x';
    win.dispatchEvent(new Event('popstate'));
    expect(onChange).toHaveBeenCalledTimes(2);
    loc.href = 'https://www.youtube.com/feed/subscriptions';
    await vi.advanceTimersByTimeAsync(1100);
    expect(onChange).toHaveBeenCalledTimes(3);
    w.stop();
  });
  it('stop removes listeners and the poll', async () => {
    const { win, loc } = fakeWin('https://www.youtube.com/');
    const onChange = vi.fn();
    const w = new RouteWatcher({ doc: document, win, pollMs: 100 }, onChange);
    w.start();
    w.stop();
    loc.href = 'https://www.youtube.com/watch?v=abcDEF12345';
    document.dispatchEvent(new Event('yt-navigate-finish'));
    await vi.advanceTimersByTimeAsync(500);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('playback tracker', () => {
  function setup(ad = false) {
    const video = document.createElement('video');
    let time = 0;
    Object.defineProperty(video, 'currentTime', {
      get: () => time,
      set: (v: number) => {
        time = v;
      },
    });
    Object.defineProperty(video, 'duration', { get: () => 600 });
    Object.defineProperty(video, 'paused', { value: false, configurable: true });
    const sent: PlaybackUpdate[] = [];
    const tracker = new PlaybackTracker({
      send: (u) => sent.push(u),
      isAdShowing: () => ad,
      getInfo: () => ({ title: 'T' }),
    });
    tracker.attach(video, 'abcDEF12345');
    const tick = (to: number): void => {
      time = to;
      video.dispatchEvent(new Event('timeupdate'));
    };
    return {
      video,
      tracker,
      sent,
      tick,
      seek: (to: number) => {
        time = to;
        video.dispatchEvent(new Event('seeking'));
      },
    };
  }
  it('counts continuous playback but not seeks, and marks start once', () => {
    const { tracker, sent, tick, seek } = setup();
    tick(0.25);
    tick(0.5);
    tick(0.75);
    seek(300);
    tick(300.25);
    tracker.flush(false);
    const total = sent.reduce((a, u) => a + u.deltaSeconds, 0);
    expect(total).toBeGreaterThan(0.5);
    expect(total).toBeLessThan(1.5);
    expect(sent.filter((u) => u.started)).toHaveLength(1);
    tracker.detach();
  });
  it('reports completion once at the end', () => {
    const { tracker, sent, tick } = setup();
    tick(597.5);
    tick(598);
    tick(599);
    tick(600);
    tracker.flush(true);
    tracker.flush(true);
    expect(sent.filter((u) => u.completed)).toHaveLength(1);
    tracker.detach();
  });
  it('does not count ad playback', () => {
    const { tracker, sent, tick } = setup(true);
    tick(1);
    tick(2);
    tick(3);
    tracker.flush(false);
    expect(sent).toHaveLength(0);
    tracker.detach();
  });
  it('detach removes listeners and the flush timer', () => {
    const { tracker, sent, tick } = setup();
    tracker.detach();
    tick(1);
    tick(2);
    vi.advanceTimersByTime(60_000);
    expect(sent).toHaveLength(0);
  });
});
