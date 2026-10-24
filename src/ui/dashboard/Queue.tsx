import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ListVideo,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  Video,
} from 'lucide-react';
import { EmptyState, ProgressBar } from '../components';
import { completionRatio, remainingSeconds } from '../../shared/queue';
import { parseVideoId, watchUrl } from '../../shared/urls';
import { formatDuration } from '../../shared/util';
import type { PageProps } from './ctx';

export function QueuePage({ settings, data, act }: PageProps) {
  const [name, setName] = useState('');
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const queue = data.queues.find((q) => q.id === data.activeQueueId) ?? data.queues[0];
  const q = completionRatio(queue);
  const rem = queue ? remainingSeconds(queue) : { seconds: 0, unknownCount: 0 };

  const add = async (): Promise<void> => {
    const id = parseVideoId(link);
    if (!id)
      return setLinkError(
        'That is not a YouTube video link. Paste a watch, youtu.be or Shorts link.',
      );
    setLinkError(null);
    const res = await act(
      {
        type: 'QUEUE_OP',
        op: {
          op: 'add',
          ...(queue ? { queueId: queue.id } : {}),
          video: { videoId: id, url: watchUrl(id), title: '' },
        },
      },
      'Added to queue',
    );
    if (res.ok) setLink('');
  };

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Queue</h1>
        <p className="muted">
          A private watch list stored on this device. Your YouTube playlists are never changed.
        </p>
      </div>
      <section className="card stack-sm" aria-label="Queues">
        <div className="chips">
          {data.queues.map((x) => (
            <button
              key={x.id}
              type="button"
              className={`chip ${x.id === queue?.id ? 'active' : ''}`}
              aria-pressed={x.id === queue?.id}
              onClick={() => void act({ type: 'QUEUE_OP', op: { op: 'setActive', queueId: x.id } })}
            >
              {x.name} ({x.items.length})
            </button>
          ))}
        </div>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim())
              void act({ type: 'QUEUE_OP', op: { op: 'create', name } }, 'Queue created').then(() =>
                setName(''),
              );
          }}
        >
          <input
            type="text"
            aria-label="New queue name"
            placeholder="New queue name"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn" type="submit">
            <Plus size={14} />
            Create queue
          </button>
        </form>
      </section>

      <section className="card stack-sm" aria-label="Queue items">
        {!queue ? (
          <EmptyState
            icon={ListVideo}
            title="No queue yet"
            body="Create a queue above, or paste a video link below to start one."
          />
        ) : (
          <>
            <div className="row between">
              <h2>{queue.name}</h2>
              <div className="row">
                <button
                  className="btn small"
                  type="button"
                  onClick={() => {
                    const n = window.prompt('Rename queue', queue.name);
                    if (n)
                      void act({
                        type: 'QUEUE_OP',
                        op: { op: 'rename', queueId: queue.id, name: n },
                      });
                  }}
                >
                  Rename
                </button>
                <button
                  className="btn small danger"
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Delete “${queue.name}” and its ${queue.items.length} videos from FocusTube?`,
                      )
                    )
                      void act(
                        { type: 'QUEUE_OP', op: { op: 'delete', queueId: queue.id } },
                        'Queue deleted',
                      );
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
            {q.total > 0 && (
              <>
                <ProgressBar value={q.ratio} label="Queue completion" />
                <p className="muted small">
                  {q.done} of {q.total} watched · about {formatDuration(rem.seconds)} remaining
                  {rem.unknownCount > 0 ? ` (+${rem.unknownCount} of unknown length)` : ''}
                </p>
              </>
            )}
          </>
        )}
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <input
            type="text"
            aria-label="YouTube video link"
            aria-invalid={!!linkError}
            placeholder="Paste a YouTube video link"
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
          <button className="btn primary" type="submit">
            <Plus size={14} />
            Add
          </button>
        </form>
        {linkError && (
          <p className="small" role="alert" style={{ color: 'var(--danger)' }}>
            {linkError}
          </p>
        )}
        {queue && queue.items.length === 0 && (
          <EmptyState
            icon={Video}
            title="This queue is empty"
            body="Paste a link above, or use the FocusTube menu on any watch page."
          />
        )}
        {queue && queue.items.length > 0 && (
          <ul className="list">
            {queue.items.map((it, i) => (
              <li key={it.videoId}>
                {settings.queue.showThumbnails && it.thumbnailUrl ? (
                  <img className="thumb" src={it.thumbnailUrl} alt="" loading="lazy" />
                ) : (
                  <div className="thumb ph" aria-hidden="true">
                    <Video size={18} />
                  </div>
                )}
                <div className="grow">
                  <h3
                    style={{
                      textDecoration: it.completed ? 'line-through' : 'none',
                      opacity: it.completed ? 0.6 : 1,
                    }}
                  >
                    {it.title}
                  </h3>
                  <p className="muted small">
                    {it.durationSec ? formatDuration(it.durationSec) : 'Length unknown'}
                    {it.positionSec > 5 && !it.completed
                      ? ` · resume at ${formatDuration(it.positionSec)}`
                      : ''}
                    {it.completed ? ' · watched' : ''}
                  </p>
                </div>
                <a
                  className="btn small primary"
                  href={watchUrl(it.videoId, it.completed ? 0 : it.positionSec)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Play size={12} />
                  {it.positionSec > 5 && !it.completed ? 'Resume' : 'Watch'}
                </a>
                <button
                  className="btn small icon"
                  type="button"
                  aria-label={
                    it.completed ? `Mark ${it.title} as not watched` : `Mark ${it.title} as watched`
                  }
                  onClick={() =>
                    void act({
                      type: 'QUEUE_OP',
                      op: { op: 'complete', videoId: it.videoId, completed: !it.completed },
                    })
                  }
                >
                  {it.completed ? <RotateCcw size={14} /> : <Check size={14} />}
                </button>
                <button
                  className="btn small icon"
                  type="button"
                  aria-label={`Move ${it.title} up`}
                  disabled={i === 0}
                  onClick={() =>
                    void act({
                      type: 'QUEUE_OP',
                      op: { op: 'move', queueId: queue.id, videoId: it.videoId, toIndex: i - 1 },
                    })
                  }
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  className="btn small icon"
                  type="button"
                  aria-label={`Move ${it.title} down`}
                  disabled={i === queue.items.length - 1}
                  onClick={() =>
                    void act({
                      type: 'QUEUE_OP',
                      op: { op: 'move', queueId: queue.id, videoId: it.videoId, toIndex: i + 1 },
                    })
                  }
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  className="btn small icon danger"
                  type="button"
                  aria-label={`Remove ${it.title}`}
                  onClick={() =>
                    void act({
                      type: 'QUEUE_OP',
                      op: { op: 'remove', queueId: queue.id, videoId: it.videoId },
                    })
                  }
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
