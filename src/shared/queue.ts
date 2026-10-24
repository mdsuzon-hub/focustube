import { LIMITS } from './defaults';
import type { Queue, QueueItem, VideoMeta } from './types';
import { newId } from './util';
import { thumbnailFor, watchUrl } from './urls';

export function createQueue(queues: Queue[], name: string, now: number, id = newId()): Queue[] {
  const clean = name.trim().slice(0, 80);
  if (!clean || queues.length >= LIMITS.queues) return queues;
  return [...queues, { id, name: clean, createdAt: now, items: [] }];
}

export function renameQueue(queues: Queue[], queueId: string, name: string): Queue[] {
  const clean = name.trim().slice(0, 80);
  if (!clean) return queues;
  return queues.map((q) => (q.id === queueId ? { ...q, name: clean } : q));
}

export function deleteQueue(queues: Queue[], queueId: string): Queue[] {
  return queues.filter((q) => q.id !== queueId);
}

function mapQueue(queues: Queue[], queueId: string, fn: (q: Queue) => Queue): Queue[] {
  return queues.map((q) => (q.id === queueId ? fn(q) : q));
}

export function addItem(
  queues: Queue[],
  queueId: string,
  video: VideoMeta,
  topicId: string | null,
  now: number,
): Queue[] {
  return mapQueue(queues, queueId, (q) => {
    if (q.items.some((i) => i.videoId === video.videoId)) return q;
    if (q.items.length >= LIMITS.itemsPerQueue) return q;
    const item: QueueItem = {
      videoId: video.videoId,
      url: watchUrl(video.videoId),
      title: video.title.trim().slice(0, 200) || `YouTube video ${video.videoId}`,
      thumbnailUrl: video.thumbnailUrl ?? thumbnailFor(video.videoId),
      ...(video.durationSec ? { durationSec: video.durationSec } : {}),
      topicId,
      positionSec: 0,
      completed: false,
      addedAt: now,
      lastWatchedAt: null,
    };
    return { ...q, items: [...q.items, item] };
  });
}

export function removeItem(queues: Queue[], queueId: string, videoId: string): Queue[] {
  return mapQueue(queues, queueId, (q) => ({
    ...q,
    items: q.items.filter((i) => i.videoId !== videoId),
  }));
}

export function moveItem(
  queues: Queue[],
  queueId: string,
  videoId: string,
  toIndex: number,
): Queue[] {
  return mapQueue(queues, queueId, (q) => {
    const from = q.items.findIndex((i) => i.videoId === videoId);
    if (from < 0) return q;
    const items = [...q.items];
    const [moved] = items.splice(from, 1);
    if (!moved) return q;
    items.splice(Math.max(0, Math.min(items.length, toIndex)), 0, moved);
    return { ...q, items };
  });
}

/** Updates a video in every queue that contains it (progress is per video, not per queue). */
export function updateProgress(
  queues: Queue[],
  videoId: string,
  patch: { positionSec?: number; durationSec?: number; title?: string; thumbnailUrl?: string },
  now: number,
): Queue[] {
  return queues.map((q) => {
    if (!q.items.some((i) => i.videoId === videoId)) return q;
    return {
      ...q,
      items: q.items.map((i) => {
        if (i.videoId !== videoId) return i;
        const hasRealTitle = !i.title.startsWith('YouTube video ');
        return {
          ...i,
          positionSec:
            patch.positionSec !== undefined ? Math.max(0, patch.positionSec) : i.positionSec,
          ...(patch.durationSec && patch.durationSec > 0 ? { durationSec: patch.durationSec } : {}),
          ...(patch.title && !hasRealTitle ? { title: patch.title.slice(0, 200) } : {}),
          lastWatchedAt: now,
        };
      }),
    };
  });
}

export function markCompleted(
  queues: Queue[],
  videoId: string,
  completed: boolean,
  now: number,
): Queue[] {
  return queues.map((q) => ({
    ...q,
    items: q.items.map((i) =>
      i.videoId === videoId
        ? {
            ...i,
            completed,
            positionSec: completed ? 0 : i.positionSec,
            lastWatchedAt: completed ? now : i.lastWatchedAt,
          }
        : i,
    ),
  }));
}

export function remainingSeconds(q: Queue): { seconds: number; unknownCount: number } {
  let seconds = 0;
  let unknownCount = 0;
  for (const i of q.items) {
    if (i.completed) continue;
    if (i.durationSec === undefined) unknownCount++;
    else seconds += Math.max(0, i.durationSec - i.positionSec);
  }
  return { seconds, unknownCount };
}

export function completionRatio(q: Queue | undefined): {
  done: number;
  total: number;
  ratio: number;
} {
  const total = q?.items.length ?? 0;
  const done = q?.items.filter((i) => i.completed).length ?? 0;
  return { done, total, ratio: total === 0 ? 0 : done / total };
}

export function nextItem(q: Queue): QueueItem | undefined {
  return q.items.find((i) => !i.completed);
}
