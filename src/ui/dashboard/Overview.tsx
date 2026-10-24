import { Activity, ListVideo, ShieldOff, Timer } from 'lucide-react';
import { EmptyState, ProgressBar } from '../components';
import { goalProgress, lastDays } from '../../shared/analytics';
import { completionRatio, remainingSeconds } from '../../shared/queue';
import { remainingMs } from '../../shared/session';
import { dateKey, formatClock, formatDuration } from '../../shared/util';
import type { PageProps } from './ctx';

export function OverviewPage({ settings, data, now }: PageProps) {
  const today = lastDays(data, dateKey(now), 1)[0]!;
  const goal = settings.analytics.dailyGoalMinutes;
  const topic = data.topics.find((t) => t.id === data.activeTopicId);
  const queue = data.queues.find((q) => q.id === data.activeQueueId);
  const q = completionRatio(queue);
  const rem = queue ? remainingSeconds(queue) : { seconds: 0, unknownCount: 0 };
  const s = data.session;
  return (
    <div className="stack">
      <div className="page-head">
        <h1>Overview</h1>
        <p className="muted">Watch with purpose. Learn without distraction.</p>
      </div>
      <div className="grid cols-4">
        <div className="card metric">
          <span className="muted small">Focused viewing today</span>
          <span className="v num">{formatDuration(today.watchSeconds)}</span>
          {goal > 0 && (
            <ProgressBar
              value={goalProgress(today.watchSeconds, goal)}
              label="Daily goal progress"
            />
          )}
          <span className="muted small">{goal > 0 ? `Goal ${goal} min` : 'No daily goal set'}</span>
        </div>
        <div className="card metric">
          <span className="muted small">Videos finished today</span>
          <span className="v num">{today.videosCompleted}</span>
          <span className="muted small">{today.videosStarted} started</span>
        </div>
        <div className="card metric">
          <span className="muted small">Sessions completed today</span>
          <span className="v num">{today.sessionsCompleted}</span>
        </div>
        <div className="card metric">
          <span className="muted small">Shorts blocked today</span>
          <span className="v num">
            {settings.analytics.trackBlockedEvents ? today.shortsBlocked : '–'}
          </span>
          <span className="muted small">
            {settings.analytics.trackBlockedEvents ? 'Counted locally' : 'Tracking is off'}
          </span>
        </div>
      </div>
      <div className="grid cols-2">
        <section className="card stack-sm" aria-label="Current topic and session">
          <h2>Current topic</h2>
          {topic ? (
            <span className="chip active" style={{ alignSelf: 'flex-start' }}>
              {topic.name}
            </span>
          ) : (
            <p className="muted">No active topic. Pick one on the Search page.</p>
          )}
          <hr className="divider" />
          <h2>Session</h2>
          {s ? (
            <div className="row between">
              <span>
                {s.state === 'paused' ? 'Paused' : 'Running'}
                {s.topicName ? ` · ${s.topicName}` : ''}
              </span>
              <span className="num" style={{ fontSize: 24, fontWeight: 600 }}>
                {formatClock(remainingMs(s, now))}
              </span>
            </div>
          ) : (
            <p className="muted">No session running. Start one on the Focus page.</p>
          )}
        </section>
        <section className="card stack-sm" aria-label="Queue status">
          <h2>{queue ? queue.name : 'Queue'}</h2>
          {q.total === 0 ? (
            <EmptyState
              icon={ListVideo}
              title="Your queue is empty"
              body="Add videos from a watch page, or paste a link on the Queue page."
            />
          ) : (
            <>
              <ProgressBar value={q.ratio} label="Queue completion" />
              <p className="muted small">
                {q.done} of {q.total} watched · about {formatDuration(rem.seconds)} left
                {rem.unknownCount > 0 ? ` (+${rem.unknownCount} of unknown length)` : ''}
              </p>
            </>
          )}
        </section>
      </div>
      <section className="card" aria-label="Recent activity">
        <h2 style={{ marginBottom: 8 }}>Recent activity</h2>
        {data.activity.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No activity yet"
            body="Videos you watch and sessions you run will appear here."
          />
        ) : (
          <ul className="list">
            {[...data.activity]
              .reverse()
              .slice(0, 8)
              .map((a) => (
                <li key={a.id}>
                  <Timer size={14} aria-hidden="true" className="muted" />
                  <span className="grow">{a.label}</span>
                  <span className="muted small">{new Date(a.ts).toLocaleString()}</span>
                </li>
              ))}
          </ul>
        )}
      </section>
      {!settings.enabled && (
        <div className="banner" role="status">
          <ShieldOff size={14} aria-hidden="true" style={{ verticalAlign: -2 }} /> Focus Mode is
          off. Turn it on from the popup or the Focus page.
        </div>
      )}
    </div>
  );
}
