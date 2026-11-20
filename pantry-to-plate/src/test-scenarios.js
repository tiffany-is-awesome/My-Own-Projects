// The review's 16 test scenarios — the parts that can be checked in the engine. Run: node test-scenarios.js
const E = require("./engine.js");
const { RECIPES } = require("./recipes.js");
const now = new Date("2026-11-19T10:00:00");
const T = "2026-11-19", ago = n => E.addDays(T, -n), ahead = n => E.addDays(T, n);
const ST = E.DEFAULT_STAPLES.concat(["onion", "fish_sauce", "flour"]);
let fails = 0, count = 0;
const ok = (c, msg) => { count++; console.log((c ? "  ✓ " : "  ✗ ") + msg); if (!c) fails++; };
const K = items => { const p = []; E.addToPantry(p, items, now); return p; };
const R = id => RECIPES.find(r => r.id === id);
const F = it => E.freshness(it, now);

console.log("\n1. 'leftover rice' typed with no cooking date");
const parsed = E.parseIngredientText("leftover rice")[0];
ok(parsed.key === "rice_cooked" && parsed.needsDate && parsed.uncertain, "parser marks it as cooked food that needs its cooking date (review step opens)");
const rice = E.newItem(parsed, now);
ok(rice.cookedOn === null && F(rice).group === "check" && !F(rice).safe, "if added without a date: NOT treated as cooked today; flagged: '" + F(rice).note + "'");
ok(E.usableItems([rice], now).length === 0, "and it is not used in recipes");

console.log("\n2. Chicken cooked yesterday");
const ch = E.newItem({ name: "Leftover chicken", key: "chicken_cooked", cookedOn: ago(1), added: T }, now);
ok(F(ch).safe && F(ch).daysLeft === 2, "3-day window from the cooking date (not the entry date): " + F(ch).note);

console.log("\n3. Chicken with an unknown cooking date");
const chU = E.newItem({ name: "Leftover chicken", key: "chicken_cooked", unknownAge: true }, now);
ok(!F(chU).safe && F(chU).group === "check", "not called safe: " + F(chU).note);

console.log("\n4. Two batches of milk with different printed dates");
const milk = K([{ name: "Milk", key: "milk", qty: 1, unit: "l", label: { type: "useby", date: ahead(2) } }, { name: "Milk", key: "milk", qty: 1, unit: "l", label: { type: "useby", date: ahead(6) } }]);
ok(milk.length === 2 && milk.map(m => m.label.date).sort().join() === [ahead(2), ahead(6)].join(), "kept as two batches, each with its own use-by date");
const same = K([{ name: "Milk", key: "milk", qty: 1, unit: "l", label: { type: "useby", date: ahead(6) } }, { name: "Milk", key: "milk", qty: 1, unit: "l", label: { type: "useby", date: ahead(6) } }]);
ok(same.length === 1 && same[0].qty === 2, "identical batches (same dates) still combine: 2 L");
const pm = E.matchRecipe(R("banana-smoothie"), [...milk, ...K([{ name: "Bananas", key: "banana", qty: 2, unit: "pcs" }])], ST, {}, now);
ok(pm.ok && E.planDeductions(pm).some(r => r.id === milk.find(m => m.label.date === ahead(2)).id), "recipes use the batch that expires first");

console.log("\n5. A food with no recorded amount");
const noQty = K([{ name: "Spinach", key: "spinach" }, { name: "Eggs", key: "egg", qty: 6, unit: "pcs" }]);
const gm = E.matchRecipe(R("garlic-greens"), noQty, ST, {}, now);
ok(gm.ok && gm.unconfirmed.length === 1, "recipe is offered but the spinach amount is flagged 'unconfirmed' (not assumed enough)");
const gd = E.planDeductions(gm).find(r => r.name === "Spinach");
ok(gd && gd.take === null && !gd.all, "no guessed deduction: the person says how much they used");
const vegUnknown = E.matchRecipe(R("veg-soup"), K([{ name: "Carrots", key: "carrot" }, { name: "Cabbage", key: "cabbage" }]), ST, {}, now);
ok(vegUnknown.ok && vegUnknown.unconfirmed.length === 1, "mixed-vegetable slot: unknown amounts count as nothing, so it's flagged to check, not 'enough'");

console.log("\n6. Recipe needs more chicken than you have");
const ch100 = K([{ name: "Chicken", key: "chicken", qty: 100, unit: "g" }, { name: "Eggs", key: "egg", qty: 6, unit: "pcs" }, { name: "Onion", key: "onion", qty: 2, unit: "pcs" }, { name: "Leftover rice", key: "rice_cooked", qty: 4, unit: "cup", cookedOn: T }]);
const oy = E.matchRecipe(R("oyakodon"), ch100, ST, {}, now);
ok(!oy.ok && oy.amountShort.some(a => a.name === "Chicken" && Math.abs(a.ratio - 0.4) < 0.01), "needs 250 g, you have 100 g (40%): NOT offered at full size");
ok(!E.fitMatch(R("oyakodon"), ch100, ST, {}, now).ok, "even 1 serving needs 125 g, so it's not offered at all (no 75% fudge)");
const ch150 = K([{ name: "Chicken", key: "chicken", qty: 150, unit: "g" }, { name: "Eggs", key: "egg", qty: 6, unit: "pcs" }, { name: "Onion", key: "onion", qty: 2, unit: "pcs" }, { name: "Leftover rice", key: "rice_cooked", qty: 4, unit: "cup", cookedOn: T }]);
const fm = E.fitMatch(R("oyakodon"), ch150, ST, {}, now);
ok(fm.ok && fm.scaledDown && fm.servings === 1 && fm.lines.find(l => l.ing.k === "chicken").q === 125, "with 150 g: offered as 1 serving using 125 g, and every amount is scaled");

console.log("\n7. Scale a recipe from 2 servings to 5");
const big = K([{ name: "Leftover rice", key: "rice_cooked", qty: 10, unit: "cup", cookedOn: T }, { name: "Eggs", key: "egg", qty: 12, unit: "pcs" }]);
const m5 = E.matchRecipe(R("egg-fried-rice"), big, ST, { servings: 5 }, now);
const L = k => m5.lines.find(l => l.ing.k === k);
ok(m5.ok && L("rice_cooked").q === 7.5 && L("egg").q === 5 && L("oil").q === 5 && L("soy_sauce").q === 3.75, "×2.5: rice 3→7.5 cups, eggs 2→5, oil 2→5 tbsp, soy 1.5→3.75 tbsp");
ok(!R("egg-fried-rice").steps.some(s => /\d+\s*(tbsp|tsp|cups?|ml|g)\b/.test(s)), "method steps have no fixed amounts, so they stay right when scaled");

console.log("\n8. Mixed-vegetable recipe with too few vegetables");
const v400 = K([{ name: "Carrots", key: "carrot", qty: 250, unit: "g" }, { name: "Potatoes", key: "potato", qty: 150, unit: "g" }]);
const s400 = E.matchRecipe(R("veg-soup"), v400, ST, {}, now);
ok(!s400.ok, "400 g for a soup needing 800 g (6 servings): not offered at full size");
const s400fit = E.fitMatch(R("veg-soup"), v400, ST, {}, now);
const vl = s400fit.lines.find(l => l.ing.any);
ok(s400fit.ok && s400fit.servings === 4 && vl.tolUsed && vl.haveG >= vl.needG * 0.75 - 1e-6, "offered as 4 servings: needs 533 g, you have 400 g (75%), which this soup's own rule allows, and the page says so");
ok(!E.fitMatch(R("veg-soup"), K([{ name: "Carrots", key: "carrot", qty: 60, unit: "g" }, { name: "Potatoes", key: "potato", qty: 30, unit: "g" }]), ST, {}, now).ok, "90 g of vegetables (below 75% of even 1 serving): not offered");
const pan = E.matchRecipe(R("banana-pancakes"), K([{ name: "Bananas", key: "banana", qty: 2, unit: "pcs" }, { name: "Eggs", key: "egg", qty: 1, unit: "pcs" }, { name: "Milk", key: "milk", qty: 180, unit: "ml" }, { name: "Flour", key: "flour", qty: 0.5, unit: "cup" }]), ["salt", "sugar", "butter"], {}, now);
ok(!pan.ok, "pancakes with half the flour: not offered (no tolerance for flour in batters)");

console.log("\n9. Recipe with an expired best-before date");
const pasta = E.newItem({ name: "Spaghetti", key: "pasta_dry", qty: 500, unit: "g", loc: "pantry", label: { type: "bestbefore", date: ago(20) } }, now);
ok(F(pasta).safe && /quality date, not a safety date/.test(F(pasta).note), "dry pasta past best-before: usable, clearly labelled as a quality date");
ok(E.matchRecipe(R("aglio-olio"), [pasta], ST, {}, now).ok, "and recipes can still use it");
const cream = E.newItem({ name: "Cream", key: "cream", loc: "fridge", added: ago(1), label: { type: "bestbefore", date: ago(1) } }, now);
ok(F(cream).safe, "perishable 1 day past best-before but bought yesterday: not automatically called unsafe");
const oldCream = E.newItem({ name: "Cream", key: "cream", loc: "fridge", added: ago(9), label: { type: "bestbefore", date: ahead(10) } }, now);
ok(!F(oldCream).safe, "best-before still weeks away but stored 9 days: storage time still applies (not 'safe because the date hasn't passed')");

console.log("\n10. Recipe with a past use-by date");
const yog = E.newItem({ name: "Yogurt", key: "yogurt", qty: 200, unit: "g", label: { type: "useby", date: ago(1) } }, now);
ok(!F(yog).safe && E.usableItems([yog], now).length === 0, "past use-by: 'Don't eat it' and never used in recipes");

console.log("\n13 & 14. Confirmed amounts are deducted; leftovers get their real cooking date");
const k13 = K([{ name: "Eggs", key: "egg", qty: 9, unit: "pcs" }, { name: "Leftover rice", key: "rice_cooked", qty: 3, unit: "cup", cookedOn: T }]);
const ids = Object.fromEntries(k13.map(p => [p.key, p.id]));
const after = E.applyDeductions(k13, [{ id: ids.egg, take: 3, all: false }, { id: ids.rice_cooked, take: 3, all: true }]).pantry;
ok(after.length === 1 && after[0].qty === 6, "used 3 of 9 eggs (as confirmed) → 6 left; rice used up");
const lo = E.leftoverItem(R("chicken-adobo"), 2, now);
ok(lo.cookedOn === T && F(lo).daysLeft === 3, "adobo leftovers: cooked today, 3-day window");

console.log(`\n${count - fails}/${count} scenario checks passed` + (fails ? ` — ${fails} FAILED` : ""));
process.exit(fails ? 1 : 0);
