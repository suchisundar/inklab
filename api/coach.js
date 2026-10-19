// Vercel serverless function: AI coach feedback with the API key kept on the
// server. Set ANTHROPIC_API_KEY in the Vercel project. Optionally set
// CLASS_CODE so only people who know the code can use the coach (and your
// API credit).
//
// The function builds the prompt itself from structured fields, so it can
// only be used for InkLab reviews - it isn't an open proxy to Claude.

import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

// Reuse the browser's curriculum and prompt files.
const ctx = vm.createContext({ window: {} });
for (const f of ["js/data.js", "js/coach-prompt.js"]) {
  vm.runInContext(fs.readFileSync(path.join(process.cwd(), f), "utf8"), ctx);
}
const { INKLAB_DATA, InkPrompt } = ctx.window;

const MODEL = "claude-opus-5-5";
const MAX_PHOTO_BASE64 = 3_000_000; // ~2.2 MB image; the app sends ~200 KB

const client = new Anthropic(); // reads ANTHROPIC_API_KEY

function validate(body) {
  const ex = INKLAB_DATA.EXERCISES.find((e) => e.id === body.exerciseId);
  if (!ex) return { error: "Unknown exercise." };
  const problemIds = new Set(INKLAB_DATA.TROUBLESHOOT.map((p) => p.id));
  const photo = typeof body.photo === "string" && body.photo ? body.photo : null;
  if (photo && (photo.length > MAX_PHOTO_BASE64 || !/^[A-Za-z0-9+/=]+$/.test(photo))) return { error: "That photo is too large or isn't a JPEG." };
  return {
    input: {
      exerciseId: ex.id,
      level: INKLAB_DATA.LEVELS.some((l) => l.id === body.level) ? body.level : "starting",
      difficulty: [1, 2, 3].includes(body.difficulty) ? body.difficulty : 2,
      checks: ex.checks.map((_, i) => Array.isArray(body.checks) && body.checks[i] === true),
      problems: Array.isArray(body.problems) ? body.problems.filter((p) => problemIds.has(p)).slice(0, 12) : [],
      notes: typeof body.notes === "string" ? body.notes.slice(0, 1500) : "",
      hasPhoto: !!photo,
    },
    photo,
  };
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ ok: !!process.env.ANTHROPIC_API_KEY, needsCode: !!process.env.CLASS_CODE });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: "The AI coach isn't set up on this site yet." });
  if (process.env.CLASS_CODE && req.headers["x-class-code"] !== process.env.CLASS_CODE) {
    return res.status(401).json({ error: "Enter the class code in Settings to use the AI coach." });
  }

  const { input, photo, error } = validate(req.body || {});
  if (error) return res.status(400).json({ error });

  const content = [];
  if (photo) content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: photo } });
  content.push({ type: "text", text: InkPrompt.buildText(input) });

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: InkPrompt.SYSTEM,
      output_config: { effort: "medium", format: { type: "json_schema", schema: InkPrompt.schema() } },
      messages: [{ role: "user", content }],
    });

    if (response.stop_reason === "refusal") {
      return res.status(422).json({ error: "The coach couldn't review this one. Try a different photo or rephrase your notes." });
    }
    const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    return res.status(200).json(InkPrompt.normalize(JSON.parse(text)));
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return res.status(429).json({ error: "The coach is busy. Wait a minute and try again." });
    if (e instanceof Anthropic.AuthenticationError) return res.status(503).json({ error: "The site's API key isn't valid. Tell whoever runs this site." });
    if (e instanceof Anthropic.BadRequestError) return res.status(400).json({ error: "Claude couldn't read that request. Try a different photo." });
    if (e instanceof Anthropic.APIError) return res.status(502).json({ error: "Claude is having trouble right now. Try again shortly." });
    if (e instanceof SyntaxError) return res.status(502).json({ error: "The coach's reply was cut off. Try again." });
    console.error(e);
    return res.status(500).json({ error: "Something went wrong. Try again." });
  }
}
