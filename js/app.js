// InkLab UI. Hash-routed views rendered from the store.

(function () {
  const { LEVELS, FOCUSES, STAGES, EXERCISES, TROUBLESHOOT } = window.INKLAB_DATA;
  const S = window.InkStore;
  const C = window.InkCoach;

  const view = document.getElementById("view");
  const modal = document.getElementById("modal");
  const modalBody = document.getElementById("modal-body");

  // --- helpers --------------------------------------------------------------
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  function toast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove("show"), 2600);
  }

  function openModal(html, onMount) {
    modalBody.innerHTML = html;
    if (!modal.open) modal.showModal();
    modalBody.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => modal.close()));
    if (onMount) onMount(modalBody);
  }
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.close();
  });

  const STATUS_PILL = {
    new: '<span class="pill grey">Not started</span>',
    practicing: '<span class="pill warn">Practicing</span>',
    solid: '<span class="pill">Solid ✓</span>',
  };

  // --- router ---------------------------------------------------------------
  const routes = { practice: renderPractice, roadmap: renderRoadmap, journal: renderJournal, fix: renderFix, questions: renderQuestions, settings: renderSettings };

  function route() {
    const name = (location.hash.replace(/^#\/?/, "").split("/")[0] || "practice");
    const fn = routes[name] || renderPractice;
    document.querySelectorAll(".tabs a").forEach((a) => a.classList.toggle("active", a.dataset.route === name));
    fn();
  }
  window.addEventListener("hashchange", () => {
    route();
    window.scrollTo(0, 0);
  });

  // --- Practice -------------------------------------------------------------
  function radioGroup(name, options, current, inline) {
    return `<div class="options ${inline ? "inline" : ""}" role="radiogroup">${options
      .map(
        (o) => `<label class="radio"><input type="radio" name="${name}" value="${o.id}" ${o.id === current ? "checked" : ""}/>
          <span>${esc(o.label)}${o.blurb ? `<br><small>${esc(o.blurb)}</small>` : ""}</span></label>`
      )
      .join("")}</div>`;
  }

  function renderPractice() {
    const st = S.get();
    const p = st.profile;
    const session = st.session;

    view.innerHTML = `
      <section class="card">
        <h1>What should I practice today?</h1>
        <p class="muted">Answer three questions and InkLab builds a session from the roadmap and your journal.</p>
        <form id="profile-form">
          <div class="question">Where are you in your tattoo journey?</div>
          ${radioGroup("level", LEVELS, p.level)}
          <div class="question">What do you want to improve?</div>
          ${radioGroup("focus", FOCUSES, p.focus)}
          <div class="question">How much time do you have?</div>
          ${radioGroup("minutes", [15, 30, 60].map((m) => ({ id: String(m), label: m + " min" })), String(p.minutes), true)}
          <button class="primary big" type="submit">Generate my practice session ✦</button>
        </form>
      </section>
      <div id="session"></div>`;

    view.querySelector("#profile-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      S.update((s) => {
        s.profile = { level: fd.get("level"), focus: fd.get("focus"), minutes: Number(fd.get("minutes")) };
        s.session = C.generateSession(s.profile, s.attempts);
      });
      renderPractice();
      document.getElementById("session").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    if (session) renderSession(document.getElementById("session"), session);
  }

  function renderSession(el, session) {
    const attempts = S.get().attempts;
    const total = session.blocks.reduce((s, b) => s + b.minutes, 0);
    const level = LEVELS.find((l) => l.id === session.profile.level);
    const focus = FOCUSES.find((f) => f.id === session.profile.focus);

    el.innerHTML = `
      <section class="card">
        <div class="spread">
          <h2>Your ${total}-minute session</h2>
          <span class="pill">${esc(focus.label)} · ${esc(level.label)}</span>
        </div>
        <p class="muted small">Generated ${fmtDate(session.created)}. Do the blocks in order and log each one when you're done.</p>
        ${session.notes.map((n) => `<p class="pill info" style="display:block;border-radius:12px;padding:10px 14px">${esc(n)}</p>`).join("")}
      </section>
      ${session.blocks.map((b, i) => blockCard(b, i, attempts)).join("")}`;

    el.querySelectorAll("[data-log]").forEach((btn) =>
      btn.addEventListener("click", () => openLog(btn.dataset.log, { blockIndex: Number(btn.dataset.block), minutes: Number(btn.dataset.minutes) }))
    );
    el.querySelectorAll("[data-ex]").forEach((btn) => btn.addEventListener("click", () => openExercise(btn.dataset.ex)));
    el.querySelectorAll("[data-problem]").forEach((btn) =>
      btn.addEventListener("click", () => {
        location.hash = "#/fix/" + btn.dataset.problem;
      })
    );
  }

  function blockCard(b, i, attempts) {
    if (!b.exerciseId) {
      return `<section class="card block"><div class="mins"><b>${b.minutes}</b><span>min</span></div>
        <div><span class="pill grey">${esc(b.role)}</span><p style="margin-top:8px">${esc(b.reason)}</p>
        <a class="btn" href="#/journal">Open journal</a></div></section>`;
    }
    const ex = C.byId[b.exerciseId];
    const done = !!b.loggedAttemptId;
    const problem = b.problemId ? C.problemById[b.problemId] : null;
    return `
      <section class="card block ${done ? "done" : ""}">
        <div class="mins"><b>${b.minutes}</b><span>min</span></div>
        <div>
          <div class="row"><span class="pill ${b.role === "Fix-it drill" ? "warn" : b.role === "Main exercise" ? "" : "grey"}">${esc(b.role)}</span>${STATUS_PILL[C.status(attempts, ex.id)]}${ex.paperOnly ? '<span class="pill grey">Paper</span>' : ""}</div>
          <h3 style="margin-top:10px">${esc(ex.title)}</h3>
          <p class="muted">${esc(b.reason)}</p>
          ${problem ? `<p class="small">Read first: <button class="link" data-problem="${problem.id}">${esc(problem.symptom)}</button></p>` : ""}
          ${exerciseBody(ex)}
          <div class="row" style="margin-top:12px">
            ${done ? '<span class="pill">Logged ✓</span>' : `<button class="primary" data-log="${ex.id}" data-block="${i}" data-minutes="${b.minutes}">Log this exercise</button>`}
          </div>
        </div>
      </section>`;
  }

  function exerciseBody(ex, open) {
    return `
      <p><b>Why:</b> ${esc(ex.why)}</p>
      <details ${open ? "open" : ""}><summary>Steps</summary><ol>${ex.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></details>
      <details ${open ? "open" : ""}><summary>You'll need</summary><ul>${ex.equipment.map((s) => `<li>${esc(s)}</li>`).join("")}</ul></details>
      <details ${open ? "open" : ""}><summary>How to check yourself</summary><ul>${ex.checks.map((s) => `<li>${esc(s)}</li>`).join("")}</ul></details>
      ${
        ex.problems.length
          ? `<details><summary>Common problems</summary><ul>${ex.problems
              .map((id) => `<li><a href="#/fix/${id}">${esc(C.problemById[id].symptom)}</a></li>`)
              .join("")}</ul></details>`
          : ""
      }`;
  }

  // --- exercise detail & logging -------------------------------------------
  function openExercise(id) {
    const ex = C.byId[id];
    const attempts = S.get().attempts;
    const reqs = (ex.requires || []).map((r) => C.byId[r]);
    openModal(
      `<div class="modal-head"><h2>${esc(ex.title)}</h2><button data-close aria-label="Close">✕</button></div>
       <div class="row" style="margin-bottom:10px">${STATUS_PILL[C.status(attempts, id)]}<span class="pill grey">~${ex.minutes} min</span></div>
       ${reqs.length ? `<p class="small muted">Builds on: ${reqs.map((r) => esc(r.title)).join(", ")}</p>` : ""}
       ${exerciseBody(ex, true)}
       <button class="primary" id="log-from-ex">Log an attempt</button>`,
      (m) => m.querySelector("#log-from-ex").addEventListener("click", () => openLog(id, { minutes: ex.minutes }))
    );
  }

  function openLog(exId, ctx = {}) {
    const ex = C.byId[exId];
    const otherProblems = TROUBLESHOOT.filter((p) => !ex.problems.includes(p.id));
    const state = { difficulty: 2, problems: new Set(), photo: null };

    openModal(
      `<div class="modal-head"><h2>Log: ${esc(ex.title)}</h2><button data-close aria-label="Close">✕</button></div>
       <form id="log-form">
         <label class="field">How did it feel?</label>
         <div class="seg" id="diff">${[1, 2, 3].map((d) => `<button type="button" data-d="${d}" aria-pressed="${d === 2}">${C.DIFFICULTY[d]}</button>`).join("")}</div>

         <label class="field">Self-check - tick what's honestly true</label>
         ${ex.checks.map((c, i) => `<label class="check"><input type="checkbox" name="check" value="${i}"/><span>${esc(c)}</span></label>`).join("")}

         <label class="field">Anything go wrong?</label>
         <div class="row" id="probs">
           ${ex.problems.map((id) => `<button type="button" class="chip" data-p="${id}" aria-pressed="false">${esc(C.problemById[id].symptom)}</button>`).join("")}
         </div>
         <details ${ex.problems.length ? "" : "open"}><summary>Other problems</summary><div class="row">
           ${otherProblems.map((p) => `<button type="button" class="chip" data-p="${p.id}" aria-pressed="false">${esc(p.symptom)}</button>`).join("")}
         </div></details>

         <label class="field" for="minutes">Minutes spent</label>
         <input type="number" id="minutes" min="1" max="240" value="${ctx.minutes || ex.minutes}" />

         <label class="field" for="notes">Notes (what you noticed, settings used, questions)</label>
         <textarea id="notes" placeholder="e.g. 3RL at 8V, lines went grey on the left-to-right pulls"></textarea>

         <label class="field" for="photo">Photo of your practice (optional, recommended)</label>
         <input type="file" id="photo" accept="image/*" capture="environment" />
         <p class="small muted">Tip: even light, no glare, phone parallel to the skin, fill the frame.</p>
         <img id="preview" class="photo-preview hidden" alt="Preview of your practice photo" />

         <div class="row" style="margin-top:16px"><button class="primary" type="submit">Save to journal</button><button type="button" data-close>Cancel</button></div>
       </form>`,
      (m) => {
        m.querySelectorAll("#diff button").forEach((b) =>
          b.addEventListener("click", () => {
            state.difficulty = Number(b.dataset.d);
            m.querySelectorAll("#diff button").forEach((x) => x.setAttribute("aria-pressed", x === b));
          })
        );
        m.querySelectorAll("[data-p]").forEach((b) =>
          b.addEventListener("click", () => {
            const id = b.dataset.p;
            state.problems.has(id) ? state.problems.delete(id) : state.problems.add(id);
            b.setAttribute("aria-pressed", state.problems.has(id));
          })
        );
        m.querySelector("#photo").addEventListener("change", async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          try {
            state.photo = await S.shrinkImage(file);
            const img = m.querySelector("#preview");
            img.src = state.photo;
            img.classList.remove("hidden");
          } catch (err) {
            toast(err.message);
          }
        });
        m.querySelector("#log-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const checkedIdx = new Set([...m.querySelectorAll('input[name="check"]:checked')].map((c) => Number(c.value)));
          const attempt = {
            id: S.uid(),
            date: new Date().toISOString(),
            exerciseId: exId,
            minutes: Number(m.querySelector("#minutes").value) || ex.minutes,
            difficulty: state.difficulty,
            checks: ex.checks.map((_, i) => checkedIdx.has(i)),
            problems: [...state.problems],
            notes: m.querySelector("#notes").value.trim(),
            hasPhoto: !!state.photo,
            instructorNotes: "",
            ai: null,
          };
          if (state.photo) {
            try {
              await S.putPhoto(attempt.id, state.photo);
            } catch (err) {
              attempt.hasPhoto = false;
              toast("Couldn't store the photo on this device; saved the rest.");
            }
          }
          S.update((s) => {
            s.attempts.push(attempt);
            if (s.session && ctx.blockIndex != null && s.session.blocks[ctx.blockIndex]) s.session.blocks[ctx.blockIndex].loggedAttemptId = attempt.id;
          });
          modal.close();
          const st = C.status(S.get().attempts, exId);
          toast(st === "solid" ? "Logged - this one is now solid ✓" : "Logged. Keep going!");
          route();
        });
      }
    );
  }

  // --- Roadmap ---------------------------------------------------------------
  function renderRoadmap() {
    const attempts = S.get().attempts;
    view.innerHTML = `
      <section class="card">
        <h1>Your roadmap</h1>
        <p class="muted">A suggested order from first setup to intro shading. "Solid" means 2 of your last 3 attempts felt okay or easy and you ticked at least 75% of the self-check.</p>
      </section>
      ${STAGES.map((st) => {
        const exs = EXERCISES.filter((e) => e.stage === st.id);
        const solid = exs.filter((e) => C.status(attempts, e.id) === "solid").length;
        const prac = exs.filter((e) => C.status(attempts, e.id) === "practicing").length;
        return `<section class="card">
          <div class="spread"><h2>${esc(st.title)}</h2><span class="muted small">${solid}/${exs.length} solid</span></div>
          <p class="muted">${esc(st.goal)}</p>
          <div class="bar" aria-hidden="true"><i class="s" style="width:${(solid / exs.length) * 100}%"></i><i class="p" style="width:${(prac / exs.length) * 100}%"></i></div>
          <div style="margin-top:8px">
            ${exs
              .map(
                (e) => `<div class="stage-ex"><button data-ex="${e.id}">${esc(e.title)}${e.paperOnly ? ' <span class="muted small">(paper)</span>' : ""}</button>${STATUS_PILL[C.status(attempts, e.id)]}</div>`
              )
              .join("")}
          </div>
        </section>`;
      }).join("")}`;
    view.querySelectorAll("[data-ex]").forEach((b) => b.addEventListener("click", () => openExercise(b.dataset.ex)));
  }

  // --- Journal ---------------------------------------------------------------
  function trendSentence(t) {
    if (t.beforeCheck == null) return "Log at least 6 exercises to see a trend.";
    const dc = Math.round((t.recentCheck - t.beforeCheck) * 100);
    const parts = [];
    if (dc > 5) parts.push(`you're ticking ${dc}% more of your self-checks than in the 5 entries before`);
    else if (dc < -5) parts.push(`self-check scores dipped ${-dc}% - normal when you move to harder exercises`);
    else parts.push("self-check scores are steady");
    if (t.recentDiff < t.beforeDiff - 0.2) parts.push("exercises are feeling easier");
    else if (t.recentDiff > t.beforeDiff + 0.2) parts.push("exercises are feeling harder");
    return "Over your last 5 entries, " + parts.join(", and ") + ".";
  }

  function renderJournal() {
    const st = S.get();
    const attempts = st.attempts.slice().sort((a, b) => b.date.localeCompare(a.date));
    const pr = C.progress(st.attempts);

    view.innerHTML = `
      <section class="card">
        <div class="spread"><h1>Practice journal</h1>
          <div class="row"><button id="export">Export</button><label class="btn" for="import">Import</label><input type="file" id="import" accept="application/json" class="hidden" /></div>
        </div>
        <div class="grid" style="margin-top:12px">
          <div class="stat"><b>${pr.sessions}</b><span>practice days</span></div>
          <div class="stat"><b>${pr.totalMinutes}</b><span>minutes logged</span></div>
          <div class="stat"><b>${pr.streak}</b><span>day streak</span></div>
          <div class="stat"><b>${pr.stages.reduce((s, x) => s + x.solid, 0)}/${EXERCISES.length}</b><span>exercises solid</span></div>
        </div>
      </section>
      ${
        attempts.length
          ? `<section class="card">
        <h2>Progress summary</h2>
        <p>${esc(trendSentence(pr.trend))}</p>
        ${
          pr.topProblems.length
            ? `<p class="muted small" style="margin-bottom:4px">Most common problems recently:</p>
               <div class="row">${pr.topProblems.map((t) => `<a class="btn" href="#/fix/${t.problem.id}">${esc(t.problem.symptom)} · ${t.count}×</a>`).join("")}</div>`
            : '<p class="muted small">No problems logged recently. Nice - or be a little more critical with yourself!</p>'
        }
      </section>`
          : ""
      }
      <div id="entries">
        ${attempts.length ? attempts.map(entryCard).join("") : `<section class="card"><p>No entries yet.</p><a class="btn primary" href="#/practice">Start a practice session</a></section>`}
      </div>`;

    attempts.forEach(async (a) => {
      if (!a.hasPhoto) return;
      const url = await S.getPhoto(a.id);
      const el = view.querySelector(`[data-thumb="${a.id}"]`);
      if (url && el) el.outerHTML = `<img class="thumb" src="${url}" alt="Practice photo for ${esc(C.byId[a.exerciseId]?.title)}" data-thumb="${a.id}" />`;
    });

    view.querySelector("#export").addEventListener("click", exportData);
    view.querySelector("#import").addEventListener("change", importData);
    view.querySelectorAll("[data-ai]").forEach((b) => b.addEventListener("click", () => askCoach(b.dataset.ai, b)));
    view.querySelectorAll("[data-instr]").forEach((t) =>
      t.addEventListener("change", () => {
        S.update((s) => {
          const a = s.attempts.find((x) => x.id === t.dataset.instr);
          if (a) a.instructorNotes = t.value;
        });
        toast("Instructor notes saved");
      })
    );
    view.querySelectorAll("[data-del]").forEach((b) =>
      b.addEventListener("click", () => {
        if (!confirm("Delete this entry?")) return;
        S.update((s) => (s.attempts = s.attempts.filter((x) => x.id !== b.dataset.del)));
        S.deletePhoto(b.dataset.del);
        renderJournal();
      })
    );
    view.querySelectorAll("[data-ask]").forEach((b) =>
      b.addEventListener("click", () => {
        addQuestion(b.dataset.ask);
        toast("Added to your instructor questions");
      })
    );
  }

  function entryCard(a) {
    const ex = C.byId[a.exerciseId];
    if (!ex) return "";
    const ratio = Math.round(C.checkRatio(a) * 100);
    return `
      <section class="card entry">
        <div class="thumb" data-thumb="${a.id}">${a.hasPhoto ? "Loading…" : "No photo"}</div>
        <div>
          <div class="spread"><h3 style="margin:0">${esc(ex.title)}</h3><span class="muted small">${fmtDate(a.date)} · ${a.minutes} min</span></div>
          <div class="row" style="margin:8px 0">
            <span class="pill ${a.difficulty === 3 ? "warn" : a.difficulty === 1 ? "" : "grey"}">${C.DIFFICULTY[a.difficulty]}</span>
            <span class="pill grey">Self-check ${ratio}%</span>
            ${(a.problems || []).map((p) => `<a class="pill warn" href="#/fix/${p}" style="text-decoration:none">${esc(C.problemById[p]?.symptom)}</a>`).join("")}
          </div>
          ${a.notes ? `<p>${esc(a.notes)}</p>` : ""}
          <details ${a.instructorNotes ? "open" : ""}><summary>Instructor feedback</summary>
            <textarea data-instr="${a.id}" placeholder="Paste or jot down what your instructor said about this one">${esc(a.instructorNotes)}</textarea>
          </details>
          <div id="ai-${a.id}">${a.ai ? aiBox(a.ai) : ""}</div>
          <div class="row" style="margin-top:10px">
            <button data-ai="${a.id}">${a.ai ? "Ask the AI coach again" : "Get AI coach feedback"}</button>
            <button class="link" data-del="${a.id}">Delete</button>
          </div>
        </div>
      </section>`;
  }

  function aiBox(ai) {
    const drill = C.byId[ai.next_drill_id];
    return `<div class="ai-box">
      <h4>AI coach</h4><p>${esc(ai.summary)}</p>
      ${ai.photo_quality_note ? `<p class="small muted">📷 ${esc(ai.photo_quality_note)}</p>` : ""}
      ${ai.working_well?.length ? `<h4>Working well</h4><ul>${ai.working_well.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>` : ""}
      ${
        ai.issues?.length
          ? `<h4>Fix next</h4><ol>${ai.issues
              .map((i) => `<li><b>${esc(i.issue)}</b><br><span class="muted">Likely cause:</span> ${esc(i.likely_cause)}<br><span class="muted">Try:</span> ${esc(i.fix)}</li>`)
              .join("")}</ol>`
          : ""
      }
      ${drill ? `<h4>Suggested drill</h4><p><a href="#/roadmap">${esc(drill.title)}</a> - ${esc(ai.next_drill_reason)}</p>` : ""}
      ${ai.ask_instructor ? `<h4>Worth asking your instructor</h4><p>${esc(ai.ask_instructor)} <button class="link" data-ask="${esc(ai.ask_instructor)}">Add to my questions</button></p>` : ""}
      <p class="small muted" style="margin:8px 0 0">AI feedback from a photo is a best guess. Your instructor's eye wins.</p>
    </div>`;
  }

  async function askCoach(attemptId, btn) {
    const st = S.get();
    const attempt = st.attempts.find((a) => a.id === attemptId);
    if (!st.settings.apiKey) {
      toast("Add your Claude API key in Settings to use the AI coach");
      location.hash = "#/settings";
      return;
    }
    btn.disabled = true;
    btn.textContent = "Coach is looking…";
    try {
      const photo = attempt.hasPhoto ? await S.getPhoto(attempt.id) : null;
      const ai = await window.InkAI.review({ apiKey: st.settings.apiKey, attempt, exercise: C.byId[attempt.exerciseId], photoDataUrl: photo, profile: st.profile });
      S.update((s) => (s.attempts.find((a) => a.id === attemptId).ai = ai));
      renderJournal();
    } catch (err) {
      toast(err.message || "Something went wrong");
      btn.disabled = false;
      btn.textContent = "Get AI coach feedback";
    }
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(S.get(), (k, v) => (k === "apiKey" ? undefined : v), 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `inklab-journal-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Exported (photos stay on this device)");
  }

  function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    file.text().then((txt) => {
      try {
        const data = JSON.parse(txt);
        if (!Array.isArray(data.attempts)) throw new Error();
        if (!confirm("Replace your current journal with this file?")) return;
        const key = S.get().settings.apiKey;
        S.replace(data);
        S.update((s) => (s.settings = { ...(s.settings || {}), apiKey: key }));
        toast("Imported");
        renderJournal();
      } catch (err) {
        toast("That doesn't look like an InkLab export");
      }
    });
  }

  // --- What went wrong? --------------------------------------------------------
  function renderFix() {
    const target = location.hash.split("/")[2];
    view.innerHTML = `
      <section class="card">
        <h1>What went wrong?</h1>
        <p class="muted">Pick what you're seeing. Each one lists the usual causes, what to change, and a drill. Still stuck after trying the fixes? Save it as a question for your instructor so you can ask everything at once.</p>
        <input type="text" id="fix-search" placeholder="Search: blowout, shaky, patchy…" aria-label="Search problems" />
      </section>
      <div id="fix-list">
        ${TROUBLESHOOT.map(
          (p) => `<section class="card" id="fix-${p.id}" data-text="${esc((p.symptom + " " + p.looksLike + " " + p.causes.join(" ")).toLowerCase())}">
          <details ${p.id === target ? "open" : ""}>
            <summary style="color:var(--text)"><b>${esc(p.symptom)}</b></summary>
            <p class="muted">Looks like: ${esc(p.looksLike)}</p>
            <h3>Usual causes</h3><ul>${p.causes.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
            <h3>What to change</h3><ul>${p.fixes.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
            <div class="row">
              <button class="primary" data-ex="${p.drill}">Drill: ${esc(C.byId[p.drill].title)}</button>
              <button data-ask="I keep getting '${esc(p.symptom.toLowerCase())}' even after trying: ${esc(p.fixes[0].toLowerCase())} What else should I check?">Still stuck? Save a question</button>
            </div>
          </details>
        </section>`
        ).join("")}
      </div>`;

    view.querySelectorAll("[data-ex]").forEach((b) => b.addEventListener("click", () => openExercise(b.dataset.ex)));
    view.querySelectorAll("[data-ask]").forEach((b) =>
      b.addEventListener("click", () => {
        addQuestion(b.dataset.ask);
        toast("Saved to Instructor Qs - edit it there");
      })
    );
    view.querySelector("#fix-search").addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase().trim();
      view.querySelectorAll("#fix-list > section").forEach((s) => s.classList.toggle("hidden", q && !s.dataset.text.includes(q)));
    });
    if (target) {
      const el = document.getElementById("fix-" + target);
      if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }
  }

  // --- Instructor questions ------------------------------------------------------
  function addQuestion(text) {
    S.update((s) => s.questions.push({ id: S.uid(), text, date: new Date().toISOString(), answer: "", answered: false }));
  }

  function renderQuestions() {
    const qs = S.get().questions;
    const open = qs.filter((q) => !q.answered);
    const done = qs.filter((q) => q.answered);

    view.innerHTML = `
      <section class="card">
        <h1>Questions for my instructor</h1>
        <p class="muted">Collect questions as you practice instead of messaging an artist every time. When you have a few, copy them as one tidy message.</p>
        <form id="q-form" class="row" style="flex-wrap:nowrap">
          <input type="text" id="q-text" placeholder="e.g. What voltage do you line at with a 5RL?" aria-label="New question" />
          <button class="primary" type="submit">Add</button>
        </form>
      </section>
      <section class="card">
        <div class="spread"><h2>Open (${open.length})</h2>${open.length ? '<button id="copy">Copy as message</button>' : ""}</div>
        ${open.length ? open.map(qItem).join("") : '<p class="muted">Nothing waiting. 🎉</p>'}
      </section>
      ${done.length ? `<section class="card"><h2>Answered</h2>${done.map(qItem).join("")}</section>` : ""}`;

    view.querySelector("#q-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const t = view.querySelector("#q-text").value.trim();
      if (!t) return;
      addQuestion(t);
      renderQuestions();
    });
    const copy = view.querySelector("#copy");
    if (copy)
      copy.addEventListener("click", async () => {
        const msg = `Hi! No rush at all - I've been practicing on fake skin and saved up a few questions:\n\n${open.map((q, i) => `${i + 1}. ${q.text}`).join("\n")}\n\nThank you!`;
        try {
          await navigator.clipboard.writeText(msg);
          toast("Copied - paste it into a message");
        } catch (err) {
          prompt("Copy this message:", msg);
        }
      });
    view.querySelectorAll("[data-answer]").forEach((t) =>
      t.addEventListener("change", () => {
        S.update((s) => {
          const q = s.questions.find((x) => x.id === t.dataset.answer);
          q.answer = t.value;
          q.answered = !!t.value.trim();
        });
        renderQuestions();
      })
    );
    view.querySelectorAll("[data-qdel]").forEach((b) =>
      b.addEventListener("click", () => {
        S.update((s) => (s.questions = s.questions.filter((q) => q.id !== b.dataset.qdel)));
        renderQuestions();
      })
    );
  }

  function qItem(q) {
    return `<div class="stage-ex" style="display:block">
      <div class="spread"><b>${esc(q.text)}</b><button class="link" data-qdel="${q.id}">Remove</button></div>
      <textarea data-answer="${q.id}" placeholder="Their answer (saving it marks the question answered)" style="margin-top:6px;min-height:50px">${esc(q.answer)}</textarea>
    </div>`;
  }

  // --- Settings ------------------------------------------------------------------
  function renderSettings() {
    const st = S.get();
    view.innerHTML = `
      <section class="card">
        <h1>Settings</h1>
        <h2 style="margin-top:16px">AI coach (optional)</h2>
        <p class="muted">The roadmap, sessions, journal and troubleshooter all work without AI. Add a Claude API key to get photo-based technique feedback on journal entries. The key is stored only in this browser and sent only to Anthropic.</p>
        <label class="field" for="key">Claude API key</label>
        <input type="password" id="key" value="${esc(st.settings.apiKey)}" placeholder="sk-ant-..." autocomplete="off" />
        <div class="row" style="margin-top:10px"><button class="primary" id="save-key">Save key</button>${st.settings.apiKey ? '<button id="clear-key">Remove key</button>' : ""}</div>
        <p class="small muted">Model: ${window.InkAI.MODEL}. Each review is one request with one photo. Get a key at console.anthropic.com.</p>
      </section>
      <section class="card">
        <h2>Your data</h2>
        <p class="muted">Everything lives in this browser. Use Export on the Journal page to back up or share with your instructor.</p>
        <button id="reset">Erase all InkLab data</button>
      </section>`;
    view.querySelector("#save-key").addEventListener("click", () => {
      S.update((s) => (s.settings.apiKey = view.querySelector("#key").value.trim()));
      toast("Saved");
      renderSettings();
    });
    const clr = view.querySelector("#clear-key");
    if (clr)
      clr.addEventListener("click", () => {
        S.update((s) => (s.settings.apiKey = ""));
        renderSettings();
      });
    view.querySelector("#reset").addEventListener("click", () => {
      if (!confirm("Erase your journal, questions and settings? This can't be undone.")) return;
      S.get().attempts.forEach((a) => S.deletePhoto(a.id));
      S.reset();
      toast("Erased");
      location.hash = "#/practice";
    });
  }

  route();
})();
