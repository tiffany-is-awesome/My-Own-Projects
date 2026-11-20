// Final technical pass: scaling × deductions × unknown amounts, tolerances, leftover dates. Run: node test-final.js
const E = require("./engine.js");
const { RECIPES } = require("./recipes.js");
const now = new Date("2026-11-20T10:00:00");
const T = "2026-11-20";
const ST = E.DEFAULT_STAPLES.concat(["onion", "fish_sauce", "flour"]);
let fails = 0, count = 0;
const ok = (c, msg) => { count++; console.log((c ? "  ✓ " : "  ✗ ") + msg); if (!c) fails++; };
const K = items => { const p = []; E.addToPantry(p, items, now); return p; };
const R = id => RECIPES.find(r => r.id === id);
const G = (p, id) => { const x = p.find(i => i.id === id); return x ? E.toGrams(x.key, x.qty, x.unit) : 0; };
const ded = (pantry, m) => { const rows = E.planDeductions(m); const out = E.applyDeductions(JSON.parse(JSON.stringify(pantry)), rows); return { rows, after: out.pantry || out.next || out[0] || out }; };

console.log("\nA. Scaling × deductions (known amounts)");
const fr = R("egg-fried-rice");
{ const p = K([{ name: "Eggs", key: "egg", qty: 12, unit: "pcs" }, { name: "Cooked rice", key: "rice_cooked", qty: 1500, unit: "g", cooked: true, cookedOn: T }]);
  const m = E.matchRecipe(fr, p, ST, { servings: 8 }, now), f = E.fitMatch(fr, p, ST, { servings: 8 }, now);
  ok(!m.ok && f && f.servings < 8 && f.servings >= 5, `8 servings with only 1.5 kg rice → not enough; offers ${f && f.servings} servings instead`); }
for (const sv of [1, 2, 3, 5, 8]) {
  const p = K([{ name: "Eggs", key: "egg", qty: 12, unit: "pcs" }, { name: "Cooked rice", key: "rice_cooked", qty: 4000, unit: "g", cooked: true, cookedOn: T }]);
  const m = E.matchRecipe(fr, p, ST, { servings: sv }, now);
  const rows = E.planDeductions(m);
  const eggNeed = m.lines.find(l => l.items && l.items.some(x => x.p.key === "egg"));
  const eggRow = rows.find(r => r.name === "Eggs");
  ok(m.ok && eggRow && Math.abs(eggRow.take - E.fromGrams("egg", eggNeed.needG, "pcs")) < 0.01, `${sv} servings: eggs taken (${eggRow && eggRow.take}) = eggs the recipe lists`);
}
console.log("\nB. Never takes more than you have, across two batches, soonest first");
{
  const p = K([{ name: "Eggs", key: "egg", qty: 2, unit: "pcs", label: { type: "bestbefore", date: E.addDays(T, 3) } }, { name: "Eggs", key: "egg", qty: 10, unit: "pcs", label: { type: "bestbefore", date: E.addDays(T, 20) } }, { name: "Cooked rice", key: "rice_cooked", qty: 1500, unit: "g", cooked: true, cookedOn: T }]);
  const m = E.matchRecipe(fr, p, ST, { servings: 5 }, now);
  const rows = E.planDeductions(m).filter(r => r.name === "Eggs");
  const soon = p.find(i => i.key === "egg" && i.label.date === E.addDays(T, 3));
  ok(rows.length === 2 && rows.find(r => r.id === soon.id).take === 2 && rows.find(r => r.id === soon.id).all, "the 2 eggs expiring sooner are used up first, the rest comes from the other carton");
  ok(rows.every(r => r.take <= r.qty), "no row takes more than that batch has");
}
console.log("\nC. Tolerance × scaling × deduction");
{
  const gg = R("garlic-greens");
  const need2 = E.matchRecipe(gg, K([{ name: "Spinach", key: "spinach", qty: 2000, unit: "g" }]), ST, {}, now);
  const needG = need2.lines.find(l => l.ing.any).needG;
  const have = Math.round(needG * 0.9);
  const p = K([{ name: "Spinach", key: "spinach", qty: have, unit: "g" }]);
  const m = E.matchRecipe(gg, p, ST, {}, now);
  const l = m.lines.find(x => x.ing.any);
  ok(m.ok && l.tolUsed, `90% of the greens (${have} g of ${needG} g) → full recipe, flagged 'a little less'`);
  const rows = E.planDeductions(m);
  ok(rows[0].take === have && rows[0].all, "and it uses exactly what you have, never a negative amount");
  const p2 = K([{ name: "Spinach", key: "spinach", qty: Math.round(needG * 0.75), unit: "g" }]);
  const m2 = E.fitMatch(gg, p2, ST, {}, now);
  ok(!m2 || m2.servings < gg.serves, `75% of the greens → no longer passed off as the full recipe (${m2 ? "offers " + m2.servings + " serving(s) instead" : "not offered"})`);
  const big = E.matchRecipe(R("veg-soup"), K([{ name: "Carrots", key: "carrot", qty: 400, unit: "g" }, { name: "Cabbage", key: "cabbage", qty: 400, unit: "g" }]), ST, { servings: 8 }, now);
  ok(!big.ok || big.lines.every(l => !l.ing.any || l.needG == null || l.haveG >= l.needG * l.ing.tol - 1e-6), "doubling a recipe doubles what the tolerance is measured against");
}
console.log("\nD. Unknown amounts × scaling × deduction");
{
  const p = K([{ name: "Spinach", key: "spinach" }, { name: "Eggs", key: "egg", qty: 6, unit: "pcs" }]);
  for (const sv of [1, 2, 6]) {
    const m = E.matchRecipe(R("garlic-greens"), p, ST, { servings: sv }, now);
    const row = E.planDeductions(m).find(r => r.name === "Spinach");
    ok(m.unconfirmed.length === 1 && row.unknown && row.take === null, `${sv} serving(s): spinach amount still 'unconfirmed', and nothing is deducted until you say how much you used`);
  }
  const before = JSON.stringify(p);
  E.applyDeductions(p, E.planDeductions(E.matchRecipe(R("garlic-greens"), p, ST, {}, now)));
  ok(JSON.stringify(p) === before, "applyDeductions doesn't change the pantry it was given");
  const mix = K([{ name: "Spinach", key: "spinach" }, { name: "Cabbage", key: "cabbage", qty: 1000, unit: "g" }]);
  const mm = E.matchRecipe(R("garlic-greens"), mix, ST, {}, now);
  const rows = E.planDeductions(mm);
  ok(rows.every(r => r.take == null || (r.take > 0 && r.take <= r.qty)), "a mix of known and unknown greens: known ones get a real amount, unknown ones are asked");
}
console.log("\nE. Leftovers can't silently get today's date");
{
  for (const t of ["leftover rice", "leftover adobo", "cooked chicken", "some leftover pasta", "2 cups cooked rice", "leftover sinigang"]) {
    const x = E.parseIngredientText(t)[0];
    const it = E.newItem(x, now);
    ok(x.needsDate && it.cookedOn == null && E.freshness(it, now).group === "check" && !E.usableItems([it], now).length, `'${t}' → asks for the cooking date; without it: check group, not used in recipes`);
  }
  const v = E.validateItem({ name: "Leftover adobo", key: "leftover", cooked: true, loc: "fridge" }, now);
  ok(v && /cook/i.test(String(v)), "the edit form refuses to save cooked food without a date or 'not sure': " + v);
  const fz = E.newItem({ name: "Leftover adobo", key: "leftover", cooked: true, loc: "freezer" }, now);
  ok(E.freshness(fz, now).group !== "first" && !/today/i.test(fz.cookedOn || ""), "frozen leftovers without a date: no cooking date is invented");
  const lo = E.leftoverItem(R("chicken-adobo"), 2, now);
  ok(lo.cookedOn === T, "only leftovers you just cooked in the app get today's date");
  const merged = K([{ name: "Leftover adobo", key: "leftover", cooked: true, cookedOn: E.addDays(T, -2), qty: 1, unit: "servings" }, { name: "Leftover adobo", key: "leftover", cooked: true, cookedOn: T, qty: 1, unit: "servings" }]);
  ok(merged.length === 2, "leftovers from different days never merge into one date");
}

console.log("\nF. Recipes only use what's listed and what you have");
{
  const bad = RECIPES.filter(r => E.unlistedInSteps(r.steps, r.ingredients).length);
  ok(!bad.length, "no curated recipe's steps use an ingredient missing from its list" + (bad.length ? ": " + bad.map(r => r.id).join(", ") : ""));
  ok(E.unlistedInSteps(["Fry the eggs.", "Sprinkle cinnamon on top."], [{ k: "egg" }]).includes("cinnamon"), "an AI recipe that slips cinnamon into a step is caught");
  const p = K([{ name: "Spinach", key: "spinach", qty: 400, unit: "g" }]);
  const none = E.matchRecipe(R("garlic-greens"), p, [], {}, now);
  ok(!none.ok, "with no basics ticked, a recipe needing garlic and oil isn't offered (nothing assumed)");
  const withB = E.matchRecipe(R("garlic-greens"), p, ["garlic", "oil", "oyster_sauce"], {}, now);
  ok(withB.ok && withB.lines.filter(l => l.src === "staple").every(l => ["garlic", "oil", "oyster_sauce", "water"].includes(l.ing.k)), "once you tick garlic, oil and oyster sauce, it is offered, using only those basics (plus tap water)");
}
console.log(`\n${count - fails}/${count} final checks passed`);
process.exit(fails ? 1 : 0);
