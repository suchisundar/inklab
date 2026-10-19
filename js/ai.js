// Optional AI technique feedback on a journal entry, using Claude.
//
// The page picks whichever route is available, in this order:
//   1. "builtin" - published as a claude.ai Artifact: the viewer's own Claude.
//   2. "server"  - deployed to Vercel: api/coach.js, with your key kept on the server.
//   3. "key"     - anywhere else: your own API key, called from the browser.
//                  Fine for personal use; never share a page set up this way.

window.InkAI = (function () {
  const SDK_URL = "https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.131.0/+esm";
  const MODEL = "claude-opus-5-5";
  const P = window.InkPrompt;

  let samplePromise = null;
  function builtIn() {
    if (!samplePromise) {
      samplePromise = window.claude && window.claude.use ? window.claude.use("sample").catch(() => null) : Promise.resolve(null);
    }
    return samplePromise;
  }

  // Resolves {ok, needsCode} when the Vercel function is deployed, else null.
  let serverPromise = null;
  function server() {
    if (!serverPromise) {
      serverPromise =
        location.protocol.startsWith("http") && !(window.claude && window.claude.use)
          ? fetch("api/coach")
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null)
          : Promise.resolve(null);
    }
    return serverPromise;
  }

  async function mode(apiKey) {
    if (await builtIn()) return "builtin";
    const s = await server();
    if (s && s.ok) return "server";
    return apiKey ? "key" : null;
  }

  function inputFrom(attempt, profile, hasPhoto) {
    return {
      exerciseId: attempt.exerciseId,
      level: profile.level,
      difficulty: attempt.difficulty,
      checks: attempt.checks,
      problems: attempt.problems || [],
      notes: attempt.notes || "",
      hasPhoto,
    };
  }

  async function review({ apiKey, classCode, attempt, photoDataUrl, profile }) {
    const m = await mode(apiKey);
    const input = inputFrom(attempt, profile, !!photoDataUrl);
    if (m === "builtin") return viaSample(await builtIn(), input, photoDataUrl);
    if (m === "server") return viaServer(input, photoDataUrl, classCode);
    if (m === "key") return viaKey(apiKey, input, photoDataUrl);
    throw new Error("Add your Claude API key in Settings first.");
  }

  async function viaServer(input, photoDataUrl, classCode) {
    const r = await fetch("api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Class-Code": classCode || "" },
      body: JSON.stringify({ ...input, photo: photoDataUrl ? photoDataUrl.split(",")[1] : null }),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(body.error || "The coach couldn't answer. Try again.");
    return P.normalize(body);
  }

  let sdkPromise = null;
  async function viaKey(apiKey, input, photoDataUrl) {
    if (!sdkPromise) sdkPromise = import(SDK_URL).then((m) => m.default || m.Anthropic);
    const Anthropic = await sdkPromise;
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

    const content = [];
    if (photoDataUrl) {
      content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: photoDataUrl.split(",")[1] } });
    }
    content.push({ type: "text", text: P.buildText(input) });

    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: P.SYSTEM,
      output_config: { effort: "medium", format: { type: "json_schema", schema: P.schema() } },
      messages: [{ role: "user", content }],
    });

    if (response.stop_reason === "refusal") {
      throw new Error("The coach couldn't review this one. Try a different photo or rephrase your notes.");
    }
    const out = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    try {
      return P.normalize(JSON.parse(out));
    } catch (e) {
      throw new Error("The coach's reply was cut off. Try again.");
    }
  }

  function dataUrlToBlob(dataUrl) {
    const [head, b64] = dataUrl.split(",");
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: head.slice(5, head.indexOf(";")) });
  }

  async function viaSample(sample, input, photoDataUrl) {
    const opts = { modelTier: "default" };
    let photoNote = "";
    if (photoDataUrl) {
      const caps = await sample.limits().catch(() => null);
      if (caps && caps.images) opts.images = [dataUrlToBlob(photoDataUrl)];
      else photoNote = "\n(The photo could not be sent in this view, so review from the self-report only and say so in photo_quality_note.)";
    }
    const prompt = `${P.SYSTEM}

${P.buildText(input)}${photoNote}

Reply with only a JSON object in exactly this shape:
${JSON.stringify(P.schema().properties)}
All keys are required. working_well and issues are arrays (issues: at most 3 objects with issue, likely_cause, fix). next_drill_id must be one of the drill ids listed above. Use "" for ask_instructor or photo_quality_note when there is nothing to say.`;
    try {
      return P.normalize(await sample.json(prompt, opts));
    } catch (e) {
      if (e && e.code === "not_granted") throw new Error("The AI coach needs permission to use Claude. Allow it when asked, or from the artifact's Permissions menu.");
      if (e && e.code === "rate_limited") throw new Error("The coach is busy. Wait a minute and try again.");
      throw new Error((e && e.message) || "The coach couldn't answer. Try again.");
    }
  }

  return { review, mode, server, builtIn, MODEL };
})();
