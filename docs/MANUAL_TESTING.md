# Manual testing checklist

Load the unpacked build, then verify in a fresh Chrome profile. Tick each in all three modes where relevant.

**Homepage** – Balanced: Shorts shelf gone, normal grid intact. Study: grid hidden, topic panel shown, chips for saved topics work, "Exit focus mode" restores YouTube. Reload keeps state.
**Search** – Shorts never appear (scroll to load more). Research mode: excluded keyword hides results; "Show N filtered results" in the HUD menu reveals them; badges show a score and tooltip. Duration filter hides out-of-range results; live streams are never hidden.
**Watch page** – Study: related column gone, player/title/description/captions intact; comments hidden when set. End screen suggestions hidden. HUD menu: Back to results returns to the last search; Add to queue works; keyboard: Tab to pill, Enter opens, Esc closes.
**Channel pages** – Shorts tab hidden; visiting `/@name/shorts` redirects to Videos; no empty-container glitches on Videos/Playlists tabs.
**Subscriptions** – Shorts hidden, regular uploads untouched.
**Direct Shorts URL** – `/shorts/ID` opens as `/watch?v=ID`. `/shorts` (feed root) shows the notice with Go back / YouTube home.
**Dynamic loading** – infinite scroll on home/search/subscriptions never shows a Short; navigating between pages without reload re-applies rules.
**Toggling** – turn Focus Mode off: every hidden element, badge, HUD and panel disappears without reload. Turn Block Shorts off alone: Shorts return.
**Sessions** – start 15 min, pause, resume; close all Chrome windows and reopen: session continues with correct time. Let one expire while Chrome is closed: summary appears, no stale notification. Topic lock prevents clearing the topic.
**Playback tracking** – play 1 minute, seek forward, play an ad: Today increases by ~1 min only. Finish a queued video: it is marked watched once.
**Data** – export, delete all, import: settings, topics and queues return. Import a corrupt/edited file: rejected with a clear message.
**Keyboard & a11y** – every popup/dashboard control reachable by Tab with visible focus; switches announce on/off; progress bars have labels; Reduce motion and light theme work; contrast OK in both themes.
**Popup layout** – 360 px wide, no horizontal scroll, with long topic names and with 0 / 20 saved topics. Dashboard at 1280, 900 and ~400 px widths.
