/* ---------- How to use: a short tour that spotlights the real buttons (like Tiffo's) ---------- */
const Tour = (() => {
  const STEPS = [
    { tab: "home", el: ".hero-actions [data-tab=kitchen]", title: "Start with your kitchen", text: "Pantry → Plate only suggests recipes you can make with food you actually have. So the first step is telling it what's in your kitchen." },
    { tab: "kitchen", el: "#quickAdd", title: "Type what you have", text: "Write it the way you'd say it: “6 eggs, 1 kg rice, half a cabbage, 2 cans tuna”. Press Enter and check the list before it's added." },
    { tab: "kitchen", el: "[data-act=scan-photo]", title: "Or scan it", text: "Take a photo of your fridge, shelf or a receipt. The free AI suggests what it sees, and nothing is added until you've checked it. Needs internet and a Puter sign-in." },
    { tab: "kitchen", el: "#basicsAsk .basics, #staples", title: "Tick your basics", text: "Salt, oil, sugar, soy sauce… Recipes never assume you have them. Tick the ones you keep so recipes can count on them." },
    { tab: "kitchen", el: "#kitchenList", title: "Your kitchen, sorted by freshness", text: "Food that needs using soon rises to the top. Tap anything to set its amount, where it's kept, or when you bought or opened it." },
    { tab: "cook", el: "#modes", title: "Choose how to cook", text: "Save urgent food first, use the most, build a meal around one food, or use everything with a few dishes." },
    { tab: "cook", el: "#ideas", title: "Recipes you can make right now", text: "Every recipe here only uses what's in your kitchen. If a dish just needs a basic you haven't ticked, it shows up under “Almost there”." },
    { tab: "cook", el: "#detail", title: "Open a recipe", text: "Change the servings, see swaps, then press Start cooking for a step-by-step mode with timers. When you're done, “I made this” takes what you used out of your kitchen." },
    { tab: "plan", el: "#planTools", title: "Plan your meals", text: "Fill the week from your kitchen, see what you'd run short of, and get a shopping list of only the missing things." },
    { tab: "rescue", el: "#rescueBody", title: "Rescue my food", text: "Something about to spoil? Pick it here for quick ways to use it, freeze it or keep it longer." },
    { tab: "saved", el: "#savedGrid", title: "Saved recipes", text: "Recipes you keep, sorted into your own collections." },
    { tab: "home", el: "#aiStatus", title: "The free AI (optional)", text: "Sign in with Puter for AI recipe ideas, scanning, realistic dish photos and syncing your kitchen to other devices. Everything else works without it, even offline." },
    { tab: "kitchen", el: "#quickAdd", title: "Your turn!", text: "Type a few things you have now, like “4 eggs, bread, cheese”.", last: true },
  ];
  let i = 0, el = null, onKey = null, onPos = null;
  const $ = s => document.querySelector(s);
  const target = sel => [...document.querySelectorAll(sel)].find(x => x.getClientRects().length && getComputedStyle(x).visibility !== "hidden") || null;
  function open(step = 0) {
    i = step; $("#tour").hidden = false; document.body.classList.add("touring");
    onKey = e => { if (e.key === "Escape") close(); else if (e.key === "ArrowRight") move(1); else if (e.key === "ArrowLeft") move(-1); };
    onPos = () => place();
    document.addEventListener("keydown", onKey); window.addEventListener("resize", onPos); window.addEventListener("scroll", onPos, true);
    show(1);
  }
  function close() {
    $("#tour").hidden = true; document.body.classList.remove("touring");
    document.removeEventListener("keydown", onKey); window.removeEventListener("resize", onPos); window.removeEventListener("scroll", onPos, true);
    try { localStorage.setItem("p2p.tourSeen", "1"); } catch (e) {}
    renderLink();
  }
  function move(d) {
    if (i + d >= STEPS.length) { close(); setTab("kitchen"); setTimeout(() => { const q = $("#qaText"); if (q) q.focus(); }, 60); return; }
    i = Math.max(0, i + d); show(d);
  }
  function show(dir) {
    const st = STEPS[i];
    if (S.tab !== st.tab) setTab(st.tab, true);
    el = target(st.el);
    if (!el && i > 0 && i < STEPS.length - 1) { i += dir > 0 ? 1 : -1; return show(dir); } // not on screen right now: skip it
    $("#tourCount").textContent = `${i + 1} of ${STEPS.length}`;
    $("#tourTitle").textContent = st.title; $("#tourText").textContent = st.text;
    $("#tourBack").style.visibility = i === 0 ? "hidden" : "visible";
    $("#tourNext").textContent = st.last ? "Start typing" : "Next";
    if (el) { // put the highlight high enough that the card fits underneath it
      const r = el.getBoundingClientRect(), H = usableH(), th = $("#tourTip").offsetHeight || 190;
      const want = Math.max(topBar() + 14, (H - Math.min(r.height, H) - th - 20) / 2);
      window.scrollBy(0, r.top - want);
    }
    place(); $("#tourNext").focus({ preventScroll: true });
    setTimeout(place, 80);
  }
  // Space the fixed header (desktop) and bottom tab bar (phones) take up, so nothing hides behind them.
  function topBar() { const h = document.querySelector("header"); if (!h) return 0; const s = getComputedStyle(h); return (s.position === "sticky" || s.position === "fixed") ? Math.max(0, h.getBoundingClientRect().bottom) : 0; }
  function usableH() { const n = document.querySelector("nav[aria-label=Sections]"); if (n) { const r = n.getBoundingClientRect(), s = getComputedStyle(n); if (s.position === "fixed" && r.top > innerHeight / 2) return r.top; } return innerHeight; }
  function place() {
    const spot = $("#tourSpot"), tip = $("#tourTip"); if (!spot || $("#tour").hidden) return;
    const W = innerWidth, H = usableH(), tw = tip.offsetWidth, th = tip.offsetHeight, gap = 12;
    if (!el) { Object.assign(spot.style, { left: W / 2 + "px", top: H / 2 + "px", width: "0px", height: "0px" }); Object.assign(tip.style, { left: (W - tw) / 2 + "px", top: (H - th) / 2 + "px" }); return; }
    const r = el.getBoundingClientRect(), pad = 6;
    const top0 = Math.max(4, r.top - pad); let h = Math.min(r.height + pad * 2, H - 8 - top0);
    let top;
    if (top0 + h + gap + th <= H - 8) top = top0 + h + gap;                 // room below
    else if (top0 - gap - th >= 8) top = top0 - gap - th;                   // room above
    else { h = Math.max(40, H - 8 - th - gap - top0); top = top0 + h + gap; } // a big area: show its top part, card underneath
    Object.assign(spot.style, { left: r.left - pad + "px", top: top0 + "px", width: r.width + pad * 2 + "px", height: Math.max(h, 0) + "px" });
    top = Math.min(top, H - th - 8);
    const left = Math.min(Math.max(8, r.left + r.width / 2 - tw / 2), W - tw - 8);
    Object.assign(tip.style, { left: left + "px", top: top + "px" });
  }
  function seen() { try { return !!localStorage.getItem("p2p.tourSeen"); } catch (e) { return true; } }
  /* Home shows "New here? See how it works" until the tour has been seen, then a quieter "How to use" link. */
  function renderLink() {
    const box = $("#howToUse"); if (!box) return;
    const light = document.documentElement.dataset.theme === "light";
    const themeSwitch = `<span class="theme-pick" role="group" aria-label="Colour theme"><span class="label">Theme</span><button class="chip" data-act="theme" data-theme="green" aria-pressed="${!light}">Forest green</button><button class="chip" data-act="theme" data-theme="light" aria-pressed="${light}">Light</button></span>`;
    box.innerHTML = themeSwitch + (seen()
      ? `<button class="linkbtn howto-quiet" data-act="tour">${icon("info")}How to use Pantry → Plate</button>`
      : `<button class="linkbtn howto-new" data-act="tour">${icon("spark")}New here? See how Pantry → Plate works →</button>`);
  }
  return { open, close, move, renderLink, steps: STEPS };
})();
