# FocusTube

**Watch with purpose. Learn without distraction.**

A privacy-first Chrome extension (Manifest V3) that turns YouTube into a focused learning space: it blocks Shorts, trims distracting recommendations, keeps you on a topic, and measures your viewing time locally.

No account, no backend, no API key, no analytics service. Everything is stored in `chrome.storage.local`.

## Features

- **Shorts blocker** – homepage shelves, search results, sidebar, subscriptions, channel Shorts grids and tabs, related videos, dynamically loaded content. Direct `/shorts/ID` links open as normal watch pages; if that is impossible you get a small notice with a way back. Channel `/shorts` tabs redirect to the channel's Videos tab.
- **Focus modes** – _Study_ (no home/related recommendations, optional comments/end-screen hiding, home search panel), _Research_ (result filtering by excluded keywords, relevance and duration, discovery modules hidden), _Balanced_ (Shorts + shelves only). Master switch and one-click **Exit focus mode** always available.
- **Topic search** – native YouTube search, saved topics, active topic persisted across videos, "Back to search results", upload-date filter via YouTube's own parameter, duration filter on visible results, explainable text-based relevance badges.
- **Queue** – named local queues, add by link or from a watch page, reorder, resume position, mark watched, total remaining time. Your real YouTube playlists are never touched.
- **Focus sessions** – 15/25/45/60 or custom minutes, pause/resume/stop, topic lock, queue target, optional break reminders, completion notification and summary. Timing is derived from persisted timestamps, so it survives service-worker suspension and browser restarts.
- **Local analytics** – measured playback time (ads, seeks and pauses excluded), daily/weekly goals, configurable streaks, per-topic time, blocked-Shorts counts.
- **Dashboard** – Overview, Focus, Search, Queue, Insights, Rules, Settings. Dark by default, light theme, keyboard accessible, reduced-motion support.
- **Data control** – validated JSON export/import (settings, topics, queues), reset to defaults, delete all local data.

## Honest limitations

- YouTube changes its markup often. Detection combines several signals (URLs, links, thumbnail badges, shelf elements, labels) but may need selector updates; custom hide rules help in the meantime. Tab/sidebar detection by label is English-only.
- "Relevance" is computed only from the title, channel and snippet text YouTube already shows. FocusTube does **not** analyse video content, attention or learning; it reports measured playback time only.
- The upload-date filter uses one of YouTube's native filter values; combining it with other native filters is not supported. Duration filtering is applied client-side to visible results (Research mode, or all modes if enabled).
- Hidden-result filtering does not reorder results; it hides and badges them.
- Shorts links are converted with a full page load, so there may be a brief flash.
- Desktop `www.youtube.com` only (no mobile site, YouTube Music or embeds).
- The Playwright test in `e2e/` has not been executed in the authoring environment.

## Permissions

| Permission                                              | Why                                                          |
| ------------------------------------------------------- | ------------------------------------------------------------ |
| `storage`                                               | Settings, topics, queues, stats (local only).                |
| `alarms`                                                | Wake the service worker for session end and break reminders. |
| `notifications`                                         | Session-complete and break notifications.                    |
| Host `https://www.youtube.com/*` (content script match) | Hide distractions and measure playback on YouTube.           |

No other host permissions, no remote code, no `tabs`, no `history`, no `cookies`.

The queue's thumbnails are loaded by the extension pages from `i.ytimg.com` (YouTube's image server). Turn this off in Settings → Queue.

## Development

```bash
npm install
npm run dev          # rebuild on change (load dist/ in Chrome)
npm run typecheck
npm run lint
npm test             # Vitest unit + jsdom tests
npm run check        # typecheck + lint + tests
npm run build        # production build into dist/
npm run package      # build + focustube.zip (requires the `zip` command)
npm run test:e2e     # Playwright (needs `npx playwright install chromium`)
```

See [docs/INSTALL.md](docs/INSTALL.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/MANUAL_TESTING.md](docs/MANUAL_TESTING.md), [docs/STORE_CHECKLIST.md](docs/STORE_CHECKLIST.md) and [docs/ROADMAP.md](docs/ROADMAP.md).

## Screenshots guidance (Web Store)

Capture at 1280×800: (1) YouTube search in Research mode with relevance badges, (2) Study-mode home with the topic panel, (3) popup, (4) dashboard Overview with real data, (5) Insights. Use your own account data only; do not show other people's content or thumbnails you do not have rights to.
