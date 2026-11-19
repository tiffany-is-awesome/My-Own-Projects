// Acceptance tests from the brief (engine-level). Run: node test-engine.js
const E = require("./engine.js");
const { RECIPES } = require("./recipes.js");
const now = new Date("2026-11-19T10:00:00");
const staples = E.DEFAULT_STAPLES.concat(["onion","fish_sauce","flour"]);
let fails = 0;
const ok = (c, msg) => { console.log((c ? "  ✓ " : "  ✗ ") + msg); if (!c) fails++; };
const kitchen = (text, extra = {}) => { const p = []; E.addToPantry(p, E.parseIngredientText(text).map(x => ({ ...x, ...extra[x.key] })), now); return p; };
const show = (m) => `${m.recipe.title} [${m.servings} servings${m.scaledDown ? ", smaller batch" : ""}] score ${m.score.total.toFixed(0)} (taste ${m.score.quality}, urgency ${m.score.urgency.toFixed(0)}) uses ${m.usedCount}${m.swaps.length ? " swaps: " + m.swaps.map(s => s.name + "→" + s.subFor).join(", ") : ""}`;

console.log("\nTEST 1: random leftovers (rice, eggs, half cabbage, carrot, cooked chicken)");
let p = kitchen("2 cups leftover rice, 3 eggs, half a cabbage, 1 carrot, 1 cup leftover chicken", { rice_cooked: { added: "2026-11-19" }, chicken_cooked: { added: "2026-11-17" } });
let ranked = E.rankRecipes(RECIPES, p, staples, { mode: "urgent" }, now);
ranked.slice(0, 4).forEach(m => console.log("   " + show(m)));
const top = ranked[0];
ok(top && top.usedCount >= 4, "top suggestion uses most of these ingredients (" + (top && top.usedCount) + " of 5)");
ok(top && top.urgentUsed.some(x => x.key === "rice_cooked") && top.urgentUsed.some(x => x.key === "chicken_cooked"), "top suggestion uses the most urgent food (rice and chicken)");
ok(top && top.recipe.q >= 4, "top suggestion is a high-quality recipe");
ok(top && top.lines.every(l => l.skipped || l.q != null), "every ingredient has an amount");

console.log("\nTEST 2: missing one ingredient → a sensible swap");
p = kitchen("4 eggs, 2 cups canned tomatoes");
ranked = E.rankRecipes(RECIPES, p, staples, { mode: "most" }, now);
const te = ranked.find(m => m.recipe.id === "tomato-egg");
ok(!!te, "Tomato & Egg is offered without fresh tomatoes");
ok(te && te.swaps.some(s => s.ing.k === "tomato" && s.sub.k === "canned_tomato" && s.sub.f && s.sub.t && s.sub.w), "swap explains flavor, texture and how to use it");
const adobo = E.matchRecipe(RECIPES.find(r => r.id === "chicken-adobo"), kitchen("4 eggs"), staples, {}, now);
ok(!adobo.ok && adobo.missing.includes("Chicken"), "a recipe missing an essential (chicken) is NOT offered");

console.log("\nTEST 3: several foods need attention → they come first");
p = kitchen("300 g chicken thighs, 150 g spinach, 2 cups leftover rice, 6 eggs, 1 kg potatoes, 500 g pasta", { chicken: { added: "2026-11-19" }, spinach: { added: "2026-11-17" }, rice_cooked: { added: "2026-11-19" } });
ranked = E.rankRecipes(RECIPES, p, staples, { mode: "urgent" }, now);
ranked.slice(0, 4).forEach(m => console.log("   " + show(m)));
ok(ranked.slice(0, 3).every(m => m.urgentUsed.length > 0), "top 3 all use food that needs using first");
const urgentKeys = new Set(ranked.slice(0, 4).flatMap(m => m.urgentUsed.map(x => x.key)));
ok(["chicken","spinach","rice_cooked"].filter(k => urgentKeys.has(k)).length >= 2, "together they cover most urgent items: " + [...urgentKeys].join(", "));

console.log("\nTEST 4: lots of leftover vegetables → several meals / no forcing");
p = kitchen("1 cabbage, 6 carrots, 4 potatoes, 3 bell peppers, 500 g green beans, 2 sayote, 400 g squash, 6 eggs");
const plan = E.planEverything(RECIPES, p, staples, {}, now);
plan.dishes.forEach(m => console.log("   dish: " + show(m)));
console.log("   still left:", plan.left.map(x => x.name).join(", ") || "none");
ok(plan.dishes.length >= 2, "suggests more than one dish (" + plan.dishes.length + ")");
ok(plan.dishes.every(m => m.score.quality >= 52), "every dish is a good recipe, not a forced mix");

console.log("\nTEST 5: cooking deducts the right amounts");
p = kitchen("6 eggs, 3 cups leftover rice, 1 cup leftover chicken, half a cabbage, 1 carrot");
const m5 = E.matchRecipe(RECIPES.find(r => r.id === "chicken-cabbage-fried-rice"), p, staples, {}, now);
const rows = E.planDeductions(m5);
rows.forEach(r => console.log(`   ${r.name}: take ${r.take} ${r.unit} of ${r.qty}${r.all ? " (all)" : ""}`));
const after = E.applyDeductions(p, rows).pantry;
const eggs = after.find(x => x.key === "egg");
ok(eggs && eggs.qty === 4, "eggs 6 → 4");
ok(!after.some(x => x.key === "rice_cooked"), "all 3 cups of rice used up");
const cab = after.find(x => x.key === "cabbage");
ok(cab && Math.abs(cab.qty - 0.32) < 0.02, "cabbage ½ head → about ⅓ head left (" + (cab && cab.qty) + ")");
const lo = E.leftoverItem(m5.recipe, 1, now);
ok(lo.cooked && lo.key === "leftover" && E.freshness(lo, now).daysLeft === 1, "leftover fried rice is tracked as a dish, with a 24-hour window");

console.log("\nTEST 6: cooked food with an unknown history");
p = []; E.addToPantry(p, [{ name: "Leftover stew", key: "leftover", unknownAge: true }, { name: "Leftover rice", key: "rice_cooked", added: "2026-11-16" }, { name: "Chicken", key: "chicken", added: "2026-11-15" }], now);
p.forEach(x => console.log("   " + x.name + ": " + E.freshness(x, now).note));
ok(p.every(x => !E.freshness(x, now).safe), "none is called safe");
ok(E.usableItems(p, now).length === 0, "none is used in recipes");

console.log("\nTEST 7 (engine part): quick entry understands plain language");
const parsed = E.parseIngredientText("3 eggs, half a cabbage, 2 cups of rice, and one leftover chicken breast");
ok(parsed.length === 4 && parsed[0].qty === 3 && parsed[1].qty === 0.5 && parsed[2].unit === "cup" && parsed[3].key === "chicken_cooked", "brief's example sentence → 4 correct items");
p = []; E.addToPantry(p, E.parseIngredientText("3 eggs"), now); E.addToPantry(p, E.parseIngredientText("6 eggs"), now);
ok(p.length === 1 && p[0].qty === 9, "adding eggs twice merges into one entry (9 eggs), no duplicates");
ok(E.resolveKey("hot sauce") !== "soy_sauce", "'hot sauce' is not mistaken for soy sauce");

console.log("\nTEST 8 (engine part): taste beats ingredient count");
p = kitchen("1 cabbage, 2 carrots, 1 cup leftover chicken, 6 eggs, 3 cups leftover rice, 2 bananas, 4 slices bread");
ranked = E.rankRecipes(RECIPES, p, staples, { mode: "most" }, now);
ok(ranked.slice(0, 5).every(m => m.recipe.q >= 4), "top 5 are all 4★+ recipes");
console.log("\n" + (fails ? fails + " check(s) failed" : "All checks passed"));
process.exit(fails ? 1 : 0);
