import { BarChart3, Flame } from 'lucide-react';
import { BarChart, EmptyState, ProgressBar } from '../components';
import {
  computeStreak,
  goalProgress,
  lastDays,
  topicBreakdown,
  totalSeconds,
} from '../../shared/analytics';
import { addDays, dateKey, formatDuration } from '../../shared/util';
import type { PageProps } from './ctx';

export function InsightsPage({ settings, data, now }: PageProps) {
  const a = settings.analytics;
  const todayKey = dateKey(now);
  const week = lastDays(data, todayKey, 7);
  const weekSecs = totalSeconds(week);
  const today = week[6]!;
  const streak = a.streaks ? computeStreak(data, a.dailyGoalMinutes, todayKey) : 0;
  const topics = topicBreakdown(lastDays(data, todayKey, 30)).slice(0, 8);
  const maxTopic = Math.max(1, ...topics.map((t) => t.seconds));
  const label = (k: string): string =>
    new Date(`${k}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' });
  const hasAny = Object.keys(data.daily).length > 0;

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Insights</h1>
        <p className="muted">
          Everything here is measured from playback on this device. FocusTube cannot tell whether
          you were paying attention or what you learned.
        </p>
      </div>
      {!a.enabled && (
        <div className="banner" role="status">
          Analytics are off, so no new viewing time is recorded. Turn them on in Settings →
          Analytics.
        </div>
      )}
      <div className="grid cols-4">
        <div className="card metric">
          <span className="muted small">Today</span>
          <span className="v num">{formatDuration(today.watchSeconds)}</span>
          {a.dailyGoalMinutes > 0 && (
            <ProgressBar
              value={goalProgress(today.watchSeconds, a.dailyGoalMinutes)}
              label="Daily goal"
            />
          )}
          <span className="muted small">
            {a.dailyGoalMinutes > 0 ? `Goal ${a.dailyGoalMinutes} min` : 'No goal'}
          </span>
        </div>
        <div className="card metric">
          <span className="muted small">Last 7 days</span>
          <span className="v num">{formatDuration(weekSecs)}</span>
          {a.weeklyGoalMinutes > 0 && (
            <ProgressBar value={goalProgress(weekSecs, a.weeklyGoalMinutes)} label="Weekly goal" />
          )}
          <span className="muted small">
            {a.weeklyGoalMinutes > 0 ? `Goal ${a.weeklyGoalMinutes} min` : 'No goal'}
          </span>
        </div>
        <div className="card metric">
          <span className="muted small">Videos finished (7 days)</span>
          <span className="v num">{week.reduce((n, d) => n + d.videosCompleted, 0)}</span>
        </div>
        <div className="card metric">
          <span className="muted small">Goal streak</span>
          <span className="v num">
            {a.streaks && a.dailyGoalMinutes > 0 ? `${streak} day${streak === 1 ? '' : 's'}` : '–'}
          </span>
          <span className="muted small">
            {a.streaks ? 'Days you met your daily goal. Missing a day is fine.' : 'Streaks are off'}
          </span>
        </div>
      </div>
      <section className="card stack-sm" aria-label="Weekly chart">
        <h2>Focused viewing, last 7 days</h2>
        {hasAny ? (
          <BarChart
            goalSeconds={a.dailyGoalMinutes * 60}
            days={week.map((d) => ({ label: label(d.date), seconds: d.watchSeconds }))}
          />
        ) : (
          <EmptyState
            icon={BarChart3}
            title="No data yet"
            body="Watch a video on YouTube with FocusTube on and your viewing time will show up here."
          />
        )}
      </section>
      <div className="grid cols-2">
        <section className="card stack-sm" aria-label="Topics">
          <h2>By topic (30 days)</h2>
          {topics.length === 0 ? (
            <p className="muted">Time is attributed to the active topic while you watch.</p>
          ) : (
            topics.map((t) => (
              <div key={t.topic} className="stack-sm">
                <div className="row between">
                  <span>{t.topic}</span>
                  <span className="muted num small">{formatDuration(t.seconds)}</span>
                </div>
                <ProgressBar value={t.seconds / maxTopic} label={`${t.topic} share of time`} />
              </div>
            ))
          )}
        </section>
        <section className="card stack-sm" aria-label="Blocked content">
          <h2>Shorts blocked</h2>
          {a.trackBlockedEvents ? (
            <>
              <p className="v num" style={{ fontSize: 28, fontWeight: 600 }}>
                {lastDays(data, todayKey, 7).reduce((n, d) => n + d.shortsBlocked, 0)}
              </p>
              <p className="muted small">
                Shorts hidden in the last 7 days (counted when they first appeared on a page; the
                same Short can be counted again after a reload).
              </p>
            </>
          ) : (
            <p className="muted">Blocked-content counting is off.</p>
          )}
          <hr className="divider" />
          <p className="muted small">
            <Flame size={12} aria-hidden="true" style={{ verticalAlign: -1 }} /> Stored history is
            kept for {a.historyDays} days. Oldest day kept:{' '}
            {Object.keys(data.daily).sort()[0] ?? addDays(todayKey, 0)}.
          </p>
        </section>
      </div>
    </div>
  );
}
