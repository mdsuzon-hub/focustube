import { effectiveFeatures, type Features, NO_FEATURES } from '../shared/features';
import { send } from '../shared/messages';
import { defaultData, defaultSettings } from '../shared/defaults';
import { loadData, loadSettings, STORAGE_KEYS } from '../shared/storage';
import { remainingMs } from '../shared/session';
import type { AppData, Settings } from '../shared/types';
import {
  buildSearchUrl,
  channelShortsToVideosUrl,
  getPageType,
  parseVideoId,
  shortsToWatchUrl,
  thumbnailFor,
  type PageType,
} from '../shared/urls';
import { applyCustomRules } from './rules';
import { Hud } from './hud';
import { DebouncedObserver } from './observer';
import { BlockedMessage, HomePanel } from './panels';
import { PlaybackTracker } from './playback';
import { HiddenRegistry } from './registry';
import { RouteWatcher } from './route';
import { removeBadges, scanSearchResults } from './search-filter';
import { scanShorts } from './shorts';
import { StyleManager } from './styles';

export const TEARDOWN_EVENT = 'focustube:teardown';

/** Owns every side effect of the content script so `stop()` can undo all of them. */
export class FocusController {
  private settings: Settings = defaultSettings();
  private data: AppData = defaultData();
  private features: Features = NO_FEATURES;
  private bypassFilter = false;
  private pendingShorts = 0;
  private shortsFlush: ReturnType<typeof setTimeout> | null = null;
  private clock: ReturnType<typeof setInterval> | null = null;
  private stopped = false;

  private readonly doc = document;
  private readonly win = window;
  private readonly registry = new HiddenRegistry(document);
  private readonly styles = new StyleManager(document);
  private readonly observer = new DebouncedObserver(document.documentElement, () => this.scan());
  private readonly route = new RouteWatcher({ doc: document, win: window }, () => this.onRoute());
  private readonly tracker = new PlaybackTracker({
    send: (update) => void this.safeSend({ type: 'PLAYBACK', update }),
    isAdShowing: () => !!this.doc.querySelector('.html5-video-player.ad-showing'),
    getInfo: () => this.videoInfo(),
  });
  private readonly hud = new Hud(document, {
    back: () => this.data.lastSearchUrl && this.win.location.assign(this.data.lastSearchUrl),
    addToQueue: () => void this.addCurrentToQueue(),
    toggleBypass: () => {
      this.bypassFilter = !this.bypassFilter;
      this.scan();
    },
    pauseResume: () =>
      void this.safeSend({
        type: 'SESSION_OP',
        op: { op: this.data.session?.state === 'paused' ? 'resume' : 'pause' },
      }),
    exit: () => void this.safeSend({ type: 'EXIT_FOCUS' }),
  });
  private readonly homePanel = new HomePanel(document, {
    search: (q) => this.search(q),
    exit: () => void this.safeSend({ type: 'EXIT_FOCUS' }),
  });
  private readonly blocked = new BlockedMessage(document, {
    back: () =>
      this.win.history.length > 1
        ? this.win.history.back()
        : this.win.location.assign('https://www.youtube.com/'),
    home: () => this.win.location.assign('https://www.youtube.com/'),
  });

  private readonly onStorage = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ): void => {
    if (area !== 'local') return;
    if (STORAGE_KEYS.settings in changes || STORAGE_KEYS.data in changes) void this.reload();
  };
  private readonly onTeardown = (): void => this.stop();

  async start(): Promise<void> {
    this.doc.dispatchEvent(new CustomEvent(TEARDOWN_EVENT)); // retire any previous instance
    this.doc.addEventListener(TEARDOWN_EVENT, this.onTeardown);
    chrome.storage.onChanged.addListener(this.onStorage);
    await this.reload();
    this.route.start();
    this.observer.start();
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.doc.removeEventListener(TEARDOWN_EVENT, this.onTeardown);
    try {
      chrome.storage.onChanged.removeListener(this.onStorage);
    } catch {
      /* extension context already gone */
    }
    this.observer.disconnect();
    this.route.stop();
    this.tracker.detach();
    if (this.clock !== null) clearInterval(this.clock);
    if (this.shortsFlush !== null) clearTimeout(this.shortsFlush);
    removeBadges(this.doc);
    this.registry.restoreAll();
    this.homePanel.dispose();
    this.blocked.hide();
    this.hud.dispose();
    this.styles.dispose();
  }

  private async reload(): Promise<void> {
    try {
      [this.settings, this.data] = await Promise.all([loadSettings(), loadData()]);
    } catch {
      // Extension was reloaded/removed: this orphaned script retires itself.
      this.stop();
      return;
    }
    this.features = effectiveFeatures(this.settings);
    this.applyAll();
  }

  private async safeSend(msg: Parameters<typeof send>[0]): Promise<void> {
    const res = await send(msg);
    if (!res.ok && /context invalidated/i.test(res.error)) this.stop();
  }

  private page(): PageType {
    return getPageType(this.win.location.href);
  }

  private onRoute(): void {
    this.bypassFilter = false;
    this.applyAll();
  }

  private activeTopic(): string {
    return this.data.topics.find((t) => t.id === this.data.activeTopicId)?.name ?? '';
  }

  private search(q: string): void {
    const url = buildSearchUrl(q, this.settings.search.uploadDate);
    void this.safeSend({ type: 'TOPIC_SAVE', name: q, activate: true });
    void this.safeSend({ type: 'SEARCH_RECORD', query: q, url });
    this.win.location.assign(url);
  }

  /** Full pass: flags, redirects, scans, UI, playback binding. */
  private applyAll(): void {
    if (this.stopped) return;
    const f = this.features;
    const page = this.page();

    this.styles.setFlags({
      home: f.hideHomeRecs && page === 'home',
      related: f.hideRelated,
      comments: f.hideComments,
      endscreen: f.hideEndScreen,
      shelves: f.hideShelves,
      shortspage: f.shorts && page === 'shorts',
    });

    if (f.redirectShorts && this.redirectIfShorts()) return;
    if (f.shorts && page === 'shorts') this.blocked.show();
    else this.blocked.hide();

    if (page === 'results' && this.shouldRecordSearch()) this.recordSearch();
    this.scan();
    this.bindPlayback();
    this.syncClock();
  }

  /** Light pass, safe to run on every debounced mutation. */
  private scan(): void {
    if (this.stopped) return;
    const f = this.features;
    const page = this.page();

    if (f.shorts) this.countShorts(scanShorts(this.doc, this.registry));
    else this.registry.restoreCategory('shorts');

    if (f.filterSearch && page === 'results') {
      scanSearchResults(this.doc, this.searchConfig(), this.registry);
    } else {
      this.registry.restoreCategory('search');
      removeBadges(this.doc);
    }

    if (this.settings.enabled)
      applyCustomRules(this.doc, this.settings.advanced.customHideSelectors, this.registry);
    else this.registry.restoreCategory('custom');

    if (f.homePanel && f.hideHomeRecs && page === 'home') {
      this.homePanel.show(
        this.data.topics.map((t) => t.name),
        this.activeTopic() || null,
      );
    } else {
      this.homePanel.hide();
    }

    if (f.hud) {
      this.hud.ensureMounted();
      this.updateHud();
    } else {
      this.hud.dispose();
    }
    this.bindPlayback();
  }

  private searchConfig() {
    const s = this.settings.search;
    return {
      topic: this.activeTopic(),
      negativeKeywords: s.negativeKeywords,
      preferredChannels: s.preferredChannels,
      hideIrrelevant: s.hideIrrelevant,
      minRelevance: s.minRelevance,
      duration: s.duration,
      showScores: s.showScores,
      bypass: this.bypassFilter,
    };
  }

  private updateHud(): void {
    const page = this.page();
    this.hud.update({
      topicName: this.activeTopic() || null,
      session: this.data.session,
      canGoBack: !!this.data.lastSearchUrl && page !== 'results',
      canQueue: page === 'watch' && !!parseVideoId(this.win.location.href),
      filteredCount: this.registry.count('search'),
      bypass: this.bypassFilter,
      now: Date.now(),
    });
  }

  /** The HUD countdown ticks from persisted timestamps, never from an in-memory counter. */
  private syncClock(): void {
    const needs = this.features.hud && !!this.data.session;
    if (needs && this.clock === null) {
      this.clock = setInterval(() => {
        this.updateHud();
        const s = this.data.session;
        if (s && s.state === 'running' && remainingMs(s, Date.now()) === 0) {
          void this.safeSend({ type: 'SESSION_RECOVER' });
        }
      }, 1000);
    } else if (!needs && this.clock !== null) {
      clearInterval(this.clock);
      this.clock = null;
    }
  }

  private redirectIfShorts(): boolean {
    const href = this.win.location.href;
    const watch = shortsToWatchUrl(href);
    if (watch) {
      this.win.location.replace(watch);
      return true;
    }
    const channelVideos = channelShortsToVideosUrl(href);
    if (channelVideos) {
      this.win.location.replace(channelVideos);
      return true;
    }
    return false;
  }

  private countShorts(fresh: number): void {
    if (fresh <= 0) return;
    this.pendingShorts += fresh;
    if (this.shortsFlush !== null) return;
    this.shortsFlush = setTimeout(() => {
      this.shortsFlush = null;
      const count = Math.min(this.pendingShorts, 9999);
      this.pendingShorts = 0;
      if (count > 0) void this.safeSend({ type: 'SHORTS_BLOCKED', count });
    }, 5000);
  }

  private shouldRecordSearch(): boolean {
    return this.data.lastSearchUrl !== this.win.location.href;
  }

  private recordSearch(): void {
    const q = new URL(this.win.location.href).searchParams.get('search_query');
    if (!q) return;
    void this.safeSend({ type: 'SEARCH_RECORD', query: q, url: this.win.location.href });
  }

  private videoInfo() {
    const title =
      this.doc.querySelector('ytd-watch-metadata h1')?.textContent?.trim() ||
      this.doc.title.replace(/ - YouTube$/, '').trim();
    const channel = this.doc
      .querySelector('ytd-watch-metadata ytd-channel-name a')
      ?.textContent?.trim();
    const id = parseVideoId(this.win.location.href);
    return {
      ...(title ? { title } : {}),
      ...(channel ? { channel } : {}),
      ...(id ? { thumbnailUrl: thumbnailFor(id) } : {}),
    };
  }

  private bindPlayback(): void {
    const id = this.page() === 'watch' ? parseVideoId(this.win.location.href) : null;
    const video = this.doc.querySelector<HTMLVideoElement>('video.html5-main-video');
    if (id && video) this.tracker.attach(video, id);
    else if (this.tracker.currentVideoId) this.tracker.detach();
  }

  private async addCurrentToQueue(): Promise<void> {
    const id = parseVideoId(this.win.location.href);
    if (!id) return;
    const info = this.videoInfo();
    const video = this.doc.querySelector<HTMLVideoElement>('video.html5-main-video');
    await this.safeSend({
      type: 'QUEUE_OP',
      op: {
        op: 'add',
        video: {
          videoId: id,
          url: `https://www.youtube.com/watch?v=${id}`,
          title: info.title ?? '',
          ...(info.channel ? { channel: info.channel } : {}),
          thumbnailUrl: thumbnailFor(id),
          ...(video && Number.isFinite(video.duration) && video.duration > 0
            ? { durationSec: Math.floor(video.duration) }
            : {}),
        },
      },
    });
  }
}
