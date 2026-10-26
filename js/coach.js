// The practice coach: decides what you should do next based on your answers
// and your journal. Rule-based on purpose - it's predictable, works offline,
// and you can read exactly why it picked something.

window.InkCoach = (function () {
  const { LEVELS, EXERCISES, TROUBLESHOOT, STAGES } = window.INKLAB_DATA;

  const byId = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));
  const problemById = Object.fromEntries(TROUBLESHOOT.map((p) => [p.id, p]));
  const levelIdx = (id) => LEVELS.findIndex((l) => l.id === id);

  const DIFFICULTY = { 1: "Easy", 2: "Okay", 3: "Hard" };

  function checkRatio(a) {
    if (!a.checks || !a.checks.length) return 0;
    return a.checks.filter(Boolean).length / a.checks.length;
  }

  function attemptsFor(attempts, exId) {
    return attempts.filter((a) => a.exerciseId === exId).sort((a, b) => a.date.localeCompare(b.date));
  }

  // new -> practicing -> solid. "Solid" = 2 of your last 3 attempts were
  // okay/easy AND you ticked at least 75% of the self-check.
  function status(attempts, exId) {
    const list = attemptsFor(attempts, exId);
    if (!list.length) return "new";
    const good = list.slice(-3).filter((a) => a.difficulty <= 2 && checkRatio(a) >= 0.75);
    return good.length >= 2 ? "solid" : "practicing";
  }

  function topProblems(attempts, limit = 3, recent = 10) {
    const counts = {};
    attempts
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, recent)
      .forEach((a) => (a.problems || []).forEach((p) => (counts[p] = (counts[p] || 0) + 1)));
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id, count]) => ({ problem: problemById[id], count }))
      .filter((x) => x.problem);
  }

  function eligible(ex, level) {
    const minLevel = Math.min(...ex.levels.map(levelIdx));
    return minLevel <= levelIdx(level);
  }

  const minLevel = (ex) => Math.min(...ex.levels.map(levelIdx));

  // Walk back through prerequisites until we find one that isn't started.
  // A prerequisite aimed at a lower level than yours counts as met: if you
  // say you're past that stage, the coach takes your word for it.
  function unmetPrereq(ex, attempts, level, seen = new Set()) {
    for (const req of ex.requires || []) {
      if (seen.has(req)) continue;
      seen.add(req);
      if (minLevel(byId[req]) < levelIdx(level)) continue;
      if (status(attempts, req) === "new") {
        return unmetPrereq(byId[req], attempts, level, seen) || byId[req];
      }
    }
    return null;
  }

  // The next exercise to work on: finish one you've started before opening a
  // new one, otherwise the first that isn't solid. Skips any you've already
  // moved past (a later exercise in the list is solid).
  function nextUp(list, attempts) {
    const open = list.filter(
      (e, i) => status(attempts, e.id) !== "solid" && !list.slice(i + 1).some((later) => status(attempts, later.id) === "solid")
    );
    return open.find((e) => status(attempts, e.id) === "practicing") || open[0];
  }

  function generateSession(profile, attempts) {
    const { level, focus, minutes } = profile;
    const blocks = [];
    const notes = [];
    let remaining = minutes;

    const reflect = minutes >= 30 ? 5 : 3;
    remaining -= reflect;

    // 1. Warm-up on paper - cheap, fast, and catches grip problems.
    const warmId = focus === "curves" ? "curve-paper" : "grip-paper";
    const warm = minutes >= 60 ? 10 : minutes >= 30 ? 5 : 3;
    blocks.push({ exerciseId: warmId, minutes: warm, role: "Warm-up", reason: "Loosen up on paper before you pick up the machine." });
    remaining -= warm;

    // 2. Main exercise.
    // Exercises aimed at your level come first; easier ones are only revisited
    // once those are solid (or when an exercise lists them as a prerequisite).
    const inFocus = EXERCISES.filter((e) => e.skills.includes(focus) && eligible(e, level) && !e.paperOnly);
    const atLevel = inFocus.filter((e) => e.levels.includes(level));
    const focusExercises = atLevel.some((e) => status(attempts, e.id) !== "solid") ? atLevel : inFocus;
    const focusAttempts = attempts
      .filter((a) => byId[a.exerciseId] && byId[a.exerciseId].skills.includes(focus) && !byId[a.exerciseId].paperOnly)
      .sort((a, b) => b.date.localeCompare(a.date));
    const last = focusAttempts[0];

    let main = null;
    let mainReason = "";

    if (level === "starting" && status(attempts, "setup-hygiene") === "new") {
      main = byId["setup-hygiene"];
      mainReason = "Before your first real session, practice a clean setup and breakdown. You'll do it every single time.";
    } else if (last && (last.difficulty === 3 || checkRatio(last) < 0.5) && status(attempts, last.exerciseId) !== "solid") {
      main = byId[last.exerciseId];
      mainReason = `Last time this felt ${DIFFICULTY[last.difficulty].toLowerCase()} and you ticked ${Math.round(checkRatio(last) * 100)}% of the self-check. Repeating it is how it gets easy.`;
    } else {
      const next = nextUp(focusExercises, attempts);
      if (next) {
        const pre = unmetPrereq(next, attempts, level);
        if (pre) {
          main = pre;
          mainReason = `"${next.title}" builds on this one, so start here.`;
        } else {
          main = next;
          const s = status(attempts, next.id);
          mainReason =
            s === "practicing"
              ? "You've started this but it isn't solid yet (2 good attempts out of your last 3)."
              : "This is the next step on your roadmap for " + focusLabel(focus) + ".";
        }
      } else {
        main = focusExercises[focusExercises.length - 1] || byId["straight-pulls"];
        mainReason = "You've got everything in this focus area solid - keep it sharp, or switch focus or level.";
      }
    }

    // Give the main exercise its full time if there's room for something else
    // afterwards; otherwise it gets everything that's left. Exception: a
    // problem you keep logging (2+ times recently) gets 10 minutes of its drill
    // even in a short session, as long as the main block keeps at least 10.
    // Too short to split, so the drill becomes the main exercise.
    let recurring = topProblems(attempts, 3).find((t) => t.count >= 2 && t.problem.drill !== main.id && t.problem.drill !== warmId);
    if (recurring && remaining < 20 && eligible(byId[recurring.problem.drill], level)) {
      main = byId[recurring.problem.drill];
      mainReason = `You've logged "${recurring.problem.symptom.toLowerCase()}" ${recurring.count}× recently and there's only time for one exercise, so today is its drill.`;
      recurring = null;
    }
    const mainMinutes =
      remaining >= main.minutes + 10 ? main.minutes : recurring && remaining >= 20 ? remaining - 10 : remaining;
    blocks.push({ exerciseId: main.id, minutes: mainMinutes, role: "Main exercise", reason: mainReason });
    remaining -= mainMinutes;

    // 3. If there's time left, add a fix-it drill for your most common problem,
    //    or the next exercise as a stretch goal.
    if (remaining >= 10) {
      const top = topProblems(attempts, 3).find((t) => t.problem.drill !== main.id && t.problem.drill !== warmId);
      if (top) {
        blocks.push({
          exerciseId: top.problem.drill,
          minutes: remaining,
          role: "Fix-it drill",
          reason: `You've logged "${top.problem.symptom.toLowerCase()}" ${top.count}× recently. This drill targets it.`,
          problemId: top.problem.id,
        });
      } else {
        const stretch = focusExercises.find((e) => e.id !== main.id && status(attempts, e.id) !== "solid" && !unmetPrereq(e, attempts, level));
        if (stretch) {
          blocks.push({ exerciseId: stretch.id, minutes: remaining, role: "Stretch goal", reason: "If the main exercise went well, try a preview of what's next." });
        } else {
          blocks[1].minutes += remaining;
        }
      }
      remaining = 0;
    } else if (remaining > 0) {
      blocks[1].minutes += remaining;
    }

    blocks.push({ exerciseId: null, minutes: reflect, role: "Log it", reason: "Rate how it felt, tick the self-check, snap a photo. This is what makes the next session smarter." });

    if (!attempts.length) notes.push("No journal entries yet, so this plan is based only on your answers. Log each exercise and the next plan will adapt.");
    const tp = topProblems(attempts, 1)[0];
    if (tp && tp.count >= 3) notes.push(`"${tp.problem.symptom}" keeps coming up. If it doesn't improve in a couple of sessions, that's a great specific question for your instructor.`);

    return { id: Date.now().toString(36), created: new Date().toISOString(), profile: { ...profile }, blocks, notes };
  }

  function focusLabel(id) {
    const f = window.INKLAB_DATA.FOCUSES.find((x) => x.id === id);
    return f ? f.label.toLowerCase() : id;
  }

  function dayKey(iso) {
    return iso.slice(0, 10);
  }

  function progress(attempts) {
    const days = [...new Set(attempts.map((a) => dayKey(a.date)))].sort();
    const totalMinutes = attempts.reduce((s, a) => s + (Number(a.minutes) || 0), 0);

    // streak of consecutive days ending today or yesterday
    let streak = 0;
    const set = new Set(days);
    const d = new Date();
    if (!set.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
    while (set.has(d.toISOString().slice(0, 10))) {
      streak++;
      d.setDate(d.getDate() - 1);
    }

    const stages = STAGES.map((st) => {
      const exs = EXERCISES.filter((e) => e.stage === st.id);
      const statuses = exs.map((e) => status(attempts, e.id));
      return {
        ...st,
        total: exs.length,
        solid: statuses.filter((s) => s === "solid").length,
        practicing: statuses.filter((s) => s === "practicing").length,
      };
    });

    const sorted = attempts.slice().sort((a, b) => a.date.localeCompare(b.date));
    const avg = (arr, f) => (arr.length ? arr.reduce((s, a) => s + f(a), 0) / arr.length : null);
    const recent = sorted.slice(-5);
    const before = sorted.slice(-10, -5);
    const trend = {
      recentCheck: avg(recent, checkRatio),
      beforeCheck: avg(before, checkRatio),
      recentDiff: avg(recent, (a) => a.difficulty),
      beforeDiff: avg(before, (a) => a.difficulty),
    };

    return { sessions: days.length, totalMinutes, streak, stages, trend, topProblems: topProblems(attempts, 3) };
  }

  return { byId, problemById, status, checkRatio, generateSession, progress, topProblems, DIFFICULTY };
})();
