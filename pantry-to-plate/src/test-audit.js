// Phase 1 completion audit: realistic scenarios + exact maths. Run: node test-audit.js
const E = require("./engine.js");
const { RECIPES } = require("./recipes.js");
const now = new Date("2026-11-19T10:00:00");
const T = "2026-11-19", ago = n => E.addDays(T, -n);
const ST = E.DEFAULT_STAPLES.concat(["onion", "fish_sauce", "flour"]);
let fails = 0, count = 0;
const ok = (c, msg) => { count++; console.log((c ? "  ✓ " : "  ✗ ") + msg); if (!c) fails++; };
const near = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;
const withCook = x => (x.cooked || (E.ING[x.key] || {}).isCooked) && !x.cookedOn && !x.unknownAge && x.loc !== "freezer" ? { ...x, cookedOn: x.added || T } : x;
const K = items => { const p = []; E.addToPantry(p, items.map(withCook), now); return p; };
const R = id => RECIPES.find(r => r.id === id);
const meals = { kind: "meals" }, drinks = { kind: "drinks" };

console.log("\n1. ALL FOUR MODES, REALISTIC LEFTOVERS");
const fridgeA = K([
  { name: "Leftover rice", key: "rice_cooked", qty: 3, unit: "cup", added: T },
  { name: "Leftover adobo chicken", key: "chicken_cooked", qty: 1.5, unit: "cup", added: ago(1) },
  { name: "Eggs", key: "egg", qty: 8, unit: "pcs", added: ago(7) },
  { name: "Cabbage", key: "cabbage", qty: 0.5, unit: "pcs", added: ago(6) },
  { name: "Carrots", key: "carrot", qty: 2, unit: "pcs", added: ago(5) },
  { name: "Tomatoes", key: "tomato", qty: 3, unit: "pcs", loc: "pantry", added: ago(2) },
  { name: "Bananas", key: "banana", qty: 3, unit: "pcs", loc: "pantry", added: ago(4) },
  { name: "Spaghetti", key: "pasta_dry", qty: 400, unit: "g", loc: "pantry", added: ago(40) },
  { name: "Milk", key: "milk", qty: 1, unit: "l", opened: true, openedOn: ago(2), added: ago(2) }]);
for (const mode of ["urgent", "most"]) {
  const r = E.rankRecipes(RECIPES, fridgeA, ST, { mode, ...meals }, now);
  console.log(`   ${mode}: ` + r.slice(0, 4).map(m => `${m.recipe.title} (q${m.recipe.q}, uses ${m.usedCount}, urgent ${m.urgentUsed.length})`).join(" · "));
  ok(r.length >= 8, `${mode}: plenty of choice (${r.length} meals)`);
  ok(r.slice(0, 3).every(m => m.recipe.q >= 4 && m.recipe.kind !== "drink"), `${mode}: top 3 are 4★+ meals, no drinks mixed in`);
}
const urg = E.rankRecipes(RECIPES, fridgeA, ST, { mode: "urgent", ...meals }, now);
ok(urg[0].urgentUsed.some(p => p.key === "rice_cooked"), "urgent: #1 uses the leftover rice (expires today)");
const most = E.rankRecipes(RECIPES, fridgeA, ST, { mode: "most", ...meals }, now);
ok(most[0].usedCount >= urg[urg.length - 1].usedCount && most[0].usedCount >= 4, `most: #1 uses ${most[0].usedCount} foods`);
const tomatoId = fridgeA.find(p => p.key === "tomato").id;
const one = E.rankRecipes(RECIPES, fridgeA, ST, { mode: "one", focus: [tomatoId], ...meals }, now);
ok(one.length >= 1 && one.every(m => m.usedItems.has(tomatoId)), `one (tomatoes): ${one.length} recipes, all use the tomatoes: ${one.slice(0, 3).map(m => m.recipe.title).join(", ")}`);
const plan = E.planEverything(RECIPES, fridgeA, ST, meals, now);
console.log("   everything: " + plan.dishes.map(m => m.recipe.title).join(" + ") + " | left: " + plan.left.map(p => p.name).join(", "));
ok(plan.dishes.length >= 2, "everything: several dishes rather than one forced recipe");
const usedIds = new Set(); let clash = false;
for (const m of plan.dishes) for (const r of E.planDeductions(m)) { if (r.all && usedIds.has(r.id)) clash = true; if (r.all) usedIds.add(r.id); }
ok(!clash, "everything: no food is fully used up by two different dishes");
const dr = E.rankRecipes(RECIPES, fridgeA, ST, { mode: "urgent", ...drinks }, now);
ok(dr.length >= 1 && dr.every(m => m.recipe.kind === "drink") && dr[0].urgentUsed.some(p => p.key === "banana"), `drinks: ${dr.map(m => m.recipe.title).join(", ")}; #1 uses the bananas`);

console.log("\n2. MATHS: AMOUNTS, SWAPS, SERVINGS");
const big = K([{ name: "Chicken thighs", key: "chicken", qty: 1, unit: "kg" }, { name: "Onions", key: "onion", qty: 4, unit: "pcs" }, { name: "Eggs", key: "egg", qty: 12, unit: "pcs" }, { name: "Rice", key: "rice_raw", qty: 2, unit: "kg", loc: "pantry" }]);
const oy2 = E.matchRecipe(R("oyakodon"), big, ST, {}, now), oy4 = E.matchRecipe(R("oyakodon"), big, ST, { servings: 4 }, now);
const q = (m, k) => m.lines.find(l => (l.sub ? l.sub.k : l.ing.k) === k || l.ing.k === k);
ok(q(oy2, "chicken").q === 250 && q(oy4, "chicken").q === 500, "chicken 250 g for 2 → 500 g for 4");
ok(q(oy4, "egg").q === 6 && q(oy4, "soy_sauce").q === 6, "eggs 3 → 6, soy 3 → 6 tbsp when doubled");
const riceLine = q(oy4, "rice_cooked");
ok(riceLine.sub && riceLine.sub.k === "rice_raw" && near(riceLine.q, 1.5), "swap: no cooked rice → raw rice, ¾ cup ×2 = 1.5 cups");
const d4 = E.planDeductions(oy4);
ok(near(d4.find(r => r.name === "Chicken thighs").take, 0.5), "deduct 500 g from a 1 kg pack = 0.5 kg");
ok(near(d4.find(r => r.name === "Rice").take, 1.5 * 185 / 1000, 0.002), "deduct 1.5 cups raw rice ≈ 0.28 kg");
const d1 = E.planDeductions(E.matchRecipe(R("oyakodon"), big, ST, { servings: 1 }, now));
ok(d1.find(r => r.name === "Eggs").take === 2, "1 serving: 1.5 eggs scaled → 2 whole eggs used, matching what the recipe shows");
const twoRice = K([{ name: "Leftover rice", key: "rice_cooked", qty: 2, unit: "cup" }, { name: "Eggs", key: "egg", qty: 2, unit: "pcs" }]);
const fm = E.fitMatch(R("egg-fried-rice"), twoRice, ST, {}, now);
ok(fm.ok && fm.scaledDown && fm.servings === 1, "only 2 of 3 cups rice → smaller batch (1 serving) instead of hiding it");
const ex = E.matchRecipe(R("egg-fried-rice"), twoRice, ST, { servings: 2 }, now);
ok(!ex.ok, "asking for the full 2 servings correctly says there isn't enough");
const cans = K([{ name: "Canned tomatoes", key: "canned_tomato", qty: 2, unit: "can" }, { name: "Eggs", key: "egg", qty: 4, unit: "pcs" }]);
const te = E.matchRecipe(R("tomato-egg"), cans, ST, {}, now);
const sw = te.swaps.find(s => s.sub.k === "canned_tomato");
ok(sw && sw.q === 1 && sw.unit === "cup", "swap amount: 1 cup canned tomatoes for 3 fresh");
ok(near(E.planDeductions(te).find(r => r.name === "Canned tomatoes").take, 0.6), "1 cup (240 g) from 400 g cans = 0.6 can");

console.log("\n3. DEDUCTIONS USE WHAT YOU CONFIRM");
const before = K([{ name: "Eggs", key: "egg", qty: 6, unit: "pcs" }, { name: "Milk", key: "milk", qty: 1000, unit: "ml" }, { name: "Spinach", key: "spinach", qty: null }]);
const ids = Object.fromEntries(before.map(p => [p.name, p.id]));
const after = E.applyDeductions(before, [{ id: ids.Eggs, take: 4, all: false }, { id: ids.Milk, take: 150, all: false }, { id: ids.Spinach, take: null, all: true }]).pantry;
ok(after.find(p => p.name === "Eggs").qty === 2, "used 4 of 6 eggs (user-edited) → 2 left");
ok(after.find(p => p.name === "Milk").qty === 850, "used 150 ml milk → 850 ml left");
ok(!after.some(p => p.name === "Spinach"), "'used it all' on an item with no amount removes it");
const untouched = E.applyDeductions(before, [{ id: ids.Eggs, take: 0, all: false }]).pantry;
ok(untouched.find(p => p.name === "Eggs").qty === 6, "taking 0 changes nothing");
ok(E.applyDeductions(before, [{ id: ids.Eggs, take: 99, all: false }]).pantry.every(p => p.name !== "Eggs"), "taking more than you have just uses it up (no negative amounts)");

console.log("\n4. LEFTOVERS GET THEIR OWN STORAGE GUIDANCE");
const loAdobo = E.leftoverItem(R("chicken-adobo"), 2, now), loRice = E.leftoverItem(R("kimchi-fried-rice"), 1, now);
ok(loAdobo.key === "leftover" && loAdobo.cooked && loAdobo.loc === "fridge" && E.freshness(loAdobo, now).daysLeft === 3, "adobo leftovers: fridge, 3 days");
ok(loRice.riceDish && E.freshness(loRice, now).daysLeft === 1, "rice-dish leftovers: 24 hours (UK FSA)");
ok(/steaming hot/.test(loAdobo.notes) && /once/.test(loRice.notes), "notes explain reheating (steaming hot; rice only once)");
const lo2 = K([]); E.addToPantry(lo2, [loAdobo], now); E.addToPantry(lo2, [E.leftoverItem(R("tinola"), 3, now)], now);
ok(lo2.length === 2, "two different leftover dishes stay as two entries");

console.log("\n5. FRESHNESS SYSTEM");
const F = s => E.freshness(E.newItem(withCook(s), now), now);
ok(!F({ name: "Leftover stew", key: "leftover", unknownAge: true }).safe, "unknown-age cooked food: not called safe");
ok(F({ name: "Mystery soup", key: "leftover", unknownAge: true, loc: "freezer" }).safe, "unknown-age but frozen: safe while frozen, no invented date");
ok(!F({ name: "Yogurt", key: "yogurt", label: { type: "useby", date: ago(1) } }).safe, "past printed use-by: don't eat");
ok(F({ name: "Pasta", key: "pasta_dry", loc: "pantry", label: { type: "bestbefore", date: ago(30) } }).safe, "dry pasta past best-before: quality warning, still usable");
ok(F({ name: "Cream", key: "cream", loc: "fridge", added: ago(1), label: { type: "bestbefore", date: ago(2) } }).safe, "cream past best-before but bought yesterday: NOT called unsafe (quality date)");
ok(!F({ name: "Cream", key: "cream", loc: "fridge", added: ago(10), label: { type: "bestbefore", date: E.addDays(T, 5) } }).safe, "cream within best-before but 10 days in the fridge: storage time still applies");
ok(F({ name: "Milk", key: "milk", added: ago(3), opened: true, openedOn: ago(1), label: { type: "useby", date: E.addDays(T, 20) } }).daysLeft === 4, "opened milk: 5 days from opening beats a later printed date");
ok(F({ name: "Mayo", key: "mayonnaise", opened: true, openedOn: ago(10), added: ago(30) }).daysLeft === 50, "opened mayo: 60 days from opening");
ok(F({ name: "Chicken", key: "chicken", loc: "freezer", added: ago(400) }).safe, "frozen chicken past best quality: still safe while frozen");
ok(F({ name: "Chicken", key: "chicken", loc: "fridge", added: ago(30), thawedOn: T }).safe, "thawed today: clock restarts from thawing");
ok(!F({ name: "Chicken", key: "chicken", loc: "fridge", added: ago(30), thawedOn: ago(3) }).safe, "thawed 3 days ago: past the 1–2 day window");
ok(!F({ name: "Leftover rice", key: "rice_cooked", added: ago(2) }).safe, "rice cooked 2 days ago: don't eat");
ok(F({ name: "Chicken", key: "chicken", loc: "pantry" }).group === "check", "raw chicken left in the cupboard: flagged");
const est = F({ name: "Spinach", key: "spinach", added: ago(1) });
ok(/estimate/.test(est.note) && /Best used/.test(est.note), "estimates are worded as guides: '" + est.note + "'");
ok(F({ name: "Dragonfruit jam", added: ago(1) }).basis === "estimate", "unknown foods get a cautious estimate");

console.log("\n6. RANKING BALANCE");
const sc = (q, urgentN, used) => E.scoreMatch({ recipe: { q, prep: 10, cook: 10 }, swaps: [], lines: [{ ing: {}, items: Array(urgentN).fill({ fr: { group: "first" } }) }], usedCount: used }, "urgent").total;
ok(sc(5, 1, 1) > sc(3, 5, 5), "5★ using 1 urgent food beats 3★ using 5");
ok(sc(4, 4, 4) > sc(5, 0, 1), "4★ that saves 4 urgent foods beats 5★ that saves none (waste matters)");
ok(sc(4, 2, 2) > sc(4, 0, 2), "same quality: the one using urgent food ranks higher");
const ai = E.scoreMatch({ recipe: { q: 4, ai: true, prep: 10, cook: 10 }, swaps: [], lines: [], usedCount: 2 }, "most").total;
ok(ai < E.scoreMatch({ recipe: { q: 4, prep: 10, cook: 10 }, swaps: [], lines: [], usedCount: 2 }, "most").total, "untested AI recipe ranks below an equal library recipe (reliability)");

console.log(`\n${count - fails}/${count} checks passed` + (fails ? ` — ${fails} FAILED` : ""));
process.exit(fails ? 1 : 0);
