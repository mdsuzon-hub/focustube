import { isCompleted } from '../shared/playback';
import type { PlaybackUpdate } from '../shared/types';

export interface VideoInfo {
  title?: string;
  channel?: string;
  thumbnailUrl?: string;
}

export interface TrackerDeps {
  send: (u: PlaybackUpdate) => void;
  isAdShowing: () => boolean;
  getInfo: () => VideoInfo;
  flushEveryMs?: number;
}

/**
 * Measures actual playback time from the <video> element's own clock. Seeks, buffering,
 * pauses and ads are excluded, so the number is measured viewing time, not attention.
 */
export class PlaybackTracker {
  private video: HTMLVideoElement | null = null;
  private videoId: string | null = null;
  private lastTime: number | null = null;
  private pending = 0;
  private startedSent = false;
  private completedSent = false;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly deps: TrackerDeps) {}

  private readonly onTimeUpdate = (): void => {
    const v = this.video;
    if (!v || v.paused || v.seeking || this.deps.isAdShowing()) {
      this.lastTime = v ? v.currentTime : null;
      return;
    }
    const cur = v.currentTime;
    if (this.lastTime !== null) {
      const delta = cur - this.lastTime;
      // Normal playback advances by at most ~rate seconds between events; larger jumps are seeks.
      if (delta > 0 && delta <= 2.5 * Math.max(1, v.playbackRate)) this.pending += delta;
    }
    this.lastTime = cur;
    if (!this.startedSent && this.pending > 0) this.flush(false);
  };
  private readonly onPlay = (): void => {
    this.lastTime = this.video?.currentTime ?? null;
  };
  private readonly onSeek = (): void => {
    this.lastTime = this.video?.currentTime ?? null;
  };
  private readonly onPause = (): void => this.flush(false);
  private readonly onEnded = (): void => this.flush(true);
  private readonly onHidden = (): void => {
    if (document.visibilityState === 'hidden') this.flush(false);
  };

  /** Binds to a video element and the id of the video it is playing. */
  attach(video: HTMLVideoElement, videoId: string): void {
    if (this.video === video && this.videoId === videoId) return;
    this.detach();
    this.video = video;
    this.videoId = videoId;
    this.lastTime = video.currentTime;
    for (const [ev, fn] of this.listeners()) video.addEventListener(ev, fn);
    document.addEventListener('visibilitychange', this.onHidden);
    this.timer = setInterval(() => this.flush(false), this.deps.flushEveryMs ?? 15_000);
  }

  private listeners(): Array<[string, () => void]> {
    return [
      ['timeupdate', this.onTimeUpdate],
      ['play', this.onPlay],
      ['seeking', this.onSeek],
      ['seeked', this.onSeek],
      ['pause', this.onPause],
      ['ended', this.onEnded],
    ];
  }

  get currentVideoId(): string | null {
    return this.videoId;
  }

  detach(): void {
    this.flush(false);
    if (this.video) for (const [ev, fn] of this.listeners()) this.video.removeEventListener(ev, fn);
    document.removeEventListener('visibilitychange', this.onHidden);
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.video = null;
    this.videoId = null;
    this.lastTime = null;
    this.pending = 0;
    this.startedSent = false;
    this.completedSent = false;
  }

  flush(ended: boolean): void {
    const v = this.video;
    const id = this.videoId;
    if (!v || !id) return;
    const duration = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : undefined;
    const finished = !this.completedSent && (ended || isCompleted(v.currentTime, duration));
    const shouldStart = !this.startedSent && this.pending > 0;
    if (this.pending <= 0 && !finished && !shouldStart) return;
    if (this.deps.isAdShowing() && !ended) return;
    const info = this.deps.getInfo();
    this.deps.send({
      videoId: id,
      deltaSeconds: Math.round(this.pending * 10) / 10,
      positionSec: Math.floor(v.currentTime),
      ...(duration !== undefined ? { durationSec: Math.floor(duration) } : {}),
      ...(info.title ? { title: info.title } : {}),
      ...(info.channel ? { channel: info.channel } : {}),
      ...(shouldStart ? { started: true } : {}),
      ...(finished ? { completed: true } : {}),
    });
    this.pending = 0;
    if (shouldStart) this.startedSent = true;
    if (finished) this.completedSent = true;
  }
}
