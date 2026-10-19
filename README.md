# InkLab

**Your personal tattoo practice coach.** An AI-assisted apprenticeship companion for beginners learning on fake skin. It answers two questions beginners keep running into:

1. **What should I practice next?** A roadmap plus a coach that builds each session from your answers and your journal.
2. **What am I doing wrong?** A "What went wrong?" troubleshooter, self-check lists for every exercise, and optional AI feedback on photos of your practice. When you're still stuck, InkLab saves the question so you can send your instructor one message instead of a dozen.

> Practice on synthetic skin or paper only. InkLab doesn't replace an apprenticeship, bloodborne-pathogen/hygiene training, or a working artist's eye.

## Run it

Static site with no build step and no install.

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

You can also open `index.html` directly, or host the folder on GitHub Pages or Netlify.

## Features (version one)

| Feature | What it does |
| --- | --- |
| **Practice** | The three questions (journey stage, focus, time). Generates a timed session: paper warm-up → main exercise → fix-it drill or stretch goal → log it. Each block says *why* it was picked. |
| **Roadmap** | 14 exercises in 5 stages: Foundations → Straight lines → Curves & circles → Simple designs → Intro shading. Each exercise has steps, equipment, a self-check and common problems. |
| **Journal** | Log difficulty, self-check, problems, notes and a photo. Shows practice days, minutes, streak, exercises "solid", a trend summary and your most common problems. Includes an instructor-feedback field per entry, plus JSON export/import. |
| **What went wrong?** | 11 common beginner problems (blowouts, shaky lines, patchy lines, uneven width, blobs at line ends, lopsided circles, stencil smearing, streaky shading, chewed skin…). Each lists likely causes, what to change and a drill. |
| **Instructor Qs** | Questions collect here (from the troubleshooter, the AI coach, or typed in). "Copy as message" turns the open ones into one polite batch message. You can record the answers. |
| **AI coach** *(optional)* | Add a Claude API key in Settings to get structured feedback on a journal entry: what's working, up to 3 issues with likely cause + fix, a suggested drill, and a question for your instructor when something needs an in-person check. |

### How the coach decides (no AI needed)

The rules live in `js/coach.js`:

- An exercise is **solid** when 2 of your last 3 attempts felt Okay/Easy **and** you ticked ≥75% of its self-check.
- If your last attempt in this focus area felt **Hard** or scored under 50% on the self-check, you repeat it.
- Otherwise you get the next exercise at your level that isn't solid yet. If it builds on something you haven't started, you do that first.
- If there's time left, you get a **fix-it drill** for the problem you've logged most often recently, or else a stretch goal.

To change the curriculum, edit `js/data.js`. It's plain data, so your instructor can review it too.

## Class assignment framing

| Question | InkLab answer |
| --- | --- |
| What are you improving? | Beginners often lack structured, personalized direction when learning tattooing on their own. They don't know what to learn next or what they're doing wrong. |
| What does the system need to know? | Experience level, learning goals, available practice time, and previous progress (difficulty ratings, self-checks, reported problems, photos). |
| What should it produce? | A personalized practice session, a roadmap with milestones, targeted fix-it drills, progress summaries, and optional feedback on practice photos. |
| How would you know it was good? | Users finish the exercises, understand the instructions, self-check scores rise and difficulty falls across sessions, and fewer problems repeat. |
| What feedback would improve it? | Difficulty ratings, photos of completed exercises, reported problems, and instructor feedback (each journal entry has a field for it). |

**Suggested experiment:** use it for two weeks. Export your journal at the end and compare self-check scores and repeated problems between week 1 and week 2. Show the export and a few photos to your instructor and ask whether the drills and AI feedback matched what they would have said.

## Privacy & the API key

All data (journal, photos, questions, key) stays in your browser: localStorage, plus IndexedDB for photos. The AI coach calls the Claude API straight from the browser with your own key. That's fine for a personal prototype. A public app should route requests through a small server so the key isn't exposed.

## Files

```
index.html        app shell
css/styles.css    styles (light + dark)
js/data.js        curriculum, exercises, troubleshooting library
js/store.js       localStorage + IndexedDB persistence
js/coach.js       session generator, mastery + progress logic
js/ai.js          optional Claude photo feedback
js/app.js         views and interactions
```

## Ideas for version two

- Stencil generation from a reference image
- Comparing photos of the same exercise over time, side by side
- An instructor view: share a read-only link and let them leave feedback on entries
- Checking machine-setting notes per needle/voltage combination
