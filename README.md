# InkLab

**Your personal tattoo practice coach.** An AI-assisted apprenticeship companion for beginners learning on fake skin. It answers two questions beginners keep running into:

1. **What should I practice next?** A roadmap plus a coach that builds each session from your answers and your journal.
2. **What am I doing wrong?** A "What went wrong?" troubleshooter, self-check lists for every exercise, and optional AI feedback on photos of your practice. When you're still stuck, InkLab saves the question so you can send your instructor one message instead of a dozen.

> Practice on synthetic skin or paper only. InkLab doesn't replace an apprenticeship, bloodborne-pathogen/hygiene training, or a working artist's eye.

## Try it

Published version: https://claude.ai/artifact/8QxgSrk1d86xUghk5zaAQr (shared as "anyone with the link"; viewers need a Claude account). There, the AI coach uses the viewer's Claude account with no API key, and each person's journal is saved privately to their own account.

## Deploy to Vercel (shareable class link)

1. Go to [vercel.com/new](https://vercel.com/new), sign in with GitHub, and import `suchisundar/inklab`.
2. Leave the defaults (Framework preset: **Other**, no build command, no output directory).
3. Under **Environment Variables**, add:
   - `ANTHROPIC_API_KEY` - your key from [console.anthropic.com](https://console.anthropic.com). It stays on the server and never reaches the browser.
   - `CLASS_CODE` *(recommended)* - any word you choose. Classmates enter it in Settings to use the AI coach, so strangers who find the link can't spend your API credit. Everything else in the app works without it.
4. Click **Deploy**. You'll get a link like `inklab.vercel.app` to post for class.

Things to know:
- On Vercel each person's journal and photos stay in their own browser. Nothing is shared between classmates, and nothing is stored on the server.
- Each AI review is one Claude request with one photo, paid from your API account. Set a monthly spend limit in the Anthropic Console.
- Without `ANTHROPIC_API_KEY` the site still works. The AI coach then asks each person for their own key.
- If Vercel builds from a different branch than the one with this code, change it under Settings → Git → Production Branch.

## Run it locally

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
| **Journal** | Log difficulty, self-check, problems, notes and a photo. Shows practice days, minutes, streak, exercises "solid", a trend summary and your most common problems. Includes an instructor-feedback field per entry, plus JSON export/import. **Upload practice photo** adds practice done outside a session (your own flash, a traced design) with a photo, what it was, how it felt and any problems. It gets the same AI coach feedback, and its problems count toward fix-it drills. |
| **What went wrong?** | 11 common beginner problems (blowouts, shaky lines, patchy lines, uneven width, blobs at line ends, lopsided circles, stencil smearing, streaky shading, chewed skin…). Each lists likely causes, what to change and a drill. |
| **Instructor Qs** | Questions collect here (from the troubleshooter, the AI coach, or typed in). "Copy as message" turns the open ones into one polite batch message. You can record the answers. |
| **AI coach** *(optional)* | Add a Claude API key in Settings to get structured feedback on a journal entry: what's working, up to 3 issues with likely cause + fix, a suggested drill, and a question for your instructor when something needs an in-person check. |

### How the coach decides (no AI needed)

The rules live in `js/coach.js`:

- An exercise is **solid** when 2 of your last 3 attempts felt Okay/Easy **and** you ticked ≥75% of its self-check.
- If your last attempt in this focus area felt **Hard** or scored under 50% on the self-check, you repeat it.
- Otherwise you finish an exercise you've started before opening a new one, then move to the next exercise at your level that isn't solid yet. If it builds on something you haven't started, you do that first (stencil transfer, for example, comes right before your first design).
- If there's time left, you get a **fix-it drill** for the problem you've logged most often recently, or else a stretch goal.
- A problem logged 2+ times recently always gets attention: in a 30-minute session the drill takes 10 minutes from the main block; in a 15-minute session the drill *is* the main exercise.

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

The journal, photos and questions are stored in each person's browser (localStorage, plus IndexedDB for photos). On Vercel the API key lives only in the server function. The browser-key mode is meant for personal use and should never be shared.

## Files

```
ANSWERS.md        class write-up: the five questions
index.html        app shell
css/styles.css    styles (light + dark)
js/data.js        curriculum, exercises, troubleshooting library
js/store.js       localStorage + IndexedDB persistence
js/coach.js       session generator, mastery + progress logic
js/coach-prompt.js  AI coach instructions + output shape (shared with the server)
js/ai.js          AI coach: picks built-in Claude, the Vercel function, or your own key
api/coach.js      Vercel function that calls Claude with the server-side key
js/app.js         views and interactions
```

## Ideas for version two

- Stencil generation from a reference image
- Comparing photos of the same exercise over time, side by side
- An instructor view: share a read-only link and let them leave feedback on entries
- Checking machine-setting notes per needle/voltage combination
