import { useState } from 'react';
import {
  ExternalLink,
  Pause,
  Play,
  Search,
  Settings as Cog,
  Square,
  Target,
  X,
} from 'lucide-react';
import {
  EmptyState,
  ErrorBanner,
  Loading,
  ProgressBar,
  Segmented,
  Toast,
  Toggle,
} from '../components';
import { useAction, useAppearance, useAppState, useNow, useToast } from '../store';
import { lastDays, goalProgress } from '../../shared/analytics';
import { completionRatio } from '../../shared/queue';
import { PRESET_MINUTES, remainingMs } from '../../shared/session';
import { buildSearchUrl } from '../../shared/urls';
import { dateKey, formatClock, formatDuration } from '../../shared/util';
import type { FocusMode } from '../../shared/types';

const MODES: Array<{ value: FocusMode; label: string }> = [
  { value: 'study', label: 'Study' },
  { value: 'research', label: 'Research' },
  { value: 'balanced', label: 'Balanced' },
];

export function PopupApp() {
  const { state, error } = useAppState();
  useAppearance(state?.settings);
  const toast = useToast();
  const act = useAction(toast.notify);
  const now = useNow(1000);
  const [query, setQuery] = useState('');
  const [minutes, setMinutes] = useState<number>(25);

  if (!state) return <Loading />;
  const { settings, data } = state;
  const topic = data.topics.find((t) => t.id === data.activeTopicId) ?? null;
  const today = lastDays(data, dateKey(now), 1)[0]!;
  const goal = settings.analytics.dailyGoalMinutes;
  const queue = data.queues.find((q) => q.id === data.activeQueueId);
  const q = completionRatio(queue);
  const s = data.session;

  const search = async (text: string): Promise<void> => {
    const term = text.trim();
    if (!term) return;
    const url = buildSearchUrl(term, settings.search.uploadDate);
    await act({ type: 'TOPIC_SAVE', name: term, activate: true });
    await act({ type: 'SEARCH_RECORD', query: term, url });
    await chrome.tabs.create({ url });
    window.close();
  };
  const openDashboard = (hash = ''): void =>
    void chrome.tabs.create({ url: chrome.runtime.getURL(`dashboard.html${hash}`) });

  return (
    <div className="wrap">
      <header className="row between">
        <div className="brand">
          <div className="logo" aria-hidden="true">
            <Target size={18} />
          </div>
          <div>
            <h1 style={{ fontSize: 16 }}>FocusTube</h1>
            <div className="tag">Watch with purpose. Learn without distraction.</div>
          </div>
        </div>
        <span className={`pill ${settings.enabled ? '' : 'off'}`}>
          <span className={`dot ${settings.enabled ? '' : 'off'}`} />
          {settings.enabled ? 'Active' : 'Off'}
        </span>
      </header>

      {error && <ErrorBanner text={`Storage problem: ${error}`} />}

      <section className="card tight stack-sm" aria-label="Focus mode">
        <div className="row between">
          <div>
            <h3>Focus Mode</h3>
            <p className="muted small">Applies to youtube.com</p>
          </div>
          <Toggle
            label="Focus Mode"
            checked={settings.enabled}
            onChange={(v) => void act({ type: 'SETTINGS_UPDATE', patch: { enabled: v } })}
          />
        </div>
        <Segmented
          label="Mode"
          value={settings.mode}
          options={MODES}
          onChange={(mode) => void act({ type: 'SETTINGS_UPDATE', patch: { mode } })}
        />
        <div className="row between">
          <div>
            <h3>Shorts protection</h3>
            <p className="muted small">
              {settings.enabled && settings.shorts.block
                ? 'Blocking Shorts everywhere'
                : 'Shorts are visible'}
            </p>
          </div>
          <Toggle
            label="Block Shorts"
            checked={settings.shorts.block}
            onChange={(v) => void act({ type: 'SETTINGS_UPDATE', patch: { shorts: { block: v } } })}
          />
        </div>
      </section>

      <section className="card tight stack-sm" aria-label="Topic">
        <h3>Topic</h3>
        {topic && (
          <div className="row">
            <span className="chip active grow">{topic.name}</span>
            <button
              className="btn icon"
              type="button"
              aria-label="Clear active topic"
              disabled={!!s?.topicLocked}
              onClick={() => void act({ type: 'TOPIC_ACTIVATE', id: null })}
            >
              <X size={16} />
            </button>
          </div>
        )}
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            void search(query);
          }}
        >
          <input
            type="search"
            aria-label="Search a topic on YouTube"
            placeholder={topic ? 'Search another topic' : 'What are you learning?'}
            list="ft-topics"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <datalist id="ft-topics">
            {data.topics.map((t) => (
              <option key={t.id} value={t.name} />
            ))}
          </datalist>
          <button className="btn primary icon" type="submit" aria-label="Search">
            <Search size={16} />
          </button>
        </form>
        {topic && (
          <button className="btn small" type="button" onClick={() => void search(topic.name)}>
            Search “{topic.name}” again
          </button>
        )}
      </section>

      <section className="card tight stack-sm" aria-label="Focus session">
        {s ? (
          <>
            <div className="row between">
              <div>
                <h3>{s.state === 'paused' ? 'Session paused' : 'Session running'}</h3>
                <p className="muted small">
                  {s.topicName ?? 'No topic'}
                  {s.topicLocked ? ' · topic locked' : ''}
                </p>
              </div>
              <span className="num" style={{ fontSize: 24, fontWeight: 600 }}>
                {formatClock(remainingMs(s, now))}
              </span>
            </div>
            <div className="row">
              <button
                className="btn primary grow"
                type="button"
                onClick={() =>
                  void act({
                    type: 'SESSION_OP',
                    op: { op: s.state === 'paused' ? 'resume' : 'pause' },
                  })
                }
              >
                {s.state === 'paused' ? (
                  <>
                    <Play size={16} />
                    Resume session
                  </>
                ) : (
                  <>
                    <Pause size={16} />
                    Pause
                  </>
                )}
              </button>
              <button
                className="btn danger"
                type="button"
                onClick={() =>
                  void act({ type: 'SESSION_OP', op: { op: 'stop' } }, 'Session stopped')
                }
              >
                <Square size={14} />
                Stop
              </button>
            </div>
          </>
        ) : (
          <>
            <h3>Focus session</h3>
            <div className="seg" role="radiogroup" aria-label="Session length">
              {PRESET_MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={minutes === m}
                  onClick={() => setMinutes(m)}
                >
                  {m}m
                </button>
              ))}
            </div>
            <button
              className="btn primary"
              type="button"
              onClick={() =>
                void act(
                  { type: 'SESSION_OP', op: { op: 'start', minutes, topicLocked: false } },
                  'Session started',
                )
              }
            >
              <Play size={16} />
              Start {minutes}-minute session
            </button>
          </>
        )}
      </section>

      <section className="card tight stack-sm" aria-label="Progress today">
        <div className="row between">
          <h3>Today</h3>
          <span className="num">
            {formatDuration(today.watchSeconds)}
            {goal > 0 ? ` of ${goal}m` : ''}
          </span>
        </div>
        {goal > 0 && (
          <ProgressBar
            value={goalProgress(today.watchSeconds, goal)}
            label="Daily watch-time goal"
          />
        )}
        <p className="muted small">Measured playback time, not attention.</p>
        <div className="row between">
          <h3>Queue</h3>
          <span className="num">{q.total === 0 ? 'Empty' : `${q.done} of ${q.total} done`}</span>
        </div>
        {q.total > 0 ? (
          <ProgressBar value={q.ratio} label="Queue completion" />
        ) : (
          <EmptyState
            icon={Target}
            title="Nothing queued"
            body="Add videos from a watch page using the FocusTube menu."
          />
        )}
      </section>

      <footer className="row">
        <button className="btn grow" type="button" onClick={() => openDashboard()}>
          <ExternalLink size={14} />
          Dashboard
        </button>
        <button
          className="btn grow"
          type="button"
          onClick={() => void chrome.runtime.openOptionsPage()}
        >
          <Cog size={14} />
          Settings
        </button>
      </footer>
      <Toast text={toast.text} kind={toast.kind} />
    </div>
  );
}
