/* ============================================================
   DAYVAULT — script.js
   A functional front-end demo. All data lives in localStorage
   under one key. Structure:

   1.  Helpers
   2.  Data layer: seedData / loadData / saveData
   3.  Render functions (one per card) + summary
   4.  Form handlers (add / toggle / delete)
   5.  Quick Add modal + jump shortcuts
   6.  Scroll-reveal animations
   7.  Boot
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {

  /* ---------- 1. HELPERS ---------- */
  const $  = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const euro = (n) => "€" + Number(n).toFixed(2);
  const niceDate = (iso) => {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };
  // Escape user text before inserting into innerHTML
  const esc = (s) => String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  // After (re)rendering, grow progress bars from 0 to their target
  function animateBars(scope) {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      $$("[data-width]", scope).forEach((b) => { b.style.width = b.dataset.width; });
    }));
  }

  // Briefly highlight the newest list item
  let lastAdded = null;
  function flashNew(scope) {
    if (!lastAdded) return;
    const el = $(`[data-id="${lastAdded}"]`, scope);
    if (el) {
      el.classList.add("flash");
      setTimeout(() => el.classList.remove("flash"), 1500);
    }
    lastAdded = null;
  }

  /* ---------- 2. DATA LAYER ---------- */
  const DB_KEY = "dayvault-demo-v1";

  // Demo content for first visit (and after reset)
  function seedData() {
    const t = todayISO();
    return {
      budget: { daily: 30 },
      expenses: [
        { id: uid(), title: "Groceries", amount: 8.9, category: "Food", waste: false, date: t },
        { id: uid(), title: "Tram ticket", amount: 4.8, category: "Transport", waste: false, date: t },
        { id: uid(), title: "Cappuccino", amount: 3.5, category: "Coffee", waste: true, date: t },
        { id: uid(), title: "Snack", amount: 1.3, category: "Food", waste: false, date: t }
      ],
      tasks: [
        { id: uid(), title: "Submit visa form", tier: "must", done: false },
        { id: uid(), title: "Pay rent", tier: "must", done: false },
        { id: uid(), title: "Gym session", tier: "must", done: false },
        { id: uid(), title: "Clean room", tier: "should", done: true },
        { id: uid(), title: "Call family", tier: "should", done: false },
        { id: uid(), title: "Organize photos", tier: "could", done: false }
      ],
      projects: [
        { id: uid(), name: "Vanera App Launch", progress: 68, next: "Test payment flow", deadline: "Friday", status: "Moving" },
        { id: uid(), name: "Thesis Draft", progress: 35, next: "Outline chapter 3", deadline: "Jun 20", status: "Moving" },
        { id: uid(), name: "Visa Documents", progress: 80, next: "Book biometrics", deadline: "Jun 16", status: "Waiting" },
        { id: uid(), name: "Fitness Plan", progress: 45, next: "Plan week 3", deadline: "—", status: "Stuck" },
        { id: uid(), name: "Startup Pitch", progress: 20, next: "Draft first deck", deadline: "Jul 1", status: "Moving" }
      ],
      notes: [
        { id: uid(), text: "Project idea: daily finance + study tracker for students.", kind: "Idea", date: t },
        { id: uid(), text: "Embassy — Tiergartenstr. 24, ring bell B.", kind: "Address", date: t },
        { id: uid(), text: "Visa checklist PDF — saved to Vault.", kind: "Link", date: t }
      ],
      diary: [
        { id: uid(), date: t, did: "Finished the visa form draft and a push session at the gym.",
          felt: "Calm after sorting the paperwork.", fix: "Start writing earlier in the day.", mood: "Focused" }
      ],
      docs: [
        { id: uid(), name: "Passport.pdf", type: "PDF", category: "Passport", note: "ID — expires 2031", date: t },
        { id: uid(), name: "Rent-receipt-June.pdf", type: "PDF", category: "Rent", note: "June rent proof", date: t },
        { id: uid(), name: "Flight-ticket.pdf", type: "PDF", category: "Ticket", note: "Trip on Jul 2", date: t },
        { id: uid(), name: "Insurance-policy.pdf", type: "PDF", category: "Insurance", note: "Health insurance", date: t },
        { id: uid(), name: "Embassy-proof.jpg", type: "JPG", category: "Visa", note: "Appointment confirmation", date: t },
        { id: uid(), name: "Bank-transfer.png", type: "PNG", category: "Bank proof", note: "Deposit confirmation", date: t }
      ],
      health: { date: t, sleep: "6h 20m", water: 1.8, energy: 7, workout: true, cigs: 0, symptoms: "None" },
      events: [
        { id: uid(), title: "Embassy appointment", date: t, time: "10:00", type: "Appointment" },
        { id: uid(), title: "Thesis meeting", date: t, time: "14:00", type: "Meeting" },
        { id: uid(), title: "Gym", date: t, time: "20:00", type: "Appointment" },
        { id: uid(), title: "Rent due", date: "2026-06-12", time: "", type: "Bill" },
        { id: uid(), title: "Visa biometrics", date: "2026-06-16", time: "09:30", type: "Deadline" }
      ],
      follows: [
        { id: uid(), name: "Salim", reason: "Reply about the visa letter", due: t, type: "Message", done: false },
        { id: uid(), name: "Lena", reason: "Thank her for sharing the post", due: t, type: "Thank you", done: false },
        { id: uid(), name: "Developer", reason: "Payment flow estimate — 3 days quiet", due: t, type: "Promise", done: false }
      ]
    };
  }

  function loadData() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* corrupted storage → reseed */ }
    const fresh = seedData();
    localStorage.setItem(DB_KEY, JSON.stringify(fresh));
    return fresh;
  }

  function saveData() {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }

  let db = loadData();

  /* ---------- 3. RENDER FUNCTIONS ---------- */

  /* --- Money --- */
  const CAT_BARS = {
    Food: "bar-green", Transport: "bar-blue", Coffee: "bar-amber", Bills: "bar-purple",
    Shopping: "bar-coral", Health: "bar-teal", Travel: "bar-blue", Other: "bar-muted"
  };

  function renderExpenses() {
    const t = todayISO();
    const todays = db.expenses.filter((e) => e.date === t);
    const spent = todays.reduce((s, e) => s + e.amount, 0);
    const waste = todays.filter((e) => e.waste).reduce((s, e) => s + e.amount, 0);
    const budget = db.budget.daily;
    const remaining = budget - spent;
    const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0;

    $("#mSpent").textContent = euro(spent);
    $("#mBudget").textContent = euro(budget);
    $("#mRemaining").textContent = euro(remaining);
    $("#mSaved").textContent = (remaining >= 0 ? "+" : "") + euro(Math.max(0, remaining)).slice(0);
    $("#mWaste").textContent = euro(waste);
    $("#mPct").textContent = pct + "%";

    // Budget mood: calm / careful / warning
    const fill = $("#budgetFill");
    const state = $("#budgetState");
    fill.classList.remove("state-warn", "state-danger");
    state.className = "card-tag";
    if (pct < 60) { state.classList.add("tag-green"); state.textContent = "Calm"; }
    else if (pct <= 90) { fill.classList.add("state-warn"); state.classList.add("tag-amber"); state.textContent = "Careful"; }
    else { fill.classList.add("state-danger"); state.classList.add("tag-coral"); state.textContent = "Over the line"; }
    fill.dataset.width = Math.min(pct, 100) + "%";

    // Category breakdown
    const totals = {};
    todays.forEach((e) => { totals[e.category] = (totals[e.category] || 0) + e.amount; });
    $("#catList").innerHTML = Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amt]) => {
        const w = spent > 0 ? Math.round((amt / spent) * 100) : 0;
        return `<li class="cat">
          <span class="cat-name">${esc(cat)}</span>
          <span class="cat-track"><span class="cat-fill ${CAT_BARS[cat] || "bar-muted"}" data-width="${w}%"></span></span>
          <span class="cat-amt">${euro(amt)}</span>
        </li>`;
      }).join("") || `<li class="empty-hint">No spending captured yet today.</li>`;

    // Expense rows
    $("#expenseList").innerHTML = todays.slice().reverse().map((e) => `
      <li class="row-item" data-id="${e.id}">
        <div class="ri-main">
          <strong>${esc(e.title)}</strong>
          <small>${esc(e.category)}${e.waste ? " · waste" : ""}</small>
        </div>
        <span class="ri-amt${e.waste ? " waste" : ""}">${euro(e.amount)}</span>
        <button class="ri-del" data-del aria-label="Delete expense">×</button>
      </li>`).join("") || `<li class="empty-hint">Nothing yet. Capture the first one.</li>`;

    animateBars($("#card-money"));
    flashNew($("#expenseList"));
  }

  /* --- Tasks --- */
  function renderTasks() {
    const tiers = { must: $("#mustList"), should: $("#shouldList"), could: $("#couldList") };
    Object.entries(tiers).forEach(([tier, ul]) => {
      const items = db.tasks.filter((t) => t.tier === tier);
      ul.innerHTML = items.map((t) => `
        <li class="task-row ${tier}" data-id="${t.id}">
          <label class="task">
            <input type="checkbox" class="task-check" ${t.done ? "checked" : ""} />
            <span class="checkmark" aria-hidden="true"></span>
            <span class="task-text">${esc(t.title)}</span>
          </label>
          <button class="ri-del" data-del aria-label="Delete task">×</button>
        </li>`).join("") || `<li class="empty-hint">Empty. Enjoy it or fill it.</li>`;
    });
    const done = db.tasks.filter((t) => t.done).length;
    $("#taskCount").textContent = `${done} of ${db.tasks.length}`;
    flashNew($("#card-tasks"));
  }

  /* --- Projects --- */
  const STATUS_CLASS = { Moving: "st-moving", Stuck: "st-stuck", Waiting: "st-waiting", Done: "st-done" };

  function renderProjects() {
    $("#projectList").innerHTML = db.projects.map((p) => `
      <li class="proj" data-id="${p.id}">
        <div class="pf-top">
          <strong>${esc(p.name)}</strong>
          <span class="status-pill ${STATUS_CLASS[p.status] || "st-moving"}">${esc(p.status)}</span>
        </div>
        <div class="pf-track"><span class="pf-fill" data-width="${p.progress}%"></span></div>
        <div class="pf-meta">
          <span class="pf-pct">${p.progress}%</span>
          ${p.next ? `<span class="pf-next">→ ${esc(p.next)}</span>` : ""}
          ${p.deadline ? `<span class="pf-due">${esc(p.deadline)}</span>` : ""}
        </div>
        <div class="proj-actions">
          <button class="pa-btn" data-act="minus" type="button" aria-label="Decrease progress">−10%</button>
          <button class="pa-btn" data-act="plus" type="button" aria-label="Increase progress">+10%</button>
          <button class="pa-btn pa-del" data-del type="button">Delete</button>
        </div>
      </li>`).join("") || `<li class="empty-hint">No projects. Add the first one below.</li>`;

    const active = db.projects.filter((p) => p.status !== "Done").length;
    $("#projCount").textContent = `${active} active`;
    animateBars($("#card-projects"));
    flashNew($("#projectList"));
  }

  /* --- Notes --- */
  function renderNotes() {
    $("#notesList").innerHTML = db.notes.slice().reverse().map((n) => `
      <li class="row-item" data-id="${n.id}">
        <span class="ri-kind">${esc(n.kind)}</span>
        <div class="ri-main"><strong>${esc(n.text)}</strong></div>
        <button class="ri-del" data-del aria-label="Delete note">×</button>
      </li>`).join("") || `<li class="empty-hint">Nothing captured yet.</li>`;
    flashNew($("#notesList"));
  }

  /* --- Diary --- */
  function renderDiary() {
    $("#diaryList").innerHTML = db.diary.slice().reverse().map((d) => `
      <details class="diary-entry" data-id="${d.id}">
        <summary>
          <span class="de-date">${niceDate(d.date)}</span>
          ${d.mood ? `<span class="de-mood">${esc(d.mood)}</span>` : ""}
          <span class="de-prev">${esc(d.did)}</span>
        </summary>
        <div class="de-body">
          <p><strong>Did:</strong> ${esc(d.did)}</p>
          ${d.felt ? `<p><strong>Felt:</strong> ${esc(d.felt)}</p>` : ""}
          ${d.fix ? `<p><strong>Fix tomorrow:</strong> ${esc(d.fix)}</p>` : ""}
          <button class="ri-del" data-del aria-label="Delete entry">×</button>
        </div>
      </details>`).join("") || `<p class="empty-hint">No entries yet. Keep today before it disappears.</p>`;
    flashNew($("#diaryList"));
  }

  /* --- Documents --- */
  const DOC_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>`;

  function renderDocuments() {
    const q = ($("#docSearch").value || "").toLowerCase();
    const cat = $("#docFilter").value;
    const filtered = db.docs.filter((d) => {
      const hit = (d.name + " " + d.note + " " + d.category).toLowerCase().includes(q);
      return hit && (!cat || d.category === cat);
    });
    $("#docList").innerHTML = filtered.slice().reverse().map((d) => `
      <li class="row-item" data-id="${d.id}">
        <span class="doc-ico" aria-hidden="true">${DOC_ICON}</span>
        <div class="ri-main">
          <strong>${esc(d.name)}</strong>
          <small>${esc(d.type)} · ${esc(d.category)} · ${niceDate(d.date)}${d.note ? " — " + esc(d.note) : ""}</small>
        </div>
        <button class="ri-del" data-del aria-label="Delete document">×</button>
      </li>`).join("") || `<li class="empty-hint">No documents match.</li>`;
    $("#docCount").textContent = db.docs.length;
    flashNew($("#docList"));
  }

  /* --- Health --- */
  function renderHealth() {
    const h = db.health || {};
    const fresh = h.date === todayISO();
    $("#healthTag").textContent = fresh ? "Updated today" : "Not updated";
    $("#healthTag").className = "card-tag " + (fresh ? "tag-green" : "tag-amber");
    $("#healthSnap").innerHTML = `
      <div class="h-stat"><span class="hs-label">Sleep</span><strong>${esc(h.sleep || "—")}</strong></div>
      <div class="h-stat"><span class="hs-label">Water</span><strong>${h.water != null && h.water !== "" ? esc(h.water) + " L" : "—"}</strong></div>
      <div class="h-stat"><span class="hs-label">Energy</span><strong>${h.energy ? esc(h.energy) + "/10" : "—"}</strong></div>
      <div class="h-stat"><span class="hs-label">Workout</span><strong>${h.workout ? "Done ✓" : "—"}</strong></div>
      <div class="h-stat"><span class="hs-label">Cigarettes</span><strong class="${Number(h.cigs) === 0 ? "text-green" : ""}">${h.cigs != null && h.cigs !== "" ? esc(h.cigs) : "—"}</strong></div>
      <div class="h-stat"><span class="hs-label">Symptoms</span><strong>${esc(h.symptoms || "None")}</strong></div>`;
  }

  /* --- Events --- */
  function renderEvents() {
    const sorted = db.events.slice().sort((a, b) =>
      (a.date + (a.time || "99:99")).localeCompare(b.date + (b.time || "99:99")));
    $("#eventList").innerHTML = sorted.map((e) => `
      <li class="row-item" data-id="${e.id}">
        <span class="ev-time">${e.date === todayISO() ? (e.time || "Today") : niceDate(e.date)}${e.date !== todayISO() && e.time ? " " + esc(e.time) : ""}</span>
        <div class="ri-main"><strong>${esc(e.title)}</strong></div>
        <span class="ri-kind ev-type t-${esc(e.type.toLowerCase().replace(/\s/g, ""))}">${esc(e.type)}</span>
        <button class="ri-del" data-del aria-label="Delete event">×</button>
      </li>`).join("") || `<li class="empty-hint">No anchors set.</li>`;
    flashNew($("#eventList"));
  }

  /* --- Follow-ups --- */
  function renderFollowUps() {
    $("#followList").innerHTML = db.follows.map((f) => `
      <li class="row-item${f.done ? " done" : ""}" data-id="${f.id}">
        <input type="checkbox" class="fu-check" ${f.done ? "checked" : ""} aria-label="Mark done" />
        <div class="ri-main">
          <strong>${esc(f.name)}</strong>
          <small>${esc(f.reason || "")}${f.due ? " · " + niceDate(f.due) : ""}</small>
        </div>
        <span class="ri-kind">${esc(f.type)}</span>
        <button class="ri-del" data-del aria-label="Delete follow-up">×</button>
      </li>`).join("") || `<li class="empty-hint">Loop closed. Nice.</li>`;
    flashNew($("#followList"));
  }

  /* --- Summary strip + clarity score --- */
  function renderSummary() {
    const t = todayISO();
    const spent = db.expenses.filter((e) => e.date === t).reduce((s, e) => s + e.amount, 0);
    const done = db.tasks.filter((x) => x.done).length;
    const diaryToday = db.diary.some((d) => d.date === t);

    $("#sumSpent").textContent = euro(spent);
    $("#sumTasks").textContent = `${done} / ${db.tasks.length}`;
    $("#sumProjects").textContent = db.projects.filter((p) => p.status !== "Done").length;
    $("#sumDiary").textContent = diaryToday ? "Saved ✓" : "Not yet";
    $("#sumDocs").textContent = db.docs.length;

    // Daily clarity score: 5 simple signals × 20%
    let score = 0;
    if (spent <= db.budget.daily) score += 20;                                   // budget intact
    if (done > 0) score += 20;                                                   // momentum
    if (db.health && db.health.date === t) score += 20;                          // body checked
    if (diaryToday) score += 20;                                                 // day kept
    if (db.projects.some((p) => p.next && p.status !== "Done")) score += 20;     // next step exists
    $("#clarityScore").textContent = score + "%";
    $("#clarityRing").style.setProperty("--score", score);
  }

  function renderAll() {
    renderExpenses(); renderTasks(); renderProjects(); renderNotes();
    renderDiary(); renderDocuments(); renderHealth(); renderEvents();
    renderFollowUps(); renderSummary();
  }

  /* ---------- 4. FORM HANDLERS & LIST ACTIONS ---------- */

  /* --- Money: add expense --- */
  $("#expenseForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const amount = parseFloat($("#expAmount").value);
    if (!amount || amount <= 0) return;
    const item = {
      id: uid(),
      title: $("#expTitle").value.trim() || "Expense",
      amount,
      category: $("#expCategory").value,
      waste: $("#expKind").value === "waste",
      date: todayISO()
    };
    db.expenses.push(item);
    lastAdded = item.id;
    saveData(); renderExpenses(); renderSummary();
    e.target.reset();
    $("#expTitle").focus();
  });

  // Delete expense (delegated)
  $("#expenseList").addEventListener("click", (e) => {
    if (!e.target.closest("[data-del]")) return;
    const id = e.target.closest("[data-id]").dataset.id;
    db.expenses = db.expenses.filter((x) => x.id !== id);
    saveData(); renderExpenses(); renderSummary();
  });

  /* --- Money: budget calculator --- */
  function recalcBudget() {
    const income = parseFloat($("#calcIncome").value) || 0;
    const fixed = parseFloat($("#calcFixed").value) || 0;
    const goal = parseFloat($("#calcGoal").value) || 0;
    const days = parseInt($("#calcDays").value, 10) || 30;
    const daily = (income - fixed - goal) / days;
    $("#calcResult").textContent = income
      ? `Your daily flexible budget is ${euro(Math.max(0, daily))}.`
      : "Your daily flexible budget is €—.";
    return Math.max(0, daily);
  }
  ["calcIncome", "calcFixed", "calcGoal", "calcDays"].forEach((id) =>
    $("#" + id).addEventListener("input", recalcBudget));

  $("#useCalcBtn").addEventListener("click", () => {
    const daily = recalcBudget();
    if (daily > 0) {
      db.budget.daily = Math.round(daily * 100) / 100;
      saveData(); renderExpenses(); renderSummary();
    }
  });

  $("#setBudgetBtn").addEventListener("click", () => {
    const v = parseFloat($("#manualBudget").value);
    if (v > 0) {
      db.budget.daily = v;
      $("#manualBudget").value = "";
      saveData(); renderExpenses(); renderSummary();
    }
  });

  /* --- Tasks --- */
  $("#taskForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const item = { id: uid(), title: $("#taskTitle").value.trim(), tier: $("#taskTier").value, done: false };
    if (!item.title) return;
    db.tasks.push(item);
    lastAdded = item.id;
    saveData(); renderTasks(); renderSummary();
    e.target.reset();
    $("#taskTitle").focus();
  });

  // Toggle + delete (delegated across the three lists)
  $("#card-tasks").addEventListener("change", (e) => {
    if (!e.target.classList.contains("task-check")) return;
    const id = e.target.closest("[data-id]").dataset.id;
    const task = db.tasks.find((t) => t.id === id);
    if (task) { task.done = e.target.checked; saveData(); }
    const done = db.tasks.filter((t) => t.done).length;
    $("#taskCount").textContent = `${done} of ${db.tasks.length}`;
    renderSummary();
  });
  $("#card-tasks").addEventListener("click", (e) => {
    if (!e.target.closest("[data-del]")) return;
    const id = e.target.closest("[data-id]").dataset.id;
    db.tasks = db.tasks.filter((t) => t.id !== id);
    saveData(); renderTasks(); renderSummary();
  });

  /* --- Projects --- */
  $("#projectForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const item = {
      id: uid(),
      name: $("#projName").value.trim(),
      progress: Math.min(100, Math.max(0, parseInt($("#projProgress").value, 10) || 0)),
      next: $("#projNext").value.trim(),
      deadline: $("#projDeadline").value.trim(),
      status: $("#projStatus").value
    };
    if (!item.name) return;
    db.projects.push(item);
    lastAdded = item.id;
    saveData(); renderProjects(); renderSummary();
    e.target.reset();
  });

  $("#projectList").addEventListener("click", (e) => {
    const row = e.target.closest("[data-id]");
    if (!row) return;
    const id = row.dataset.id;
    const proj = db.projects.find((p) => p.id === id);
    if (e.target.closest("[data-del]")) {
      db.projects = db.projects.filter((p) => p.id !== id);
    } else if (e.target.dataset.act === "plus" && proj) {
      proj.progress = Math.min(100, proj.progress + 10);
      if (proj.progress === 100) proj.status = "Done";
    } else if (e.target.dataset.act === "minus" && proj) {
      proj.progress = Math.max(0, proj.progress - 10);
      if (proj.status === "Done" && proj.progress < 100) proj.status = "Moving";
    } else return;
    saveData(); renderProjects(); renderSummary();
  });

  /* --- Notes --- */
  $("#noteForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const item = { id: uid(), text: $("#noteText").value.trim(), kind: $("#noteKind").value, date: todayISO() };
    if (!item.text) return;
    db.notes.push(item);
    lastAdded = item.id;
    saveData(); renderNotes();
    e.target.reset();
    $("#noteText").focus();
  });
  $("#notesList").addEventListener("click", (e) => {
    if (!e.target.closest("[data-del]")) return;
    const id = e.target.closest("[data-id]").dataset.id;
    db.notes = db.notes.filter((n) => n.id !== id);
    saveData(); renderNotes();
  });

  /* --- Diary --- */
  let selectedMood = "";
  $$(".mood-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const already = btn.classList.contains("sel");
      $$(".mood-btn").forEach((b) => b.classList.remove("sel"));
      if (!already) { btn.classList.add("sel"); selectedMood = btn.dataset.mood; }
      else selectedMood = "";
    });
  });

  $("#diaryForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const item = {
      id: uid(),
      date: todayISO(),
      did: $("#diaryDid").value.trim(),
      felt: $("#diaryFelt").value.trim(),
      fix: $("#diaryFix").value.trim(),
      mood: selectedMood
    };
    if (!item.did) return;
    db.diary.push(item);
    lastAdded = item.id;
    saveData(); renderDiary(); renderSummary();
    e.target.reset();
    selectedMood = "";
    $$(".mood-btn").forEach((b) => b.classList.remove("sel"));
  });
  $("#diaryList").addEventListener("click", (e) => {
    if (!e.target.closest("[data-del]")) return;
    const id = e.target.closest("[data-id]").dataset.id;
    db.diary = db.diary.filter((d) => d.id !== id);
    saveData(); renderDiary(); renderSummary();
  });

  /* --- Documents --- */
  let pendingFile = null; // metadata of the chosen/dropped file

  function setPendingFile(file) {
    if (!file) return;
    const ext = (file.name.split(".").pop() || "").toUpperCase();
    pendingFile = { name: file.name, type: ext || "FILE" };
    $("#fileChosen").textContent = "Selected: " + file.name;
  }

  $("#fileInput").addEventListener("change", (e) => setPendingFile(e.target.files[0]));

  const dropZone = $("#dropZone");
  dropZone.addEventListener("click", (e) => {
    // The label/input handles its own clicks; avoid double-open
    if (!e.target.closest(".choose-btn")) $("#fileInput").click();
  });
  dropZone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("#fileInput").click(); }
  });
  ["dragover", "dragenter"].forEach((ev) =>
    dropZone.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.add("dragover"); }));
  ["dragleave", "drop"].forEach((ev) =>
    dropZone.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.remove("dragover"); }));
  dropZone.addEventListener("drop", (e) => setPendingFile(e.dataTransfer.files[0]));

  $("#addDocBtn").addEventListener("click", () => {
    if (!pendingFile) {
      $("#fileChosen").textContent = "Choose or drop a file first.";
      return;
    }
    const item = {
      id: uid(),
      name: pendingFile.name,
      type: pendingFile.type,
      category: $("#docCategory").value,
      note: $("#docNote").value.trim(),
      date: todayISO()
    };
    db.docs.push(item);
    lastAdded = item.id;
    pendingFile = null;
    $("#fileChosen").textContent = "";
    $("#docNote").value = "";
    $("#fileInput").value = "";
    saveData(); renderDocuments(); renderSummary();
  });

  $("#docSearch").addEventListener("input", renderDocuments);
  $("#docFilter").addEventListener("change", renderDocuments);
  $("#docList").addEventListener("click", (e) => {
    if (!e.target.closest("[data-del]")) return;
    const id = e.target.closest("[data-id]").dataset.id;
    db.docs = db.docs.filter((d) => d.id !== id);
    saveData(); renderDocuments(); renderSummary();
  });

  /* --- Health --- */
  $("#healthForm").addEventListener("submit", (e) => {
    e.preventDefault();
    db.health = {
      date: todayISO(),
      sleep: $("#hSleep").value.trim() || db.health.sleep,
      water: $("#hWater").value !== "" ? parseFloat($("#hWater").value) : db.health.water,
      energy: $("#hEnergy").value !== "" ? parseInt($("#hEnergy").value, 10) : db.health.energy,
      workout: $("#hWorkout").checked,
      cigs: $("#hCigs").value !== "" ? parseInt($("#hCigs").value, 10) : db.health.cigs,
      symptoms: $("#hSymptoms").value.trim() || "None"
    };
    saveData(); renderHealth(); renderSummary();
    e.target.reset();
    e.target.closest("details").removeAttribute("open");
  });

  /* --- Events --- */
  $("#eventForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const item = {
      id: uid(),
      title: $("#evTitle").value.trim(),
      date: $("#evDate").value,
      time: $("#evTime").value,
      type: $("#evType").value
    };
    if (!item.title || !item.date) return;
    db.events.push(item);
    lastAdded = item.id;
    saveData(); renderEvents();
    e.target.reset();
  });
  $("#eventList").addEventListener("click", (e) => {
    if (!e.target.closest("[data-del]")) return;
    const id = e.target.closest("[data-id]").dataset.id;
    db.events = db.events.filter((x) => x.id !== id);
    saveData(); renderEvents();
  });

  /* --- Follow-ups --- */
  $("#followForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const item = {
      id: uid(),
      name: $("#fuName").value.trim(),
      reason: $("#fuReason").value.trim(),
      due: $("#fuDue").value,
      type: $("#fuType").value,
      done: false
    };
    if (!item.name) return;
    db.follows.push(item);
    lastAdded = item.id;
    saveData(); renderFollowUps();
    e.target.reset();
  });
  $("#followList").addEventListener("change", (e) => {
    if (!e.target.classList.contains("fu-check")) return;
    const id = e.target.closest("[data-id]").dataset.id;
    const f = db.follows.find((x) => x.id === id);
    if (f) { f.done = e.target.checked; saveData(); renderFollowUps(); }
  });
  $("#followList").addEventListener("click", (e) => {
    if (!e.target.closest("[data-del]")) return;
    const id = e.target.closest("[data-id]").dataset.id;
    db.follows = db.follows.filter((x) => x.id !== id);
    saveData(); renderFollowUps();
  });

  /* --- Reset demo data --- */
  $("#resetBtn").addEventListener("click", () => {
    if (!confirm("Reset all demo data to the original sample content?")) return;
    localStorage.removeItem(DB_KEY);
    db = loadData();
    renderAll();
  });

  /* ---------- 5. QUICK ADD MODAL + JUMP SHORTCUTS ---------- */
  const overlay = $("#quickAddModal");

  function openModal() {
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add("open"));
    document.body.style.overflow = "hidden";
  }
  function closeModal() {
    overlay.classList.remove("open");
    document.body.style.overflow = "";
    setTimeout(() => { overlay.hidden = true; }, 300);
  }

  $("#quickAddBtn").addEventListener("click", openModal);
  $("#navQuickAdd").addEventListener("click", openModal);
  $("#modalCloseBtn").addEventListener("click", closeModal);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !overlay.hidden) closeModal(); });

  // Any element with data-jump scrolls to its card, highlights it,
  // and (optionally) focuses an input. Used by the shortcut strip,
  // the modal options, and the mobile bottom nav.
  function jumpTo(targetSel, focusSel) {
    const target = $(targetSel);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: targetSel.startsWith("#card-") ? "center" : "start" });
    target.classList.remove("card-highlight");
    void target.offsetWidth; // restart the animation
    target.classList.add("card-highlight");
    setTimeout(() => target.classList.remove("card-highlight"), 1100);
    if (focusSel) setTimeout(() => { const f = $(focusSel); if (f) f.focus({ preventScroll: true }); }, 650);
  }

  document.addEventListener("click", (e) => {
    const jumper = e.target.closest("[data-jump]");
    if (!jumper) return;
    if (!overlay.hidden) closeModal();
    jumpTo(jumper.dataset.jump, jumper.dataset.focus);
  });

  // Smooth scroll for plain anchor links (nav, hero, CTA)
  $$('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (e) => {
      const id = link.getAttribute("href");
      if (id.length <= 1) return;
      const target = $(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  /* ---------- 6. SCROLL-REVEAL ---------- */
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const siblings = [...el.parentElement.children].filter((s) => s.classList && s.classList.contains("reveal"));
      el.style.transitionDelay = `${Math.min(siblings.indexOf(el) * 80, 400)}ms`;
      el.classList.add("visible");
      revealObserver.unobserve(el);
    });
  }, { threshold: 0.12 });
  $$(".reveal").forEach((el) => revealObserver.observe(el));

  /* ---------- 7. BOOT ---------- */
  // Default the event date picker to today for fast entry
  $("#evDate").value = todayISO();
  renderAll();
});
