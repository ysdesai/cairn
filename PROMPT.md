# Build a NeetCode 150 tracker and learning app

I want you to build a web app that I will use every day for the next few months to work through the NeetCode 150 and get properly good at LeetCode-style interview problems. Build the whole thing in the current directory, which is empty.

Two things matter most, and they matter equally:

1. **It makes me better at solving problems**, not only better at ticking boxes. Most trackers are checklists. This one should manage my revisions, expose my weak patterns, and train me to recognise which pattern a problem needs.
2. **It looks and feels exceptional.** I want to open it and be impressed: a product someone would assume a strong design team shipped. The visual design, motion, layout and interaction details are yours to decide. I am deliberately not prescribing a style, colours, typography or layout, because I want to see your taste. Avoid the generic dashboard look (a grid of grey cards with a sidebar); have a point of view and carry it through every screen.

Be ambitious with the interface. Spend real effort on it: a distinctive visual identity, considered typography and colour, depth and atmosphere, fluid transitions between screens, and small interaction details that make it a pleasure to use. The roadmap in particular should be a showpiece, something I would want to screenshot. Treat the data visualisations as designed objects, not default chart-library output. A plain, safe, competent interface is a failure for this project, even if every feature works.

The sections below say what the app must do. How it looks, how screens are arranged, what things are named, and any extra touches are up to you. If you think of a feature that would really help someone learn, add it, as long as everything required here works well first.

## About me and how I will use it

- I am a software engineer preparing for interviews, solving in Python.
- I solve problems on leetcode.com in another tab. This app is where I decide what to do next, log how it went, take notes, and revise.
- A typical session is 30 to 90 minutes: clear a few revisions, then attempt one to three new problems.
- I use a laptop most of the time and my phone sometimes, so it has to work well at both sizes.
- I like keyboard-driven tools.

## Technical constraints

- React, TypeScript and Vite. Beyond that, choose whatever libraries you like for styling, animation, charts and graph layout.
- It is a static client-side app with no backend, no accounts and no API keys. It must work when deployed as static files.
- All progress is stored in the browser and survives a reload. Provide export to and import from a JSON file so I can back up and move between devices. Keep the storage layer behind a small interface so that remote sync could be added later; do not build sync now.
- `npm install && npm run dev` must start it, and `npm run build` must pass with no type errors.
- Light and dark themes, both designed with care, following the system setting with a manual override.
- It should stay fast and smooth with all 150 problems and a year of history.

## The problem data

Embed the full NeetCode 150 as data in the app: exactly 150 problems in these 18 topics, in NeetCode's order within each topic.

| Topic | Problems |
|---|---|
| Arrays & Hashing | 9 |
| Two Pointers | 5 |
| Sliding Window | 6 |
| Stack | 7 |
| Binary Search | 7 |
| Linked List | 11 |
| Trees | 15 |
| Tries | 3 |
| Heap / Priority Queue | 7 |
| Backtracking | 9 |
| Graphs | 13 |
| Advanced Graphs | 6 |
| 1-D Dynamic Programming | 12 |
| 2-D Dynamic Programming | 11 |
| Greedy | 8 |
| Intervals | 6 |
| Math & Geometry | 8 |
| Bit Manipulation | 7 |

For each problem store the title, LeetCode number, LeetCode slug, difficulty (Easy, Medium or Hard), topic, whether it needs LeetCode Premium, and a few finer-grained pattern tags (for example "monotonic stack", "fast and slow pointers", "topological sort"). Build the LeetCode link from the slug. Do not invent video or article URLs; if you are not certain a URL exists, leave it out. Check that the final count is 150 and that the per-topic counts match the table.

The topics form a dependency graph, which the roadmap view uses:

- Arrays & Hashing → Two Pointers, Stack
- Two Pointers → Binary Search, Sliding Window, Linked List
- Binary Search, Sliding Window, Linked List → Trees
- Trees → Tries, Heap / Priority Queue, Backtracking
- Heap / Priority Queue → Intervals, Greedy, Advanced Graphs
- Backtracking → Graphs, 1-D Dynamic Programming
- Graphs → Advanced Graphs, 2-D Dynamic Programming, Math & Geometry
- 1-D Dynamic Programming → 2-D Dynamic Programming, Bit Manipulation
- Bit Manipulation → Math & Geometry

Also write, for each of the 18 topics, a short cheat sheet: the clues in a problem statement that point to this pattern, the core idea, a minimal Python template, and common mistakes.

This is my own tool that follows the public problem list. Do not copy the neetcode.io visual design or branding.

## What the app must do

### 1. A home screen that tells me what to do today

When I open the app I should know within a few seconds what to work on. It shows the revisions due today, the next new problems to attempt (following the roadmap order, and leaning toward my weak areas), and where I stand: streak, progress, and whether I am on pace for my target date. Starting work on any item is one click or keypress.

Include a session builder: I say how much time I have (for example 40 minutes) and it proposes a queue of revisions and new problems that fits.

### 2. The roadmap

An interactive view of the 18-topic dependency graph, which is the main way to see overall progress. Each topic shows how far along I am, and it should be obvious which topics are finished, in progress, and recommended next. Opening a topic shows its problems and its cheat sheet. The graph only recommends an order; it never blocks me from opening any problem.

### 3. Problem detail

Opening a problem from anywhere shows: title, number, difficulty, topic, pattern tags, the LeetCode link, a Premium marker if it applies, my status, my history with this problem, and my notes. From here I can:

- Start a **solve timer**, with a target time by difficulty (roughly 15 minutes for Easy, 25 for Medium, 40 for Hard). The time is saved with the attempt. I can also enter a time by hand or skip it.
- **Log the result** with one of three ratings: "Easy" (solved alone, quickly), "Struggled" (solved alone, slowly) or "Needed help" (used a hint, video or solution). I can backdate a solve.
- **Write notes** in a structured form: key insight, time and space complexity, and mistakes. Notes save automatically.
- **Tag mistakes** from a fixed set, such as wrong pattern, missed edge case, off-by-one, wrong complexity, bug in implementation, ran out of time.
- **Open a coaching chat**: a button that opens `https://claude.ai/new?q=<encoded prompt>` in a new tab, where the prompt asks for a hints-only interview coach for this specific problem (understand the question first, ask for my brute-force idea, one small hint at a time, no optimal approach or code unless I ask, then have me explain why it works, the complexity, and the clues that identify the pattern). Include the problem title, LeetCode URL and "My language: Python".
- Mark the problem unsolved again, with a confirmation.

### 4. Revisions that adapt and never pile up

Solved problems come back for revision on a spaced schedule.

- Intervals adapt per problem. A good starting ladder is 1, 3, 7, 21 and 45 days. "Easy" moves a problem along faster, "Struggled" moves it one step, and "Needed help" sends it back to the start. A problem that clears the whole ladder is "mastered".
- There is a daily cap on revisions (default 5, configurable). When more are due than the cap allows, show the most urgent and weakest first and carry the rest over without making me feel behind. A fixed schedule without a cap buries the user in reviews after a few weeks, and I want to avoid that.
- **Recall before reveal**: when I start a revision, I first type the key insight from memory. Only then does the app show my saved notes beside what I typed, and I rate how it went.
- Show a forecast of how many revisions are coming over the next two weeks.

### 5. Pattern drill

A quick-fire mode that trains pattern recognition. It shows a problem's title and a one or two sentence summary of what it asks (written by you, in your own words, with no solution hints), and I choose which pattern it needs from several options. I get immediate feedback, with a short explanation of the clue that gives it away. It tracks my accuracy per pattern and favours the patterns I get wrong. It can draw from problems I have not solved yet, since recognising the pattern is the skill.

### 6. Mock interview

Picks two problems (configurable: difficulty mix, only solved, only unsolved, or specific topics) and runs a 45-minute countdown. Topic and pattern tags are hidden during the mock so they do not give the approach away. At the end I rate each problem and the results are saved to my history like any other attempt.

### 7. Insight into my progress

- **Weakness view**: a per-topic strength score that combines ratings, solve times against target, revision lapses, and drill accuracy, with a clear suggestion of what to work on next.
- **Activity heatmap** of solves and revisions, with current and best streak.
- **Plan versus actual**: I set a start date and a target finish date. Show cumulative solved against the planned line, the pace I need per day, my actual pace, and the projected finish date.
- **Mistake breakdown**: which mistake tags come up most, and in which topics.
- Breakdown by difficulty, and counts of solved, mastered and remaining.

### 8. Finding things

- A full problem list with search across title, number, topic, tags and my notes, and filters for topic, difficulty and status (to do, solved, due, mastered, has notes).
- A command palette on `Cmd+K` / `Ctrl+K` that can jump to any problem, topic or screen and run common actions.
- Keyboard shortcuts for the frequent actions, with a discoverable shortcut reference.

### 9. Settings and data

Start date, target date, daily revision cap, timer targets, theme, export, import, and reset all data (with confirmation).

Include a "load demo data" action that fills the app with about ten weeks of realistic, varied history (around 60 solved problems, a mix of ratings, some mastered, some overdue, notes, mistake tags, drill results), and a way to clear it. A first-time user sees a well-designed empty state, and I want to be able to see every chart and screen populated without using the app for weeks.

## Quality bar

- Every screen has considered empty, loading and populated states.
- Motion has a purpose: it shows where something came from or confirms an action. Respect the reduced-motion setting.
- Finishing a topic or mastering a problem should feel rewarding, without getting in the way.
- Text contrast is readable in both themes, everything interactive is reachable by keyboard, and focus is visible.
- On a phone, nothing scrolls sideways and every feature is usable.
- No placeholder content, dead buttons or "coming soon" sections. If something is in the interface, it works.

## Before you finish

Run the build and the app yourself. Load the demo data and go through each screen at laptop and phone widths, in both themes, and fix what looks wrong or behaves badly. Then give me a short summary of what you built, the design direction you chose and why, any features you added beyond this brief, and anything that does not fully work.
