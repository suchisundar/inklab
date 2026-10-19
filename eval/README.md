# Evaluating InkLab

## 1. Practice coach (runs offline)

`node eval/run.mjs` scores `js/coach.js` against `eval/gold.json`: 18 learner scenarios (answers + journal history), each labelled with the main exercise(s) a reasonable instructor would accept today.

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

| Version | Checks passed | Scenarios fully correct |
| --- | --- | --- |
| Baseline (`results-baseline.txt`) | 55/60 (92%) | 13/18 |
| After the progression fix (`results-after.txt`) | 58/60 (97%) | 16/18 |

The improvement: prerequisites aimed at a lower level than the learner's count as met, and exercises the learner has already moved past (a later one is solid) are skipped.

Still failing:
- **S06:** stencil transfer is tagged with every skill, so a new fake-skin learner who wants curves gets stencil practice first.
- **S12:** a 30-minute session has no room for a fix-it drill, so repeated blowouts aren't targeted.

Caveat: the fix was made while looking at these same scenarios, so the after score is optimistic. New scenarios written by someone else are the honest test.

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
