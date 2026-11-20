/* =====================================================================
   APP: state, saving, and every screen. The engine (engine.js) does the
   thinking; this file only shows things and reacts to taps.
   ===================================================================== */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);
const E = Engine;
const LIB = RECIPES;
/* Draw the illustrated plate, then swap in a real photo if one exists and loads. */
const PHOTO_BASE = "img/";
function paint(cv, r) {
  if (!cv || !r) return;
  drawPlate(cv, r, null);
  const ph = PHOTOS[r.id]; if (!ph) return;
  const img = new Image(); img.alt = r.title + (ph.ai ? " (AI-generated image)" : ""); img.decoding = "async"; img.loading = "lazy";
  img.className = cv.className + " dish-photo"; img.referrerPolicy = "no-referrer";
  img.onload = () => { if (cv.isConnected) { cv.replaceWith(img); requestAnimationFrame(() => img.classList.add("in")); } };
  img.src = ph.url || PHOTO_BASE + ph.file;
}
const GROUP_COLORS = { check: "var(--urgent)", first: "#C2410C", soon: "#B7791F", fresh: "var(--accent)", long: "#7A8A9A" };
const CUISINES = ["Filipino","Chinese","Japanese","Korean","Italian","American","Mexican","Southeast Asian","Middle Eastern","French","Any"];

/* ---------- State ---------- */
const S = {
  tab: "home", pantry: [], staples: [], saved: [], collections: [], week: [], history: [], plan: { days: {} }, cooking: null,
  prefs: { servings: null, maxTime: 0, cuisine: "any", diet: [], equipment: ["stove", "blender"], kind: "meals", v: 2 },
  sample: false, savedAt: 0,
  ui: { loc: "all", sort: "fresh", mode: "urgent", focus: [], pins: [], currentId: null, oneId: null, aiRecipes: [], aiBusy: false, servingsOverride: {}, planRange: "week", rescueId: null },
  aiChecking: true
};
const STORE_KEY = "p2p.v3";
function snapshot() { return { v: 3, owner: S.owner || null, feedback: S.feedback || {}, pantry: S.pantry, staples: S.staples, saved: S.saved, collections: S.collections, week: S.week, history: S.history, plan: S.plan, cooking: S.cooking, prefs: S.prefs, sample: S.sample, savedAt: S.savedAt || 0 }; }
function saveLocal() { try { localStorage.setItem(STORE_KEY, JSON.stringify(snapshot())); } catch (e) {} }
// Each save is always newer than anything this device has already seen, even if another device's clock runs ahead.
function persist() { S.savedAt = Math.max(Date.now(), (S.savedAt || 0) + 1); saveLocal(); if (typeof Cloud !== "undefined") Cloud.schedule(); }
function applySnapshot(d) {
  if (!d) return;
  if (d.v !== 3) d = migrateV2(d);
  // Older saves had no cooking date. Only leftovers the app made itself ("I made this") were really cooked on the day
  // they were added; anything typed in might be older, so it gets no date and the person is asked.
  const madeHere = p => p.key === "leftover" && p.unit === "servings" && /^Leftover /.test(p.name || "");
  S.pantry = (d.pantry || []).map(p => E.newItem((p.cooked || (E.ING[p.key] || {}).isCooked) && !p.cookedOn && !p.unknownAge && p.loc !== "freezer" && madeHere(p) ? { ...p, cookedOn: p.added } : p));
  S.feedback = d.feedback || {};
  S.staples = Array.isArray(d.staples) ? d.staples : E.DEFAULT_STAPLES.slice();
  S.saved = d.saved || []; S.collections = d.collections || []; S.week = d.week || [];
  S.plan = d.plan && d.plan.days ? d.plan : { days: {} }; S.cooking = d.cooking && d.cooking.rid ? d.cooking : null;
  S.history = d.history || []; S.prefs = Object.assign({ servings: null, maxTime: 0, cuisine: "any", diet: [], equipment: ["stove", "blender"], kind: "meals" }, d.prefs || {});
  if ((S.prefs.v || 1) < 2) { if (!S.prefs.equipment.includes("blender")) S.prefs.equipment.push("blender"); S.prefs.kind = S.prefs.kind || "meals"; S.prefs.v = 2; }
  S.owner = d.owner || null;
  S.sample = !!d.sample; S.savedAt = d.savedAt || 0;
}
/* Older versions stored "days left" as a fixed number. Keep everything, convert it to dates. */
function migrateV2(d) {
  // "days left" in the old format were counted from when it was last saved, not from today
  const today = d.savedAt > 0 && d.savedAt <= Date.now() ? E.todayISO(new Date(d.savedAt)) : E.todayISO();
  const pantry = (d.pantry || []).map(o => {
    const parts = String(o.qty || "").split(",").map(x => x.trim()).filter(Boolean);
    const tries = (parts.length ? parts : [""]).map(q => E.parseIngredientText((q ? q + " " : "") + o.name).slice(-1)[0] || {});
    const parsed = tries.find(t => ["g", "kg", "ml", "l", "cup"].includes(t.unit)) || tries[0] || {};
    return { name: o.name, key: parsed.key || E.resolveKey(o.name), qty: parsed.qty ?? null, unit: parsed.unit || null, loc: parsed.loc,
      cooked: parsed.cooked, added: today, est: null, notes: "" }; // the old "days left" was a default, not a date the person chose: use the normal food estimate
  });
  const staples = (d.staples || []).filter(s => s.on).map(s => E.resolveKey(s.name)).filter(Boolean);
  const saved = (d.saved || []).map(z => ({ id: z.id || uid(), col: z.col || "", at: z.at || 0, ...(LIB.find(r => r.title === z.recipe?.title) ? { rid: LIB.find(r => r.title === z.recipe.title).id } : { recipe: legacyRecipe(z.recipe) }) }));
  return { v: 3, pantry, staples: staples.length ? staples : E.DEFAULT_STAPLES.slice(), saved, collections: d.collections || [], week: d.week || [], history: [], prefs: null, sample: false, savedAt: d.savedAt || 0 };
}
function legacyRecipe(r) {
  if (!r) return null;
  return { id: "legacy-" + uid(), ai: true, title: r.title, cuisine: r.cuisine || "Any", style: "Home-style", desc: r.verdict || "", serves: r.servings || 2, prep: r.prep || 10, cook: r.cook || 15,
    difficulty: "Easy", equip: ["stove"], q: 4, plating: r.plating || "plate", palette: r.palette || ["#E9D7A8","#C98B4A","#5E8C3A","#F7F3EA"],
    ingredients: (r.ingredients || []).map(i => ({ k: E.resolveKey(i.name), n: i.name, q: null, u: null, amountText: i.amount || "" })),
    steps: r.steps || [], season: "", store: "Refrigerate leftovers within 2 hours and eat within 3 days. Reheat until steaming hot." };
}
function seedKitchen() {
  const t = E.todayISO(), ago = n => E.addDays(t, -n);
  S.pantry = [];
  E.addToPantry(S.pantry, [
    { name: "Leftover rice", key: "rice_cooked", qty: 2, unit: "cup", loc: "fridge", added: t, cookedOn: t },
    { name: "Leftover chicken", key: "chicken_cooked", qty: 1, unit: "cup", loc: "fridge", added: ago(1), cookedOn: ago(1) },
    { name: "Spinach", key: "spinach", qty: 150, unit: "g", loc: "fridge", added: ago(1) },
    { name: "Eggs", key: "egg", qty: 6, unit: "pcs", loc: "fridge", added: ago(5) },
    { name: "Cabbage", key: "cabbage", qty: 0.5, unit: "pcs", loc: "fridge", added: ago(4) },
    { name: "Carrots", key: "carrot", qty: 2, unit: "pcs", loc: "fridge", added: ago(4) },
    { name: "Tomatoes", key: "tomato", qty: 3, unit: "pcs", loc: "pantry", added: ago(2) },
    { name: "Bananas", key: "banana", qty: 2, unit: "pcs", loc: "pantry", added: ago(4) },
    { name: "Potatoes", key: "potato", qty: 4, unit: "pcs", loc: "pantry", added: ago(6) },
    { name: "Spaghetti", key: "pasta_dry", qty: 500, unit: "g", loc: "pantry", added: ago(30) },
    { name: "Canned tuna", key: "tuna", qty: 1, unit: "can", loc: "pantry", added: ago(30) },
    { name: "Chicken thighs", key: "chicken", qty: 500, unit: "g", loc: "freezer", added: ago(10) },
    { name: "Milk", key: "milk", qty: 500, unit: "ml", loc: "fridge", added: ago(1), opened: true, openedOn: ago(1) }
  ]);
  S.staples = E.DEFAULT_STAPLES.concat(["onion", "fish_sauce", "flour"]);
  S.collections = ["Weeknight", "Fridge clean-out"];
  S.saved = []; S.week = []; S.history = []; S.sample = true;
}
function load() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(STORE_KEY) || "null"); } catch (e) {}
  let migrated = false;
  if (!d) { try { const old = JSON.parse(localStorage.getItem("p2p.v2") || "null"); if (old && Array.isArray(old.pantry)) { d = migrateV2(old); migrated = true; } } catch (e) {} }
  if (d) applySnapshot(d); else seedKitchen();
  if (migrated) saveLocal(); // convert old data once, so its dates don't move forward on every visit
}
function resetToSample() { try { localStorage.removeItem(STORE_KEY); } catch (e) {} seedKitchen(); S.savedAt = 0; S.owner = null; }
/* After signing in on a device that had its own kitchen: ask before combining. */
function offerMerge(local) {
  S.ui.pendingMerge = local;
  const n = (local.pantry || []).length, r = (local.saved || []).length;
  openModal(`<h2 id="authTitle">Add this device's kitchen to your account?</h2>
    <p>Your account's kitchen is now showing. Before you signed in, this device also had ${n} food${n === 1 ? "" : "s"}${r ? " and " + r + " saved recipe" + (r === 1 ? "" : "s") : ""}.</p>
    <div class="form-actions"><button class="btn primary" data-act="merge-yes">Add them to my account</button><button class="linkbtn" data-act="merge-no">No, keep my account as it is</button></div>`);
}
function rerender() { setTab(S.tab, true); }

/* ---------- Helpers ---------- */
const fr = p => E.freshness(p);
const usable = () => E.usableItems(S.pantry);
function opts(extra = {}) {
  return { mode: S.ui.mode, prefs: S.prefs, maxTime: S.prefs.maxTime || 0, cuisine: S.prefs.cuisine, servings: S.prefs.servings || null, kind: S.prefs.kind || "meals", ...extra };
}
function allRecipes() { return LIB.concat(S.ui.aiRecipes); }
function getRecipe(id) { return allRecipes().find(r => r.id === id) || (S.saved.find(z => z.recipe && z.recipe.id === id) || {}).recipe || null; }
function match(r, extra = {}) {
  const sv = S.ui.servingsOverride[r.id] || S.prefs.servings || null;
  return E.fitMatch(r, S.pantry, S.staples, opts({ servings: sv, ...extra }));
}
function owns(name) {
  const k = E.resolveKey(name); if (!k) return null;
  const it = usable().find(x => x.p.key === k); if (it) return { item: it.p };
  if (S.staples.includes(k)) return { item: { name: E.ingName(k) } };
  return null;
}
/* Things you can't split nicely (eggs, garlic cloves) show as whole numbers when a recipe is scaled. */
function niceAmount(q, u, k) {
  if (q != null && (k === "egg" || u === "clove") && Math.abs(q - Math.round(q)) > 0.01) return E.fmtAmount(Math.max(1, Math.round(q)), u) + (k === "egg" ? "" : "");
  return E.fmtAmount(q, u);
}
function amountLabel(p) { return p.qty == null ? "Amount not recorded" : E.fmtAmount(p.qty, p.unit) + (p.unit === "pcs" || !p.unit ? "" : ""); }
/* Four-pointed twinkle stars: the "shine" used for every success. */
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0C12.8 7.2 16.8 11.2 24 12 16.8 12.8 12.8 16.8 12 24 11.2 16.8 7.2 12.8 0 12 7.2 11.2 11.2 7.2 12 0Z"/></svg>';
const STAR_COLS = ["#F4B400", "#FFD35C", "#9BB8AC", "#2E6B5A", "#FFFFFF"];
function reducedMotion() { return matchMedia("(prefers-reduced-motion: reduce)").matches; }
/* Twinkle a few stars around an element (or a CSS selector). */
function sparkle(target, n = 5) {
  if (reducedMotion()) return;
  const el = typeof target === "string" ? document.querySelector(target) : target; if (!el) return;
  const r = el.getBoundingClientRect(); if (!r.width) return;
  const layer = document.createElement("div"); layer.className = "sparkles"; layer.setAttribute("aria-hidden", "true");
  for (let i = 0; i < n; i++) {
    const s = document.createElement("i"), size = 9 + Math.random() * 13, edge = Math.random() < .5;
    const x = edge ? (Math.random() < .5 ? r.left - 6 : r.right - 8) : r.left + Math.random() * r.width;
    const y = edge ? r.top + Math.random() * r.height : (Math.random() < .5 ? r.top - 10 : r.bottom - 8);
    s.innerHTML = STAR; s.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px;color:${STAR_COLS[i % 3]};animation-delay:${i * 70 + Math.random() * 120}ms`;
    layer.appendChild(s);
  }
  document.body.appendChild(layer); setTimeout(() => layer.remove(), 1600);
}
/* Finishing a meal: a burst of stars from the middle of the screen. */
function celebrate() {
  if (reducedMotion()) return;
  const box = document.createElement("div"); box.className = "celebrate"; box.setAttribute("aria-hidden", "true");
  const cx = innerWidth / 2, cy = innerHeight * .45;
  for (let i = 0; i < 26; i++) {
    const p = document.createElement("i"), ang = (i / 26) * Math.PI * 2 + Math.random() * .3, dist = 90 + Math.random() * Math.min(innerWidth, 520) * .45, size = 10 + Math.random() * 18;
    p.innerHTML = STAR; p.style.cssText = `left:${cx}px;top:${cy}px;width:${size}px;height:${size}px;color:${STAR_COLS[i % STAR_COLS.length]};--x:${Math.cos(ang) * dist}px;--y:${Math.sin(ang) * dist}px;animation-delay:${Math.random() * 160}ms`;
    box.appendChild(p);
  }
  document.body.appendChild(box); setTimeout(() => box.remove(), 1900);
}
let tt; function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("show"), 3800); }
function openModal(html, focusSel) { $("#authBox").innerHTML = html; $("#authModal").hidden = false; const f = focusSel ? $("#authBox " + focusSel) : $("#authBox input, #authBox button"); if (f) f.focus(); }
function closeAuth() { $("#authModal").hidden = true; }

/* ---------- Tabs ---------- */
const TABS = ["home", "kitchen", "cook", "saved"];
const RENDER = { home: () => renderHome(), kitchen: () => renderKitchen(), cook: () => renderCook(), saved: () => renderSaved() };
function setTab(t, keepScroll) {
  if (!TABS.includes(t)) t = "home";
  S.tab = t;
  document.querySelectorAll(".view").forEach(v => v.hidden = v.id !== "view-" + t);
  document.querySelectorAll("nav button").forEach(b => { if (b.dataset.tab === t) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  if (location.hash.slice(1) !== t) history.replaceState(null, "", "#" + t);
  RENDER[t]();
  renderNavCounts(); renderCookbar();
  if (!keepScroll) window.scrollTo({ top: 0 });
}
function renderNavCounts() { $("#navKitchen").textContent = S.pantry.length || ""; $("#navSaved").textContent = S.saved.length || "";
  const n = S.pantry.filter(p => ["check", "first"].includes(fr(p).group)).length; $("#navRescue").textContent = n || ""; }

/* =====================================================================
   HOME
   ===================================================================== */
function renderHome() {
  const items = S.pantry.map(p => ({ p, f: fr(p) }));
  const check = items.filter(x => x.f.group === "check");
  $("#homeAlert").innerHTML = check.length ? `<button class="alert" data-act="tab" data-tab="rescue">${icon("stop")}<b>${check.length} food${check.length > 1 ? "s" : ""} may not be safe to eat.</b> See what to do in Rescue my food →</button>` : "";
  const urgent = items.filter(x => x.f.group === "first" || x.f.group === "soon").sort((a, b) => (a.f.daysLeft ?? 99) - (b.f.daysLeft ?? 99)).slice(0, 6);
  $("#homeUse").innerHTML = urgent.length ? `<ul class="uselist">${urgent.map(({ p, f }) => `<li><button class="rowbtn plain" data-act="rescue-item" data-id="${p.id}">${foodArt(p)}<span class="ul-t"><span><b>${esc(p.name)}</b> <span class="muted">${esc(amountLabel(p))}</span></span><small>${esc(f.note)}</small></span>${freshBadge(f)}</button></li>`).join("")}</ul>`
    : S.pantry.length ? emptyState("basket", "Nothing urgent", "Your kitchen is in good shape. Nothing needs using in the next few days.")
    : emptyState("fridge", "Your kitchen is empty", "Add the food you have and I'll show what to use first.", `<button class="btn primary" data-act="tab" data-tab="kitchen">Add food</button>`);
  const cooking = S.cooking && getRecipe(S.cooking.rid);
  const up = upcomingMeals(3);
  $("#homeResume").innerHTML = (cooking ? `<button class="resume" data-act="gc-resume"><span class="resume-ic">${icon("play")}</span><span><span class="label">Continue cooking</span><b>${esc(cooking.title)}</b><small>Step ${S.cooking.step + 1} of ${cooking.steps.length}</small></span>${icon("right")}</button>` : "")
    + (up.length ? `<div class="upcoming"><span class="label">${icon("calendar")}Coming up</span>${up.map(u => `<button class="up-item" data-act="tab" data-tab="plan"><b>${esc(u.r.title)}</b><small>${u.d === E.todayISO() ? "Today" : esc(E.prettyDate(u.d))} · ${esc(u.label)}</small></button>`).join("")}</div>` : "");
  const ranked = E.rankRecipes(allRecipes(), S.pantry, S.staples, opts({ mode: "urgent", servings: S.prefs.servings || null, kind: "meals" }));
  const drink = E.rankRecipes(allRecipes(), S.pantry, S.staples, opts({ mode: "urgent", servings: null, kind: "drinks" }))[0];
  const pick = ranked[0];
  $("#homePick").innerHTML = pick ? `<div class="pick-hero"><canvas width="240" height="300" id="homePickCanvas" aria-hidden="true"></canvas>
      <div><span class="label">${esc(pick.recipe.cuisine)} · ${pick.recipe.prep + pick.recipe.cook} min · ${esc(pick.recipe.difficulty || "Easy")}</span>
      <h3>${esc(pick.recipe.title)}</h3><p>${esc(pick.recipe.desc)}</p>
      <p class="why">${whyLine(pick)}</p>
      <button class="btn primary" data-act="open-recipe" data-id="${esc(pick.recipe.id)}">Cook this</button></div></div>`
    : `<p class="muted">Add a few foods and I'll suggest something.</p>`;
  if (pick) paint($("#homePickCanvas"), pick.recipe);
  const row = (m, pre = "") => `<li><button class="rowbtn" data-act="open-recipe" data-id="${esc(m.recipe.id)}"><b>${pre}${esc(m.recipe.title)}</b><span>${m.recipe.prep + m.recipe.cook} min · uses ${m.usedCount} of your foods${m.urgentUsed.length ? " · saves " + m.urgentUsed.length + " that need using" : ""}</span></button></li>`;
  $("#homeQuick").innerHTML = ranked.length > 1 || drink ? `<ul class="quicklist">${ranked.slice(1, 4).map(m => row(m)).join("")}${drink ? row(drink, "Drink: ") : ""}</ul>` : `<p class="muted">More ideas appear as you add food.</p>`;
  const meals = S.history.length, used = S.history.reduce((n, h) => n + (h.used || []).length, 0);
  $("#hProg").textContent = meals ? "Recently cooked" : "How it works";
  $("#homeProgress").innerHTML = meals
    ? `<ul class="quicklist">${S.history.slice(-3).reverse().map(h => `<li><button class="rowbtn" data-act="open-recipe" data-id="${esc(h.rid || "")}"${getRecipe(h.rid) ? "" : " disabled"}><b>${esc(h.title)}</b><span>${E.prettyDate(E.todayISO(new Date(h.at)))} · ${h.servings} serving${h.servings > 1 ? "s" : ""} · cook again</span></button></li>`).join("")}</ul>
       <p class="muted small">${meals} meal${meals > 1 ? "s" : ""} cooked from your kitchen, ${used} food${used === 1 ? "" : "s"} used up.</p>`
    : `<ol class="steps3">
         <li><span class="n">1</span><div><b>Add your food</b><span>Type it the way you'd say it: "3 eggs, half a cabbage, leftover adobo".</span></div></li>
         <li><span class="n">2</span><div><b>See what to use first</b><span>Freshness estimates put food that's about to spoil at the top.</span></div></li>
         <li><span class="n">3</span><div><b>Cook something delicious</b><span>Recipes use only what you have, with smart swaps. Your kitchen updates when you're done.</span></div></li>
       </ol>`;
  $("#homeSample").innerHTML = S.sample ? `<div class="note-bar"><span>You're looking at an <b>example kitchen</b>, so you can try everything right away.</span><button class="btn small" data-act="clear-sample">Start with my own food</button></div>` : "";
}
function whyLine(m) {
  const bits = [];
  if (m.urgentUsed.length) bits.push("Uses " + m.urgentUsed.slice(0, 3).map(p => p.name.toLowerCase()).join(", ") + " before " + (m.urgentUsed.length > 1 ? "they go" : "it goes") + " off");
  if (m.swaps.length) bits.push(m.swaps.length + " easy swap" + (m.swaps.length > 1 ? "s" : ""));
  if (m.scaledDown) bits.push("a smaller batch that fits what you have");
  return esc(bits.join(" · ") || "Made entirely from what you have");
}

/* =====================================================================
   MY KITCHEN
   ===================================================================== */
const ZONES = [
  ["Back of the fridge", "leftovers, opened jars", ["Leftover rice", "Leftover chicken", "Leftovers", "Kimchi", "Opened tomato sauce", "Cooked pasta"]],
  ["Fridge shelves", "dairy, eggs, tofu", ["Eggs", "Milk", "Yogurt", "Cheese", "Tofu", "Ham", "Hotdogs", "Bacon"]],
  ["Crisper drawers", "fruit and vegetables", ["Carrots", "Cabbage", "Tomatoes", "Cucumber", "Bell pepper", "Spring onions", "Spinach", "Calamansi", "Ginger", "Eggplant"]],
  ["Fridge door", "sauces and condiments", ["Butter", "Mayonnaise", "Ketchup", "Oyster sauce", "Fish sauce", "Gochujang"]],
  ["Fruit bowl & counter", "fruit that's ripening", ["Bananas", "Mangoes", "Pineapple", "Ripe papaya", "Avocado", "Oranges", "Apples", "Watermelon", "Calamansi"]],
  ["Freezer", "meat, fish, frozen veg", ["Chicken thighs", "Ground pork", "Fish fillets", "Shrimp", "Longganisa", "Frozen peas", "Bread"]],
  ["Cupboard & counter", "dry goods, cans, produce", ["Rice", "Pasta", "Instant noodles", "Canned tuna", "Canned tomatoes", "Corned beef", "Coconut milk", "Onions", "Potatoes", "Bananas"]]
];
const ZONE_LOC = { "Freezer": "freezer", "Cupboard & counter": "pantry", "Fruit bowl & counter": "pantry" };
function renderKitchen() {
  $("#sampleNote").innerHTML = S.sample && S.ui.welcomeDone ? `<div class="note-bar"><span>This is a <b>sample kitchen</b> so you can see how it works.</span><button class="btn small" data-act="clear-sample">Start with an empty kitchen</button></div>` : "";
  const counts = { all: S.pantry.length, fridge: 0, freezer: 0, pantry: 0 }; S.pantry.forEach(p => counts[p.loc]++);
  $("#locFilters").innerHTML = [["all", "Everything"], ["fridge", "Fridge"], ["freezer", "Freezer"], ["pantry", "Cupboard"]].map(([k, l]) => `<button data-act="loc" data-v="${k}" aria-pressed="${S.ui.loc === k}">${l} <span class="mono muted">${counts[k]}</span></button>`).join("");
  $("#kitchenSort").value = S.ui.sort;
  let items = S.pantry.filter(p => S.ui.loc === "all" || p.loc === S.ui.loc).map(p => ({ p, f: fr(p) }));
  S.ui.pins = S.ui.pins.filter(id => S.pantry.some(p => p.id === id));
  const card = ({ p, f }) => {
    const pinned = S.ui.pins.includes(p.id);
    const twin = S.pantry.some(q => q !== p && q.key === p.key && E.norm(q.name) === E.norm(p.name));
    const tags = [E.LOCS[p.loc], p.cooked ? (p.cookedOn ? "Cooked " + E.prettyDate(p.cookedOn) : "Cooked") : "", p.opened ? "Opened" : "", p.label ? (p.label.type === "useby" ? "Use-by date" : "Best-before date") : "",
      twin && !p.cooked ? "Bought " + E.prettyDate(p.added) : "", p.qty == null ? "Amount not recorded" : ""].filter(Boolean);
    return `<div class="item g-${f.group}${pinned ? " pinned" : ""}${S.ui.fresh && S.ui.fresh.includes(p.id) ? " just-added" : ""}">
      <button class="item-main" data-act="item-edit" data-id="${p.id}" aria-label="Edit ${esc(p.name)}">
        <span class="item-top">${foodArt(p)}<span class="item-id"><span class="name">${esc(p.name)}</span><span class="amt${p.qty == null ? " unknown" : ""}">${esc(amountLabel(p))}</span></span></span>
        <span class="fresh">${freshBadge(f)} <span class="fnote">${esc(f.note)}</span></span>
        <span class="tags">${tags.map(t => `<i>${esc(t)}</i>`).join("")}</span>
      </button>
      ${f.group === "check" ? `<button class="btn small danger" data-act="item-toss" data-id="${p.id}">Throw out</button>`
        : f.group === "first" || f.group === "soon" ? `<button class="btn small pinbtn" data-act="rescue-item" data-id="${p.id}">${icon("rescue")}Rescue it</button>`
        : p.loc === "freezer" ? `<button class="btn small pinbtn" data-act="thaw" data-id="${p.id}">Thaw in the fridge</button>`
        : `<button class="btn small pinbtn" data-act="pin" data-id="${p.id}" aria-pressed="${pinned}">${pinned ? "✓ Cook with this" : "Cook with this"}</button>`}
    </div>`;
  };
  let html = "";
  if (!items.length) html = S.pantry.length ? emptyState(S.ui.loc === "freezer" ? "freezer" : "shelf", "Nothing kept here", S.ui.loc === "freezer" ? "Nothing in the freezer yet. Freezing food that you won't eat in time is one of the easiest ways to waste less." : "Nothing stored here yet.")
    : emptyState("fridge", "Your kitchen is empty", "Type what you have in the box above, scan a photo or receipt, or walk through <b>Check every spot</b> below.");
  else if (S.ui.sort === "fresh") {
    for (const [g, title, desc] of E.GROUPS) {
      const list = items.filter(x => x.f.group === g).sort((a, b) => (a.f.daysLeft ?? 999) - (b.f.daysLeft ?? 999));
      if (!list.length) continue;
      html += `<section class="group"><div class="group-head"><h2 style="--gc:${GROUP_COLORS[g]}">${title} <span class="mono muted">${list.length}</span></h2><p>${desc}</p></div><div class="grid">${list.map(card).join("")}</div></section>`;
    }
  } else {
    const by = { date: (a, b) => (a.f.dateISO || "9999").localeCompare(b.f.dateISO || "9999"), name: (a, b) => a.p.name.localeCompare(b.p.name), loc: (a, b) => a.p.loc.localeCompare(b.p.loc) || a.p.name.localeCompare(b.p.name) }[S.ui.sort];
    html = `<div class="grid">${items.sort(by).map(card).join("")}</div>`;
  }
  $("#kitchenList").innerHTML = html;
  S.ui.fresh = null;
  $("#kitchenWelcome").innerHTML = !S.pantry.length || (S.sample && !S.ui.welcomeDone) ? `<div class="welcome">${ill("basket")}<div><h2>Welcome to your kitchen</h2><p>Add the food you have and Pantry → Plate shows what to use first and what you can cook. Pick any way to start:</p>${S.sample ? `<p class="small">Right now you're looking at an <b>example kitchen</b>. <button class="btn small" data-act="clear-sample">Empty it and add my own food</button></p>` : ""}
    <div class="ways"><button class="way" data-act="focus-add">${icon("list")}<b>Type several at once</b><small>“2 tomatoes, 1 onion, leftover rice”</small></button>
    <button class="way" data-act="item-new">${icon("plus")}<b>Add one with details</b><small>Amount, place and dates</small></button>
    <button class="way" data-act="scan-photo">${icon("camera")}<b>Scan a photo</b><small>${scanAvailable() ? "Uses the free AI; you confirm everything" : "Needs the free AI"}</small></button>
    <button class="way" data-act="${S.pantry.length ? "welcome-done" : "load-sample"}">${icon("spark")}<b>${S.pantry.length ? "Explore the example kitchen" : "Try an example kitchen"}</b><small>${S.pantry.length ? "It's loaded: look around, then empty it" : "See how everything works first"}</small></button></div></div></div>` : "";
  $("#nextStep").innerHTML = S.ui.justAdded && S.pantry.length ? `<div class="nextstep"><div><h2>${icon("check", "ok")}Your kitchen is ready. What would you like to make?</h2></div>
    <div class="ways"><button class="way" data-act="cook-today">${icon("pot")}<b>Find a recipe</b></button><button class="way" data-act="tab" data-tab="rescue">${icon("rescue")}<b>Use food that needs attention</b></button>
    <button class="way" data-act="one-mode">${icon("spark")}<b>Explore one ingredient</b></button><button class="way" data-act="tab" data-tab="plan">${icon("calendar")}<b>Plan several meals</b></button></div></div>` : "";
  renderZones();
  const st = E.DEFAULT_STAPLES.concat(E.OPTIONAL_STAPLES.filter(k => !E.DEFAULT_STAPLES.includes(k)));
  $("#staples").innerHTML = st.map(k => `<label class="chip"><input type="checkbox" data-staple="${k}" ${S.staples.includes(k) ? "checked" : ""}>${esc(E.ingName(k))}</label>`).join("");
  renderNavCounts(); renderCookbar();
}
function renderZones() {
  const box = $("#zones"); if (!box) return;
  const open = [...box.querySelectorAll("details[open]")].map(d => d.dataset.z);
  box.innerHTML = ZONES.map(([z, hint, list]) => `<details class="zone" data-z="${esc(z)}"${open.includes(z) ? " open" : ""}><summary>${esc(z)}<small>${esc(hint)}</small></summary>
    <div class="chips">${list.map(n => { const k = E.resolveKey(n); const has = S.pantry.some(p => (k && p.key === k) || E.norm(p.name) === E.norm(n)); return `<button type="button" data-act="zone-add" data-z="${esc(z)}" data-n="${esc(n)}" class="${has ? "have" : ""}" aria-pressed="${has}">${esc(n)}</button>`; }).join("")}</div></details>`).join("");
}
function addFromText(text, where) {
  const items = E.parseIngredientText(text);
  if (!items.length) { toast("Type at least one food, like “3 eggs”."); return; }
  if (items.some(x => x.uncertain)) { openReview(items); return; }
  commitItems(items);
}
/* A quick look before adding when something's unclear: cooked food (when was it cooked?),
   vague amounts ("a little"), or foods the app doesn't know. Nothing is added until you confirm. */
function openReview(items) {
  S.ui.review = items;
  const unitOpts = u => E.UNITS.map(x => `<option value="${x}"${(u || "pcs") === x ? " selected" : ""}>${x === "pcs" ? "pieces" : x}</option>`).join("");
  const why = x => [x.cooked ? "When was it cooked?" : "", x.vague || x.qty == null ? "How much is there?" : "", !x.key ? "I don't know this food yet: I'll use a cautious estimate." : ""].filter(Boolean).join(" ");
  openModal(`<h2 id="authTitle">Check before adding</h2><p>A few details make the freshness and recipes accurate.</p>
    <form id="reviewForm">${items.map((x, i) => `<div class="rv" data-i="${i}">
      <div class="rv-head"><input type="text" id="rvName${i}" value="${esc(x.name)}" aria-label="Food name"><button type="button" class="linkbtn" data-act="rv-remove" data-i="${i}" aria-label="Don't add ${esc(x.name)}">Remove</button></div>
      <small class="muted">${esc(why(x))}</small>
      <div class="row3"><label>Amount<input type="number" id="rvQty${i}" min="0" step="any" value="${x.qty ?? ""}" placeholder="Not sure"></label>
        <label>Unit<select id="rvUnit${i}">${unitOpts(x.unit || (E.ING[x.key] || {}).u)}</select></label>
        <label>Where<select id="rvLoc${i}">${Object.entries(E.LOCS).map(([k, l]) => `<option value="${k}"${x.loc === k ? " selected" : ""}>${l}</option>`).join("")}</select></label></div>
      ${x.cooked ? `<label>Cooked<select id="rvCooked${i}" data-rvcooked="${i}"><option value="">Choose…</option><option value="0">Today</option><option value="1">Yesterday</option><option value="2">2 days ago</option><option value="3">3 days ago</option><option value="pick">Pick a date</option><option value="unknown">I'm not sure</option></select></label>
        <input type="date" id="rvDate${i}" max="${E.todayISO()}" hidden aria-label="Date it was cooked">` : ""}
    </div>`).join("")}
    <div id="formErr"></div>
    <div class="form-actions"><button class="btn primary" type="submit">Add to my kitchen</button><button class="linkbtn" type="button" data-act="auth-close">Cancel</button></div></form>`, "#reviewForm input");
}
function submitReview() {
  const items = [], errs = [];
  (S.ui.review || []).forEach((x, i) => {
    const row = document.querySelector(`.rv[data-i="${i}"]`); if (!row || row.hidden) return;
    const name = $("#rvName" + i).value.trim(); if (!name) return;
    const qv = $("#rvQty" + i).value, qty = qv === "" ? null : Number(qv);
    if (qty != null && !(qty > 0)) errs.push(`${name}: the amount must be a positive number.`);
    const it = { ...x, name, qty, unit: qty == null ? null : $("#rvUnit" + i).value, loc: $("#rvLoc" + i).value, added: E.todayISO() };
    if (E.norm(name) !== E.norm(x.name)) it.key = E.resolveKey(name);
    if (x.cooked) {
      const c = $("#rvCooked" + i).value;
      if (!c) errs.push(`${name}: choose when it was cooked (or “I'm not sure”).`);
      else if (c === "unknown") it.unknownAge = true;
      else if (c === "pick") { const d = $("#rvDate" + i).value; if (!d || d > E.todayISO()) errs.push(`${name}: pick the date it was cooked.`); else it.cookedOn = d; }
      else it.cookedOn = E.addDays(E.todayISO(), -Number(c));
    }
    items.push(it);
  });
  if (errs.length) { $("#formErr").innerHTML = `<div class="msg err" role="alert">${errs.map(esc).join("<br>")}</div>`; return; }
  closeAuth(); if (items.length) commitItems(items);
}
function commitItems(items) {
  const before = S.pantry.length;
  const r = E.addToPantry(S.pantry, items.map(x => ({ ...x, added: x.added || E.todayISO() })));
  S.sample = false; persist();
  const unknown = r.added.filter(p => !p.key).map(p => p.name);
  let msg = r.added.length ? "Added " + r.added.map(p => p.name).join(", ") : "";
  if (r.merged.length) msg += (msg ? ". " : "") + "Updated " + r.merged.map(p => p.name + " (now " + amountLabel(p) + ")").join(", ");
  if (unknown.length) msg += ". I don't know " + unknown.join(", ") + " yet, so freshness is a cautious estimate: tap it to set a date";
  if (r.added.some(p => S.pantry.some(q => q !== p && q.key === p.key && E.norm(q.name) === E.norm(p.name)))) msg += ". Kept as a separate batch because its dates differ";
  toast(msg + ".");
  S.ui.fresh = r.added.concat(r.merged).map(p => p.id); S.ui.justAdded = true;
  if (S.tab === "kitchen") renderKitchen(); else if (S.tab === "home") renderHome();
  renderNavCounts();
  requestAnimationFrame(() => { document.querySelectorAll(".item.just-added").forEach((el, i) => i < 4 && setTimeout(() => sparkle(el, 4), i * 120)); sparkle("#navKitchen", 3); });
  return S.pantry.length - before;
}

/* ----- Add / edit food ----- */
function itemForm(p) {
  const isNew = !p; p = p || { name: "", qty: null, unit: "pcs", loc: "fridge", added: E.todayISO(), cooked: false, opened: false, label: null, unknownAge: false, notes: "" };
  const unitOpts = E.UNITS.map(u => `<option value="${u}"${(p.unit || "pcs") === u ? " selected" : ""}>${u === "pcs" ? "pieces" : u}</option>`).join("");
  return `<h2 id="authTitle">${isNew ? "Add food" : "Edit " + esc(p.name)}</h2>
  <form id="itemForm" data-id="${isNew ? "" : p.id}" novalidate>
    <label for="fName">What is it?<input type="text" id="fName" value="${esc(p.name)}" required placeholder="e.g. Chicken thighs"></label>
    <div class="row2"><label for="fQty">How much?<input type="number" id="fQty" min="0" step="any" value="${p.qty ?? ""}" placeholder="Optional"></label>
      <label for="fUnit">Unit<select id="fUnit">${unitOpts}</select></label></div>
    <fieldset><legend>Where is it kept?</legend><div class="radios">${Object.entries(E.LOCS).map(([k, l]) => `<label><input type="radio" name="fLoc" value="${k}"${p.loc === k ? " checked" : ""}> ${l}</label>`).join("")}</div></fieldset>
    <label class="check"><input type="checkbox" id="fCooked"${p.cooked ? " checked" : ""}> It's cooked food or leftovers</label>
    <label for="fAdded" id="fAddedWrap"${p.cooked ? " hidden" : ""}>Bought on<input type="date" id="fAdded" value="${esc(p.added || "")}" max="${E.todayISO()}"></label>
    <label for="fCookedOn" id="fCookedWrap"${p.cooked ? "" : " hidden"}>Cooked on<input type="date" id="fCookedOn" value="${esc(p.cookedOn || "")}" max="${E.todayISO()}"></label>
    <label class="check"><input type="checkbox" id="fUnknown"${p.unknownAge ? " checked" : ""}> I'm not sure when it was made or bought</label>
    <label class="check"><input type="checkbox" id="fOpened"${p.opened ? " checked" : ""}> The package is open</label>
    <label for="fOpenedOn" id="fOpenedWrap"${p.opened ? "" : " hidden"}>Opened on<input type="date" id="fOpenedOn" value="${esc(p.openedOn || "")}" max="${E.todayISO()}"></label>
    <fieldset><legend>Expiry date (optional)</legend>
      <div class="row2"><label for="fLabelType" class="sr">Type of date</label><select id="fLabelType"><option value="">No date: estimate for me</option><option value="useby"${p.label?.type === "useby" ? " selected" : ""}>Use by / Expiry (printed, safety)</option><option value="bestbefore"${p.label?.type === "bestbefore" ? " selected" : ""}>Best before (printed, quality)</option><option value="own"${!p.label && p.est ? " selected" : ""}>My own use-by date</option></select>
      <label for="fLabelDate" class="sr">Date</label><input type="date" id="fLabelDate" value="${esc(p.label?.date || p.est || "")}"></div>
      <p class="hint">A <b>use-by</b> date is about safety: don't eat after it. A <b>best-before</b> date is about quality. Use <b>my own date</b> for homemade food or anything without a label.</p></fieldset>
    <label for="fNotes">Notes (optional)<input type="text" id="fNotes" value="${esc(p.notes || "")}" maxlength="200"></label>
    <div id="formErr"></div>
    <div class="form-actions"><button class="btn primary" type="submit">${isNew ? "Add to my kitchen" : "Save changes"}</button>
    ${isNew ? "" : `<button class="btn danger" type="button" data-act="item-delete" data-id="${p.id}">Remove</button>`}
    <button class="linkbtn" type="button" data-act="auth-close">Cancel</button></div>
  </form>`;
}
function readItemForm() {
  const v = id => document.getElementById(id);
  const qty = v("fQty").value === "" ? null : Number(v("fQty").value);
  const lt = v("fLabelType").value, ld = v("fLabelDate").value;
  return { name: v("fName").value.trim(), qty, unit: v("fUnit").value, loc: (document.querySelector('input[name="fLoc"]:checked') || {}).value || "fridge",
    cooked: v("fCooked").checked, added: v("fAdded").value || E.todayISO(), cookedOn: v("fCooked").checked ? (v("fCookedOn").value || null) : null, unknownAge: v("fUnknown").checked, opened: v("fOpened").checked,
    openedOn: v("fOpened").checked ? (v("fOpenedOn").value || E.todayISO()) : null,
    label: lt && lt !== "own" && ld ? { type: lt, date: ld } : null, est: lt === "own" && ld ? ld : null, notes: v("fNotes").value.trim() };
}
function submitItemForm(form) {
  const data = readItemForm(), id = form.dataset.id;
  const errs = E.validateItem({ ...data, qty: data.qty });
  if (lt_missing(data)) errs.push("Add the date, or choose “No date: estimate for me”.");
  if (errs.length) { $("#formErr").innerHTML = `<div class="msg err" role="alert">${errs.map(esc).join("<br>")}</div>`; return; }
  if (id) {
    const i = S.pantry.findIndex(p => p.id === id); if (i < 0) return;
    const key = E.norm(data.name) === E.norm(S.pantry[i].name) ? S.pantry[i].key : E.resolveKey(data.name);
    const old = S.pantry[i];
    const thawedOn = old.loc === "freezer" && data.loc !== "freezer" ? E.todayISO() : (data.loc === "freezer" ? null : old.thawedOn);
    S.pantry[i] = E.newItem({ ...old, ...data, key, id, thawedOn });
    if (thawedOn && thawedOn !== old.thawedOn) toast("Moved out of the freezer: freshness now counts from today, when it started thawing.");
    toast("Saved " + data.name + ".");
  } else {
    const r = E.addToPantry(S.pantry, [{ ...data }]);
    toast(r.merged.length ? "Added to your existing " + r.merged[0].name + "." : "Added " + data.name + ".");
  }
  S.sample = false; persist(); closeAuth(); rerender();
}
function lt_missing(d) { const lt = document.getElementById("fLabelType").value, ld = document.getElementById("fLabelDate").value; return !!lt && !ld; }

/* ----- picking foods to cook with ----- */
function renderCookbar() {
  const bar = $("#cookbar"), items = S.ui.pins.map(id => S.pantry.find(p => p.id === id)).filter(Boolean);
  if (S.tab !== "kitchen" || !items.length) { bar.hidden = true; return; }
  bar.innerHTML = `<span class="what"><b>${items.length} picked:</b> ${esc(items.map(i => i.name).join(", "))}</span>
    <button class="btn small" data-act="pins-clear">Clear</button><button class="btn primary small" data-act="cook-pins">Find recipes →</button>`;
  bar.hidden = false;
}

/* =====================================================================
   COOK SOMETHING
   ===================================================================== */
const MODES = [
  ["urgent", "Save urgent food", "Uses what needs using first"],
  ["most", "Use the most", "Recipes that use lots of what you have"],
  ["one", "Cook with one", "Build a meal around one food"],
  ["everything", "Use everything", "A few dishes that clear your kitchen"]
];
function renderCook() {
  $("#modes").innerHTML = MODES.map(([k, t, d]) => `<button data-act="mode" data-mode="${k}" aria-pressed="${S.ui.mode === k}"><b>${t}</b><span>${d}</span></button>`).join("");
  const u = usable().filter(x => E.ING[x.p.key]?.c !== "condiment").sort((a, b) => E.GROUP_RANK[a.fr.group] - E.GROUP_RANK[b.fr.group]);
  if (S.ui.mode === "one" && !S.ui.oneId && u.length) S.ui.oneId = u[0].p.id;
  const P = S.prefs;
  $("#cookFilters").innerHTML = `
    <div class="field"><span>Show</span><div class="seg" role="group" aria-label="Meals or drinks">${[["meals","Meals"],["drinks","Drinks"],["both","Both"]].map(([k,l]) => `<button data-act="kind" data-k="${k}" aria-pressed="${(P.kind || "meals") === k}">${l}</button>`).join("")}</div></div>
    ${S.ui.mode === "one" ? `<label class="field">Food to use<select id="oneSel">${u.map(x => `<option value="${x.p.id}"${S.ui.oneId === x.p.id ? " selected" : ""}>${esc(x.p.name)} · ${esc(x.fr.note)}</option>`).join("")}</select></label>` : ""}
    ${S.ui.focus.length ? `<span class="anchor">Built around: ${esc(S.ui.focus.map(id => (S.pantry.find(p => p.id === id) || {}).name).filter(Boolean).join(", "))}<button data-act="focus-clear" aria-label="Stop building around these">×</button></span>` : ""}
    <div class="field"><span>People</span><div class="stepper"><button data-act="serv" data-d="-1" aria-label="Fewer people">−</button><b>${P.servings || "Recipe"}</b><button data-act="serv" data-d="1" aria-label="More people">+</button></div></div>
    <label class="field">Time<select id="timeSel">${[[0, "Any time"], [20, "20 min or less"], [30, "30 min or less"], [45, "45 min or less"], [60, "1 hour or less"]].map(([v, l]) => `<option value="${v}"${P.maxTime === v ? " selected" : ""}>${l}</option>`).join("")}</select></label>
    <label class="field">Cuisine<select id="cuisineSel"><option value="any">Any cuisine</option>${CUISINES.filter(c => c !== "Any").map(c => `<option${P.cuisine === c ? " selected" : ""}>${c}</option>`).join("")}</select></label>
    <button class="btn small" data-act="prefs">Diet & equipment${P.diet.length ? " (" + P.diet.length + ")" : ""}</button>`;
  renderIdeas();
}
/* Your ratings shape what's suggested: loved it ranks up, problems rank down, "didn't work" ranks well down. */
const FB = { good: ["It turned out well", 8], changed: ["I changed an ingredient", 0], improve: ["It needs improvement", -10], amounts: ["The quantities were wrong", -12], unclear: ["The instructions were unclear", -12], bad: ["It didn't work / didn't taste good", -30] };
function fbKind(f) { return f && (f.kind || (f.reason && Object.keys(FB).find(k => FB[k][0] === f.reason)) || "bad"); }
function feedbackPenalty(list) { const fb = S.feedback || {}; list.forEach(m => { const f = fb[m.recipe.id]; if (f) m.score.total += (FB[fbKind(f)] || FB.bad)[1]; }); return list.sort((a, b) => b.score.total - a.score.total); }
function currentList() {
  const focus = S.ui.mode === "one" ? (S.ui.oneId ? [S.ui.oneId] : []) : S.ui.focus;
  if (S.ui.mode === "everything") return { plan: E.planEverything(allRecipes(), S.pantry, S.staples, opts({ focus }), undefined) };
  return { list: feedbackPenalty(E.rankRecipes(allRecipes(), S.pantry, S.staples, opts({ focus }))) };
}
function ideaCard(m, extra = "") {
  const r = m.recipe;
  return `<button class="pick" data-act="pick" data-id="${esc(r.id)}" aria-pressed="${S.ui.currentId === r.id}">
    <canvas width="128" height="160" data-pthumb="${esc(r.id)}" aria-hidden="true"></canvas>
    <span class="pt"><span class="label">${esc(r.cuisine)} · ${styleLabel(r)}${isSaved(r) ? ' · <span class="savedmark">Saved</span>' : ""}</span><strong>${esc(r.title)}</strong>
    <span class="meta">${r.prep + r.cook} min · ${esc(r.difficulty || "Easy")} · uses ${m.usedCount} of yours${m.urgentUsed.length ? ` · <span class="urg">saves ${m.urgentUsed.length} that need using</span>` : ""}${m.swaps.length ? " · " + m.swaps.length + " swap" + (m.swaps.length > 1 ? "s" : "") : ""}${m.scaledDown ? " · smaller batch" : ""}${m.unconfirmed && m.unconfirmed.length ? ` · <span class="urg">check ${m.unconfirmed.length} amount${m.unconfirmed.length > 1 ? "s" : ""}</span>` : ""}</span>${extra}</span></button>`;
}
function styleLabel(r) { return r.ai ? "AI recipe" : esc(r.style || "Classic"); }
function renderIdeas() {
  const res = currentList();
  let html = "";
  if (res.plan) {
    const { dishes, covered, left } = res.plan;
    const total = covered.length + left.length;
    html += `<div class="plan-head"><b>${dishes.length ? dishes.length + " dish" + (dishes.length > 1 ? "es" : "") + " use " + covered.length + " of your " + total + " foods" : "No good combination yet"}</b><span>Separate dishes taste better than forcing everything into one.</span></div>`;
    html += dishes.map((m, i) => ideaCard(m, `<span class="meta">Dish ${i + 1}</span>`)).join("");
    if (left.length) html += `<div class="leftover-box"><b>Keep these for another day</b><ul>${left.map(p => `<li>${esc(p.name)}: ${esc((E.ING[p.key] || {}).fz || (p.loc === "pantry" ? "Store cool and dry; it keeps." : "Keep it cold and use it in the next few days."))}</li>`).join("")}</ul></div>`;
    S.ui.lastList = dishes;
  } else {
    const list = res.list;
    S.ui.lastList = list;
    html += `<p class="count"><b>${list.length}</b> recipe${list.length === 1 ? "" : "s"} you can make now${S.ui.mode === "urgent" ? ", most urgent first" : ""}</p>`;
    html += list.slice(0, 30).map(m => ideaCard(m)).join("") || `<div class="empty">${S.pantry.length ? "Nothing fits these filters. Try “Any time”, another cuisine, or fewer diet limits." : "Add some food in My kitchen first."}</div>`;
  }
  html += `<div class="ai-more">${AI.ready ? `<button class="btn" data-act="ai-more"${S.ui.aiBusy ? " disabled" : ""}>${S.ui.aiBusy ? "Asking the AI…" : "Ask the AI for more ideas"}</button><small>AI recipes are checked against your kitchen before they're shown.</small>` : `<small>Recipes come from a curated library of well-known dishes, so they work even without AI.</small>`}</div>`;
  $("#ideas").innerHTML = html;
  document.querySelectorAll("canvas[data-pthumb]").forEach(cv => paint(cv, getRecipe(cv.dataset.pthumb)));
  const shown = (S.ui.lastList || []).map(m => m.recipe.id);
  if (!S.ui.currentId || !shown.includes(S.ui.currentId)) S.ui.currentId = shown[0] || null;
  document.querySelectorAll(".pick[data-act=pick]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.id === S.ui.currentId)));
  renderDetail();
}
function renderDetail() {
  const box = $("#detail"); const r = S.ui.currentId && getRecipe(S.ui.currentId);
  if (!r) { box.innerHTML = `<div class="empty">Pick a recipe on the left.</div>`; return; }
  const m = match(r);
  if (!m.ok) { box.innerHTML = `<div class="empty">You no longer have everything for ${esc(r.title)}${m.missing.length ? " (missing " + esc(m.missing.join(", ")) + ")" : ""}.</div>`; return; }
  const sv = m.servings;
  const lineHTML = l => {
    if (l.skipped) return `<li class="skip"><div><span class="iname">${esc(l.name)}</span> <span class="amt">${esc(l.ing.q != null ? E.fmtAmount(l.q, l.ing.u) : "")}</span>${l.ing.note ? `<span class="inote">${esc(l.ing.note)}</span>` : ""}</div><span class="st">Optional: skip it</span></li>`;
    const u = l.unit || l.ing.u;
    const amount = l.ing.q == null ? esc(l.ing.amountText || "") : esc(niceAmount(l.q, u, l.ing.k));
    const have = l.src === "pantry" ? l.items.map(x => x.p.name + (x.p.qty != null ? " (" + amountLabel(x.p) + ")" : "")).join(", ") : "";
    const tag = l.src === "pantry" ? `<span class="st have">Yours</span>` : `<span class="st">Staple</span>`;
    const sw = l.sub ? `<div class="swapbox"><b>Swap: ${esc(E.fmtAmount(l.q, u))} ${esc(l.name.toLowerCase())} instead of ${esc(l.subFor.toLowerCase())}</b><span><i>Flavor:</i> ${esc(l.sub.f)}</span><span><i>Texture:</i> ${esc(l.sub.t)}</span><span><i>How:</i> ${esc(l.sub.w)}</span></div>` : "";
    const need = E.fmtAmount(l.q, u);
    const haveTxt = l.haveG != null && l.needG ? Math.round(l.haveG / l.needG * 100) : null;
    let short = "";
    if (l.unconfirmed) short = `<span class="inote warn">Amount not recorded. You need ${esc(need)}; how much do you have?</span>${l.items.filter(x => x.p.qty == null).map(x => `<span class="setqty"><label class="sr" for="sq-${x.p.id}">Amount of ${esc(x.p.name)}</label><input type="number" min="0" step="any" id="sq-${x.p.id}" placeholder="Amount"><select id="squ-${x.p.id}" aria-label="Unit">${E.UNITS.map(un => `<option${un === u ? " selected" : ""}>${un}</option>`).join("")}</select><button class="btn small" data-act="set-qty" data-id="${x.p.id}">Save amount</button></span>`).join("")}`;
    else if (l.tolUsed) short = `<span class="inote warn">You have about ${haveTxt}% of this. ${esc(l.ing.tolNote || "A little less is fine here.")}</span>`;
    else if (l.short && l.ing.opt) short = `<span class="inote">You have a little less than this; just use what you have.</span>`;
    else if (l.topUp) short = `<span class="inote">Uses what's left in your kitchen, topped up from your basics.</span>`;
    return `<li><div><span class="iname">${esc(l.sub ? l.name : (l.ing.any ? l.ing.label || l.name : l.name))}</span> <span class="amt">${amount}</span>${l.ing.note ? `<span class="inote">${esc(l.ing.note)}</span>` : ""}${have ? `<span class="inote">From: ${esc(have)}</span>` : ""}${short}${sw}</div>${tag}</li>`;
  };
  const safety = E.safetyNotes(m);
  box.innerHTML = `
    <div class="detail-top">
      <div><div class="frame"><canvas id="plate" width="480" height="600" aria-label="Illustration of ${esc(r.title)}"></canvas></div>${PHOTOS[r.id] ? `<p class="photo-credit">${PHOTOS[r.id].page ? `<a href="${esc(PHOTOS[r.id].page)}" target="_blank" rel="noopener">${esc(PHOTOS[r.id].credit || "")}</a>` : esc(PHOTOS[r.id].credit || "")}${PHOTOS[r.id].ai ? " · AI-generated image" : ""}</p>` : `<p class="photo-credit">Illustration</p>`}</div>
      <div class="detail-head">
        <span class="label">${esc(r.cuisine)} · <span class="style-${(r.style || "").toLowerCase()}">${styleLabel(r)}</span></span>
        <h2>${esc(r.title)}</h2>
        <p>${esc(r.desc)}</p>
        ${r.styleNote ? `<p class="small muted">${esc(r.styleNote)}</p>` : ""}
        ${r.ai ? `<p class="small warnbox">Written by AI${r.reviewed ? ", reviewed for taste and safety," : ""} and checked against your kitchen and sensible amounts. AI recipes aren't test-cooked or guaranteed, so read it through before cooking and follow the safety notes.</p>` : ""}
        <dl class="spec">
          <div><dt>${r.kind === "drink" ? "Makes" : "Serves"}</dt><dd>${m.scaledDown ? `<small class="warn-line">The full recipe makes ${r.serves}. You have enough of ${esc((E.matchRecipe(r, S.pantry, S.staples, opts({ servings: r.serves })).amountShort || []).map(a => a.name.toLowerCase()).join(", ") || "everything")} for ${m.servings}, so every amount below is scaled to ${m.servings}.</small>` : ""}<div class="stepper"><button data-act="rserv" data-d="-1" aria-label="Fewer servings">−</button><b>${sv}${r.kind === "drink" ? " glass" + (sv > 1 ? "es" : "") : ""}</b><button data-act="rserv" data-d="1" aria-label="More servings">+</button></div></dd></div>
          <div><dt>Time</dt><dd>${r.prep} min prep · ${r.cook} min cooking</dd></div>
          <div><dt>Difficulty</dt><dd>${esc(r.difficulty || "Easy")}</dd></div>
          <div><dt>From your kitchen</dt><dd>${m.usedCount} of your foods + staples · <b class="ok">nothing to buy</b>${m.urgentUsed.length ? `<br><span class="urg">Uses up: ${esc(m.urgentUsed.map(p => p.name).join(", "))}</span>` : ""}</dd></div>
        </dl>
        ${S.feedback && S.feedback[r.id] ? `<p class="small ${FB[fbKind(S.feedback[r.id])][1] < 0 ? "warnbox" : "okbox"}">You said: “${esc(FB[fbKind(S.feedback[r.id])][0])}${S.feedback[r.id].note ? " · " + esc(S.feedback[r.id].note) : ""}”.</p>` : ""}
        <div class="actions-row">
          <button class="btn primary" data-act="gc-start">${icon("play")}Start cooking</button>
          <button class="btn" data-act="cooked">${icon("check")}I made this</button>
          <button class="btn" data-act="feedback">${icon("star")}How did it go?</button>
          <div class="save-wrap">${isSaved(r) ? `<button class="btn saved" data-act="save-open">✓ Saved</button>` : `<button class="btn" data-act="save-quick">Save recipe</button>`}
            <div class="pop" id="savePop" hidden><span class="label">Put it in a collection</span>
              ${S.collections.map(cn => `<button class="opt" data-act="save-to" data-col="${esc(cn)}">${esc(cn)}</button>`).join("")}
              <form id="popNew"><input type="text" id="popNewName" placeholder="New collection" aria-label="New collection name" required><button class="btn small" type="submit">Add</button></form>
              <button class="opt" data-act="unsave-current" style="color:var(--urgent)">Remove from saved</button></div></div>
        </div>
      </div>
    </div>
    <section><div class="sec-title"><h3>Ingredients</h3><span class="label">for ${sv}</span></div><ul class="ings">${m.lines.map(lineHTML).join("")}</ul></section>
    <section><div class="sec-title"><h3>Method</h3><span class="label">${r.steps.length} steps</span></div><ol class="steps">${r.steps.map(s => `<li><span>${esc(s)}</span></li>`).join("")}</ol></section>
    ${r.season ? `<section><div class="sec-title"><h3>Seasoning</h3></div><p>${esc(r.season)}</p></section>` : ""}
    <section><div class="sec-title"><h3>Storing & leftovers</h3></div><p>${esc(r.store || "Refrigerate within 2 hours and eat within 3 days. Reheat until steaming hot.")}</p></section>
    <section class="safety"><div class="sec-title"><h3>Food safety</h3></div><ul>${safety.map(n => `<li>${esc(n)}</li>`).join("")}</ul></section>
    <section><div class="sec-title"><h3>Rescue my dish</h3><span class="label">Mid-cook fixes</span></div>
      <div class="rescue">${["Too salty", "Too watery", "Needs brightness", "Needs more depth", "Too spicy", "Too bland"].map(p => `<button class="btn small" data-act="rescue" data-p="${p}">${p}</button>`).join("")}</div>
      <div class="fixes" id="fixes"></div></section>`;
  paint($("#plate"), r);
}

/* ----- "I made this" ----- */
function openCooked() {
  const r = getRecipe(S.ui.currentId); if (!r) return;
  const m = match(r);
  const rows = E.planDeductions(m);
  S.ui.cooking = { rid: r.id, rows, servings: m.servings };
  openModal(`<h2 id="authTitle">Did you make ${esc(r.title)}?</h2>
    <p>Check how much you used, then I'll update your kitchen. Nothing changes until you confirm.</p>
    <form id="cookedForm">
      <div class="cooked-rows">${rows.map((x, i) => `<div class="crow"><span class="cname">${esc(x.name)}<small>${x.qty != null ? "You have " + esc(E.fmtAmount(x.qty, x.unit)) : "Amount not recorded"}</small></span>
        ${x.qty != null ? `<label class="sr" for="take${i}">Amount of ${esc(x.name)} used</label><input type="number" id="take${i}" min="0" step="any" value="${x.take ?? ""}"><span class="u">${esc(x.unit === "pcs" ? "" : x.unit || "")}</span>` : `<span></span><span></span>`}
        <label class="check"><input type="checkbox" id="all${i}"${x.all ? " checked" : ""}> Used it all</label></div>`).join("") || `<p class="muted">This recipe only used staples.</p>`}</div>
      <label for="leftServ">Servings left over to keep<input type="number" id="leftServ" min="0" max="50" step="1" value="0"></label>
      <p class="hint">Leftovers go in your fridge with their own safe-to-eat window${r.ingredients.some(i => i.k === "rice_cooked" || i.k === "rice_raw") ? " (24 hours, because they contain rice)" : " (3 days)"}.</p>
      <div class="form-actions"><button class="btn primary" type="submit">Yes, update my kitchen</button><button class="linkbtn" type="button" data-act="auth-close">Not yet</button></div>
    </form>`, "#cookedForm button[type=submit]");
}
function submitCooked() {
  const c = S.ui.cooking; if (!c) return;
  const r = getRecipe(c.rid);
  const rows = c.rows.map((x, i) => {
    const all = document.getElementById("all" + i).checked;
    const el = document.getElementById("take" + i);
    let take = el ? Number(el.value) : null;
    if (el && (!(take >= 0) || el.value === "")) take = 0;
    return { ...x, all, take };
  });
  const res = E.applyDeductions(S.pantry, rows);
  S.pantry = res.pantry;
  const left = Math.max(0, Math.min(50, parseInt(document.getElementById("leftServ").value, 10) || 0));
  if (left) S.pantry.push(E.leftoverItem(r, left));
  S.history.push({ at: Date.now(), rid: r.id, title: r.title, servings: c.servings, used: res.used.map(u => ({ name: u.name, qty: u.qty, unit: u.unit, all: u.all, g: E.toGrams(u.key, u.qty, u.unit) })), leftovers: left });
  markPlanCooked(r.id); if (S.cooking && S.cooking.rid === r.id) S.cooking = null;
  S.sample = false; persist(); closeAuth();
  celebrate(); toast(`Kitchen updated: ${res.used.length} food${res.used.length === 1 ? "" : "s"} used${left ? ", " + left + " serving" + (left > 1 ? "s" : "") + " of leftovers saved" : ""}. Enjoy!`);
  rerender();
  if (!(S.feedback || {})[r.id]) setTimeout(() => { if ($("#authModal").hidden) { S.ui.currentId = r.id; openFeedback(true); } }, 1400);
}

/* ----- "This didn't work": recipe feedback ----- */
function openFeedback(afterCook) {
  const r = getRecipe(S.ui.currentId); if (!r) return;
  openModal(`<h2 id="authTitle">How did ${esc(r.title)} go?</h2><p>Your answer shapes what I suggest next${Cloud.user ? " and helps fix the recipe" : ""}.</p>
    <form id="feedbackForm"><div class="fb-grid">${Object.entries(FB).map(([k, [label]], i) => `<label class="fb-opt fb-${k}"><input type="radio" name="fbReason" value="${k}"${(afterCook ? k === "good" : i === 0) ? " checked" : ""}><span>${icon(k === "good" ? "star" : k === "changed" ? "spark" : k === "bad" ? "stop" : "info")}${esc(label)}</span></label>`).join("")}</div>
    <label for="fbNote">Anything to add? (optional)<input type="text" id="fbNote" maxlength="300" placeholder="e.g. used lime instead of calamansi; needed 10 more minutes"></label>
    <div class="form-actions"><button class="btn primary" type="submit">Save</button><button class="linkbtn" type="button" data-act="auth-close">${afterCook ? "Skip" : "Cancel"}</button></div></form>`);
}
async function submitFeedback() {
  const r = getRecipe(S.ui.currentId); if (!r) return;
  const kind = (document.querySelector('input[name="fbReason"]:checked') || {}).value || "bad", reason = FB[kind][0], note = $("#fbNote").value.trim().slice(0, 300);
  S.feedback = S.feedback || {}; S.feedback[r.id] = { kind, reason, note, at: Date.now() }; persist(); closeAuth(); if (S.tab === "cook") renderIdeas();
  let sent = false;
  if (Cloud.user) { try { const sb = await Cloud.client(); const { error } = await sb.from("pantry_feedback").insert({ user_id: Cloud.user.id, recipe_id: r.id, recipe_title: r.title, reason, note, ai: !!r.ai }); sent = !error; } catch (e) {} }
  const effect = FB[kind][1] > 0 ? "I'll suggest it more often." : FB[kind][1] < 0 ? "It's ranked lower for you now." : "Noted.";
  toast(`Thanks! ${effect}${sent ? " Your note was sent to the site owner." : ""}`);
}

/* ----- Diet & equipment ----- */
function openPrefs() {
  const D = [["vegetarian", "Vegetarian"], ["nopork", "No pork"], ["nobeef", "No beef"], ["noseafood", "No seafood"], ["nodairy", "No dairy"], ["noegg", "No eggs"], ["nogluten", "No gluten"]];
  const EQ = [["stove", "Stove"], ["blender", "Blender"], ["oven", "Oven"], ["microwave", "Microwave"], ["ricecooker", "Rice cooker"]];
  openModal(`<h2 id="authTitle">Diet & equipment</h2><form id="prefsForm">
    <fieldset><legend>Leave out</legend><div class="chips">${D.map(([k, l]) => `<label class="chip"><input type="checkbox" name="diet" value="${k}"${S.prefs.diet.includes(k) ? " checked" : ""}>${l}</label>`).join("")}</div></fieldset>
    <fieldset><legend>I can cook with</legend><div class="chips">${EQ.map(([k, l]) => `<label class="chip"><input type="checkbox" name="equip" value="${k}"${S.prefs.equipment.includes(k) ? " checked" : ""}>${l}</label>`).join("")}</div></fieldset>
    <p class="hint">Diet choices filter by ingredient. Always check labels yourself for allergies.</p>
    <div class="form-actions"><button class="btn primary" type="submit">Save</button><button class="linkbtn" type="button" data-act="auth-close">Cancel</button></div></form>`);
}

/* ----- AI: more ideas, checked before showing ----- */
async function askAIMore() {
  if (S.ui.aiBusy) return;
  S.ui.aiBusy = true; renderIdeas();
  const u = usable().sort((a, b) => E.GROUP_RANK[a.fr.group] - E.GROUP_RANK[b.fr.group]);
  const kitchen = u.map(x => `- ${x.p.name}${x.p.qty != null ? ": " + E.fmtAmount(x.p.qty, x.p.unit) : ""} (${x.fr.note})`).join("\n");
  const staples = S.staples.map(E.ingName).join(", ");
  const focusNames = (S.ui.mode === "one" ? [S.ui.oneId] : S.ui.focus).map(id => (S.pantry.find(p => p.id === id) || {}).name).filter(Boolean);
  const have = allRecipes().map(r => r.title).join("; ");
  const P = S.prefs;
  try {
    const res = await AI.json(`You are a careful home-cooking expert writing recipes for a "cook from what you have" app.
KITCHEN (most urgent first):
${kitchen}
ALWAYS AVAILABLE: ${staples}, water
${focusNames.length ? "MUST FEATURE: " + focusNames.join(", ") + "\n" : ""}${P.diet.length ? "DIET: avoid " + P.diet.join(", ") + "\n" : ""}${P.maxTime ? "TIME LIMIT: " + P.maxTime + " minutes total\n" : ""}${P.servings ? "SERVINGS: " + P.servings + "\n" : ""}ALREADY SUGGESTED (don't repeat): ${have}

${S.prefs.kind === "drinks" ? "Write 3 refreshing NON-ALCOHOLIC drinks (smoothies, shakes or fresh fruit juices)" : "Write 3 genuinely delicious, practical MEALS"}, based on well-established recipes, that use ONLY the kitchen and always-available items. Prefer food that needs using first, but never at the cost of taste or safety. Don't force ingredients that don't belong together.
Use correct proportions, proper seasoning, realistic times, and standard safe cooking temperatures (poultry 74°C/165°F, ground meat 71°C/160°F). Never invent unusual temperatures or times.
If a dish is changed from the traditional version, set style to "Home-style"; if it mixes cuisines, "Fusion". Only use "Classic" when it's made the traditional way.
JSON only:
{"recipes":[{"title":"","cuisine":"","style":"Classic|Home-style|Fusion","desc":"one sentence","serves":2,"prep":10,"cook":15,"difficulty":"Easy|Medium","ingredients":[{"name":"exactly as in the kitchen list","qty":1,"unit":"pcs|g|kg|ml|cup|tbsp|tsp|clove|stalk|can","optional":false,"replaces":null}],"steps":["4-8 clear steps"],"season":"seasoning advice","store":"storage and reheating advice"}]}`);
    const arr = (res && res.recipes) || [];
    const cands = []; let dropped = 0;
    for (const x of arr.slice(0, 3)) {
      const r = aiToRecipe(x);
      if (r && match(r).ok) cands.push({ r, x }); else dropped++;
    }
    // Second opinion: a strict head-chef review. Only recipes rated tasty, practical and safe are kept.
    let kept = [];
    if (cands.length) {
      try {
        const rev = await AI.json(`You are a strict head chef and food-safety inspector reviewing recipes before they're published.
For each recipe, rate taste (1-5: would people happily cook and eat this again?) and practicality (1-5), and say if anything is unsafe (undercooked meat, risky storage, wrong temperatures, raw egg in drinks).
Be critical: a recipe that just throws leftovers together, has odd flavor pairings, wrong proportions or vague steps scores 3 or less.
RECIPES:
${cands.map((c, i) => `#${i} ${c.x.title}\nIngredients: ${c.x.ingredients.map(g => (g.qty || "") + " " + (g.unit || "") + " " + g.name).join("; ")}\nSteps: ${c.x.steps.join(" | ")}`).join("\n\n")}
JSON only: {"reviews":[{"index":0,"taste":4,"practical":4,"unsafe":false,"problem":"one short sentence or empty"}]}`, { fast: true });
        const by = new Map(((rev && rev.reviews) || []).map(v => [v.index, v]));
        cands.forEach((c, i) => { const v = by.get(i); if (v && v.taste >= 4 && v.practical >= 4 && !v.unsafe) { c.r.reviewed = true; kept.push(c.r); } else dropped++; });
      } catch (e) { kept = []; dropped += cands.length; }
    }
    kept.forEach(r => S.ui.aiRecipes.push(r));
    toast(kept.length ? `Added ${kept.length} AI recipe${kept.length > 1 ? "s" : ""}${dropped ? `; left out ${dropped} that didn't pass the taste, safety or ingredient checks` : ""}.` : "None of the AI's ideas passed the taste, safety and ingredient checks, so I left them out. The curated recipes are still here.");
  } catch (e) {
    if (e && e.code === "puter_sign_in") openPuterConnect(() => askAIMore());
    else if (e && e.code === "sign_in") { toast("Sign in to use the AI."); openAuth("signin"); }
    else toast("The AI couldn't answer just now. The recipe library still works. Try again later.");
  } finally { S.ui.aiBusy = false; if (S.tab === "cook") renderIdeas(); }
}
function aiToRecipe(x) {
  if (!x || !x.title || !Array.isArray(x.ingredients) || !Array.isArray(x.steps) || x.steps.length < 3) return null;
  const prep = Math.round(+x.prep || 0), cook = Math.round(+x.cook || 0);
  if (prep < 0 || cook < 0 || prep + cook < 3 || prep + cook > 240) return null;
  const ings = [];
  for (const i of x.ingredients) {
    const k = E.resolveKey(i.name) || (S.pantry.find(p => E.norm(p.name) === E.norm(i.name)) || {}).key;
    if (!k) { if (i.optional) continue; return null; }
    const unit = ({ g: "g", kg: "kg", ml: "ml", cup: "cup", cups: "cup", tbsp: "tbsp", tsp: "tsp", clove: "clove", cloves: "clove", stalk: "stalk", can: "can", pcs: "pcs", piece: "pcs", pieces: "pcs", l: "l" })[String(i.unit || "").toLowerCase()] || "pcs";
    const q = +i.qty > 0 && +i.qty < 5000 ? +i.qty : null;
    ings.push({ k, q, u: unit, opt: !!i.optional, note: i.replaces ? "instead of " + i.replaces : "" });
  }
  if (ings.filter(i => i.q == null).length > ings.length * 0.3) return null; // needs real quantities
  // Sanity limits per serving: reject recipes with clearly wrong amounts.
  const serves = Math.max(1, Math.min(12, Math.round(+x.serves || 2)));
  const per = k => ings.filter(i => i.k === k && i.q != null).reduce((g, i) => g + (E.toGrams(k, i.q, i.u) || 0), 0) / serves;
  const drink = S.prefs.kind === "drinks";
  if (per("salt") > 6 || per("soy_sauce") > 35 || per("fish_sauce") > 25 || per("oil") > 60 || per("sugar") > (drink ? 40 : 30)) return null;
  // Raw meat or seafood: the method must make sure it's cooked through, so add the safety step if it's missing.
  const RAW = ["chicken", "ground_pork", "pork", "ground_beef", "beef", "fish", "shrimp", "bacon", "longganisa", "tocino"];
  const stepsText = (x.steps || []).join(" ").toLowerCase();
  const rawUsed = ings.filter(i => RAW.includes(i.k));
  if (drink && rawUsed.length) return null;
  if (drink && ings.some(i => i.k === "egg")) return null; // no raw egg in drinks
  const addSafety = rawUsed.length && !/(74|165|71|160|63|145)\s*°|no (longer )?pink|cooked through|opaque|juices run clear/.test(stepsText);
  let style = ["Classic", "Home-style", "Fusion"].includes(x.style) ? x.style : "Home-style";
  if (style === "Classic" && x.ingredients.some(i => i.replaces)) style = "Home-style";
  const pal = { Filipino: ["#E9D7A8","#A0522D","#5E8C3A","#F2B33D"], Korean: ["#C8341F","#E8A33D","#F7F3EA","#5E8C3A"], Italian: ["#C0392B","#EAD7A6","#5E8C3A","#F7F3EA"] }[x.cuisine] || ["#E9D7A8","#C98B4A","#5E8C3A","#F2C14E"];
  return { id: "ai-" + uid(), ai: true, title: String(x.title).slice(0, 80), cuisine: String(x.cuisine || "Any").slice(0, 30), style, desc: String(x.desc || "").slice(0, 200),
    serves, prep, cook, difficulty: x.difficulty === "Medium" ? "Medium" : "Easy", equip: ["stove"], q: 4,
    kind: drink ? "drink" : "meal",
    plating: drink ? "glass" : /soup|porridge|bowl|curry|rice/i.test(x.title) ? "bowl" : "plate", palette: pal, ingredients: ings,
    steps: x.steps.map(s => String(s).slice(0, 400)).slice(0, 10).concat(addSafety ? ["Before serving, check that all meat or seafood is cooked through: chicken 74°C (165°F), ground meat 71°C (160°F), fish and whole cuts 63°C (145°F)."] : []),
    season: String(x.season || "").slice(0, 300), store: String(x.store || "").slice(0, 300) };
}

/* =====================================================================
   SAVED
   ===================================================================== */
const isSaved = r => r && S.saved.find(z => (z.rid && z.rid === r.id) || (z.recipe && (z.recipe.id === r.id || z.recipe.title === r.title)));
const savedRecipe = z => z.rid ? LIB.find(r => r.id === z.rid) : z.recipe;
function saveCurrent(col) {
  const r = getRecipe(S.ui.currentId); if (!r) return;
  const ex = isSaved(r);
  if (ex) ex.col = col || "";
  else S.saved.push(r.ai ? { id: uid(), recipe: r, col: col || "", at: Date.now() } : { id: uid(), rid: r.id, col: col || "", at: Date.now() });
  persist(); renderDetail(); renderNavCounts();
  document.querySelectorAll(".pick[data-act=pick]").forEach(b => { if (b.dataset.id === r.id && !b.querySelector(".savedmark")) b.querySelector(".label").insertAdjacentHTML("beforeend", ' · <span class="savedmark">Saved</span>'); });
  toast(col ? `Saved to ${col}.` : "Saved. Find it under Saved.");
  requestAnimationFrame(() => { sparkle("#detail .btn.saved, #detail .save-wrap", 5); sparkle("#navSaved", 3); });
}
function renderSaved() {
  S.ui.savedCol = S.ui.savedCol ?? "all"; S.ui.savedSort = S.ui.savedSort || "new"; S.ui.savedQ = S.ui.savedQ || "";
  const cols = S.collections, count = c => S.saved.filter(z => c === "all" ? true : c === "" ? !z.col : z.col === c).length;
  $("#colFilters").innerHTML = [["all", "All"], ...(count("") ? [["", "Unsorted"]] : []), ...cols.map(c => [c, c])]
    .map(([k, l]) => `<button data-act="col-filter" data-c="${esc(k)}" aria-pressed="${S.ui.savedCol === k}">${esc(l)} <span class="mono muted">${count(k)}</span></button>`).join("")
    + (S.ui.addingCol ? `<form id="newCol"><input type="text" id="newColName" placeholder="Collection name" aria-label="New collection name" required><button class="btn small" type="submit">Create</button></form>` : `<button data-act="col-new">+ New collection</button>`);
  if (S.ui.addingCol) { const f = $("#newColName"); f && f.focus(); }
  $("#savedSort").value = S.ui.savedSort; if ($("#savedSearch").value !== S.ui.savedQ) $("#savedSearch").value = S.ui.savedQ;
  const q = S.ui.savedQ.toLowerCase();
  let list = S.saved.map(z => ({ z, r: savedRecipe(z) })).filter(x => x.r)
    .filter(x => S.ui.savedCol === "all" || (S.ui.savedCol === "" ? !x.z.col : x.z.col === S.ui.savedCol))
    .filter(x => !q || [x.r.title, x.r.cuisine, x.r.desc, ...x.r.ingredients.map(i => E.ingName(i.k) || i.n || "")].join(" ").toLowerCase().includes(q))
    .map(x => ({ ...x, m: match(x.r) }));
  const mins = x => x.r.prep + x.r.cook;
  list.sort({ new: (a, b) => (b.z.at || 0) - (a.z.at || 0), ready: (a, b) => (a.m.ok ? 0 : 1) - (b.m.ok ? 0 : 1) || mins(a) - mins(b), quick: (a, b) => mins(a) - mins(b), az: (a, b) => a.r.title.localeCompare(b.r.title) }[S.ui.savedSort]);
  $("#savedGrid").innerHTML = list.length ? list.map(({ z, r, m }) => `<div class="rcard"><canvas width="400" height="500" data-thumb="${z.id}" aria-hidden="true"></canvas>
      <div class="body"><span class="label">${esc(r.cuisine)} · ${r.prep + r.cook} min · ${styleLabel(r)}</span><strong>${esc(r.title)}</strong>
      <span class="status-line" style="color:${m.ok ? "var(--accent)" : "var(--urgent)"}">${m.ok ? "Ready to cook from your kitchen" : "Missing now: " + esc(m.missing.join(", "))}</span>
      <select data-move="${z.id}" aria-label="Collection for ${esc(r.title)}"><option value="">Unsorted</option>${cols.map(c => `<option${z.col === c ? " selected" : ""}>${esc(c)}</option>`).join("")}</select>
      <div class="actions"><label class="wk"><input type="checkbox" data-week="${z.id}" ${S.week.includes(z.id) ? "checked" : ""}>This week</label>
      <span style="flex:1"></span>${m.ok ? `<button class="btn small primary" data-act="open-saved" data-id="${z.id}">Cook</button>` : ""}<button class="btn small" data-act="unsave" data-id="${z.id}" aria-label="Remove ${esc(r.title)} from saved">Remove</button></div></div></div>`).join("")
    : `<div class="empty" style="grid-column:1/-1">${S.saved.length ? "No saved recipes match. Try another search or collection." : "Nothing saved yet. Tap “Save recipe” on any dish in Cook something."}</div>`;
  document.querySelectorAll("canvas[data-thumb]").forEach(cv => { const z = S.saved.find(x => x.id === cv.dataset.thumb); if (z) paint(cv, savedRecipe(z)); });
  renderWeek(); renderNavCounts();
}
function renderWeek() {
  const picked = S.saved.filter(z => S.week.includes(z.id) && savedRecipe(z)).map(z => ({ z, r: savedRecipe(z), m: match(savedRecipe(z)) }));
  const use = new Map();
  picked.forEach(({ r, m }) => m.lines.forEach(l => (l.items || []).forEach(x => { if (!use.has(x.p.id)) use.set(x.p.id, { p: x.p, by: new Set() }); use.get(x.p.id).by.add(r.title); })));
  const shared = [...use.values()].filter(v => v.by.size > 1);
  const unused = S.pantry.filter(p => { const f = fr(p); return (f.group === "first" || f.group === "soon") && !use.has(p.id); });
  const ready = picked.filter(x => x.m.ok).length;
  $("#weekPanel").innerHTML = `<span class="label">This week · kitchen check</span><h3 style="margin-top:4px">${picked.length} meal${picked.length === 1 ? "" : "s"} planned</h3>
   <p class="small muted">${picked.length ? `${ready} of ${picked.length} ready to cook from what you have.` : "Tick “This week” on a few recipes to plan them."}</p>
   ${picked.length ? `<ul class="plan">${picked.map(({ r, m }) => `<li>${esc(r.title)}<span style="color:${m.ok ? "var(--accent)" : "var(--urgent)"}">${m.ok ? "Ready to cook" : "Missing now: " + esc(m.missing.join(", "))}</span></li>`).join("")}</ul>` : ""}
   ${shared.length ? `<span class="label">Used by more than one meal</span><ul class="plan">${shared.map(v => `<li>${esc(v.p.name)}<span>${v.by.size} meals share ${esc(amountLabel(v.p))}. Check there's enough.</span></li>`).join("")}</ul>` : ""}
   ${unused.length ? `<span class="label">Needs using, not planned yet</span><ul class="plan">${unused.map(p => `<li>${esc(p.name)}<span>${esc(fr(p).note)}</span></li>`).join("")}</ul><button class="btn small" data-act="cook-today">Find recipes for these</button>` : ""}`;
}

/* =====================================================================
   EVENTS
   ===================================================================== */
document.addEventListener("click", e => {
  const t = e.target.closest("[data-act]");
  const pop = $("#savePop"); if (pop && !pop.hidden && !e.target.closest(".save-wrap")) pop.hidden = true;
  if (e.target.id === "authModal") { closeAuth(); return; }
  if (!t) return;
  const act = t.dataset.act;
  if (act === "tab") { e.preventDefault(); setTab(t.dataset.tab); return; }
  if (act === "ai-info") { openAiInfo(); return; }
  if (act === "puter-connect") { t.disabled = true; t.textContent = "Waiting for Puter…";
    AI.puterSignIn().then(async () => { S.puterConnected = await AI.puterSignedIn(); closeAuth(); toast(S.puterConnected ? "Free AI is connected. Enjoy!" : "Puter didn't confirm the sign-in. Try again."); renderAiStatus(); const f = S.afterPuter; S.afterPuter = null; if (f) f(); })
      .catch(() => { t.disabled = false; t.textContent = "Connect free AI"; toast("Sign-in didn't finish. If nothing opened, allow pop-ups for this site and try again."); });
    return; }
  if (act === "account") { Cloud.user ? openAuth("account") : openAuth("signin"); return; }
  if (act === "auth-mode") { openAuth(t.dataset.m); return; }
  if (act === "auth-close") { closeAuth(); return; }
  if (act === "sign-out") { closeAuth(); Cloud.signOut().then(() => toast("Signed out.")); return; }
  switch (act) {
    case "cook-today": S.ui.mode = "urgent"; S.ui.focus = []; S.ui.currentId = null; S.prefs.kind = "meals"; setTab("cook"); break;
    case "go-check": S.ui.sort = "fresh"; S.ui.loc = "all"; setTab("kitchen"); break;
    case "open-recipe": S.ui.currentId = t.dataset.id; S.ui.mode = "urgent"; S.ui.focus = []; { const rr = getRecipe(t.dataset.id); if (rr) S.prefs.kind = rr.kind === "drink" ? "drinks" : "meals"; } setTab("cook"); { const f = document.querySelector(`.pick[data-id="${t.dataset.id}"]`); if (f) f.scrollIntoView({ block: "nearest" }); } break;
    case "clear-sample": openModal(`<h2 id="authTitle">Start with an empty kitchen?</h2><p>This removes the sample foods so you can add your own.</p><div class="form-actions"><button class="btn primary" data-act="clear-sample-yes">Yes, empty it</button><button class="linkbtn" data-act="auth-close">Keep the sample</button></div>`); break;
    case "merge-yes": { const L = S.ui.pendingMerge; S.ui.pendingMerge = null; if (L) {
      E.addToPantry(S.pantry, (L.pantry || []).map(p => ({ ...p, id: undefined })));
      for (const z of L.saved || []) { const r = z.rid ? LIB.find(x => x.id === z.rid) : z.recipe; if (r && !isSaved(r)) S.saved.push(z); }
      S.collections = [...new Set([...S.collections, ...(L.collections || [])])];
      S.history = [...S.history, ...(L.history || [])].sort((a, b) => a.at - b.at);
      persist(); rerender(); toast("Added this device's kitchen to your account."); }
      closeAuth(); break; }
    case "merge-no": S.ui.pendingMerge = null; closeAuth(); toast("Kept your account as it is."); break;
    case "clear-sample-yes": S.pantry = []; S.sample = false; persist(); closeAuth(); renderKitchen(); toast("Your kitchen is empty. Add what you have above."); break;
    case "loc": S.ui.loc = t.dataset.v; renderKitchen(); break;
    case "item-new": openModal(itemForm(null), "#fName"); break;
    case "item-edit": openModal(itemForm(S.pantry.find(p => p.id === t.dataset.id)), "#fName"); break;
    case "item-delete": if (t.dataset.confirm) { const p = S.pantry.find(x => x.id === t.dataset.id); S.pantry = S.pantry.filter(x => x.id !== t.dataset.id); persist(); closeAuth(); rerender(); toast("Removed " + (p ? p.name : "it") + "."); }
      else { t.dataset.confirm = "1"; t.textContent = "Tap again to remove"; } break;
    case "item-toss": if (t.dataset.confirm) { const p = S.pantry.find(x => x.id === t.dataset.id); S.pantry = S.pantry.filter(x => x.id !== t.dataset.id); persist(); rerender(); toast("Removed " + (p ? p.name : "it") + ". Good call."); }
      else { t.dataset.confirm = "1"; t.textContent = "Tap again to confirm"; } break;
    case "zone-add": { const n = t.dataset.n, k = E.resolveKey(n); const ex = S.pantry.find(p => (k && p.key === k) || E.norm(p.name) === E.norm(n));
      if (ex) { openModal(itemForm(ex), "#fQty"); break; }
      const parsed = E.parseIngredientText(n)[0] || { name: n };
      if (parsed.cooked) { openReview([{ ...parsed, name: n, loc: "fridge" }]); break; }
      E.addToPantry(S.pantry, [{ ...parsed, name: n, loc: ZONE_LOC[t.dataset.z] || (["Back of the fridge", "Fridge shelves", "Fridge door", "Crisper drawers"].includes(t.dataset.z) ? "fridge" : parsed.loc), added: E.todayISO() }]);
      S.sample = false; persist(); renderKitchen(); toast(`Added ${n}. Tap it to add the amount or dates.`); break; }
    case "pin": { const id = t.dataset.id; if (S.ui.pins.includes(id)) S.ui.pins = S.ui.pins.filter(x => x !== id); else if (S.ui.pins.length >= 3) toast("Pick up to 3 foods to build a meal around."); else S.ui.pins.push(id); renderKitchen(); break; }
    case "pins-clear": S.ui.pins = []; renderKitchen(); break;
    case "thaw": { const it = S.pantry.find(x => x.id === t.dataset.id); if (it) { it.loc = "fridge"; it.thawedOn = E.todayISO(); persist(); renderKitchen(); toast(`${it.name} moved to the fridge to thaw. Thaw in the fridge, never on the counter, and use it soon after.`); } break; }
    case "cook-pins": S.ui.focus = S.ui.pins.slice(); S.ui.pins = []; S.ui.mode = "most"; S.ui.currentId = null; setTab("cook"); break;
    case "focus-clear": S.ui.focus = []; renderCook(); break;
    case "mode": S.ui.mode = t.dataset.mode; S.ui.currentId = null; renderCook(); break;
    case "rescue-item": S.ui.rescueId = t.dataset.id; setTab("rescue"); break;
    case "focus-add": { const q = $("#qaText"); if (q) { q.focus(); q.scrollIntoView({ behavior: "smooth", block: "center" }); } break; }
    case "welcome-done": S.ui.welcomeDone = true; renderKitchen(); break;
    case "load-sample": seedKitchen(); persist(); S.ui.welcomeDone = true; renderKitchen(); renderNavCounts(); toast("Example kitchen loaded. Empty it any time to add your own food."); break;
    case "one-mode": S.ui.mode = "one"; S.ui.oneId = null; S.ui.focus = []; S.ui.currentId = null; setTab("cook"); break;
    case "kind": S.prefs.kind = t.dataset.k; S.ui.currentId = null; persist(); renderCook(); break;
    case "serv": { let n; if (!S.prefs.servings) n = +t.dataset.d > 0 ? 2 : 1; else { n = S.prefs.servings + +t.dataset.d; if (n < 1) n = null; if (n > 12) n = 12; } S.prefs.servings = n; S.ui.servingsOverride = {}; persist(); renderCook(); break; }
    case "set-qty": { const it = S.pantry.find(x => x.id === t.dataset.id); const q = Number($("#sq-" + t.dataset.id).value);
      if (!it || !(q > 0)) { toast("Enter how much you have, as a number."); break; } it.qty = q; it.unit = $("#squ-" + t.dataset.id).value; persist(); renderIdeas(); toast(`Saved: ${it.name}, ${E.fmtAmount(q, it.unit)}.`); break; }
    case "rserv": { const r = getRecipe(S.ui.currentId); const cur = match(r).servings; const n = Math.max(1, Math.min(12, cur + +t.dataset.d)); const test = E.matchRecipe(r, S.pantry, S.staples, opts({ servings: n }));
      if (!test.ok) { toast(`You don't have enough for ${n} servings.`); break; } S.ui.servingsOverride[r.id] = n; renderDetail(); break; }
    case "prefs": openPrefs(); break;
    case "pick": S.ui.currentId = t.dataset.id; document.querySelectorAll(".pick[data-act=pick]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.id === S.ui.currentId))); renderDetail();
      if (window.innerWidth < 860) $("#detail").scrollIntoView({ behavior: "smooth", block: "start" }); break;
    case "cooked": openCooked(); break;
    case "feedback": openFeedback(); break;
    case "rv-remove": { const row = document.querySelector(`.rv[data-i="${t.dataset.i}"]`); if (row) row.hidden = true; break; }
    case "ai-more": askAIMore(); break;
    case "rescue": rescue(t.dataset.p); break;
    case "save-quick": saveCurrent(""); break;
    case "save-open": { const p = $("#savePop"); p.hidden = !p.hidden; break; }
    case "save-to": saveCurrent(t.dataset.col); break;
    case "unsave-current": { const ex = isSaved(getRecipe(S.ui.currentId)); if (ex) { S.saved = S.saved.filter(z => z !== ex); S.week = S.week.filter(w => w !== ex.id); persist(); renderDetail(); renderNavCounts(); toast("Removed from saved."); } break; }
    case "col-filter": S.ui.savedCol = t.dataset.c; renderSaved(); break;
    case "col-new": S.ui.addingCol = true; renderSaved(); break;
    case "open-saved": { const z = S.saved.find(x => x.id === t.dataset.id); const r = z && savedRecipe(z); if (r) { if (r.ai && !S.ui.aiRecipes.some(x => x.id === r.id)) S.ui.aiRecipes.push(r); S.ui.currentId = r.id; S.ui.mode = "most"; S.ui.focus = []; setTab("cook"); } break; }
    case "unsave": if (t.dataset.confirm) { S.saved = S.saved.filter(z => z.id !== t.dataset.id); S.week = S.week.filter(w => w !== t.dataset.id); persist(); renderSaved(); toast("Removed from saved."); } else { t.dataset.confirm = "1"; t.textContent = "Tap again"; } break;
    case "copy": navigator.clipboard.writeText(S.ui.listText || "").then(() => toast("Copied."), () => toast("Couldn't copy.")); break;
  }
});
document.addEventListener("submit", e => {
  e.preventDefault();
  const id = e.target.id;
  if (id === "authForm") { submitAuth(); return; }
  if (id === "quickAdd" || id === "homeAdd") { const inp = id === "quickAdd" ? $("#qaText") : $("#homeAddText"); if (inp.value.trim()) { addFromText(inp.value); inp.value = ""; inp.focus(); } return; }
  if (id === "itemForm") { submitItemForm(e.target); return; }
  if (id === "cookedForm") { submitCooked(); return; }
  if (id === "reviewForm") { submitReview(); return; }
  if (id === "feedbackForm") { submitFeedback(); return; }
  if (id === "prefsForm") { S.prefs.diet = [...document.querySelectorAll('input[name="diet"]:checked')].map(x => x.value); S.prefs.equipment = [...document.querySelectorAll('input[name="equip"]:checked')].map(x => x.value); persist(); closeAuth(); renderCook(); return; }
  if (id === "newCol") { const n = $("#newColName").value.trim(); if (n && !S.collections.includes(n)) { S.collections.push(n); persist(); } S.ui.addingCol = false; if (n) S.ui.savedCol = n; renderSaved(); return; }
  if (id === "popNew") { const n = $("#popNewName").value.trim(); if (n) { if (!S.collections.includes(n)) S.collections.push(n); saveCurrent(n); } return; }
});
document.addEventListener("change", e => {
  const t = e.target;
  if (t.dataset.staple) { const k = t.dataset.staple; S.staples = t.checked ? [...new Set([...S.staples, k])] : S.staples.filter(x => x !== k); persist(); return; }
  if (t.id === "kitchenSort") { S.ui.sort = t.value; renderKitchen(); return; }
  if (t.id === "oneSel") { S.ui.oneId = t.value; S.ui.currentId = null; renderIdeas(); return; }
  if (t.id === "timeSel") { S.prefs.maxTime = +t.value; persist(); renderIdeas(); return; }
  if (t.id === "cuisineSel") { S.prefs.cuisine = t.value; persist(); renderIdeas(); return; }
  if (t.id === "fCooked") { $("#fAddedWrap").hidden = t.checked; $("#fCookedWrap").hidden = !t.checked; return; }
  if (t.dataset.rvcooked !== undefined) { const i = t.dataset.rvcooked; $("#rvDate" + i).hidden = t.value !== "pick"; return; }
  if (t.id === "fOpened") { $("#fOpenedWrap").hidden = !t.checked; return; }
  if (t.dataset.move) { const z = S.saved.find(x => x.id === t.dataset.move); if (z) { z.col = t.value; persist(); renderSaved(); toast(t.value ? `Moved to ${t.value}.` : "Moved to Unsorted."); } return; }
  if (t.id === "savedSort") { S.ui.savedSort = t.value; renderSaved(); return; }
  if (t.dataset.week) { const id = t.dataset.week; S.week = t.checked ? [...S.week, id] : S.week.filter(w => w !== id); persist(); renderWeek(); return; }
});
document.addEventListener("input", e => { if (e.target.id === "savedSearch") { S.ui.savedQ = e.target.value; const pos = e.target.selectionStart; renderSaved(); const f = $("#savedSearch"); f.focus(); try { f.setSelectionRange(pos, pos); } catch (_) {} } });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#authModal").hidden) closeAuth(); });
window.addEventListener("hashchange", () => { const h = location.hash.slice(1); if (TABS.includes(h) && h !== S.tab) setTab(h); });
window.addEventListener("storage", e => { if (e.key === STORE_KEY) { try { applySnapshot(JSON.parse(e.newValue)); rerender(); } catch (_) {} } });
