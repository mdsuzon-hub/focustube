import { pruneHistory, bumpDay, pushActivity } from '../shared/analytics';
import { defaultData, defaultSettings } from '../shared/defaults';
import { parseImport } from '../shared/import-export';
import type { Message, Response } from '../shared/messages';
import { applyPlaybackUpdate } from '../shared/playback';
import * as Q from '../shared/queue';
import { mergeSettings } from '../shared/sanitize';
import {
  finalizeSession,
  pauseSession,
  recoverSession,
  resumeSession,
  startSession,
} from '../shared/session';
import {
  clearAllLocalData,
  loadSettings,
  saveData,
  saveSettings,
  updateData,
  updateSettings,
} from '../shared/storage';
import type { AppData, FocusSession, SessionSummary, Topic } from '../shared/types';
import { newId } from '../shared/util';
import { searchQueryFromUrl, isYouTubeHost } from '../shared/urls';
import { LIMITS } from '../shared/defaults';

const ok = (data?: unknown): Response => ({ ok: true, ...(data !== undefined ? { data } : {}) });
const fail = (error: string): Response => ({ ok: false, error });

/** Moves a finished session into history and updates daily counters. */
export function archiveSession(d: AppData, summary: SessionSummary, label: string): AppData {
  let next: AppData = {
    ...d,
    session: d.session?.id === summary.id ? null : d.session,
    sessionHistory: [...d.sessionHistory, summary].slice(-LIMITS.sessionHistory),
  };
  if (summary.state === 'completed') next = bumpDay(next, summary.endedAt, 'sessionsCompleted');
  next = pushActivity(
    next,
    summary.state === 'completed' ? 'session_complete' : 'session_stop',
    label,
    summary.endedAt,
  );
  return next;
}

export interface RecoverOutcome {
  data: AppData;
  completed: SessionSummary | null;
  notify: boolean;
}

export function recoverInData(d: AppData, now: number): RecoverOutcome {
  const r = recoverSession(d.session, now);
  if (!r.summary) return { data: d, completed: null, notify: false };
  const label =
    r.summary.state === 'completed'
      ? `Session finished${r.summary.topicName ? `: ${r.summary.topicName}` : ''}`
      : 'Session ended while paused';
  return { data: archiveSession(d, r.summary, label), completed: r.summary, notify: r.notify };
}

function upsertTopic(d: AppData, name: string, now: number, activate: boolean): AppData {
  const existing = d.topics.find((t) => t.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    const topics = d.topics.map((t) => (t.id === existing.id ? { ...t, lastUsedAt: now } : t));
    return { ...d, topics, activeTopicId: activate ? existing.id : d.activeTopicId };
  }
  if (d.topics.length >= LIMITS.topics) return d;
  const topic: Topic = {
    id: newId(),
    name: name.slice(0, LIMITS.topicNames),
    createdAt: now,
    lastUsedAt: now,
  };
  return {
    ...d,
    topics: [...d.topics, topic],
    activeTopicId: activate ? topic.id : d.activeTopicId,
  };
}

export async function handleMessage(msg: Message, now = Date.now()): Promise<Response> {
  switch (msg.type) {
    case 'SETTINGS_UPDATE': {
      const s = await updateSettings((cur) => mergeSettings(cur, msg.patch));
      return ok(s);
    }
    case 'SETTINGS_RESET': {
      await saveSettings(defaultSettings());
      return ok();
    }
    case 'TOPIC_SAVE': {
      await updateData((d) => upsertTopic(d, msg.name.trim(), now, msg.activate !== false));
      return ok();
    }
    case 'TOPIC_ACTIVATE': {
      let blocked = false;
      await updateData((d) => {
        if (d.session?.topicLocked && d.session.state === 'running') {
          blocked = true;
          return d;
        }
        if (msg.id !== null && !d.topics.some((t) => t.id === msg.id)) return d;
        return {
          ...d,
          activeTopicId: msg.id,
          topics: d.topics.map((t) => (t.id === msg.id ? { ...t, lastUsedAt: now } : t)),
        };
      });
      return blocked ? fail('The topic is locked for the current session.') : ok();
    }
    case 'TOPIC_DELETE': {
      await updateData((d) => ({
        ...d,
        topics: d.topics.filter((t) => t.id !== msg.id),
        activeTopicId: d.activeTopicId === msg.id ? null : d.activeTopicId,
      }));
      return ok();
    }
    case 'QUEUE_OP': {
      const op = msg.op;
      let error: string | null = null;
      await updateData((d) => {
        const target = (id?: string): string | null =>
          id ?? d.activeQueueId ?? d.queues[0]?.id ?? null;
        switch (op.op) {
          case 'create': {
            const id = newId();
            const queues = Q.createQueue(d.queues, op.name, now, id);
            if (queues === d.queues) error = 'Could not create the queue.';
            return { ...d, queues, activeQueueId: queues === d.queues ? d.activeQueueId : id };
          }
          case 'rename':
            return { ...d, queues: Q.renameQueue(d.queues, op.queueId, op.name) };
          case 'delete': {
            const queues = Q.deleteQueue(d.queues, op.queueId);
            return {
              ...d,
              queues,
              activeQueueId:
                d.activeQueueId === op.queueId ? (queues[0]?.id ?? null) : d.activeQueueId,
            };
          }
          case 'setActive':
            return d.queues.some((q) => q.id === op.queueId)
              ? { ...d, activeQueueId: op.queueId }
              : d;
          case 'add': {
            let working = d;
            let qid = target(op.queueId);
            if (!qid) {
              qid = newId();
              working = {
                ...d,
                queues: Q.createQueue(d.queues, 'Watch queue', now, qid),
                activeQueueId: qid,
              };
            }
            const before = working.queues.find((q) => q.id === qid)?.items.length ?? 0;
            const queues = Q.addItem(working.queues, qid, op.video, working.activeTopicId, now);
            const after = queues.find((q) => q.id === qid)?.items.length ?? 0;
            if (after === before)
              error = 'That video is already in the queue (or the queue is full).';
            let next: AppData = { ...working, queues };
            if (after > before)
              next = pushActivity(
                next,
                'queue_add',
                `Queued: ${op.video.title || op.video.videoId}`,
                now,
                op.video.videoId,
              );
            return next;
          }
          case 'remove':
            return { ...d, queues: Q.removeItem(d.queues, op.queueId, op.videoId) };
          case 'move':
            return { ...d, queues: Q.moveItem(d.queues, op.queueId, op.videoId, op.toIndex) };
          case 'complete':
            return { ...d, queues: Q.markCompleted(d.queues, op.videoId, op.completed, now) };
        }
      });
      return error ? fail(error) : ok();
    }
    case 'SESSION_OP': {
      const op = msg.op;
      let error: string | null = null;
      await updateData((d) => {
        switch (op.op) {
          case 'start': {
            if (d.session) {
              error = 'A session is already active.';
              return d;
            }
            const topic = d.topics.find((t) => t.id === d.activeTopicId)?.name ?? null;
            const session: FocusSession = startSession({
              now,
              minutes: op.minutes,
              topicName: topic,
              topicLocked: !!op.topicLocked && topic !== null,
              queueTarget: op.queueTarget ?? null,
            });
            return pushActivity(
              { ...d, session },
              'session_start',
              `Session started${topic ? `: ${topic}` : ''}`,
              now,
            );
          }
          case 'pause':
            return d.session ? { ...d, session: pauseSession(d.session, now) } : d;
          case 'resume':
            return d.session ? { ...d, session: resumeSession(d.session, now) } : d;
          case 'stop': {
            if (!d.session) return d;
            const summary = finalizeSession(d.session, now, 'stopped');
            return archiveSession(d, summary, 'Session stopped early');
          }
        }
      });
      return error ? fail(error) : ok();
    }
    case 'SESSION_RECOVER': {
      let completed: SessionSummary | null = null;
      await updateData((d) => {
        const r = recoverInData(d, now);
        completed = r.completed;
        return r.data;
      });
      return ok(completed);
    }
    case 'PLAYBACK': {
      const settings = await loadSettings();
      await updateData((d) =>
        pruneHistory(
          applyPlaybackUpdate(d, msg.update, {
            now,
            analyticsEnabled: settings.analytics.enabled,
            autoMarkComplete: settings.queue.autoMarkComplete,
          }),
          settings.analytics.historyDays,
          now,
        ),
      );
      return ok();
    }
    case 'SHORTS_BLOCKED': {
      const settings = await loadSettings();
      if (settings.analytics.enabled && settings.analytics.trackBlockedEvents) {
        await updateData((d) => bumpDay(d, now, 'shortsBlocked', msg.count));
      }
      return ok();
    }
    case 'SEARCH_RECORD': {
      const settings = await loadSettings();
      let valid: boolean;
      try {
        valid = isYouTubeHost(new URL(msg.url).hostname) && searchQueryFromUrl(msg.url) !== null;
      } catch {
        valid = false;
      }
      if (!valid) return fail('Not a YouTube search URL.');
      await updateData((d) => {
        const q = msg.query.trim();
        const history = settings.search.keepHistory
          ? [q, ...d.searchHistory.filter((h) => h.toLowerCase() !== q.toLowerCase())].slice(
              0,
              LIMITS.searchHistory,
            )
          : [];
        return { ...d, lastSearchUrl: msg.url, searchHistory: history };
      });
      return ok();
    }
    case 'EXIT_FOCUS': {
      await updateSettings((s) => ({ ...s, enabled: false }));
      await updateData((d) =>
        d.session
          ? archiveSession(
              d,
              finalizeSession(d.session, now, 'stopped'),
              'Session stopped: focus exited',
            )
          : d,
      );
      return ok();
    }
    case 'DATA_IMPORT': {
      const parsed = parseImport(msg.json);
      if (!parsed.ok) return fail(parsed.errors[0] ?? 'Import failed.');
      if (parsed.settings) await saveSettings(parsed.settings);
      await updateData((d) => {
        const topics = parsed.topics ?? d.topics;
        const queues = parsed.queues ?? d.queues;
        return {
          ...d,
          topics,
          queues,
          activeTopicId: topics.some((t) => t.id === d.activeTopicId) ? d.activeTopicId : null,
          activeQueueId: queues.some((q) => q.id === d.activeQueueId)
            ? d.activeQueueId
            : (queues[0]?.id ?? null),
        };
      });
      return ok({ warnings: parsed.errors });
    }
    case 'DATA_DELETE_ALL': {
      await clearAllLocalData();
      await saveData(defaultData());
      await saveSettings(defaultSettings());
      return ok();
    }
  }
}
