# Cairn

A tracker and learning app for the NeetCode 150. It decides what you should work on today, brings solved problems back for revision on a schedule, trains you to recognize which pattern a problem needs, and shows the whole climb as a map.

Everything runs in the browser. There is no backend, no account and no API key.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm run build      # type-checks, then writes static files to dist/
npm run preview    # serve dist/ locally
npm test           # engine, storage and data tests
```

`dist/` is plain static files with relative asset paths and hash-based routes, so it works from any folder on any static host.

## What is in it

| Screen | What it does |
|---|---|
| **Today** | The briefing: revisions due (held to a daily cap), the next new problems, a session builder for the time you have, and where you stand against your plan. |
| **Map** | The 18 topics as a mountain massif. Camps fill in as you solve; trails show what leads where. A topic opens its problems and its field guide. Nothing is ever locked. |
| **Problems** | All 150 with search (titles, numbers, topics, tags, your notes), filters and sorting. |
| **Problem sheet** | Opens over any screen. Solve timer, three-way rating, structured notes, mistake tags, history, a hints-only coaching chat, and recall-before-reveal for revisions. |
| **Drill** | Quick-fire pattern recognition: a title and a summary, four patterns to choose from, the clue afterwards. Weighted toward what you get wrong. |
| **Mock** | Two problems, a countdown, topic and tags hidden until you rate them. |
| **Insights** | Strength by topic, plan versus actual, activity and streaks, the revision forecast, and a breakdown of your mistakes. |
| **Settings** | Plan dates, the revision cap, timer targets, theme, export and import, demo data. |

Press `⌘K` (or `Ctrl K`) for the command palette and `?` for every keyboard shortcut.

## How revisions work

A solved problem climbs a ladder of 1, 3, 7, 21 and 45 days. Rating a revision **Easy** moves it two rungs, **Struggled** one, and **Needed help** sends it back to the start. Each problem also carries its own ease, so problems you find easy stretch out and shaky ones come back sooner. Clear the ladder and the problem is mastered.

Only so many revisions are put in front of you per day (5 by default). When more are due, the most urgent and weakest go first and the rest wait without penalty.

The schedule is never stored. It is replayed from your logged attempts, so backdating, editing or deleting an attempt always leaves a consistent history.

## Your data

Progress is kept in this browser's `localStorage` as one JSON document. **Settings → Your data** exports it to a file and imports it again, which is also how you move between devices.

**Load demo data** fills the app with about ten weeks of generated history so you can see every screen populated. Your own data is set aside while the demo is loaded and comes back when you exit it.

## Project layout

```
src/
  data/       The problem list, topic graph, pattern taxonomy, per-problem content, field guides
  domain/     Pure logic: spaced repetition, the review queue, recommendations, sessions,
              strength scores, statistics, drill sampling, demo history. No React, no storage.
  state/      The stored document, its reducers, validation, export/import, and the store
  ui/         The shared component kit and design tokens' consumers
  styles/     tokens.css (both themes) and global.css
  app/        The shell: routing, top bar, dock, shortcuts
  features/   One folder per screen or overlay
```

Storage sits behind a three-method `StorageAdapter` (`src/state/storage.ts`). Remote sync can be added by implementing that interface and passing it to `setStorageAdapter`; nothing else needs to change.

## The problem list

The 150 problems and their order come from [NeetCode's roadmap](https://neetcode.io/roadmap). Numbers, titles, difficulty and Premium status were checked against LeetCode, and each walkthrough link was confirmed to exist. Summaries, clues, pattern tags and field guides are written for this app.
