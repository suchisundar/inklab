// The AI coach's instructions and output shape. Shared by the browser
// (js/ai.js) and the Vercel function (api/coach.js) so both ask Claude the
// same way. Needs js/data.js loaded first.

window.InkPrompt = (function () {
  const DIFFICULTY = { 1: "Easy", 2: "Okay", 3: "Hard" };

  const SYSTEM = `You are InkLab's practice coach: an experienced, encouraging tattoo artist reviewing a beginner's practice on synthetic (fake) skin or paper.

Your job is to help them understand what they're likely doing wrong and what to practice next, so they don't have to bother a busy artist with every small question.

- Base your feedback on what is actually visible in the photo plus what they told you. If the photo is blurry, too far away, glare-covered or doesn't show the work, say so in photo_quality_note and keep issues tentative.
- Prioritise. Name at most 3 issues, most important first. Beginners can only fix one or two things per session.
- For each issue, give the most likely physical cause (depth, hand speed, angle, anchoring, stretch, needle/voltage, ink load, skin quality) and one concrete thing to change next session.
- Be honest about uncertainty: you can't feel depth or see the machine. Use "this often means..." rather than claiming certainty.
- Practice skin behaves differently from human skin; mention it when relevant.
- Never advise tattooing a person. If something would genuinely need an in-person check (machine setup, safety, hygiene), put a short, specific question in ask_instructor; otherwise leave it empty.
- Pick next_drill_id from the provided list.
- Plain, warm language. No jargon without a quick explanation.`;

  function drillIds() {
    return window.INKLAB_DATA.EXERCISES.map((e) => e.id);
  }

  function schema() {
    return {
      type: "object",
      additionalProperties: false,
      required: ["summary", "working_well", "issues", "next_drill_id", "next_drill_reason", "ask_instructor", "photo_quality_note"],
      properties: {
        summary: { type: "string", description: "One or two sentences of overall feedback." },
        working_well: { type: "array", items: { type: "string" } },
        issues: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["issue", "likely_cause", "fix"],
            properties: {
              issue: { type: "string" },
              likely_cause: { type: "string" },
              fix: { type: "string" },
            },
          },
        },
        next_drill_id: { type: "string", enum: drillIds() },
        next_drill_reason: { type: "string" },
        ask_instructor: { type: "string", description: "A specific question for their instructor, or empty string." },
        photo_quality_note: { type: "string", description: "Note about photo quality, or empty string if fine." },
      },
    };
  }

  // input: { exerciseId, title, level, difficulty, checks: bool[], problems: id[], notes, hasPhoto }
  // exerciseId is null for free practice (not a roadmap exercise); title says what it was.
  function buildText(input) {
    const { EXERCISES, TROUBLESHOOT, LEVELS } = window.INKLAB_DATA;
    const exercise = EXERCISES.find((e) => e.id === input.exerciseId);
    const problems = (input.problems || [])
      .map((id) => (TROUBLESHOOT.find((p) => p.id === id) || {}).symptom)
      .filter(Boolean);
    const level = (LEVELS.find((l) => l.id === input.level) || {}).label || "Unknown";

    const about = exercise
      ? `Exercise: ${exercise.title}
Goal of the exercise: ${exercise.why}`
      : `Free practice, not one of the roadmap exercises: ${input.title || "(not described)"}`;
    const selfCheck = exercise
      ? `Their self-check:
${exercise.checks.map((c, i) => `${input.checks[i] ? "[x]" : "[ ]"} ${c}`).join("\n")}`
      : "No self-check for free practice - judge from the photo and their notes, and pick the roadmap drill that best targets the main issue.";

    return `${about}
Their level: ${level}
How hard it felt: ${DIFFICULTY[input.difficulty] || "Okay"}
${selfCheck}
Problems they noticed: ${problems.length ? problems.join("; ") : "none ticked"}
Their notes: ${input.notes || "(none)"}
${input.hasPhoto ? "The photo of the practice is attached." : "No photo was provided - give feedback from the self-report only and say a photo would help."}

Available drills (id: title): ${EXERCISES.map((e) => `${e.id}: ${e.title}`).join(" | ")}`;
  }

  // Coerce whatever came back into the shape the UI renders.
  function normalize(out) {
    const ids = drillIds();
    return {
      summary: String(out.summary || ""),
      working_well: Array.isArray(out.working_well) ? out.working_well.map(String) : [],
      issues: Array.isArray(out.issues)
        ? out.issues.slice(0, 3).map((i) => ({ issue: String(i.issue || ""), likely_cause: String(i.likely_cause || ""), fix: String(i.fix || "") }))
        : [],
      next_drill_id: ids.includes(out.next_drill_id) ? out.next_drill_id : "",
      next_drill_reason: String(out.next_drill_reason || ""),
      ask_instructor: String(out.ask_instructor || ""),
      photo_quality_note: String(out.photo_quality_note || ""),
    };
  }

  return { SYSTEM, DIFFICULTY, schema, buildText, normalize };
})();
