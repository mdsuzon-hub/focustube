# Architecture and decisions

```
src/shared      pure TypeScript: types, defaults, validation/migration, URLs, relevance,
                queue, session, analytics, playback reducer, message contracts, import/export
src/background  service worker: message handlers (single writer), alarms, notifications
src/content     lightweight content script (no React): controller + small DOM modules
src/ui          React popup and dashboard
tests           Vitest (node + jsdom)
```

## Decisions

1. **Pure core, thin shells.** Session, queue, analytics, playback and validation logic are pure functions of `(state, input, now)`. This is what makes service-worker recovery and testing straightforward.
2. **Single writer.** UIs and content scripts read storage directly (and subscribe to `storage.onChanged`) but every mutation is a typed message to the service worker, which serialises read-modify-write through one promise chain. Messages are validated by `parseMessage`; senders from other extensions are rejected.
3. **No in-memory timers for correctness.** A session stores `startedAt`, `pausedAt`, `pausedTotalMs`, `deadlineAt`. Elapsed/remaining are always derived from timestamps. `chrome.alarms` only wake the worker; `recoverSession` runs on every wake, browser start and alarm, and is idempotent. Sessions that expired while the browser was closed are completed without a stale notification; abandoned paused sessions (12 h) are closed as stopped.
4. **Reversible DOM changes.** Hiding is an attribute (`data-focustube-hidden`) tracked by `HiddenRegistry`, styled by one injected stylesheet. Focus-mode CSS rules are gated by attributes on `<html>`. `stop()` removes everything. Each scan re-evaluates hidden elements, so recycled YouTube nodes are restored.
5. **No single brittle selector for Shorts.** Shelves, links to `/shorts`, thumbnail overlay badges and tab/nav labels are combined. Hiding climbs only through _single-item_ card containers, never broad parents, and never an element containing the player.
6. **SPA detection** uses YouTube's own events, `popstate`, the Navigation API when present, and a cheap URL poll fallback, all disposable. The debounced `MutationObserver` ignores FocusTube's own nodes.
7. **Shadow DOM for injected UI** (HUD, home panel, notice) so YouTube's CSS cannot affect it and ours cannot leak. The HUD lives in the masthead, never over the player.
8. **Playback measurement** uses the `<video>` element's clock between `timeupdate` events; jumps (seeks) and ad playback are excluded. Reports are batched (15 s / pause / hide / end) and deduplicated server-side.
9. **Validation everywhere.** Stored data, imports and messages pass through the same sanitizers. Selectors reject braces/semicolons; thumbnails must be `i.ytimg.com`; video ids must match `[A-Za-z0-9_-]{11}`; `__proto__`/`constructor` are ignored in merges.
10. **Schema versions.** `MIGRATIONS[i]` upgrades version _i_ to _i+1_ (`migrateSettings`); the service worker re-saves migrated settings on install.
11. **No YouTube Data API.** If added later it belongs behind a separate adapter with its own credential handling, quota tracking and policy review (see ROADMAP).
12. **Plain CSS with variables** instead of Tailwind: fewer build dependencies for a small design system. Space Grotesk is bundled locally (no font CDN).
