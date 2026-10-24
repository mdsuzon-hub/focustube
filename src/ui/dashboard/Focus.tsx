import { useState } from 'react';
import { LogOut, Pause, Play, Square } from 'lucide-react';
import { EmptyState, NumberField, SettingRow, Toggle } from '../components';
import { PRESET_MINUTES, remainingMs } from '../../shared/session';
import { formatClock, formatDuration } from '../../shared/util';
import type { FocusMode } from '../../shared/types';
import type { PageProps } from './ctx';

const MODES: Array<{ mode: FocusMode; title: string; body: string }> = [
  {
    mode: 'study',
    title: 'Study',
    body: 'Hides home recommendations and related videos. Keeps the player, title, channel, description and captions. Optionally hides comments and end screens.',
  },
  {
    mode: 'research',
    title: 'Research',
    body: 'Keeps search results, removes Shorts and anything that matches your rules (negative keywords, relevance, duration). Hides discovery modules.',
  },
  {
    mode: 'balanced',
    title: 'Balanced',
    body: 'Blocks Shorts and trims distracting shelves. Normal browsing and navigation stay as they are.',
  },
];

export function FocusPage({ settings, data, now, act }: PageProps) {
  const [minutes, setMinutes] = useState(25);
  const [lock, setLock] = useState(false);
  const [target, setTarget] = useState(0);
  const s = data.session;
  const topic = data.topics.find((t) => t.id === data.activeTopicId);
  return (
    <div className="stack">
      <div className="page-head">
        <h1>Focus</h1>
        <p className="muted">Choose how strict YouTube should be, and run timed sessions.</p>
      </div>
      <section className="card stack-sm" aria-label="Focus mode">
        <SettingRow
          title="Focus Mode"
          description="Master switch for everything FocusTube changes on YouTube."
        >
          <Toggle
            label="Focus Mode"
            checked={settings.enabled}
            onChange={(v) => void act({ type: 'SETTINGS_UPDATE', patch: { enabled: v } })}
          />
        </SettingRow>
        <div className="grid cols-4" role="radiogroup" aria-label="Mode">
          {MODES.map((m) => (
            <button
              key={m.mode}
              type="button"
              role="radio"
              aria-checked={settings.mode === m.mode}
              className={`card tight ${settings.mode === m.mode ? '' : ''}`}
              style={{
                textAlign: 'left',
                borderColor: settings.mode === m.mode ? 'var(--accent)' : undefined,
                background: settings.mode === m.mode ? 'var(--accent-soft)' : undefined,
              }}
              onClick={() => void act({ type: 'SETTINGS_UPDATE', patch: { mode: m.mode } })}
            >
              <h3>{m.title}</h3>
              <p className="muted small">{m.body}</p>
            </button>
          ))}
        </div>
        <div className="row">
          <button
            className="btn danger"
            type="button"
            disabled={!settings.enabled}
            onClick={() => void act({ type: 'EXIT_FOCUS' }, 'Focus mode is off')}
          >
            <LogOut size={14} />
            Exit focus mode
          </button>
          <span className="muted small">
            Turns FocusTube off everywhere and stops any running session. You are never locked out.
          </span>
        </div>
      </section>

      <section className="card stack-sm" aria-label="Focus session">
        <h2>Session</h2>
        {s ? (
          <>
            <div className="row between">
              <div>
                <h3>{s.state === 'paused' ? 'Paused' : 'Running'}</h3>
                <p className="muted small">
                  {s.topicName ?? 'No topic'}
                  {s.topicLocked ? ' · topic locked' : ''}
                  {s.queueTarget ? ` · target ${s.queueTarget} videos` : ''}
                </p>
              </div>
              <span className="num" style={{ fontSize: 36, fontWeight: 600 }}>
                {formatClock(remainingMs(s, now))}
              </span>
            </div>
            <p className="muted small">
              Measured playback so far: {formatDuration(s.watchSeconds)} · {s.videosCompleted}{' '}
              video(s) finished
            </p>
            <div className="row">
              <button
                className="btn primary"
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
                    Resume
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
                Stop session
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="row wrap">
              {PRESET_MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`chip ${minutes === m ? 'active' : ''}`}
                  aria-pressed={minutes === m}
                  onClick={() => setMinutes(m)}
                >
                  {m} min
                </button>
              ))}
              <NumberField
                label="Custom minutes"
                value={minutes}
                min={1}
                max={480}
                suffix="min"
                onCommit={setMinutes}
              />
            </div>
            <SettingRow
              title="Lock topic"
              description={
                topic
                  ? `Keeps “${topic.name}” as the active topic until the session ends.`
                  : 'Choose a topic on the Search page first.'
              }
            >
              <Toggle
                label="Lock topic"
                checked={lock && !!topic}
                disabled={!topic}
                onChange={setLock}
              />
            </SettingRow>
            <SettingRow
              title="Queue completion target"
              description="Optional number of queued videos to finish. 0 means no target."
            >
              <NumberField
                label="Queue target"
                value={target}
                min={0}
                max={200}
                onCommit={setTarget}
              />
            </SettingRow>
            <div>
              <button
                className="btn primary"
                type="button"
                onClick={() =>
                  void act(
                    {
                      type: 'SESSION_OP',
                      op: {
                        op: 'start',
                        minutes,
                        topicLocked: lock && !!topic,
                        queueTarget: target || null,
                      },
                    },
                    'Session started',
                  )
                }
              >
                <Play size={16} />
                Start {minutes}-minute session
              </button>
            </div>
          </>
        )}
      </section>

      <section className="card" aria-label="Session history">
        <h2 style={{ marginBottom: 8 }}>Session summaries</h2>
        {data.sessionHistory.length === 0 ? (
          <EmptyState
            icon={Play}
            title="No sessions yet"
            body="Finished and stopped sessions are summarised here."
          />
        ) : (
          <ul className="list">
            {[...data.sessionHistory]
              .reverse()
              .slice(0, 10)
              .map((h) => (
                <li key={h.id}>
                  <div className="grow">
                    <h3>
                      {h.topicName ?? 'No topic'} ·{' '}
                      {h.state === 'completed' ? 'completed' : 'stopped early'}
                    </h3>
                    <p className="muted small">
                      {new Date(h.startedAt).toLocaleString()} · {formatDuration(h.activeMs / 1000)}{' '}
                      of {formatDuration(h.plannedMs / 1000)} planned
                    </p>
                  </div>
                  <span className="small muted">
                    Measured playback {formatDuration(h.watchSeconds)} · {h.videosCompleted}{' '}
                    finished
                  </span>
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}
