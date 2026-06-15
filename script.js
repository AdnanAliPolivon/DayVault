/* ============================================================
   CALM-E DAILY — script.js
   Functional front-end demo. All data lives in localStorage.
   (Storage key kept from the DayVault era so existing data
   survives the rebrand.)

   1.  Helpers
   2.  Data layer: seedData / loadData / saveData / migration
   3.  Render functions (one per card) + summary
   4.  Form handlers: expenses, tasks, projects, notes, diary,
       documents, health, food, medications, fasting, events,
       follow-ups
   5.  Intelligent daily flow (generateDailyFlow)
   6.  Quick Add modal + jump shortcuts
   7.  Scroll-reveal animations
   8.  Boot
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {

  /* ---------- 1. HELPERS ---------- */
  const $  = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const pad = (n) => String(n).padStart(2, "0");
  const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  // Format a Date for <input type="datetime-local">
  const toLocalDT = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const euro = (n) => "€" + Number(n).toFixed(2);
  const niceDate = (iso) => {
    if (!iso) return "";
    const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };
  const niceDT = (dt) => {
    if (!dt) return "";
    return new Date(dt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };
  // Hours+minutes from milliseconds → "16h 20m"
  const fmtDur = (ms) => {
    const h = Math.floor(ms / 3600000);
    const m = Math.round((ms % 3600000) / 60000);
    return `${h}h ${m}m`;
  };
  // Escape user text before inserting into innerHTML
  const esc = (s) => String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  // Grow [data-width] bars after a render
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

  /* ---------- 2. AUTH + PER-USER DATA LAYER ----------
     Demo authentication: a small credential store with hashed
     passwords lives in localStorage. Each user's app data is
     stored under their own key (calme-data-<username>), so users
     are isolated from each other. Replace with a real backend
     (bcrypt + HTTPS) before sharing sensitive data. */
  const USERS_KEY   = "calme-users-v1";
  const SESSION_KEY = "calme-session-v1";
  const LEGACY_KEY  = "dayvault-demo-v1";       // pre-auth single-user data
  const dataKey = (u) => "calme-data-" + u;

  let currentUser = null;   // the logged-in account
  let viewUser = null;      // whose data is on screen (admin can switch)
  let db = null;            // active dataset

  // SHA-256 (salted with the username) via Web Crypto; tiny
  // non-cryptographic fallback for non-secure contexts (file://).
  async function hashPass(username, password) {
    const text = `calme|${username}|${password}`;
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return "f" + h.toString(16);
  }

  const getUsers = () => { try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; } catch (e) { return []; } };
  const setUsers = (list) => localStorage.setItem(USERS_KEY, JSON.stringify(list));

  // First run: seed the demo accounts (one admin, one standard user)
  async function ensureUsers() {
    if (getUsers().length) return;
    setUsers([
      { username: "ali",  hash: await hashPass("ali", "vault2026"), role: "admin" },
      { username: "sara", hash: await hashPass("sara", "calm2026"), role: "user" }
    ]);
  }

  function seedData() {
    const t = todayISO();
    const fastStart = new Date(Date.now() - 40 * 3600000); // a finished 16h fast
    const fastEnd = new Date(Date.now() - 24 * 3600000);
    return {
      budget: { daily: 30 },
      timeplan: {
        restHours: 8,
        workHours: 8,
        tasks: [
          { id: uid(), name: "Arabic learning", mins: 30 },
          { id: uid(), name: "Gym", mins: 60 },
          { id: uid(), name: "Vanera work", mins: 90 },
          { id: uid(), name: "Prayer / reflection", mins: 30 }
        ]
      },
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
      health: { date: t, sleep: "6h 20m", water: 1.8, energy: 7, workout: true, cigs: 0, supps: "Vitamin D3, Magnesium", symptoms: "None" },
      food: [
        { id: uid(), name: "Oatmeal with banana", portion: "1 bowl", meal: "Breakfast", effect: "Light", date: t },
        { id: uid(), name: "Chicken rice bowl", portion: "Regular", meal: "Lunch", effect: "Fine", date: t }
      ],
      meds: [
        { id: uid(), name: "Vitamin D3", dose: "2000 IU", freq: "Once daily", start: t, end: "", notes: "With breakfast", done: false },
        { id: uid(), name: "Magnesium", dose: "200 mg", freq: "Once daily", start: t, end: "", notes: "Before sleep", done: false }
      ],
      fasts: [
        { id: uid(), type: "16/8", start: toLocalDT(fastStart), end: toLocalDT(fastEnd), notes: "Clear-headed by the end." }
      ],
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

  // Patch older saved data so new features work without losing
  // anything the user already entered.
  function ensureShape(d) {
    const defaults = seedData();
    ["expenses","tasks","projects","notes","diary","docs","events","follows","food","meds","fasts"]
      .forEach((k) => { if (!Array.isArray(d[k])) d[k] = (k === "food" || k === "meds" || k === "fasts") ? [] : defaults[k]; });
    if (!d.budget || typeof d.budget.daily !== "number") d.budget = { daily: 30 };
    if (!d.timeplan || typeof d.timeplan !== "object") d.timeplan = defaults.timeplan;
    if (typeof d.timeplan.restHours !== "number") d.timeplan.restHours = 8;
    if (typeof d.timeplan.workHours !== "number") d.timeplan.workHours = 8;
    if (!Array.isArray(d.timeplan.tasks)) d.timeplan.tasks = [];
    if (!d.health) d.health = defaults.health;
    if (d.health.supps === undefined) d.health.supps = "";
    return d;
  }

  function loadData() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) return ensureShape(JSON.parse(raw));
    } catch (e) { /* corrupted storage → reseed */ }
    const fresh = seedData();
    localStorage.setItem(DB_KEY, JSON.stringify(fresh));
    return fresh;
  }

  function saveData() {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    generateDailyFlow(); // the coach updates whenever data changes
  }

  db = loadData();

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
    $("#mSaved").textContent = "+" + euro(Math.max(0, remaining));
    $("#mWaste").textContent = euro(waste);
    $("#mPct").textContent = pct + "%";

    const fill = $("#budgetFill");
    const state = $("#budgetState");
    fill.classList.remove("state-warn", "state-danger");
    state.className = "card-tag";
    if (pct < 60) { state.classList.add("tag-green"); state.textContent = "Calm"; }
    else if (pct <= 90) { fill.classList.add("state-warn"); state.classList.add("tag-amber"); state.textContent = "Careful"; }
    else { fill.classList.add("state-danger"); state.classList.add("tag-coral"); state.textContent = "Over the line"; }
    fill.dataset.width = Math.min(pct, 100) + "%";

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

  /* --- Health (snapshot is editable: form prefills today's values) --- */
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
      <div class="h-stat"><span class="hs-label">Supps / meds</span><strong>${esc(h.supps || "—")}</strong></div>
      <div class="h-stat"><span class="hs-label">Symptoms</span><strong>${esc(h.symptoms || "None")}</strong></div>`;

    // Prefill the form so today's snapshot can be edited, not retyped
    $("#hSleep").value = h.sleep || "";
    $("#hWater").value = h.water ?? "";
    $("#hEnergy").value = h.energy ?? "";
    $("#hCigs").value = h.cigs ?? "";
    $("#hSupps").value = h.supps || "";
    $("#hSymptoms").value = h.symptoms || "";
    $("#hWorkout").checked = !!h.workout;
  }

  /* --- Food Diary --- */
  function renderFood() {
    const t = todayISO();
    const effChip = (e) => e ? `<span class="eff eff-${esc(e.toLowerCase())}">${esc(e)}</span>` : "";
    const row = (f) => `
      <li class="row-item" data-id="${f.id}">
        <span class="ri-kind meal-tag">${esc(f.meal)}</span>
        <div class="ri-main">
          <strong>${esc(f.name)}</strong>
          <small>${niceDate(f.date)}${f.portion ? " · " + esc(f.portion) : ""}</small>
        </div>
        ${effChip(f.effect)}
        <button class="ri-del" data-del aria-label="Delete food entry">×</button>
      </li>`;

    const todays = db.food.filter((f) => f.date === t);
    const earlier = db.food.filter((f) => f.date !== t);

    $("#foodList").innerHTML = todays.slice().reverse().map(row).join("")
      || `<li class="empty-hint">No food entries yet. What did you eat today?</li>`;
    $("#foodHistory").innerHTML = earlier.slice().reverse().map(row).join("")
      || `<li class="empty-hint">No earlier entries.</li>`;
    $("#foodCount").textContent = `${todays.length} today`;
    flashNew($("#card-food"));
  }

  /* --- Medications & Supplements --- */
  function renderMeds() {
    const row = (m) => `
      <li class="row-item${m.done ? " done" : ""}" data-id="${m.id}">
        <input type="checkbox" class="fu-check med-done-btn" ${m.done ? "checked" : ""} aria-label="Mark completed" />
        <div class="ri-main">
          <strong>${esc(m.name)}${m.dose ? " · " + esc(m.dose) : ""}</strong>
          <small>${esc(m.freq)} · ${m.end ? niceDate(m.start) + " → " + niceDate(m.end) : "ongoing since " + niceDate(m.start)}${m.notes ? " — " + esc(m.notes) : ""}</small>
        </div>
        <span class="ri-kind med-tag">${m.end ? "Course" : "Ongoing"}</span>
        <button class="ri-del" data-del aria-label="Delete medication">×</button>
      </li>`;

    const active = db.meds.filter((m) => !m.done);
    const completed = db.meds.filter((m) => m.done);
    $("#medList").innerHTML = active.map(row).join("")
      || `<li class="empty-hint">No medications tracked. Add one if you need the reminder.</li>`;
    $("#medHistory").innerHTML = completed.map(row).join("")
      || `<li class="empty-hint">Nothing completed yet.</li>`;
    $("#medCount").textContent = `${active.length} active`;
    flashNew($("#card-meds"));
  }

  /* --- Fasting Tracker --- */
  // Target hours per fast type (used for the ongoing progress bar)
  const FAST_TARGET = { "16/8": 16, "24-hour": 24, "Religious": 14, "Custom": 16 };

  function renderFasting() {
    const ongoing = db.fasts.find((f) => !f.end);

    // Ongoing fast: live progress block
    if (ongoing) {
      const target = FAST_TARGET[ongoing.type] || 16;
      const elapsed = Date.now() - new Date(ongoing.start).getTime();
      const pct = Math.min(100, Math.round((elapsed / (target * 3600000)) * 100));
      const endsAt = new Date(new Date(ongoing.start).getTime() + target * 3600000);
      $("#fastNow").innerHTML = `
        <div class="fast-now" data-id="${ongoing.id}">
          <div class="fast-now-top">
            <strong>${esc(ongoing.type)} fast — in progress</strong>
            <span class="fast-elapsed">${fmtDur(Math.max(0, elapsed))}</span>
          </div>
          <div class="fast-track"><span class="fast-fill" data-width="${pct}%"></span></div>
          <div class="fast-now-meta">
            <span>${pct}% of ${target}h · ends ~${endsAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
            <button class="end-fast-btn" id="endFastBtn" type="button">End fast now</button>
          </div>
        </div>`;
      $("#fastTag").textContent = "Fasting now";
      $("#fastTag").className = "card-tag tag-deep";
    } else {
      $("#fastNow").innerHTML = "";
      $("#fastTag").textContent = db.fasts.length ? `${db.fasts.length} logged` : "—";
      $("#fastTag").className = "card-tag tag-deep";
    }

    // Completed fasts with auto-calculated duration
    const doneFasts = db.fasts.filter((f) => f.end);
    $("#fastList").innerHTML = doneFasts.slice().reverse().map((f) => {
      const dur = new Date(f.end) - new Date(f.start);
      return `
      <li class="row-item" data-id="${f.id}">
        <span class="ri-kind fast-dur">${fmtDur(Math.max(0, dur))}</span>
        <div class="ri-main">
          <strong>${esc(f.type)}</strong>
          <small>${niceDT(f.start)} → ${niceDT(f.end)}${f.notes ? " — " + esc(f.notes) : ""}</small>
        </div>
        <button class="ri-del" data-del aria-label="Delete fast">×</button>
      </li>`;
    }).join("") || `<li class="empty-hint">No fasts logged. Start when you're ready.</li>`;

    animateBars($("#card-fasting"));
    flashNew($("#card-fasting"));
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

  /* --- Day Planner ---
     One circle = one day. Rest and Work are the fixed base and are
     drawn as compressed grouped wedges (they never dominate the
     circle, however many hours they hold). Play always occupies the
     dominant 66% of the dial and is divided into 30-minute slices the
     user fills with flexible tasks. */
  const DAY = {
    cx: 160, cy: 160, rO: 150, rI: 92,
    playFrac: 0.66,          // Play always owns this share of the circle
    baseFrac: 0.34,          // Rest + Work share the rest (compressed)
    palette: ["#7857d6", "#3a6ff2", "#178f8f", "#119d6c", "#d99114", "#c2566f", "#2c4f9e", "#b06f33"]
  };

  const fmtMins = (m) => {
    m = Math.max(0, Math.round(m));
    const h = Math.floor(m / 60), mm = m % 60;
    if (h && mm) return `${h}h ${mm}m`;
    if (h) return `${h}h`;
    return `${mm}m`;
  };
  const fmtHrs = (h) => (Number.isInteger(h) ? `${h}h` : `${h}h`);

  // Donut segment between two angles (degrees, clockwise, 0° = 3 o'clock)
  function donutSeg(a0, a1) {
    const { cx, cy, rO, rI } = DAY;
    const pt = (r, a) => { const rad = a * Math.PI / 180; return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]; };
    const large = (a1 - a0) > 180 ? 1 : 0;
    const [x0o, y0o] = pt(rO, a0), [x1o, y1o] = pt(rO, a1);
    const [x1i, y1i] = pt(rI, a1), [x0i, y0i] = pt(rI, a0);
    return `M${x0o.toFixed(2)} ${y0o.toFixed(2)} A${rO} ${rO} 0 ${large} 1 ${x1o.toFixed(2)} ${y1o.toFixed(2)} `
         + `L${x1i.toFixed(2)} ${y1i.toFixed(2)} A${rI} ${rI} 0 ${large} 0 ${x0i.toFixed(2)} ${y0i.toFixed(2)} Z`;
  }

  function renderDayPlanner() {
    const tp = db.timeplan;
    const rest = tp.restHours, work = tp.workHours;
    let play = Math.round((24 - rest - work) * 10) / 10;
    if (play < 0) play = 0;
    const playSlices = Math.round(play * 2);
    const capMins = playSlices * 30;
    const tasks = tp.tasks;
    const plannedMins = tasks.reduce((s, t) => s + (t.mins || 0), 0);

    // Map each play slice → index of the task occupying it (or -1).
    const sliceTask = new Array(playSlices).fill(-1);
    let cursor = 0;
    tasks.forEach((t, i) => {
      const n = Math.round((t.mins || 0) / 30);
      for (let k = 0; k < n && cursor < playSlices; k++) sliceTask[cursor++] = i;
    });

    // --- Build the dial ---
    const baseHrs = rest + work;
    const restFrac = baseHrs > 0 ? DAY.baseFrac * (rest / baseHrs) : 0;
    const workFrac = baseHrs > 0 ? DAY.baseFrac * (work / baseHrs) : 0;
    const playAngle = (playSlices > 0 ? DAY.playFrac : DAY.playFrac + DAY.baseFrac) * 360;
    const baseAngle = 360 - playAngle;

    // Center Play around the top (12 o'clock = -90°).
    const playStart = -90 - playAngle / 2;
    let parts = [];

    if (playSlices > 0) {
      const slice = playAngle / playSlices;
      const gap = Math.min(slice * 0.16, 1.1); // breathing room between slices
      for (let i = 0; i < playSlices; i++) {
        const a0 = playStart + i * slice + gap / 2;
        const a1 = playStart + (i + 1) * slice - gap / 2;
        const ti = sliceTask[i];
        const filled = ti >= 0;
        const fill = filled ? DAY.palette[ti % DAY.palette.length] : "rgba(120,87,214,0.10)";
        const tid = filled ? tasks[ti].id : "";
        parts.push(
          `<path class="slice slice-play${filled ? " is-filled" : ""}" d="${donutSeg(a0, a1)}" `
          + `fill="${fill}"${tid ? ` data-ti="${tid}"` : ""}>`
          + `<title>${filled ? esc(tasks[ti].name) : "Free Play time"} · 30 min</title></path>`
        );
      }
    }

    // Base block (Work then Rest) fills the remaining bottom arc.
    let a = playStart + playAngle; // continue clockwise from play's end
    const baseGap = baseAngle > 6 ? 1.0 : 0;
    if (workFrac > 0) {
      const span = workFrac * 360;
      parts.push(`<path class="slice slice-work" d="${donutSeg(a + baseGap / 2, a + span - baseGap / 2)}" fill="var(--blue)"><title>Work · ${fmtHrs(work)}</title></path>`);
      a += span;
    }
    if (restFrac > 0) {
      const span = restFrac * 360;
      parts.push(`<path class="slice slice-rest" d="${donutSeg(a + baseGap / 2, a + span - baseGap / 2)}" fill="var(--lav)"><title>Rest · ${fmtHrs(rest)}</title></path>`);
    }

    $("#dayDial").innerHTML = parts.join("");

    // --- Readouts ---
    const leftMins = capMins - plannedMins;
    $("#dialPlayLeft").textContent = playSlices === 0 ? "0h" : fmtMins(Math.max(0, leftMins));
    $("#restVal").textContent = fmtHrs(rest);
    $("#workVal").textContent = fmtHrs(work);
    $("#playVal").textContent = fmtHrs(play);
    $("#restSlider").value = rest;
    $("#workSlider").value = work;

    const pct = capMins > 0 ? Math.min(100, (plannedMins / capMins) * 100) : 0;
    $("#playMeterFill").style.width = pct + "%";

    const over = plannedMins > capMins;
    $("#playHint").innerHTML = over
      ? `<span class="day-overflow">Over by ${fmtMins(plannedMins - capMins)}</span> · trim a task or add Play time`
      : `${fmtMins(leftMins)} free of ${fmtHrs(play)} Play`;

    const usedSlices = Math.round(plannedMins / 30);
    const cap = $("#dayCap");
    cap.textContent = `${usedSlices} / ${playSlices} slices`;
    cap.classList.toggle("day-overflow", over);

    // --- Task rows ---
    let running = 0;
    $("#dayTaskList").innerHTML = tasks.map((t, i) => {
      const fits = running + Math.round(t.mins / 30) <= playSlices;
      running += Math.round(t.mins / 30);
      const color = DAY.palette[i % DAY.palette.length];
      return `<li class="day-task-item" data-id="${t.id}">
        <span class="dt-swatch" style="background:${color}"></span>
        <span class="dt-text">
          <span class="dt-name">${esc(t.name)}</span>
          <span class="dt-dur${fits ? "" : " day-overflow"}">${fmtMins(t.mins)}${fits ? "" : " · no Play room"}</span>
        </span>
        <button class="dt-del" data-del type="button" aria-label="Remove task">×</button>
      </li>`;
    }).join("");
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

    let score = 0;
    if (spent <= db.budget.daily) score += 20;
    if (done > 0) score += 20;
    if (db.health && db.health.date === t) score += 20;
    if (diaryToday) score += 20;
    if (db.projects.some((p) => p.next && p.status !== "Done")) score += 20;
    $("#clarityScore").textContent = score + "%";
    $("#clarityRing").style.setProperty("--score", score);
  }

  function renderAll() {
    renderExpenses(); renderTasks(); renderProjects(); renderNotes();
    renderDiary(); renderDocuments(); renderHealth(); renderFood();
    renderMeds(); renderFasting(); renderEvents(); renderFollowUps();
    renderDayPlanner(); renderSummary(); generateDailyFlow();
  }

  /* ---------- 4. FORM HANDLERS & LIST ACTIONS ---------- */

  /* --- Money --- */
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

  $("#expenseList").addEventListener("click", (e) => {
    if (!e.target.closest("[data-del]")) return;
    const id = e.target.closest("[data-id]").dataset.id;
    db.expenses = db.expenses.filter((x) => x.id !== id);
    saveData(); renderExpenses(); renderSummary();
  });

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
  let pendingFile = null;

  function setPendingFile(file) {
    if (!file) return;
    const ext = (file.name.split(".").pop() || "").toUpperCase();
    pendingFile = { name: file.name, type: ext || "FILE" };
    $("#fileChosen").textContent = "Selected: " + file.name;
  }

  $("#fileInput").addEventListener("change", (e) => setPendingFile(e.target.files[0]));

  const dropZone = $("#dropZone");
  dropZone.addEventListener("click", (e) => {
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
      sleep: $("#hSleep").value.trim(),
      water: $("#hWater").value !== "" ? parseFloat($("#hWater").value) : "",
      energy: $("#hEnergy").value !== "" ? parseInt($("#hEnergy").value, 10) : "",
      workout: $("#hWorkout").checked,
      cigs: $("#hCigs").value !== "" ? parseInt($("#hCigs").value, 10) : "",
      supps: $("#hSupps").value.trim(),
      symptoms: $("#hSymptoms").value.trim() || "None"
    };
    saveData(); renderHealth(); renderSummary();
    e.target.closest("details").removeAttribute("open");
  });

  /* --- Food Diary --- */
  function saveFoodEntry(e) {
    e.preventDefault();
    const item = {
      id: uid(),
      name: $("#foodName").value.trim(),
      portion: $("#foodPortion").value.trim(),
      meal: $("#foodMeal").value,
      effect: $("#foodEffect").value,
      date: todayISO()
    };
    if (!item.name) return;
    db.food.push(item);
    lastAdded = item.id;
    saveData(); renderFood();
    e.target.reset();
    $("#foodName").focus();
  }
  $("#foodForm").addEventListener("submit", saveFoodEntry);

  $("#card-food").addEventListener("click", (e) => {
    if (!e.target.closest("[data-del]")) return;
    const id = e.target.closest("[data-id]").dataset.id;
    db.food = db.food.filter((f) => f.id !== id);
    saveData(); renderFood();
  });

  /* --- Medications & Supplements --- */
  // "Ongoing" checkbox disables the end-date field
  $("#medOngoing").addEventListener("change", () => {
    $("#medEnd").disabled = $("#medOngoing").checked;
    if ($("#medOngoing").checked) $("#medEnd").value = "";
  });

  function saveMedication(e) {
    e.preventDefault();
    const item = {
      id: uid(),
      name: $("#medName").value.trim(),
      dose: $("#medDose").value.trim(),
      freq: $("#medFreq").value,
      start: $("#medStart").value || todayISO(),
      end: $("#medOngoing").checked ? "" : $("#medEnd").value,
      notes: $("#medNotes").value.trim(),
      done: false
    };
    if (!item.name) return;
    db.meds.push(item);
    lastAdded = item.id;
    saveData(); renderMeds();
    e.target.reset();
    $("#medOngoing").checked = true;
    $("#medEnd").disabled = true;
    $("#medStart").value = todayISO();
  }
  $("#medForm").addEventListener("submit", saveMedication);

  $("#card-meds").addEventListener("change", (e) => {
    if (!e.target.classList.contains("fu-check")) return;
    const id = e.target.closest("[data-id]").dataset.id;
    const m = db.meds.find((x) => x.id === id);
    if (m) { m.done = e.target.checked; saveData(); renderMeds(); }
  });
  $("#card-meds").addEventListener("click", (e) => {
    if (!e.target.closest("[data-del]")) return;
    const id = e.target.closest("[data-id]").dataset.id;
    db.meds = db.meds.filter((m) => m.id !== id);
    saveData(); renderMeds();
  });

  /* --- Fasting Tracker --- */
  function saveFast(e) {
    e.preventDefault();
    const start = $("#fastStart").value;
    if (!start) return;
    const end = $("#fastEnd").value;
    if (end && new Date(end) <= new Date(start)) {
      $("#fastEnd").setCustomValidity("End must be after start");
      $("#fastEnd").reportValidity();
      $("#fastEnd").setCustomValidity("");
      return;
    }
    // Only one ongoing fast at a time
    if (!end && db.fasts.some((f) => !f.end)) {
      alert("You already have an ongoing fast. End it first.");
      return;
    }
    const item = { id: uid(), type: $("#fastType").value, start, end, notes: $("#fastNotes").value.trim() };
    db.fasts.push(item);
    lastAdded = item.id;
    saveData(); renderFasting();
    e.target.reset();
    $("#fastStart").value = toLocalDT(new Date());
  }
  $("#fastForm").addEventListener("submit", saveFast);

  $("#card-fasting").addEventListener("click", (e) => {
    // End the ongoing fast
    if (e.target.id === "endFastBtn") {
      const ongoing = db.fasts.find((f) => !f.end);
      if (ongoing) { ongoing.end = toLocalDT(new Date()); saveData(); renderFasting(); }
      return;
    }
    if (!e.target.closest("[data-del]")) return;
    const id = e.target.closest("[data-id]").dataset.id;
    db.fasts = db.fasts.filter((f) => f.id !== id);
    saveData(); renderFasting();
  });

  // Refresh the ongoing-fast progress every minute
  setInterval(() => { if (db.fasts.some((f) => !f.end)) renderFasting(); }, 60000);

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
    $("#evDate").value = todayISO();
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

  /* ---------- 5. INTELLIGENT DAILY FLOW ----------
     Reads tasks, events, money, food, meds, fasts, health,
     diary, projects and follow-ups, and writes personalized
     suggestions into the four timeline steps. Called on boot
     and from saveData(), so it always reflects current data. */
  function generateDailyFlow() {
    const t = todayISO();
    const morning = [], midday = [], evening = [], anytime = [];

    /* — Morning: priorities, early anchors, health reminders — */
    const musts = db.tasks.filter((x) => x.tier === "must" && !x.done);
    if (musts.length) {
      const names = musts.slice(0, 2).map((x) => `<strong>${esc(x.title)}</strong>`).join(" and ");
      morning.push(`Start with ${names}${musts.length > 2 ? ` (+${musts.length - 2} more must-dos)` : ""}.`);
    } else {
      morning.push(`<span class="flow-good">All must-dos are done.</span> Pick one Should and make it today's win.`);
    }
    const earlyEv = db.events
      .filter((e) => e.date === t && e.time && e.time < "12:00")
      .sort((a, b) => a.time.localeCompare(b.time))[0];
    if (earlyEv) morning.push(`<strong>${esc(earlyEv.time)}</strong> — ${esc(earlyEv.title)}. Leave buffer time.`);
    const activeMeds = db.meds.filter((m) => !m.done);
    if (activeMeds.length) {
      morning.push(`Take your ${activeMeds.length === 1 ? `<strong>${esc(activeMeds[0].name)}</strong>` : `medication — <strong>${activeMeds.length} active</strong>`}.`);
    }
    morning.push("Drink a glass of water before the first coffee.");

    /* — Midday: money capture, food diary, loose thoughts — */
    const spent = db.expenses.filter((e) => e.date === t).reduce((s, e) => s + e.amount, 0);
    midday.push(spent === 0
      ? "No expenses captured yet — log lunch before it leaks."
      : `<strong>${euro(spent)}</strong> captured so far. Keep the leaks visible.`);
    const lunchLogged = db.food.some((f) => f.date === t && f.meal === "Lunch");
    midday.push(lunchLogged
      ? `<span class="flow-good">Lunch is in the Food Diary.</span> Note how it sat if you haven't.`
      : "After lunch: add it to the Food Diary, with how it felt.");
    midday.push("Any loose thoughts or links? Quick Capture takes five seconds.");

    /* — Evening: projects, body, follow-ups — */
    const stuck = db.projects.find((p) => p.status === "Stuck");
    if (stuck) evening.push(`<strong>${esc(stuck.name)}</strong> is stuck — define one small next step.`);
    const moving = db.projects.find((p) => p.status !== "Done" && p.next);
    if (moving && (!stuck || moving.id !== stuck.id)) {
      evening.push(`Project nudge: <strong>${esc(moving.name)}</strong> → ${esc(moving.next)}${moving.deadline && moving.deadline !== "—" ? ` (due ${esc(moving.deadline)})` : ""}.`);
    }
    if (!db.health || db.health.date !== t) {
      evening.push("Body Signal isn't updated today — 30 seconds before bed.");
    } else {
      evening.push(`<span class="flow-good">Body Signal logged.</span> Add dinner to the Food Diary too.`);
    }
    const openFu = db.follows.filter((f) => !f.done);
    if (openFu.length) {
      evening.push(`<strong>${openFu.length} follow-up${openFu.length > 1 ? "s" : ""}</strong> still open — close one loop tonight (${esc(openFu[0].name)} first?).`);
    }
    if (!evening.length) evening.push("Everything's updated. Close the day lightly.");

    /* — Anytime: fasting, diary, vault — */
    const ongoingFast = db.fasts.find((f) => !f.end);
    if (ongoingFast) {
      const target = FAST_TARGET[ongoingFast.type] || 16;
      const elapsed = Date.now() - new Date(ongoingFast.start).getTime();
      const pct = Math.min(100, Math.round((elapsed / (target * 3600000)) * 100));
      anytime.push(`Fasting: <strong>${fmtDur(Math.max(0, elapsed))}</strong> in — ${pct}% of your ${esc(ongoingFast.type)} target.`);
    } else {
      anytime.push("Starting a fast? Log it the moment it begins.");
    }
    anytime.push(db.diary.some((d) => d.date === t)
      ? `<span class="flow-good">Today's diary is saved.</span> Add to it if the day surprises you.`
      : "No diary entry yet — keep the day before it disappears.");
    anytime.push("Got a receipt in your pocket? Vault it now, find it in March.");

    /* Write into the timeline */
    const put = (id, items) => {
      const el = $(id);
      if (el) el.innerHTML = items.map((s) => `<li>${s}</li>`).join("");
    };
    put("#flowMorning", morning);
    put("#flowMidday", midday);
    put("#flowEvening", evening);
    put("#flowAnytime", anytime);
  }

  /* ---------- 6. QUICK ADD MODAL + JUMP SHORTCUTS ---------- */
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

  function jumpTo(targetSel, focusSel) {
    const target = $(targetSel);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: targetSel.startsWith("#card-") ? "center" : "start" });
    target.classList.remove("card-highlight");
    void target.offsetWidth;
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

  /* --- Day Planner interactions --- */
  // Sliders adjust Rest/Work; Play absorbs the difference. Clamp so
  // Rest + Work never exceeds 24h (Play floors at 0).
  function setDayHours(which, value) {
    const tp = db.timeplan;
    value = Math.max(0, Math.round(value * 2) / 2); // snap to 30-min steps
    const other = which === "rest" ? tp.workHours : tp.restHours;
    if (value + other > 24) value = 24 - other;
    if (which === "rest") tp.restHours = value; else tp.workHours = value;
    renderDayPlanner();          // live feedback while dragging
  }
  $("#restSlider").addEventListener("input", (e) => setDayHours("rest", parseFloat(e.target.value)));
  $("#workSlider").addEventListener("input", (e) => setDayHours("work", parseFloat(e.target.value)));
  $("#restSlider").addEventListener("change", saveData);
  $("#workSlider").addEventListener("change", saveData);

  function addDayTask(name, mins) {
    name = String(name || "").trim();
    mins = parseInt(mins, 10);
    if (!name || !mins) return;
    db.timeplan.tasks.push({ id: uid(), name, mins });
    saveData();
    renderDayPlanner();
  }

  $("#dayTaskForm").addEventListener("submit", (e) => {
    e.preventDefault();
    addDayTask($("#dayTaskName").value, $("#dayTaskMins").value);
    $("#dayTaskName").value = "";
    $("#dayTaskName").focus();
  });

  $("#dayChips").addEventListener("click", (e) => {
    const chip = e.target.closest(".day-chip");
    if (!chip) return;
    addDayTask(chip.dataset.name, chip.dataset.mins);
  });

  // Remove a task from the list…
  $("#dayTaskList").addEventListener("click", (e) => {
    if (!e.target.closest("[data-del]")) return;
    const id = e.target.closest("[data-id]").dataset.id;
    db.timeplan.tasks = db.timeplan.tasks.filter((t) => t.id !== id);
    saveData();
    renderDayPlanner();
  });

  // …or by clicking the slice it occupies in the dial.
  $("#dayDial").addEventListener("click", (e) => {
    const slice = e.target.closest("[data-ti]");
    if (!slice) return;
    const id = slice.dataset.ti;
    db.timeplan.tasks = db.timeplan.tasks.filter((t) => t.id !== id);
    saveData();
    renderDayPlanner();
  });

  /* ---------- 7. SCROLL-REVEAL ---------- */
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

  /* ---------- 8. BOOT ---------- */
  $("#evDate").value = todayISO();
  $("#medStart").value = todayISO();
  $("#medEnd").disabled = true;          // "Ongoing" starts checked
  $("#fastStart").value = toLocalDT(new Date());
  renderAll();
});
