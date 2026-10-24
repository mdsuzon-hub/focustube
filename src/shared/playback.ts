import { addWatchTime, bumpDay, pushActivity, seenRecently } from './analytics';
import type { AppData, PlaybackUpdate } from './types';
import { markCompleted, updateProgress } from './queue';

const MAX_DELTA_PER_UPDATE = 120;
const START_DEDUPE_MS = 30 * 60_000;
const COMPLETE_DEDUPE_MS = 6 * 3600_000;

/** A video counts as finished when playback is within a few seconds of the end. */
export function isCompleted(positionSec: number, durationSec: number | undefined): boolean {
  return !!durationSec && durationSec > 10 && positionSec >= durationSec - 3;
}

export interface PlaybackOptions {
  now: number;
  analyticsEnabled: boolean;
  autoMarkComplete: boolean;
}

/** Pure reducer: applies one content-script playback report to stored data. */
export function applyPlaybackUpdate(d: AppData, u: PlaybackUpdate, o: PlaybackOptions): AppData {
  let next = d;
  const delta = Math.min(
    MAX_DELTA_PER_UPDATE,
    Math.max(0, Number.isFinite(u.deltaSeconds) ? u.deltaSeconds : 0),
  );
  const topic = d.topics.find((t) => t.id === d.activeTopicId)?.name ?? null;
  const label = u.title?.trim() || `Video ${u.videoId}`;

  // Queue progress is a queue feature and works even when analytics are off.
  next = {
    ...next,
    queues: updateProgress(
      next.queues,
      u.videoId,
      {
        positionSec: u.positionSec,
        ...(u.durationSec !== undefined ? { durationSec: u.durationSec } : {}),
        ...(u.title ? { title: u.title } : {}),
      },
      o.now,
    ),
  };

  let completedNow = false;
  if (u.completed) {
    completedNow = !seenRecently(next, 'video_complete', u.videoId, o.now, COMPLETE_DEDUPE_MS);
    if (o.autoMarkComplete)
      next = { ...next, queues: markCompleted(next.queues, u.videoId, true, o.now) };
  }

  if (!o.analyticsEnabled) return next;

  next = addWatchTime(next, o.now, delta, topic);
  if (u.started && !seenRecently(next, 'video_start', u.videoId, o.now, START_DEDUPE_MS)) {
    next = bumpDay(next, o.now, 'videosStarted');
    next = pushActivity(next, 'video_start', `Started: ${label}`, o.now, u.videoId);
  }
  if (completedNow) {
    next = bumpDay(next, o.now, 'videosCompleted');
    next = pushActivity(next, 'video_complete', `Finished: ${label}`, o.now, u.videoId);
  }

  if (next.session && next.session.state === 'running') {
    next = {
      ...next,
      session: {
        ...next.session,
        watchSeconds: next.session.watchSeconds + delta,
        videosCompleted: next.session.videosCompleted + (completedNow ? 1 : 0),
      },
    };
  }
  return next;
}
