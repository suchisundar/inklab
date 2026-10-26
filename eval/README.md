# Evaluating InkLab

## 1. Practice coach (runs offline)

`node eval/run.mjs` scores `js/coach.js` against `eval/gold.json`: 25 learner scenarios (answers + journal history), each labelled with the main exercise(s) a reasonable instructor would accept today. S01–S18 were the original set; S19–S25 (`"heldOut": true`) were written from the rubric *before* the v2 fixes, and the runner reports them separately.

**Outcome:** the learner gets a session that is the right next step for them.

**Criteria, checked per scenario:**

| Check | Passes when |
| --- | --- |
| Main exercise | It's in the scenario's accepted list |
| Time | Blocks add up exactly to the time chosen, and none is under 3 min |
| Recurring problem | A problem logged 2+ times in the last 10 entries gets a block for its drill (only scored when there is one) |
| Level | Nothing is above the learner's stated level |

**Labelling rubric used for `acceptMain`:**
- A first session for a complete beginner is the setup and hygiene run-through.
- If the last attempt felt Hard or scored under 50%, repeat it or step back to the drill for the logged problem.
- If someone says they're past a stage, don't send them back to it.
- Once an exercise is solid, move forward within the chosen focus.

The labels were written by the app's author from this rubric. **Have an instructor review them.** That's the most important next step for this eval.

**Results**

| Version | Scenarios | Checks passed | Fully correct | Held-out fully correct |
| --- | --- | --- | --- | --- |
| v1 baseline (`results-baseline.txt`) | 18 | 55/60 (92%) | 13/18 | - |
| v1 progression fix (`results-after.txt`) | 18 | 58/60 (97%) | 16/18 | - |
| v1 code on the 25-scenario set (`results-v2-baseline.txt`) | 25 | 77/83 (93%) | 20/25 | 4/7 |
| v2 (`results-v2.txt`) | 25 | 83/83 (100%) | 25/25 | 7/7 |

v1 improvement: prerequisites aimed at a lower level than the learner's count as met, and exercises the learner has already moved past (a later one is solid) are skipped.

The held-out scenarios found a bigger problem than the two known failures: stencil transfer was tagged with every skill, so it won the main slot in 3 of 7 new cases, once even over straight pulls the learner was halfway through (S24). v2 changes:

1. **Stencil transfer is a setup step, not a focus skill.** It's scheduled right before the first design (`flash-outline` requires it) or as the drill for smeared stencils. Fixes S06, S19, S21, S24.
2. **Finish what you started.** An exercise you're "practicing" comes before a brand-new one.
3. **Recurring problems get time even in short sessions.** A problem logged 2+ times recently gets 10 minutes of its drill in a 30-minute session (fixes S12, S24); in a 15-minute session the drill becomes the main exercise. That second rule was added after change 2 broke S13, which had only passed by accident (the old ordering happened to put the drill first).

Caveats: 100% means this rule set agrees with *my own* labels, not that it's right. The held-out cases were written by the same person who wrote the fix, before the fix but knowing the rules. An instructor reviewing `gold.json` and writing 10 new cases is still the honest test.

**Challenge case (S13: blowouts twice, only 15 minutes).** Two good rules conflict: "finish the exercise you started" says straight pulls, and "target the recurring problem" says the depth test. There's only room for one. v2 picks the drill, on the theory that drilling a pull you keep blowing out reinforces the habit. An instructor could reasonably disagree (one more careful set of pulls at lower depth), which is why both are in the accepted list and why this case should go to an instructor.

## 2. AI photo feedback (needs an API key and real photos)

Not yet run. Plan:

1. **Gold set:** 20–30 practice photos (fake skin), each labelled by an instructor with the 1–3 main problems (from the "What went wrong?" list) and the drill they'd assign. Include a few deliberately bad photos (blurry, glare, too far).
2. **Score each AI review:**
   - Problem recall: share of the instructor's problems the AI names.
   - Precision: share of the AI's issues the instructor agrees with.
   - Drill match: same drill as the instructor, or one they'd accept.
   - Photo-quality honesty: bad photos get a photo_quality_note and tentative issues.
   - Safety: never suggests tattooing a person.
3. **Baseline**, then change one thing (for example, give the prompt the troubleshooting library's symptom list to choose from), and re-score on the same photos plus a few new ones.
