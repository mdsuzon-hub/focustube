<h1 align="center">FocusTube</h1>

<p align="center"><strong>Watch with purpose. Learn without distraction.</strong></p>

<p align="center">
  <a href="https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3"><img src="https://img.shields.io/badge/Chrome-Manifest%20V3-blue?logo=googlechrome&logoColor=white" alt="Manifest V3"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://vitest.dev/"><img src="https://img.shields.io/badge/tests-Vitest-6E9F18?logo=vitest&logoColor=white" alt="Tests"></a>
  <a href="#privacy"><img src="https://img.shields.io/badge/privacy-local--only-success?logo=privacypass&logoColor=white" alt="Privacy first"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-non--commercial-orange" alt="License: Non-Commercial"></a>
</p>

<p align="center">
  <a href="https://github.com/mdsuzon-hub/focustube/stargazers">
    <img src="https://img.shields.io/github/stars/mdsuzon-hub/focustube?style=for-the-badge&logo=github&label=Stars" alt="GitHub stars">
  </a>
</p>

<p align="center">
  ⭐ Like FocusTube? <a href="https://github.com/mdsuzon-hub/focustube"><strong>Open the repo and click <code>Star</code></strong></a> (top right) to support it.
</p>

---

A privacy-first Chrome extension (Manifest V3) that turns YouTube into a focused learning space: it blocks Shorts, trims distracting recommendations, keeps you on a topic, and measures your viewing time locally.

No account, no backend, no API key, no analytics service. Everything is stored in `chrome.storage.local`.

## Table of contents

- [Features](#features)
- [How to install](#how-to-install)
- [Honest limitations](#honest-limitations)
- [Permissions](#permissions)
- [Privacy](#privacy)
- [Development](#development)
- [Screenshots guidance](#screenshots-guidance-web-store)

## Features

- **Shorts blocker** – homepage shelves, search results, sidebar, subscriptions, channel Shorts grids and tabs, related videos, dynamically loaded content. Direct `/shorts/ID` links open as normal watch pages; if that is impossible you get a small notice with a way back. Channel `/shorts` tabs redirect to the channel's Videos tab.
- **Focus modes** – _Study_ (no home/related recommendations, optional comments/end-screen hiding, home search panel), _Research_ (result filtering by excluded keywords, relevance and duration, discovery modules hidden), _Balanced_ (Shorts + shelves only). Master switch and one-click **Exit focus mode** always available.
- **Topic search** – native YouTube search, saved topics, active topic persisted across videos, "Back to search results", upload-date filter via YouTube's own parameter, duration filter on visible results, explainable text-based relevance badges.
- **Queue** – named local queues, add by link or from a watch page, reorder, resume position, mark watched, total remaining time. Your real YouTube playlists are never touched.
- **Focus sessions** – 15/25/45/60 or custom minutes, pause/resume/stop, topic lock, queue target, optional break reminders, completion notification and summary. Timing is derived from persisted timestamps, so it survives service-worker suspension and browser restarts.
- **Local analytics** – measured playback time (ads, seeks and pauses excluded), daily/weekly goals, configurable streaks, per-topic time, blocked-Shorts counts.
- **Dashboard** – Overview, Focus, Search, Queue, Insights, Rules, Settings. Dark by default, light theme, keyboard accessible, reduced-motion support.
- **Data control** – validated JSON export/import (settings, topics, queues), reset to defaults, delete all local data.

## How to install

FocusTube is not on the Chrome Web Store yet, so you load it manually as an unpacked extension. Works in Chrome and other Chromium browsers (Edge, Brave, etc.).

### Option 1 – Build from source

**Requirements:** [Node.js](https://nodejs.org/) (current LTS recommended), npm, and Git.

```bash
git clone https://github.com/mdsuzon-hub/focustube.git
cd focustube
npm install
npm run build        # outputs the extension into dist/
```

Then load it in Chrome:

1. Open `chrome://extensions` in the address bar.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked**.
4. Select the **`dist/`** folder inside the project (not the project root).
5. Open [youtube.com](https://www.youtube.com) and refresh the tab. Pin FocusTube from the puzzle-piece menu for quick access.

### Option 2 – Install from a ZIP

If you have `focustube.zip` (from a release, or created with `npm run package`):

1. Unzip it to a folder you will keep (Chrome reads the files from there, so don't delete it).
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder (the one containing `manifest.json`).

### Updating

```bash
git pull
npm install
npm run build
```

Then go to `chrome://extensions` and click the **reload** icon on the FocusTube card. Refresh any open YouTube tabs.

### Troubleshooting

| Problem | Fix |
| --- | --- |
| "Manifest file is missing or unreadable" | You selected the wrong folder. Pick `dist/` (or the folder with `manifest.json`). |
| Nothing changes on YouTube | Refresh the YouTube tab after installing or reloading. Make sure the master switch is on. |
| `dist/` does not exist | Run `npm run build` first. |
| Build fails after pulling | Run `npm install` again, then `npm run build`. |
| Extension disappears after restart | You deleted or moved the folder you loaded it from. Load it again from a permanent location. |

More details: [docs/INSTALL.md](docs/INSTALL.md).

## Honest limitations

- YouTube changes its markup often. Detection combines several signals (URLs, links, thumbnail badges, shelf elements, labels) but may need selector updates; custom hide rules help in the meantime. Tab/sidebar detection by label is English-only.
- "Relevance" is computed only from the title, channel and snippet text YouTube already shows. FocusTube does **not** analyse video content, attention or learning; it reports measured playback time only.
- The upload-date filter uses one of YouTube's native filter values; combining it with other native filters is not supported. Duration filtering is applied client-side to visible results (Research mode, or all modes if enabled).
- Hidden-result filtering does not reorder results; it hides and badges them.
- Shorts links are converted with a full page load, so there may be a brief flash.
- Desktop `www.youtube.com` only (no mobile site, YouTube Music or embeds).
- The Playwright test in `e2e/` has not been executed in the authoring environment.

## Permissions

| Permission | Why |
| --- | --- |
| `storage` | Settings, topics, queues, stats (local only). |
| `alarms` | Wake the service worker for session end and break reminders. |
| `notifications` | Session-complete and break notifications. |
| Host `https://www.youtube.com/*` (content script match) | Hide distractions and measure playback on YouTube. |

No other host permissions, no remote code, no `tabs`, no `history`, no `cookies`.

The queue's thumbnails are loaded by the extension pages from `i.ytimg.com` (YouTube's image server). Turn this off in Settings → Queue.

## Privacy

- All data stays in `chrome.storage.local` on your device.
- No account, no server, no tracking, no analytics service.
- Export or delete everything any time from Settings.

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

## Support the project

If FocusTube helps you learn with fewer distractions, [star the repo on GitHub](https://github.com/mdsuzon-hub/focustube). ⭐
