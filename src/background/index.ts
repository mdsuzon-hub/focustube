import { nextBreakAt } from '../shared/session';
import { parseMessage, type Response } from '../shared/messages';
import { loadData, loadSettings, saveData, saveSettings, updateData } from '../shared/storage';
import { handleMessage, recoverInData } from './handlers';
import type { Settings, SessionSummary, FocusSession } from '../shared/types';
import { defaultData } from '../shared/defaults';
import { migrateSettings, sanitizeData } from '../shared/sanitize';
import { formatDuration } from '../shared/util';

const ALARM_END = 'ft-session-end';
const ALARM_BREAK = 'ft-break';

// The service worker may be suspended at any time, so nothing here relies on in-memory
// timers. State lives in chrome.storage; alarms only wake the worker up.

async function notify(title: string, message: string): Promise<void> {
  try {
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title,
      message,
    });
  } catch (e) {
    console.error('FocusTube: notification failed', e);
  }
}

async function syncAlarms(
  session: FocusSession | null,
  settings: Settings,
  now = Date.now(),
): Promise<void> {
  await chrome.alarms.clear(ALARM_END);
  await chrome.alarms.clear(ALARM_BREAK);
  if (!session || session.state !== 'running' || session.deadlineAt === null) return;
  await chrome.alarms.create(ALARM_END, { when: Math.max(session.deadlineAt, now + 1000) });
  if (settings.notifications.breakReminders) {
    const at = nextBreakAt(session, now, settings.notifications.breakEveryMinutes);
    if (at !== null) await chrome.alarms.create(ALARM_BREAK, { when: at });
  }
}

function completionText(s: SessionSummary): string {
  const topic = s.topicName ? ` on “${s.topicName}”` : '';
  const watched = formatDuration(s.watchSeconds);
  return `${formatDuration(s.plannedMs / 1000)} session${topic} is complete. Measured playback: ${watched}, ${s.videosCompleted} video(s) finished.`;
}

/** Recovers state after any wake-up: completes expired sessions and re-arms alarms. */
async function recoverAndSync(): Promise<void> {
  const settings = await loadSettings();
  let completed: SessionSummary | null = null;
  let shouldNotify = false;
  const data = await updateData((d) => {
    const r = recoverInData(d, Date.now());
    completed = r.completed;
    shouldNotify = r.notify;
    return r.data;
  });
  await syncAlarms(data.session, settings);
  const done = completed as SessionSummary | null;
  if (
    done &&
    done.state === 'completed' &&
    shouldNotify &&
    settings.notifications.sessionComplete
  ) {
    await notify('FocusTube session complete', completionText(done));
  }
}

async function normaliseStorage(): Promise<void> {
  // Re-save through the sanitizers so schema migrations are persisted.
  const [settings, data] = await Promise.all([loadSettings(), loadData()]);
  await saveSettings(migrateSettings(settings));
  await saveData(sanitizeData(data ?? defaultData()));
}

chrome.runtime.onInstalled.addListener(() => {
  void normaliseStorage().then(recoverAndSync);
});
chrome.runtime.onStartup.addListener(() => {
  void recoverAndSync();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_END) {
    void recoverAndSync();
  } else if (alarm.name === ALARM_BREAK) {
    void (async () => {
      const [settings, data] = await Promise.all([loadSettings(), loadData()]);
      if (data.session?.state === 'running' && settings.notifications.breakReminders) {
        await notify(
          'Time for a short break',
          'You have been in this session for a while. Stretch, hydrate, rest your eyes.',
        );
      }
      await syncAlarms(data.session, settings);
    })();
  }
});

chrome.runtime.onMessage.addListener(
  (raw: unknown, sender, sendResponse: (r: Response) => void) => {
    // Only our own extension pages and content scripts may talk to us.
    if (sender.id !== chrome.runtime.id) return false;
    const msg = parseMessage(raw);
    if (!msg) {
      sendResponse({ ok: false, error: 'Invalid message.' });
      return false;
    }
    void (async () => {
      try {
        const res = await handleMessage(msg);
        if (
          msg.type === 'SESSION_OP' ||
          msg.type === 'SETTINGS_UPDATE' ||
          msg.type === 'SETTINGS_RESET' ||
          msg.type === 'EXIT_FOCUS' ||
          msg.type === 'SESSION_RECOVER'
        ) {
          const settings = await loadSettings();
          const data = await loadData();
          await syncAlarms(data.session, settings);
          if (msg.type === 'SESSION_RECOVER' && res.ok && res.data) {
            const done = res.data as SessionSummary;
            if (done.state === 'completed' && settings.notifications.sessionComplete) {
              await notify('FocusTube session complete', completionText(done));
            }
          }
        }
        sendResponse(res);
      } catch (e) {
        console.error('FocusTube: handler failed', e);
        sendResponse({ ok: false, error: e instanceof Error ? e.message : 'Unexpected error.' });
      }
    })();
    return true; // async response
  },
);

// Every wake-up (including the very first load of this worker) re-validates state.
void recoverAndSync();
