// Optional AI technique feedback on a journal entry, using Claude.
// Runs entirely in your browser with your own API key (stored only on this
// device). Fine for a personal prototype - don't ship a public app this way;
// put the key behind a small server instead.

window.InkAI = (function () {
  const SDK_URL = "https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.131.0/+esm";
  const MODEL = "claude-opus-5-5";

  let sdkPromise = null;
  function loadSdk() {
    if (!sdkPromise) sdkPromise = import(SDK_URL).then((m) => m.default || m.Anthropic);
    return sdkPromise;
  }

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

  function schema(drillIds) {
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
        next_drill_id: { type: "string", enum: drillIds },
        next_drill_reason: { type: "string" },
        ask_instructor: { type: "string", description: "A specific question for their instructor, or empty string." },
        photo_quality_note: { type: "string", description: "Note about photo quality, or empty string if fine." },
      },
    };
  }

  // When InkLab runs as a claude.ai Artifact, the viewer's own Claude answers
  // (no API key). Resolves the sample function, or null elsewhere.
  let samplePromise = null;
  function builtIn() {
    if (!samplePromise) {
      samplePromise = window.claude && window.claude.use ? window.claude.use("sample").catch(() => null) : Promise.resolve(null);
    }
    return samplePromise;
  }

  function dataUrlToBlob(dataUrl) {
    const [head, b64] = dataUrl.split(",");
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: head.slice(5, head.indexOf(";")) });
  }

  async function review({ apiKey, attempt, exercise, photoDataUrl, profile }) {
    const { EXERCISES, TROUBLESHOOT, LEVELS } = window.INKLAB_DATA;

    const checked = exercise.checks.map((c, i) => `${attempt.checks[i] ? "[x]" : "[ ]"} ${c}`).join("\n");
    const problems = (attempt.problems || [])
      .map((id) => (TROUBLESHOOT.find((p) => p.id === id) || {}).symptom)
      .filter(Boolean);
    const level = (LEVELS.find((l) => l.id === profile.level) || {}).label;

    const text = `Exercise: ${exercise.title}
Goal of the exercise: ${exercise.why}
Their level: ${level}
How hard it felt: ${window.InkCoach.DIFFICULTY[attempt.difficulty]}
Their self-check:
${checked}
Problems they noticed: ${problems.length ? problems.join("; ") : "none ticked"}
Their notes: ${attempt.notes || "(none)"}
${photoDataUrl ? "The photo of the practice is attached." : "No photo was provided - give feedback from the self-report only and say a photo would help."}

Available drills (id: title): ${EXERCISES.map((e) => `${e.id}: ${e.title}`).join(" | ")}`;

    const sample = await builtIn();
    if (sample) return reviewWithSample(sample, text, photoDataUrl, EXERCISES.map((e) => e.id));

    if (!apiKey) throw new Error("Add your Claude API key in Settings first.");
    const Anthropic = await loadSdk();
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

    const content = [];
    if (photoDataUrl) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: photoDataUrl.split(",")[1] },
      });
    }
    content.push({ type: "text", text });

    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      output_config: { effort: "medium", format: { type: "json_schema", schema: schema(EXERCISES.map((e) => e.id)) } },
      messages: [{ role: "user", content }],
    });

    if (response.stop_reason === "refusal") {
      throw new Error("The coach couldn't review this one. Try a different photo or rephrase your notes.");
    }
    const out = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    try {
      return JSON.parse(out);
    } catch (e) {
      throw new Error("The coach's reply was cut off. Try again.");
    }
  }

  async function reviewWithSample(sample, text, photoDataUrl, drillIds) {
    const opts = { modelTier: "default" };
    let photoNote = "";
    if (photoDataUrl) {
      const caps = await sample.limits().catch(() => null);
      if (caps && caps.images) opts.images = [dataUrlToBlob(photoDataUrl)];
      else photoNote = "\n(The photo could not be sent in this view, so review from the self-report only and say so in photo_quality_note.)";
    }
    const prompt = `${SYSTEM}

${text}${photoNote}

Reply with only a JSON object in exactly this shape:
${JSON.stringify(schema(drillIds).properties)}
All keys are required. working_well and issues are arrays (issues: at most 3 objects with issue, likely_cause, fix). next_drill_id must be one of the drill ids listed above. Use "" for ask_instructor or photo_quality_note when there is nothing to say.`;
    let out;
    try {
      out = await sample.json(prompt, opts);
    } catch (e) {
      if (e && e.code === "not_granted") throw new Error("The AI coach needs permission to use Claude. Allow it when asked, or from the artifact's Permissions menu.");
      if (e && e.code === "rate_limited") throw new Error("The coach is busy. Wait a minute and try again.");
      throw new Error((e && e.message) || "The coach couldn't answer. Try again.");
    }
    return {
      summary: String(out.summary || ""),
      working_well: Array.isArray(out.working_well) ? out.working_well.map(String) : [],
      issues: Array.isArray(out.issues) ? out.issues.slice(0, 3) : [],
      next_drill_id: drillIds.includes(out.next_drill_id) ? out.next_drill_id : "",
      next_drill_reason: String(out.next_drill_reason || ""),
      ask_instructor: String(out.ask_instructor || ""),
      photo_quality_note: String(out.photo_quality_note || ""),
    };
  }

  return { review, builtIn, MODEL };
})();
