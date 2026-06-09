/* ============================================================
   DAYVAULT — script.js
   All interactions are progressive enhancements:
   1. Scroll-reveal animations (IntersectionObserver)
   2. Animated progress bars when they enter the viewport
   3. Habit toggles + live "x / 7 today" counter
   4. Quick Add floating button + modal (demo UI, no storage)
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {

  /* ------------------------------------------------------------
     1. SCROLL-REVEAL
     Elements with .reveal fade/slide in when ~15% visible.
     A small stagger is added per sibling for a premium feel.
  ------------------------------------------------------------ */
  const revealEls = document.querySelectorAll(".reveal");

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      // Stagger based on position among currently-hidden siblings
      const siblings = [...el.parentElement.children].filter(
        (s) => s.classList && s.classList.contains("reveal")
      );
      const index = siblings.indexOf(el);
      el.style.transitionDelay = `${Math.min(index * 90, 450)}ms`;
      el.classList.add("visible");
      revealObserver.unobserve(el); // animate once only
    });
  }, { threshold: 0.15 });

  revealEls.forEach((el) => revealObserver.observe(el));


  /* ------------------------------------------------------------
     2. ANIMATED PROGRESS BARS
     Bars start at width 0 (CSS) and grow to their data-width
     when they scroll into view. Covers: money categories,
     daily budget, featured project, and mini projects.
  ------------------------------------------------------------ */
  const bars = document.querySelectorAll("[data-width]");

  const barObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const bar = entry.target;
      // Small delay so the card's reveal animation lands first
      setTimeout(() => {
        bar.style.width = bar.dataset.width;
      }, 350);
      barObserver.unobserve(bar);
    });
  }, { threshold: 0.4 });

  bars.forEach((bar) => barObserver.observe(bar));


  /* ------------------------------------------------------------
     3. HABIT TOGGLES
     Each habit is a <button>. Clicking toggles .done and
     aria-pressed, then updates the "x / 7 today" tag.
     (Task checkboxes are native inputs — CSS handles those.)
  ------------------------------------------------------------ */
  const habits = document.querySelectorAll(".habit");
  const habitCount = document.getElementById("habitCount");

  function updateHabitCount() {
    if (!habitCount) return;
    const done = document.querySelectorAll(".habit.done").length;
    habitCount.textContent = `${done} / ${habits.length} today`;
  }

  habits.forEach((habit) => {
    habit.addEventListener("click", () => {
      const isDone = habit.classList.toggle("done");
      habit.setAttribute("aria-pressed", String(isDone));
      updateHabitCount();
    });
  });


  /* ------------------------------------------------------------
     4. QUICK ADD — FAB + MODAL
     Flow: options grid → tiny form → "captured" confirmation.
     Pure UI demo: nothing is persisted.
  ------------------------------------------------------------ */
  const fab        = document.getElementById("quickAddBtn");
  const overlay    = document.getElementById("quickAddModal");
  const closeBtn   = document.getElementById("modalCloseBtn");
  const options    = document.getElementById("modalOptions");
  const form       = document.getElementById("modalForm");
  const formLabel  = document.getElementById("formLabel");
  const formInput  = document.getElementById("formInput");
  const backBtn    = document.getElementById("formBackBtn");
  const doneState  = document.getElementById("modalDone");

  // Per-kind labels and placeholders for the mini form
  const KIND_COPY = {
    "expense":   { label: "What did you spend?",        placeholder: "e.g. €3.50 — coffee" },
    "task":      { label: "What needs doing?",          placeholder: "e.g. Pay rent (must)" },
    "note":      { label: "What should you remember?",  placeholder: "e.g. Embassy ring bell B" },
    "project":   { label: "Name the project",           placeholder: "e.g. Thesis draft" },
    "document":  { label: "Label the document",         placeholder: "e.g. Rent receipt — June" },
    "follow-up": { label: "Who, and about what?",       placeholder: "e.g. Reply to Salim — visa letter" }
  };

  // Show one of the modal's three internal states
  function showStep(step) {
    options.hidden   = step !== "options";
    form.hidden      = step !== "form";
    doneState.hidden = step !== "done";
  }

  function openModal() {
    overlay.hidden = false;
    // Next frame so the CSS transition can run
    requestAnimationFrame(() => overlay.classList.add("open"));
    showStep("options");
    document.body.style.overflow = "hidden"; // lock page scroll
  }

  function closeModal() {
    overlay.classList.remove("open");
    document.body.style.overflow = "";
    // Wait for the fade-out transition before hiding entirely
    setTimeout(() => { overlay.hidden = true; }, 300);
  }

  fab.addEventListener("click", openModal);
  closeBtn.addEventListener("click", closeModal);

  // Click outside the modal card closes it
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });

  // Escape key closes it
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !overlay.hidden) closeModal();
  });

  // Step 1 → Step 2: choosing a kind opens the mini form
  options.addEventListener("click", (e) => {
    const btn = e.target.closest(".m-opt");
    if (!btn) return;
    const copy = KIND_COPY[btn.dataset.kind];
    formLabel.textContent = copy.label;
    formInput.placeholder = copy.placeholder;
    formInput.value = "";
    showStep("form");
    formInput.focus();
  });

  // Back returns to the options grid
  backBtn.addEventListener("click", () => showStep("options"));

  // Step 2 → Step 3: "save" shows the confirmation, then closes
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    showStep("done");
    setTimeout(closeModal, 1600);
  });


  /* ------------------------------------------------------------
     5. SMOOTH SCROLL FALLBACK
     CSS `scroll-behavior: smooth` covers modern browsers; this
     adds explicit handling so the hero/CTA buttons always work,
     including the sticky-nav offset.
  ------------------------------------------------------------ */
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (e) => {
      const id = link.getAttribute("href");
      if (id.length <= 1) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

});
