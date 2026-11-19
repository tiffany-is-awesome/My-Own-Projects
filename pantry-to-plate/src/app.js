/* =====================================================================
   APP: state, saving, and every screen. The engine (engine.js) does the
   thinking; this file only shows things and reacts to taps.
   ===================================================================== */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);
const E = Engine;
const LIB = RECIPES;
const GROUP_COLORS = { check: "var(--urgent)", first: "#C2410C", soon: "#B7791F", fresh: "var(--accent)", long: "#7A8A9A" };
const CUISINES = ["Filipino","Chinese","Japanese","Korean","Italian","American","Mexican","Southeast Asian","French","Any"];

/* ---------- State ---------- */
const S = {
  tab: "home", pantry: [], staples: [], saved: [], collections: [], week: [], history: [],
  prefs: { servings: null, maxTime: 0, cuisine: "any", diet: [], equipment: ["stove", "blender"], kind: "meals", v: 2 },
  sample: false, savedAt: 0,
  ui: { loc: "all", sort: "fresh", mode: "urgent", focus: [], pins: [], currentId: null, oneId: null, aiRecipes: [], aiBusy: false, servingsOverride: {} },
  aiChecking: true
};
const STORE_KEY = "p2p.v3";
function snapshot() { return { v: 3, owner: S.owner || null, pantry: S.pantry, staples: S.staples, saved: S.saved, collections: S.collections, week: S.week, history: S.history, prefs: S.prefs, sample: S.sample, savedAt: S.savedAt || 0 }; }
function saveLocal() { try { localStorage.setItem(STORE_KEY, JSON.stringify(snapshot())); } catch (e) {} }
// Each save is always newer than anything this device has already seen, even if another device's clock runs ahead.
function persist() { S.savedAt = Math.max(Date.now(), (S.savedAt || 0) + 1); saveLocal(); if (typeof Cloud !== "undefined") Cloud.schedule(); }
function applySnapshot(d) {
  if (!d) return;
  if (d.v !== 3) d = migrateV2(d);
  S.pantry = (d.pantry || []).map(p => E.newItem(p));
  S.staples = Array.isArray(d.staples) ? d.staples : E.DEFAULT_STAPLES.slice();
  S.saved = d.saved || []; S.collections = d.collections || []; S.week = d.week || [];
  S.history = d.history || []; S.prefs = Object.assign({ servings: null, maxTime: 0, cuisine: "any", diet: [], equipment: ["stove", "blender"], kind: "meals" }, d.prefs || {});
  if ((S.prefs.v || 1) < 2) { if (!S.prefs.equipment.includes("blender")) S.prefs.equipment.push("blender"); S.prefs.kind = S.prefs.kind || "meals"; S.prefs.v = 2; }
  S.owner = d.owner || null;
  S.sample = !!d.sample; S.savedAt = d.savedAt || 0;
}
/* Older versions stored "days left" as a fixed number. Keep everything, convert it to dates. */
function migrateV2(d) {
  const today = E.todayISO();
  const pantry = (d.pantry || []).map(o => {
    const parts = String(o.qty || "").split(",").map(x => x.trim()).filter(Boolean);
    const tries = (parts.length ? parts : [""]).map(q => E.parseIngredientText((q ? q + " " : "") + o.name).slice(-1)[0] || {});
    const parsed = tries.find(t => ["g", "kg", "ml", "l", "cup"].includes(t.unit)) || tries[0] || {};
    return { name: o.name, key: parsed.key || E.resolveKey(o.name), qty: parsed.qty ?? null, unit: parsed.unit || null, loc: parsed.loc,
      cooked: parsed.cooked, added: today, est: o.days != null ? E.addDays(today, Math.max(0, o.days)) : null, notes: "" };
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
    { name: "Leftover rice", key: "rice_cooked", qty: 2, unit: "cup", loc: "fridge", added: t },
    { name: "Leftover chicken", key: "chicken_cooked", qty: 1, unit: "cup", loc: "fridge", added: ago(1) },
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
  if (!d) { try { const old = JSON.parse(localStorage.getItem("p2p.v2") || "null"); if (old && Array.isArray(old.pantry)) d = migrateV2(old); } catch (e) {} }
  if (d) applySnapshot(d); else seedKitchen();
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
function amountLabel(p) { return p.qty == null ? "Amount not recorded" : E.fmtAmount(p.qty, p.unit) + (p.unit === "pcs" || !p.unit ? "" : ""); }
let tt; function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("show"), 3800); }
function openModal(html, focusSel) { $("#authBox").innerHTML = html; $("#authModal").hidden = false; const f = focusSel ? $("#authBox " + focusSel) : $("#authBox input, #authBox button"); if (f) f.focus(); }
function closeAuth() { $("#authModal").hidden = true; }

/* ---------- Tabs ---------- */
const TABS = ["home", "kitchen", "cook", "saved"];
function setTab(t, keepScroll) {
  if (!TABS.includes(t)) t = "home";
  S.tab = t;
  document.querySelectorAll(".view").forEach(v => v.hidden = v.id !== "view-" + t);
  document.querySelectorAll("nav button").forEach(b => { if (b.dataset.tab === t) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  if (location.hash.slice(1) !== t) history.replaceState(null, "", "#" + t);
  ({ home: renderHome, kitchen: renderKitchen, cook: renderCook, saved: renderSaved })[t]();
  renderNavCounts(); renderCookbar();
  if (!keepScroll) window.scrollTo({ top: 0 });
}
function renderNavCounts() { $("#navKitchen").textContent = S.pantry.length || ""; $("#navSaved").textContent = S.saved.length || ""; }

/* =====================================================================
   HOME
   ===================================================================== */
function renderHome() {
  const items = S.pantry.map(p => ({ p, f: fr(p) }));
  const check = items.filter(x => x.f.group === "check");
  $("#homeAlert").innerHTML = check.length ? `<button class="alert" data-act="go-check"><b>${check.length} food${check.length > 1 ? "s" : ""} may not be safe to eat.</b> Review ${check.length > 1 ? "them" : "it"} in My kitchen →</button>` : "";
  const urgent = items.filter(x => x.f.group === "first" || x.f.group === "soon").sort((a, b) => (a.f.daysLeft ?? 99) - (b.f.daysLeft ?? 99)).slice(0, 6);
  $("#homeUse").innerHTML = urgent.length ? `<ul class="uselist">${urgent.map(({ p, f }) => `<li><span class="dot" style="background:${GROUP_COLORS[f.group]}"></span><span><b>${esc(p.name)}</b> <span class="muted">${esc(amountLabel(p))}</span><br><small>${esc(f.note)}</small></span></li>`).join("")}</ul>`
    : `<p class="muted">Nothing urgent. ${S.pantry.length ? "Your kitchen is in good shape." : "Add what you have to get started."}</p>`;
  const ranked = E.rankRecipes(allRecipes(), S.pantry, S.staples, opts({ mode: "urgent", servings: S.prefs.servings || null, kind: "meals" }));
  const drink = E.rankRecipes(allRecipes(), S.pantry, S.staples, opts({ mode: "urgent", servings: null, kind: "drinks" }))[0];
  const pick = ranked[0];
  $("#homePick").innerHTML = pick ? `<div class="pick-hero"><canvas width="240" height="300" id="homePickCanvas" aria-hidden="true"></canvas>
      <div><span class="label">${esc(pick.recipe.cuisine)} · ${pick.recipe.prep + pick.recipe.cook} min · ${esc(pick.recipe.difficulty || "Easy")}</span>
      <h3>${esc(pick.recipe.title)}</h3><p>${esc(pick.recipe.desc)}</p>
      <p class="why">${whyLine(pick)}</p>
      <button class="btn primary" data-act="open-recipe" data-id="${esc(pick.recipe.id)}">Cook this</button></div></div>`
    : `<p class="muted">Add a few foods and I'll suggest something.</p>`;
  if (pick) drawPlate($("#homePickCanvas"), pick.recipe, null);
  const row = (m, pre = "") => `<li><button class="rowbtn" data-act="open-recipe" data-id="${esc(m.recipe.id)}"><b>${pre}${esc(m.recipe.title)}</b><span>${m.recipe.prep + m.recipe.cook} min · uses ${m.usedCount} of your foods${m.urgentUsed.length ? " · saves " + m.urgentUsed.length + " that need using" : ""}</span></button></li>`;
  $("#homeQuick").innerHTML = ranked.length > 1 || drink ? `<ul class="quicklist">${ranked.slice(1, 4).map(m => row(m)).join("")}${drink ? row(drink, "Drink: ") : ""}</ul>` : `<p class="muted">More ideas appear as you add food.</p>`;
  const meals = S.history.length, used = S.history.reduce((n, h) => n + (h.used || []).length, 0);
  const grams = S.history.reduce((g, h) => g + (h.used || []).reduce((s, u) => s + (u.g || 0), 0), 0);
  const unknown = S.history.some(h => (h.used || []).some(u => u.g == null));
  $("#homeProgress").innerHTML = meals ? `<div class="stats"><div><b>${meals}</b><span>meal${meals > 1 ? "s" : ""} cooked</span></div><div><b>${used}</b><span>foods used up</span></div><div><b>${grams >= 1000 ? (grams / 1000).toFixed(1) + " kg" : Math.round(grams) + " g"}</b><span>food cooked from your kitchen${unknown ? "*" : ""}</span></div></div>
     <p class="muted small">Weights come from the amounts you recorded${unknown ? ". *Foods without a recorded amount aren't counted" : ""}. Money saved is coming with My Impact.</p>`
    : `<p class="muted">After you cook a recipe and tap "I made this", you'll see what you've used up here. Every meal counts.</p>`;
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
  $("#sampleNote").innerHTML = S.sample ? `<div class="note-bar"><span>This is a <b>sample kitchen</b> so you can see how it works.</span><button class="btn small" data-act="clear-sample">Start with an empty kitchen</button></div>` : "";
  const counts = { all: S.pantry.length, fridge: 0, freezer: 0, pantry: 0 }; S.pantry.forEach(p => counts[p.loc]++);
  $("#locFilters").innerHTML = [["all", "Everything"], ["fridge", "Fridge"], ["freezer", "Freezer"], ["pantry", "Cupboard"]].map(([k, l]) => `<button data-act="loc" data-v="${k}" aria-pressed="${S.ui.loc === k}">${l} <span class="mono muted">${counts[k]}</span></button>`).join("");
  $("#kitchenSort").value = S.ui.sort;
  let items = S.pantry.filter(p => S.ui.loc === "all" || p.loc === S.ui.loc).map(p => ({ p, f: fr(p) }));
  S.ui.pins = S.ui.pins.filter(id => S.pantry.some(p => p.id === id));
  const card = ({ p, f }) => {
    const pinned = S.ui.pins.includes(p.id);
    const tags = [E.LOCS[p.loc], p.cooked ? "Cooked" : "", p.opened ? "Opened" : "", p.label ? (p.label.type === "useby" ? "Use-by date" : "Best-before date") : ""].filter(Boolean);
    return `<div class="item g-${f.group}${pinned ? " pinned" : ""}">
      <button class="item-main" data-act="item-edit" data-id="${p.id}" aria-label="Edit ${esc(p.name)}">
        <span class="name">${esc(p.name)}</span>
        <span class="amt">${esc(amountLabel(p))}</span>
        <span class="fresh" style="color:${GROUP_COLORS[f.group]}">${esc(f.note)}</span>
        <span class="tags">${tags.map(t => `<i>${esc(t)}</i>`).join("")}</span>
      </button>
      ${f.group === "check" ? `<button class="btn small danger" data-act="item-toss" data-id="${p.id}">Throw out</button>`
        : p.loc === "freezer" ? `<button class="btn small pinbtn" data-act="thaw" data-id="${p.id}">Thaw in the fridge</button>`
        : `<button class="btn small pinbtn" data-act="pin" data-id="${p.id}" aria-pressed="${pinned}">${pinned ? "✓ Cook with this" : "Cook with this"}</button>`}
    </div>`;
  };
  let html = "";
  if (!items.length) html = `<div class="empty">${S.pantry.length ? "Nothing kept here." : "Your kitchen is empty. Type what you have above, or open <b>Check every spot</b>."}</div>`;
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
  const before = S.pantry.length;
  const r = E.addToPantry(S.pantry, items.map(x => ({ ...x, added: E.todayISO() })));
  S.sample = false; persist();
  const unknown = r.added.filter(p => !p.key).map(p => p.name);
  let msg = r.added.length ? "Added " + r.added.map(p => p.name).join(", ") : "";
  if (r.merged.length) msg += (msg ? ". " : "") + "Updated " + r.merged.map(p => p.name + " (now " + amountLabel(p) + ")").join(", ");
  if (unknown.length) msg += ". I don't know " + unknown.join(", ") + " yet, so freshness is a cautious guess: tap it to set a date.";
  toast(msg + ".");
  if (S.tab === "kitchen") renderKitchen(); else if (S.tab === "home") renderHome();
  renderNavCounts();
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
    <label for="fAdded"><span id="fAddedLabel">${p.cooked ? "Cooked on" : "Bought on"}</span><input type="date" id="fAdded" value="${esc(p.added || "")}" max="${E.todayISO()}"></label>
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
    cooked: v("fCooked").checked, added: v("fAdded").value || E.todayISO(), unknownAge: v("fUnknown").checked, opened: v("fOpened").checked,
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
function currentList() {
  const focus = S.ui.mode === "one" ? (S.ui.oneId ? [S.ui.oneId] : []) : S.ui.focus;
  if (S.ui.mode === "everything") return { plan: E.planEverything(allRecipes(), S.pantry, S.staples, opts({ focus }), undefined) };
  return { list: E.rankRecipes(allRecipes(), S.pantry, S.staples, opts({ focus })) };
}
function ideaCard(m, extra = "") {
  const r = m.recipe;
  return `<button class="pick" data-act="pick" data-id="${esc(r.id)}" aria-pressed="${S.ui.currentId === r.id}">
    <canvas width="128" height="160" data-pthumb="${esc(r.id)}" aria-hidden="true"></canvas>
    <span class="pt"><span class="label">${esc(r.cuisine)} · ${styleLabel(r)}${isSaved(r) ? ' · <span class="savedmark">Saved</span>' : ""}</span><strong>${esc(r.title)}</strong>
    <span class="meta">${r.prep + r.cook} min · ${esc(r.difficulty || "Easy")} · uses ${m.usedCount} of yours${m.urgentUsed.length ? ` · <span class="urg">saves ${m.urgentUsed.length} that need using</span>` : ""}${m.swaps.length ? " · " + m.swaps.length + " swap" + (m.swaps.length > 1 ? "s" : "") : ""}${m.scaledDown ? " · smaller batch" : ""}</span>${extra}</span></button>`;
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
  html += `<div class="ai-more">${AI.ready ? `<button class="btn" data-act="ai-more"${S.ui.aiBusy ? " disabled" : ""}>${S.ui.aiBusy ? "Asking the AI…" : "Ask the AI for more ideas"}</button><small>AI recipes are checked against your kitchen before they're shown.</small>` : `<small>Recipes come from a tested library, so they work even without AI.</small>`}</div>`;
  $("#ideas").innerHTML = html;
  document.querySelectorAll("canvas[data-pthumb]").forEach(cv => { const r = getRecipe(cv.dataset.pthumb); if (r) drawPlate(cv, r, null); });
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
    const amount = l.ing.q == null ? esc(l.ing.amountText || "") : esc(E.fmtAmount(l.q, u));
    const have = l.src === "pantry" ? l.items.map(x => x.p.name + (x.p.qty != null ? " (" + amountLabel(x.p) + ")" : "")).join(", ") : "";
    const tag = l.src === "pantry" ? `<span class="st have">Yours</span>` : `<span class="st">Staple</span>`;
    const sw = l.sub ? `<div class="swapbox"><b>Swap: ${esc(E.fmtAmount(l.q, u))} ${esc(l.name.toLowerCase())} instead of ${esc(l.subFor.toLowerCase())}</b><span><i>Flavor:</i> ${esc(l.sub.f)}</span><span><i>Texture:</i> ${esc(l.sub.t)}</span><span><i>How:</i> ${esc(l.sub.w)}</span></div>` : "";
    const short = l.short && !l.unknown ? `<span class="inote warn">You have a little less than this; it'll still work.</span>` : "";
    return `<li><div><span class="iname">${esc(l.sub ? l.name : (l.ing.any ? l.ing.label || l.name : l.name))}</span> <span class="amt">${amount}</span>${l.ing.note ? `<span class="inote">${esc(l.ing.note)}</span>` : ""}${have ? `<span class="inote">From: ${esc(have)}</span>` : ""}${short}${sw}</div>${tag}</li>`;
  };
  const safety = E.safetyNotes(m);
  box.innerHTML = `
    <div class="detail-top">
      <div class="frame"><canvas id="plate" width="480" height="600" aria-label="Illustration of ${esc(r.title)}"></canvas></div>
      <div class="detail-head">
        <span class="label">${esc(r.cuisine)} · <span class="style-${(r.style || "").toLowerCase()}">${styleLabel(r)}</span></span>
        <h2>${esc(r.title)}</h2>
        <p>${esc(r.desc)}</p>
        ${r.styleNote ? `<p class="small muted">${esc(r.styleNote)}</p>` : ""}
        ${r.ai ? `<p class="small warnbox">Written by AI${r.reviewed ? ", reviewed for taste and safety," : ""} and checked against your kitchen and sensible amounts. It hasn't been test-cooked like the library recipes, so read it through before cooking and follow the safety notes.</p>` : ""}
        <dl class="spec">
          <div><dt>${r.kind === "drink" ? "Makes" : "Serves"}</dt><dd><div class="stepper"><button data-act="rserv" data-d="-1" aria-label="Fewer servings">−</button><b>${sv}${r.kind === "drink" ? " glass" + (sv > 1 ? "es" : "") : ""}</b><button data-act="rserv" data-d="1" aria-label="More servings">+</button></div>${m.scaledDown ? `<small class="muted">Smaller batch to fit what you have</small>` : ""}</dd></div>
          <div><dt>Time</dt><dd>${r.prep} min prep · ${r.cook} min cooking</dd></div>
          <div><dt>Difficulty</dt><dd>${esc(r.difficulty || "Easy")}</dd></div>
          <div><dt>From your kitchen</dt><dd>${m.usedCount} of your foods + staples · <b class="ok">nothing to buy</b>${m.urgentUsed.length ? `<br><span class="urg">Uses up: ${esc(m.urgentUsed.map(p => p.name).join(", "))}</span>` : ""}</dd></div>
        </dl>
        <div class="actions-row">
          <button class="btn primary" data-act="cooked">I made this</button>
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
  drawPlate($("#plate"), r, null);
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
  S.sample = false; persist(); closeAuth();
  toast(`Kitchen updated: ${res.used.length} food${res.used.length === 1 ? "" : "s"} used${left ? ", " + left + " serving" + (left > 1 ? "s" : "") + " of leftovers saved" : ""}. Enjoy!`);
  rerender();
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
    toast(kept.length ? `Added ${kept.length} AI recipe${kept.length > 1 ? "s" : ""}${dropped ? `; left out ${dropped} that didn't pass the taste, safety or ingredient checks` : ""}.` : "None of the AI's ideas passed the taste, safety and ingredient checks, so I left them out. The tested recipes are still here.");
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
  document.querySelectorAll("canvas[data-thumb]").forEach(cv => { const z = S.saved.find(x => x.id === cv.dataset.thumb); if (z && savedRecipe(z)) drawPlate(cv, savedRecipe(z), null); });
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
    AI.puterSignIn().then(() => { closeAuth(); toast("Free AI is on. Enjoy!"); renderAiStatus(); const f = S.afterPuter; S.afterPuter = null; if (f) f(); })
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
      E.addToPantry(S.pantry, [{ ...parsed, name: n, loc: ZONE_LOC[t.dataset.z] || (["Back of the fridge", "Fridge shelves", "Fridge door", "Crisper drawers"].includes(t.dataset.z) ? "fridge" : parsed.loc), added: E.todayISO() }]);
      S.sample = false; persist(); renderKitchen(); toast(`Added ${n}. Tap it to add the amount or dates.`); break; }
    case "pin": { const id = t.dataset.id; if (S.ui.pins.includes(id)) S.ui.pins = S.ui.pins.filter(x => x !== id); else if (S.ui.pins.length >= 3) toast("Pick up to 3 foods to build a meal around."); else S.ui.pins.push(id); renderKitchen(); break; }
    case "pins-clear": S.ui.pins = []; renderKitchen(); break;
    case "thaw": { const it = S.pantry.find(x => x.id === t.dataset.id); if (it) { it.loc = "fridge"; it.thawedOn = E.todayISO(); persist(); renderKitchen(); toast(`${it.name} moved to the fridge to thaw. Thaw in the fridge, never on the counter, and use it soon after.`); } break; }
    case "cook-pins": S.ui.focus = S.ui.pins.slice(); S.ui.pins = []; S.ui.mode = "most"; S.ui.currentId = null; setTab("cook"); break;
    case "focus-clear": S.ui.focus = []; renderCook(); break;
    case "mode": S.ui.mode = t.dataset.mode; S.ui.currentId = null; renderCook(); break;
    case "kind": S.prefs.kind = t.dataset.k; S.ui.currentId = null; persist(); renderCook(); break;
    case "serv": { let n; if (!S.prefs.servings) n = +t.dataset.d > 0 ? 2 : 1; else { n = S.prefs.servings + +t.dataset.d; if (n < 1) n = null; if (n > 12) n = 12; } S.prefs.servings = n; S.ui.servingsOverride = {}; persist(); renderCook(); break; }
    case "rserv": { const r = getRecipe(S.ui.currentId); const cur = match(r).servings; const n = Math.max(1, Math.min(12, cur + +t.dataset.d)); const test = E.matchRecipe(r, S.pantry, S.staples, opts({ servings: n }));
      if (!test.ok) { toast(`You don't have enough for ${n} servings.`); break; } S.ui.servingsOverride[r.id] = n; renderDetail(); break; }
    case "prefs": openPrefs(); break;
    case "pick": S.ui.currentId = t.dataset.id; document.querySelectorAll(".pick[data-act=pick]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.id === S.ui.currentId))); renderDetail();
      if (window.innerWidth < 860) $("#detail").scrollIntoView({ behavior: "smooth", block: "start" }); break;
    case "cooked": openCooked(); break;
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
  if (t.id === "fCooked") { $("#fAddedLabel").textContent = t.checked ? "Cooked on" : "Bought on"; return; }
  if (t.id === "fOpened") { $("#fOpenedWrap").hidden = !t.checked; return; }
  if (t.dataset.move) { const z = S.saved.find(x => x.id === t.dataset.move); if (z) { z.col = t.value; persist(); renderSaved(); toast(t.value ? `Moved to ${t.value}.` : "Moved to Unsorted."); } return; }
  if (t.id === "savedSort") { S.ui.savedSort = t.value; renderSaved(); return; }
  if (t.dataset.week) { const id = t.dataset.week; S.week = t.checked ? [...S.week, id] : S.week.filter(w => w !== id); persist(); renderWeek(); return; }
});
document.addEventListener("input", e => { if (e.target.id === "savedSearch") { S.ui.savedQ = e.target.value; const pos = e.target.selectionStart; renderSaved(); const f = $("#savedSearch"); f.focus(); try { f.setSelectionRange(pos, pos); } catch (_) {} } });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#authModal").hidden) closeAuth(); });
window.addEventListener("hashchange", () => { const h = location.hash.slice(1); if (TABS.includes(h) && h !== S.tab) setTab(h); });
window.addEventListener("storage", e => { if (e.key === STORE_KEY) { try { applySnapshot(JSON.parse(e.newValue)); rerender(); } catch (_) {} } });
