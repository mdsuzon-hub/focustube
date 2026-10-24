import { useRef, useState, type ReactNode } from 'react';
import { Download, RotateCcw, Trash2, Upload } from 'lucide-react';
import { NumberField, SettingRow, Toggle } from '../components';
import { buildExport, parseImport, type ImportResult } from '../../shared/import-export';
import type { DeepPartial, Settings } from '../../shared/types';
import type { Notify } from '../store';
import type { PageProps } from './ctx';

const Section = ({ id, title, children }: { id: string; title: string; children: ReactNode }) => (
  <section className="card" aria-labelledby={`h-${id}`} id={id}>
    <h2 id={`h-${id}`} style={{ marginBottom: 4 }}>
      {title}
    </h2>
    {children}
  </section>
);

export function SettingsPage({ settings: s, data, act, notify }: PageProps & { notify: Notify }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ json: string; result: ImportResult } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const up = (patch: DeepPartial<Settings>): void => void act({ type: 'SETTINGS_UPDATE', patch });
  const sw = (label: string, checked: boolean, onChange: (v: boolean) => void) => (
    <Toggle label={label} checked={checked} onChange={onChange} />
  );

  const exportFile = (): void => {
    const file = buildExport(s, data.topics, data.queues, new Date());
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `focustube-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify('ok', 'Export downloaded');
  };
  const onFile = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    const json = await file.text();
    const result = parseImport(json);
    if (!result.ok) notify('err', result.errors[0] ?? 'Import failed');
    else setPending({ json, result });
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Settings</h1>
        <p className="muted">Everything is stored on this device. Changes apply immediately.</p>
      </div>

      <Section id="general" title="General">
        <SettingRow
          title="Focus Mode"
          description="Master switch. When off, FocusTube restores every change it made to YouTube."
        >
          {sw('Focus Mode', s.enabled, (v) => up({ enabled: v }))}
        </SettingRow>
        <SettingRow
          title="Show the FocusTube menu on YouTube"
          description="A small pill in the YouTube header with your topic, session timer and a quick exit."
        >
          {' '}
          {sw('Show FocusTube menu', s.focus.showHud, (v) => up({ focus: { showHud: v } }))}
        </SettingRow>
      </Section>
      <Section id="shorts" title="Shorts">
        <SettingRow
          title="Block Shorts"
          description="Hides Shorts shelves, cards, sidebar entries and channel tabs."
        >
          {sw('Block Shorts', s.shorts.block, (v) => up({ shorts: { block: v } }))}
        </SettingRow>
        <SettingRow
          title="Open Shorts links as normal videos"
          description="Converts /shorts/ links to the standard watch page. If that is not possible you see a short notice with a way back."
        >
          {sw('Convert Shorts links', s.shorts.redirectDirect, (v) =>
            up({ shorts: { redirectDirect: v } }),
          )}
        </SettingRow>
      </Section>
      <Section id="focus" title="Focus">
        <SettingRow
          title="Hide end-screen suggestions"
          description="Removes video suggestions shown at the end of playback (Study and Research)."
        >
          {sw('Hide end screens', s.focus.hideEndScreen, (v) =>
            up({ focus: { hideEndScreen: v } }),
          )}
        </SettingRow>
        <SettingRow
          title="Hide comments"
          description="Hides the comments section on watch pages (Study)."
        >
          {sw('Hide comments', s.focus.hideComments, (v) => up({ focus: { hideComments: v } }))}
        </SettingRow>
        <SettingRow
          title="Show topic search on the home page"
          description="Replaces hidden home recommendations with a topic search box (Study)."
        >
          {sw('Home search panel', s.focus.showHomePanel, (v) =>
            up({ focus: { showHomePanel: v } }),
          )}
        </SettingRow>
      </Section>
      <Section id="search" title="Search">
        <SettingRow
          title="Filter results in every mode"
          description="By default result filtering only runs in Research mode."
        >
          {sw('Filter in all modes', s.search.applyInAllModes, (v) =>
            up({ search: { applyInAllModes: v } }),
          )}
        </SettingRow>
        <SettingRow
          title="Show relevance scores"
          description="Adds a small “Match” badge to results when a topic is active. Hover it to see why."
        >
          {sw('Show scores', s.search.showScores, (v) => up({ search: { showScores: v } }))}
        </SettingRow>
        <SettingRow
          title="Keep search history"
          description="Remembers your recent searches on this device."
        >
          {sw('Keep search history', s.search.keepHistory, (v) =>
            up({ search: { keepHistory: v } }),
          )}
        </SettingRow>
      </Section>
      <Section id="queue" title="Queue">
        <SettingRow
          title="Show thumbnails"
          description="Loads thumbnails from YouTube’s image server (i.ytimg.com). Turn off to avoid those requests."
        >
          {sw('Show thumbnails', s.queue.showThumbnails, (v) =>
            up({ queue: { showThumbnails: v } }),
          )}
        </SettingRow>
        <SettingRow
          title="Mark finished videos automatically"
          description="Marks a queued video as watched when it plays to the end."
        >
          {sw('Auto-mark watched', s.queue.autoMarkComplete, (v) =>
            up({ queue: { autoMarkComplete: v } }),
          )}
        </SettingRow>
      </Section>
      <Section id="analytics" title="Analytics">
        <SettingRow
          title="Record viewing time"
          description="Measures playback time on this device. Nothing is sent anywhere."
        >
          {sw('Record viewing time', s.analytics.enabled, (v) => up({ analytics: { enabled: v } }))}
        </SettingRow>
        <SettingRow
          title="Daily goal"
          description="Minutes of measured viewing per day. 0 turns the goal off."
        >
          <NumberField
            label="Daily goal minutes"
            value={s.analytics.dailyGoalMinutes}
            min={0}
            max={1440}
            suffix="min"
            onCommit={(n) => up({ analytics: { dailyGoalMinutes: n } })}
          />
        </SettingRow>
        <SettingRow
          title="Weekly goal"
          description="Minutes of measured viewing per week. 0 turns it off."
        >
          <NumberField
            label="Weekly goal minutes"
            value={s.analytics.weeklyGoalMinutes}
            min={0}
            max={10080}
            suffix="min"
            onCommit={(n) => up({ analytics: { weeklyGoalMinutes: n } })}
          />
        </SettingRow>
        <SettingRow
          title="Show goal streaks"
          description="Counts consecutive days you met the daily goal."
        >
          {sw('Show streaks', s.analytics.streaks, (v) => up({ analytics: { streaks: v } }))}
        </SettingRow>
        <SettingRow
          title="Count blocked Shorts"
          description="Keeps a local count of how many Shorts were hidden."
        >
          {sw('Count blocked Shorts', s.analytics.trackBlockedEvents, (v) =>
            up({ analytics: { trackBlockedEvents: v } }),
          )}
        </SettingRow>
        <SettingRow
          title="Keep history for"
          description="Older daily stats are deleted automatically."
        >
          <NumberField
            label="History days"
            value={s.analytics.historyDays}
            min={7}
            max={365}
            suffix="days"
            onCommit={(n) => up({ analytics: { historyDays: n } })}
          />
        </SettingRow>
      </Section>
      <Section id="notifications" title="Notifications">
        <SettingRow
          title="Session complete"
          description="Show a desktop notification when a session ends."
        >
          {sw('Session complete notification', s.notifications.sessionComplete, (v) =>
            up({ notifications: { sessionComplete: v } }),
          )}
        </SettingRow>
        <SettingRow title="Break reminders" description="Remind you to rest during long sessions.">
          {sw('Break reminders', s.notifications.breakReminders, (v) =>
            up({ notifications: { breakReminders: v } }),
          )}
        </SettingRow>
        <SettingRow title="Break interval" description="Minutes of session time between reminders.">
          <NumberField
            label="Break interval minutes"
            value={s.notifications.breakEveryMinutes}
            min={5}
            max={120}
            suffix="min"
            onCommit={(n) => up({ notifications: { breakEveryMinutes: n } })}
          />
        </SettingRow>
      </Section>
      <Section id="appearance" title="Appearance">
        <SettingRow title="Theme" description="Dark is the default.">
          <select
            aria-label="Theme"
            value={s.appearance.theme}
            onChange={(e) =>
              up({ appearance: { theme: e.target.value as Settings['appearance']['theme'] } })
            }
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="system">Match system</option>
          </select>
        </SettingRow>
        <SettingRow
          title="Reduce motion"
          description="Turns off transitions and animations in FocusTube’s own screens (your system setting is also respected)."
        >
          {sw('Reduce motion', s.appearance.reducedMotion, (v) =>
            up({ appearance: { reducedMotion: v } }),
          )}
        </SettingRow>
      </Section>
      <Section id="advanced" title="Advanced rules">
        <p className="muted small" style={{ padding: '10px 0' }}>
          Excluded keywords, preferred channels, relevance thresholds and custom hide selectors live
          on the{' '}
          <a href="#/rules" style={{ color: 'var(--accent)' }}>
            Rules
          </a>{' '}
          page.
        </p>
      </Section>

      <Section id="privacy" title="Privacy and data">
        <div className="stack-sm" style={{ padding: '12px 0' }}>
          <p className="small">
            FocusTube works entirely on this device. It has no account, no backend and no analytics
            service, and it never sends your viewing history anywhere. It reads YouTube pages only
            to hide distractions and measure playback time.
          </p>
          <p className="small muted">
            Stored locally: settings, topics, queues, daily totals (up to {s.analytics.historyDays}{' '}
            days), the last 100 activity entries and up to 50 session summaries.
          </p>
        </div>
        <div className="row wrap" style={{ paddingTop: 8 }}>
          <button className="btn" type="button" onClick={exportFile}>
            <Download size={14} />
            Export settings and queues
          </button>
          <button className="btn" type="button" onClick={() => fileRef.current?.click()}>
            <Upload size={14} />
            Import…
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="Import file"
            tabIndex={-1}
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </div>
        {pending && (
          <div
            className="banner stack-sm"
            role="alertdialog"
            aria-label="Confirm import"
            style={{ marginTop: 12 }}
          >
            <p>
              Importing will replace your current {pending.result.settings ? 'settings' : ''}
              {pending.result.topics
                ? `${pending.result.settings ? ', ' : ''}${pending.result.topics.length} topic(s)`
                : ''}
              {pending.result.queues ? `, ${pending.result.queues.length} queue(s)` : ''}.
            </p>
            {pending.result.errors.map((e) => (
              <p key={e} className="small muted">
                {e}
              </p>
            ))}
            <div className="row">
              <button
                className="btn primary"
                type="button"
                onClick={() =>
                  void act({ type: 'DATA_IMPORT', json: pending.json }, 'Import complete').then(
                    () => setPending(null),
                  )
                }
              >
                Replace with imported data
              </button>
              <button className="btn" type="button" onClick={() => setPending(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}
        <hr className="divider" style={{ margin: '16px 0' }} />
        <div className="row wrap">
          <button
            className="btn"
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  'Reset every setting to its default? Your queues and history are kept.',
                )
              )
                void act({ type: 'SETTINGS_RESET' }, 'Settings reset');
            }}
          >
            <RotateCcw size={14} />
            Reset settings to defaults
          </button>
          {!confirmDelete ? (
            <button className="btn danger" type="button" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={14} />
              Delete all local data…
            </button>
          ) : (
            <span className="row" role="alertdialog" aria-label="Confirm delete all data">
              <span className="small">
                This permanently deletes settings, topics, queues and history.
              </span>
              <button
                className="btn danger"
                type="button"
                onClick={() =>
                  void act({ type: 'DATA_DELETE_ALL' }, 'All local data deleted').then(() =>
                    setConfirmDelete(false),
                  )
                }
              >
                Yes, delete everything
              </button>
              <button className="btn" type="button" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </span>
          )}
        </div>
      </Section>
    </div>
  );
}
