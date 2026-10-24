import { useState } from 'react';
import { History, Play, Search as SearchIcon, Trash2 } from 'lucide-react';
import { EmptyState, ListField, SettingRow } from '../components';
import { buildSearchUrl } from '../../shared/urls';
import type { DurationFilter, UploadDateFilter } from '../../shared/types';
import type { PageProps } from './ctx';

export function SearchPage({ settings, data, act }: PageProps) {
  const [query, setQuery] = useState('');
  const topic = data.topics.find((t) => t.id === data.activeTopicId);
  const s = settings.search;

  const run = async (text: string): Promise<void> => {
    const term = text.trim();
    if (!term) return;
    const url = buildSearchUrl(term, s.uploadDate);
    await act({ type: 'TOPIC_SAVE', name: term, activate: true });
    await act({ type: 'SEARCH_RECORD', query: term, url });
    window.open(url, '_blank', 'noopener');
    setQuery('');
  };
  const patch = (p: Parameters<typeof act>[0] extends infer M ? M : never): void => void act(p);

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Search</h1>
        <p className="muted">Search YouTube by topic. The topic stays active while you watch.</p>
      </div>
      <section className="card stack-sm" aria-label="Topic search">
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            void run(query);
          }}
        >
          <input
            type="search"
            aria-label="Topic"
            placeholder="e.g. linear algebra, Rust ownership, Roman history"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="btn primary" type="submit">
            <SearchIcon size={16} />
            Search
          </button>
        </form>
        <p className="muted small">
          Opens YouTube’s own search. Relevance scores are based only on the title, channel and
          snippet shown in results. FocusTube does not analyse video content.
        </p>
        <div className="row wrap">
          <label className="row small">
            <span className="muted">Uploaded</span>
            <select
              aria-label="Upload date"
              value={s.uploadDate}
              onChange={(e) =>
                patch({
                  type: 'SETTINGS_UPDATE',
                  patch: { search: { uploadDate: e.target.value as UploadDateFilter } },
                })
              }
            >
              <option value="any">Any time</option>
              <option value="today">Today</option>
              <option value="week">This week</option>
              <option value="month">This month</option>
              <option value="year">This year</option>
            </select>
          </label>
          <label className="row small">
            <span className="muted">Duration</span>
            <select
              aria-label="Duration"
              value={s.duration}
              onChange={(e) =>
                patch({
                  type: 'SETTINGS_UPDATE',
                  patch: { search: { duration: e.target.value as DurationFilter } },
                })
              }
            >
              <option value="any">Any length</option>
              <option value="short">Under 4 min</option>
              <option value="medium">4–20 min</option>
              <option value="long">Over 20 min</option>
            </select>
          </label>
        </div>
        <p className="muted small">
          Upload date uses YouTube’s native filter. Duration is applied to visible results in
          Research mode.
        </p>
      </section>

      <section className="card stack-sm" aria-label="Saved topics">
        <h2>Saved topics</h2>
        {data.topics.length === 0 ? (
          <EmptyState
            icon={SearchIcon}
            title="No saved topics"
            body="Topics you search for are saved here so you can switch between them."
          />
        ) : (
          <ul className="list">
            {[...data.topics]
              .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
              .map((t) => (
                <li key={t.id}>
                  <span className={`chip ${t.id === data.activeTopicId ? 'active' : ''}`}>
                    {t.name}
                  </span>
                  <span className="grow muted small">
                    {t.id === data.activeTopicId
                      ? 'Active'
                      : `Last used ${new Date(t.lastUsedAt).toLocaleDateString()}`}
                  </span>
                  <button
                    className="btn small"
                    type="button"
                    onClick={() =>
                      void act({ type: 'TOPIC_ACTIVATE', id: t.id }, `Topic: ${t.name}`)
                    }
                    disabled={t.id === data.activeTopicId}
                  >
                    Use
                  </button>
                  <button className="btn small" type="button" onClick={() => void run(t.name)}>
                    Search
                  </button>
                  <button
                    className="btn small icon"
                    type="button"
                    aria-label={`Delete topic ${t.name}`}
                    onClick={() => void act({ type: 'TOPIC_DELETE', id: t.id }, 'Topic deleted')}
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
          </ul>
        )}
        {topic && (
          <div>
            <button
              className="btn primary"
              type="button"
              onClick={() =>
                void act(
                  { type: 'SESSION_OP', op: { op: 'start', minutes: 25, topicLocked: true } },
                  `Started a 25-minute session on ${topic.name}`,
                )
              }
              disabled={!!data.session}
            >
              <Play size={16} />
              Start a focus session on “{topic.name}”
            </button>
          </div>
        )}
      </section>

      <section className="card stack-sm" aria-label="Search preferences">
        <h2>Result filtering</h2>
        <SettingRow
          title="Excluded keywords"
          description="Results containing these words are hidden in Research mode. One per line."
        >
          <ListField
            label="Excluded keywords"
            value={s.negativeKeywords}
            placeholder={'reaction\nclickbait'}
            onCommit={(v) =>
              patch({ type: 'SETTINGS_UPDATE', patch: { search: { negativeKeywords: v } } })
            }
          />
        </SettingRow>
      </section>

      <section className="card" aria-label="Recent searches">
        <h2 style={{ marginBottom: 8 }}>Recent searches</h2>
        {!s.keepHistory ? (
          <p className="muted">Search history is off. Turn it on in Settings → Search.</p>
        ) : data.searchHistory.length === 0 ? (
          <EmptyState
            icon={History}
            title="No searches yet"
            body="Your recent topic searches will appear here."
          />
        ) : (
          <div className="chips">
            {data.searchHistory.slice(0, 12).map((h) => (
              <button key={h} type="button" className="chip" onClick={() => void run(h)}>
                {h}
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
