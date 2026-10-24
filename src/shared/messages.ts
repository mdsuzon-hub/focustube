import type { DeepPartial, PlaybackUpdate, Settings, VideoMeta } from './types';
import { isRecord } from './util';
import { isVideoId } from './urls';

export type QueueOp =
  | { op: 'create'; name: string }
  | { op: 'rename'; queueId: string; name: string }
  | { op: 'delete'; queueId: string }
  | { op: 'setActive'; queueId: string }
  | { op: 'add'; queueId?: string; video: VideoMeta }
  | { op: 'remove'; queueId: string; videoId: string }
  | { op: 'move'; queueId: string; videoId: string; toIndex: number }
  | { op: 'complete'; videoId: string; completed: boolean };

export type SessionOp =
  | { op: 'start'; minutes: number; topicLocked?: boolean; queueTarget?: number | null }
  | { op: 'pause' }
  | { op: 'resume' }
  | { op: 'stop' };

export type Message =
  | { type: 'SETTINGS_UPDATE'; patch: DeepPartial<Settings> }
  | { type: 'SETTINGS_RESET' }
  | { type: 'TOPIC_SAVE'; name: string; activate?: boolean }
  | { type: 'TOPIC_ACTIVATE'; id: string | null }
  | { type: 'TOPIC_DELETE'; id: string }
  | { type: 'QUEUE_OP'; op: QueueOp }
  | { type: 'SESSION_OP'; op: SessionOp }
  | { type: 'SESSION_RECOVER' }
  | { type: 'PLAYBACK'; update: PlaybackUpdate }
  | { type: 'SHORTS_BLOCKED'; count: number }
  | { type: 'SEARCH_RECORD'; query: string; url: string }
  | { type: 'EXIT_FOCUS' }
  | { type: 'DATA_IMPORT'; json: string }
  | { type: 'DATA_DELETE_ALL' };

export type Response = { ok: true; data?: unknown } | { ok: false; error: string };

const str = (v: unknown, max = 500): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= max;

function parseQueueOp(r: Record<string, unknown>): QueueOp | null {
  switch (r.op) {
    case 'create':
      return str(r.name, 80) ? { op: 'create', name: r.name } : null;
    case 'rename':
      return str(r.queueId, 80) && str(r.name, 80)
        ? { op: 'rename', queueId: r.queueId, name: r.name }
        : null;
    case 'delete':
    case 'setActive':
      return str(r.queueId, 80) ? { op: r.op, queueId: r.queueId } : null;
    case 'add': {
      const v = r.video;
      if (!isRecord(v) || !isVideoId(v.videoId)) return null;
      const video: VideoMeta = {
        videoId: v.videoId,
        url: `https://www.youtube.com/watch?v=${v.videoId}`,
        title: typeof v.title === 'string' ? v.title.slice(0, 200) : '',
        ...(typeof v.channel === 'string' ? { channel: v.channel.slice(0, 120) } : {}),
        ...(typeof v.thumbnailUrl === 'string'
          ? { thumbnailUrl: v.thumbnailUrl.slice(0, 300) }
          : {}),
        ...(typeof v.durationSec === 'number' && v.durationSec > 0
          ? { durationSec: v.durationSec }
          : {}),
      };
      return { op: 'add', ...(str(r.queueId, 80) ? { queueId: r.queueId } : {}), video };
    }
    case 'remove':
      return str(r.queueId, 80) && isVideoId(r.videoId)
        ? { op: 'remove', queueId: r.queueId, videoId: r.videoId }
        : null;
    case 'move':
      return str(r.queueId, 80) && isVideoId(r.videoId) && typeof r.toIndex === 'number'
        ? { op: 'move', queueId: r.queueId, videoId: r.videoId, toIndex: Math.floor(r.toIndex) }
        : null;
    case 'complete':
      return isVideoId(r.videoId) && typeof r.completed === 'boolean'
        ? { op: 'complete', videoId: r.videoId, completed: r.completed }
        : null;
    default:
      return null;
  }
}

function parseSessionOp(r: Record<string, unknown>): SessionOp | null {
  switch (r.op) {
    case 'start':
      return typeof r.minutes === 'number' && Number.isFinite(r.minutes)
        ? {
            op: 'start',
            minutes: r.minutes,
            topicLocked: r.topicLocked === true,
            queueTarget: typeof r.queueTarget === 'number' ? r.queueTarget : null,
          }
        : null;
    case 'pause':
    case 'resume':
    case 'stop':
      return { op: r.op };
    default:
      return null;
  }
}

function parsePlayback(r: Record<string, unknown>): PlaybackUpdate | null {
  if (!isVideoId(r.videoId)) return null;
  if (typeof r.deltaSeconds !== 'number' || typeof r.positionSec !== 'number') return null;
  return {
    videoId: r.videoId,
    deltaSeconds: r.deltaSeconds,
    positionSec: r.positionSec,
    ...(typeof r.title === 'string' ? { title: r.title.slice(0, 200) } : {}),
    ...(typeof r.channel === 'string' ? { channel: r.channel.slice(0, 120) } : {}),
    ...(typeof r.durationSec === 'number' && r.durationSec > 0
      ? { durationSec: r.durationSec }
      : {}),
    ...(r.started === true ? { started: true } : {}),
    ...(r.completed === true ? { completed: true } : {}),
  };
}

/** Validates an untrusted runtime message. Returns null when the shape is wrong. */
export function parseMessage(raw: unknown): Message | null {
  if (!isRecord(raw) || typeof raw.type !== 'string') return null;
  const r = raw;
  switch (r.type) {
    case 'SETTINGS_UPDATE':
      return isRecord(r.patch)
        ? { type: 'SETTINGS_UPDATE', patch: r.patch as DeepPartial<Settings> }
        : null;
    case 'SETTINGS_RESET':
    case 'SESSION_RECOVER':
    case 'EXIT_FOCUS':
    case 'DATA_DELETE_ALL':
      return { type: r.type };
    case 'TOPIC_SAVE':
      return str(r.name, 80)
        ? { type: 'TOPIC_SAVE', name: r.name, activate: r.activate !== false }
        : null;
    case 'TOPIC_ACTIVATE':
      return r.id === null || str(r.id, 80)
        ? { type: 'TOPIC_ACTIVATE', id: r.id as string | null }
        : null;
    case 'TOPIC_DELETE':
      return str(r.id, 80) ? { type: 'TOPIC_DELETE', id: r.id } : null;
    case 'QUEUE_OP': {
      const op = isRecord(r.op) ? parseQueueOp(r.op) : null;
      return op ? { type: 'QUEUE_OP', op } : null;
    }
    case 'SESSION_OP': {
      const op = isRecord(r.op) ? parseSessionOp(r.op) : null;
      return op ? { type: 'SESSION_OP', op } : null;
    }
    case 'PLAYBACK': {
      const update = isRecord(r.update) ? parsePlayback(r.update) : null;
      return update ? { type: 'PLAYBACK', update } : null;
    }
    case 'SHORTS_BLOCKED':
      return typeof r.count === 'number' && r.count > 0 && r.count < 10_000
        ? { type: 'SHORTS_BLOCKED', count: Math.floor(r.count) }
        : null;
    case 'SEARCH_RECORD':
      return str(r.query, 200) && str(r.url, 500)
        ? { type: 'SEARCH_RECORD', query: r.query, url: r.url }
        : null;
    case 'DATA_IMPORT':
      return typeof r.json === 'string' ? { type: 'DATA_IMPORT', json: r.json } : null;
    default:
      return null;
  }
}

/** Sends a message to the service worker; never throws. */
export async function send(msg: Message): Promise<Response> {
  try {
    const res = (await chrome.runtime.sendMessage(msg)) as Response | undefined;
    return res ?? { ok: false, error: 'No response from the background worker.' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Message failed.' };
  }
}
