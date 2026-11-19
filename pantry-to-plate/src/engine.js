/* =====================================================================
   PANTRY → PLATE ENGINE
   Ordinary code for everything that doesn't need AI: ingredients,
   units, freshness and food-safety rules, recipe matching, ranking,
   and pantry deductions. No DOM here, so it can be tested on its own.
   ===================================================================== */

/* ---------- Dates ---------- */
const DAY = 86400000;
function todayISO(now) { const d = now ? new Date(now) : new Date(); const z = n => String(n).padStart(2, "0"); return d.getFullYear() + "-" + z(d.getMonth() + 1) + "-" + z(d.getDate()); }
function parseISO(s) { if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null; const [y,m,d] = s.split("-").map(Number); const t = new Date(y, m-1, d); return isNaN(t) ? null : t; }
function addDays(iso, n) { const d = parseISO(iso); d.setDate(d.getDate() + n); return todayISO(d); }
function daysUntil(iso, now) { const a = parseISO(todayISO(now)), b = parseISO(iso); return Math.round((b - a) / DAY); }
function prettyDate(iso) { const d = parseISO(iso); return d ? d.toLocaleDateString(undefined, { day: "numeric", month: "short" }) : ""; }

/* ---------- Ingredient knowledge ----------
   Shelf-life numbers are deliberately at the SHORT end of public guidance:
   USDA / FoodSafety.gov cold-storage chart (fridge at 4°C/40°F or colder;
   freezer times are for quality, frozen food stays safe), and the UK Food
   Standards Agency for cooked rice (eat within 24 hours).
   Fields: n name, s synonyms, c category, r risk (high/med/low),
   u default unit, w grams per piece, cup grams per cup,
   f fridge days, z freezer days (quality), p pantry days (null = don't),
   o days once opened (fridge), loc default location, m meat type,
   d dairy, e egg, gl gluten, cooked: key of the cooked version,
   fz short freezing tip, st staple-capable. */
const ING = {
  // ---- proteins (raw) ----
  chicken:        {n:"Chicken", s:["chicken","chicken thigh","chicken thighs","chicken breast","chicken breasts","chicken legs","chicken wings","chicken drumsticks","raw chicken","whole chicken"], c:"protein", r:"high", u:"g", w:150, f:1, z:270, p:null, loc:"fridge", m:"chicken", cooked:"chicken_cooked", fz:"Freeze raw in a flat bag; thaw in the fridge, never on the counter."},
  ground_pork:    {n:"Ground pork", s:["ground pork","minced pork","giniling","pork mince"], c:"protein", r:"high", u:"g", w:250, f:1, z:90, p:null, loc:"fridge", m:"pork", cooked:"leftover", fz:"Flatten in a freezer bag so it thaws fast."},
  pork:           {n:"Pork", s:["pork","pork chop","pork chops","pork belly","liempo","pork shoulder","kasim"], c:"protein", r:"high", u:"g", w:200, f:3, z:120, p:null, loc:"fridge", m:"pork", cooked:"leftover"},
  ground_beef:    {n:"Ground beef", s:["ground beef","minced beef","beef mince"], c:"protein", r:"high", u:"g", w:250, f:1, z:90, p:null, loc:"fridge", m:"beef", cooked:"leftover"},
  beef:           {n:"Beef", s:["beef","steak","beef steak","beef brisket","beef chunks"], c:"protein", r:"high", u:"g", w:250, f:3, z:120, p:null, loc:"fridge", m:"beef", cooked:"leftover"},
  fish:           {n:"Fish", s:["fish","fish fillet","fish fillets","tilapia","bangus","milkfish","salmon","galunggong","cream dory"], c:"protein", r:"high", u:"g", w:200, f:1, z:90, p:null, loc:"fridge", m:"seafood", cooked:"fish_cooked"},
  shrimp:         {n:"Shrimp", s:["shrimp","prawns","prawn","hipon"], c:"protein", r:"high", u:"g", w:15, f:1, z:90, p:null, loc:"fridge", m:"seafood", cooked:"leftover"},
  bacon:          {n:"Bacon", s:["bacon"], c:"protein", r:"high", u:"pcs", w:20, f:7, z:30, p:null, loc:"fridge", m:"pork", o:7},
  hotdog:         {n:"Hotdogs", s:["hotdog","hotdogs","hot dog","hot dogs","sausage","sausages","frankfurter"], c:"protein", r:"high", u:"pcs", w:45, f:14, o:7, z:45, p:null, loc:"fridge", m:"pork"},
  ham:            {n:"Ham", s:["ham","sliced ham","deli ham"], c:"protein", r:"high", u:"g", w:20, f:14, o:3, z:45, p:null, loc:"fridge", m:"pork"},
  longganisa:     {n:"Longganisa", s:["longganisa","longanisa","chorizo"], c:"protein", r:"high", u:"pcs", w:50, f:2, z:45, p:null, loc:"freezer", m:"pork"},
  tocino:         {n:"Tocino", s:["tocino","tapa","beef tapa"], c:"protein", r:"high", u:"g", w:250, f:3, z:45, p:null, loc:"freezer", m:"pork"},
  spam:           {n:"Luncheon meat", s:["spam","luncheon meat"], c:"protein", r:"med", u:"g", w:340, f:3, z:60, p:730, loc:"pantry", m:"pork", o:3, opensTo:"fridge"},
  corned_beef:    {n:"Corned beef (canned)", s:["corned beef","canned corned beef"], c:"protein", r:"med", u:"g", w:175, cup:200, f:3, z:60, p:730, loc:"pantry", m:"beef", o:3, opensTo:"fridge"},
  tuna:           {n:"Canned tuna", s:["canned tuna","tuna","tuna flakes","tuna can"], c:"protein", r:"med", u:"g", w:155, cup:160, f:3, z:60, p:730, loc:"pantry", m:"seafood", o:3, opensTo:"fridge"},
  sardines:       {n:"Canned sardines", s:["sardines","canned sardines"], c:"protein", r:"med", u:"g", w:155, f:3, z:60, p:730, loc:"pantry", m:"seafood", o:3, opensTo:"fridge"},
  egg:            {n:"Eggs", s:["egg","eggs","itlog"], c:"protein", r:"high", u:"pcs", w:50, f:21, z:null, p:7, loc:"fridge", e:true, fz:"Don't freeze in the shell. Beat them, then freeze in a covered container."},
  tofu:           {n:"Tofu", s:["tofu","firm tofu","tokwa","bean curd"], c:"protein", r:"high", u:"g", w:300, f:3, z:90, p:null, loc:"fridge"},
  beans_canned:   {n:"Canned beans", s:["canned beans","beans","chickpeas","kidney beans","black beans","garbanzos"], c:"grain", r:"low", u:"g", w:400, cup:175, f:3, z:60, p:730, loc:"pantry", o:3, opensTo:"fridge"},
  // ---- cooked / leftovers ----
  chicken_cooked: {n:"Cooked chicken", s:["cooked chicken","leftover chicken","roast chicken","rotisserie chicken","fried chicken","grilled chicken","chicken leftovers"], c:"cooked", r:"high", u:"g", w:170, cup:140, f:3, z:120, p:null, loc:"fridge", m:"chicken", isCooked:true, fz:"Shred, cool fast and freeze in portions."},
  fish_cooked:    {n:"Cooked fish", s:["cooked fish","leftover fish","fried fish"], c:"cooked", r:"high", u:"g", w:150, f:3, z:120, p:null, loc:"fridge", m:"seafood", isCooked:true},
  rice_cooked:    {n:"Cooked rice", s:["cooked rice","leftover rice","day-old rice","day old rice","steamed rice","kanin","rice leftovers"], c:"cooked", r:"high", u:"cup", cup:160, f:1, z:30, p:null, loc:"fridge", isCooked:true, gl:false, fz:"Cool within an hour, then freeze flat in portions. Reheat only once, until steaming hot."},
  pasta_cooked:   {n:"Cooked pasta", s:["cooked pasta","leftover pasta","leftover spaghetti","cooked noodles","leftover noodles"], c:"cooked", r:"high", u:"cup", cup:140, f:2, z:60, p:null, loc:"fridge", isCooked:true, gl:true},
  potato_cooked:  {n:"Cooked potatoes", s:["cooked potatoes","boiled potatoes","leftover potatoes","mashed potatoes"], c:"cooked", r:"high", u:"g", w:170, cup:200, f:2, z:60, p:null, loc:"fridge", isCooked:true},
  leftover:       {n:"Leftovers", s:["leftovers","leftover","leftover adobo","leftover soup","leftover stew","leftover curry","leftover sinigang","leftover viand","leftover ulam"], c:"cooked", r:"high", u:"servings", f:3, z:60, p:null, loc:"fridge", isCooked:true, fz:"Cool within 2 hours, portion into shallow containers and freeze."},
  // ---- dairy ----
  milk:           {n:"Milk", s:["milk","fresh milk","whole milk"], c:"dairy", r:"high", u:"ml", cup:245, f:5, z:90, p:null, loc:"fridge", d:true, o:5},
  evap_milk:      {n:"Evaporated milk", s:["evaporated milk","evap"], c:"dairy", r:"med", u:"ml", cup:250, f:4, z:null, p:365, loc:"pantry", d:true, o:4, opensTo:"fridge"},
  yogurt:         {n:"Yogurt", s:["yogurt","greek yogurt","plain yogurt","yoghurt"], c:"dairy", r:"high", u:"g", cup:245, f:7, z:60, p:null, loc:"fridge", d:true},
  cheese:         {n:"Cheese", s:["cheese","cheddar","cheddar cheese","quickmelt","eden cheese","processed cheese","parmesan","gouda"], c:"dairy", r:"med", u:"g", cup:100, f:21, z:120, p:null, loc:"fridge", d:true},
  mozzarella:     {n:"Mozzarella", s:["mozzarella","mozarella"], c:"dairy", r:"high", u:"g", cup:110, f:5, z:90, p:null, loc:"fridge", d:true},
  cream:          {n:"Cream", s:["cream","all-purpose cream","heavy cream","cooking cream"], c:"dairy", r:"high", u:"ml", cup:240, f:5, z:null, p:365, loc:"pantry", d:true, o:5, opensTo:"fridge"},
  butter:         {n:"Butter", s:["butter","margarine"], c:"dairy", r:"low", u:"g", cup:225, f:30, z:180, p:null, loc:"fridge", d:true, st:true},
  // ---- grains & dry goods ----
  rice_raw:       {n:"Rice (uncooked)", s:["rice","uncooked rice","jasmine rice","white rice","brown rice","bigas"], c:"grain", r:"low", u:"cup", cup:185, f:null, z:null, p:365, loc:"pantry", cooked:"rice_cooked"},
  pasta_dry:      {n:"Pasta", s:["pasta","spaghetti","penne","macaroni","fusilli","linguine","dry pasta"], c:"grain", r:"low", u:"g", cup:100, f:null, z:null, p:365, loc:"pantry", gl:true, cooked:"pasta_cooked"},
  noodles:        {n:"Noodles", s:["noodles","instant noodles","pancit canton","canton noodles","ramen","bihon","rice noodles","egg noodles","miki"], c:"grain", r:"low", u:"g", w:80, f:null, z:null, p:180, loc:"pantry", gl:true},
  bread:          {n:"Bread", s:["bread","loaf bread","sliced bread","pandesal","bread slices","tasty bread","stale bread"], c:"grain", r:"low", u:"pcs", w:30, f:7, z:90, p:4, loc:"pantry", gl:true, fz:"Freeze sliced; toast straight from frozen."},
  tortilla:       {n:"Tortillas", s:["tortilla","tortillas","wraps","flour tortillas","corn tortillas"], c:"grain", r:"low", u:"pcs", w:40, f:14, z:90, p:5, loc:"pantry", gl:true},
  flour:          {n:"Flour", s:["flour","all-purpose flour","plain flour"], c:"grain", r:"low", u:"cup", cup:125, f:null, z:null, p:240, loc:"pantry", gl:true, st:true},
  oats:           {n:"Oats", s:["oats","rolled oats","oatmeal"], c:"grain", r:"low", u:"cup", cup:90, p:365, loc:"pantry"},
  // ---- produce ----
  cabbage:        {n:"Cabbage", s:["cabbage","repolyo","napa cabbage","wombok","chinese cabbage"], c:"produce", r:"low", u:"pcs", w:1000, cup:90, f:14, z:null, p:3, loc:"fridge", fz:"Shred and blanch for 90 seconds before freezing; best used in cooked dishes."},
  carrot:         {n:"Carrots", s:["carrot","carrots"], c:"produce", r:"low", u:"pcs", w:80, cup:110, f:21, z:300, p:5, loc:"fridge", fz:"Blanch slices 2 minutes, cool, then freeze."},
  onion:          {n:"Onions", s:["onion","onions","white onion","red onion","yellow onion","sibuyas","shallot","shallots"], c:"produce", r:"low", u:"pcs", w:150, cup:160, f:60, o:7, z:240, p:30, loc:"pantry", st:true},
  garlic:         {n:"Garlic", s:["garlic","garlic cloves","bawang"], c:"produce", r:"low", u:"clove", w:5, f:60, z:300, p:90, loc:"pantry", st:true},
  ginger:         {n:"Ginger", s:["ginger","luya"], c:"produce", r:"low", u:"g", w:50, f:21, z:180, p:7, loc:"fridge", st:true},
  spring_onion:   {n:"Spring onions", s:["spring onion","spring onions","scallion","scallions","green onion","green onions","dahon ng sibuyas","leeks","leek"], c:"produce", r:"low", u:"stalk", w:15, f:5, z:null, p:null, loc:"fridge"},
  potato:         {n:"Potatoes", s:["potato","potatoes","patatas"], c:"produce", r:"low", u:"pcs", w:170, cup:150, f:null, z:null, p:21, loc:"pantry", cooked:"potato_cooked"},
  sweet_potato:   {n:"Sweet potatoes", s:["sweet potato","sweet potatoes","kamote"], c:"produce", r:"low", u:"pcs", w:200, cup:135, f:null, p:14, loc:"pantry"},
  tomato:         {n:"Tomatoes", s:["tomato","tomatoes","kamatis","cherry tomatoes"], c:"produce", r:"low", u:"pcs", w:120, cup:180, f:7, z:60, p:4, loc:"pantry"},
  canned_tomato:  {n:"Canned tomatoes", s:["canned tomatoes","tomato sauce","crushed tomatoes","diced tomatoes","passata","tomato paste"], c:"grain", r:"low", u:"g", w:400, cup:240, f:5, z:60, p:540, loc:"pantry", o:5, opensTo:"fridge"},
  bell_pepper:    {n:"Bell peppers", s:["bell pepper","bell peppers","capsicum","red pepper","green pepper"], c:"produce", r:"low", u:"pcs", w:150, cup:150, f:7, z:240, p:null, loc:"fridge"},
  cucumber:       {n:"Cucumber", s:["cucumber","pipino"], c:"produce", r:"low", u:"pcs", w:300, cup:120, f:5, z:null, p:null, loc:"fridge"},
  eggplant:       {n:"Eggplant", s:["eggplant","eggplants","talong","aubergine"], c:"produce", r:"low", u:"pcs", w:250, cup:80, f:5, z:null, p:2, loc:"fridge"},
  spinach:        {n:"Spinach", s:["spinach","baby spinach"], c:"produce", r:"low", u:"g", w:150, cup:30, f:3, z:240, p:null, loc:"fridge", fz:"Blanch 1 minute, squeeze dry, freeze in balls for soups."},
  leafy_greens:   {n:"Leafy greens", s:["kangkong","water spinach","pechay","bok choy","pak choi","malunggay","moringa","mustard greens","mustasa","lettuce","kale","chili leaves","dahon ng sili"], c:"produce", r:"low", u:"g", w:200, cup:40, f:3, z:null, p:null, loc:"fridge"},
  broccoli:       {n:"Broccoli", s:["broccoli","cauliflower"], c:"produce", r:"low", u:"g", w:300, cup:90, f:4, z:300, p:null, loc:"fridge", fz:"Cut into florets, blanch 3 minutes, cool and freeze."},
  green_beans:    {n:"Green beans", s:["green beans","string beans","sitaw","baguio beans"], c:"produce", r:"low", u:"g", w:200, cup:110, f:5, z:240, p:null, loc:"fridge"},
  sayote:         {n:"Sayote", s:["sayote","chayote","zucchini","courgette","green papaya","upo","bottle gourd"], c:"produce", r:"low", u:"pcs", w:300, cup:130, f:14, z:null, p:5, loc:"fridge"},
  squash:         {n:"Squash", s:["squash","kalabasa","pumpkin","butternut"], c:"produce", r:"low", u:"g", w:800, cup:140, f:7, z:240, p:30, loc:"pantry"},
  mushroom:       {n:"Mushrooms", s:["mushroom","mushrooms","button mushrooms","shiitake","oyster mushrooms"], c:"produce", r:"low", u:"g", w:20, cup:70, f:4, z:240, p:null, loc:"fridge"},
  corn:           {n:"Corn", s:["corn","sweet corn","corn kernels","canned corn","mais"], c:"produce", r:"low", u:"g", w:200, cup:150, f:2, z:240, p:null, loc:"fridge"},
  peas:           {n:"Peas", s:["peas","green peas","frozen peas","mixed vegetables","frozen mixed vegetables"], c:"produce", r:"low", u:"g", cup:145, f:3, z:240, p:null, loc:"freezer"},
  banana:         {n:"Bananas", s:["banana","bananas","saging","overripe bananas","ripe bananas"], c:"produce", r:"low", u:"pcs", w:120, cup:225, f:5, z:90, p:4, loc:"pantry", fz:"Peel, slice and freeze for pancakes, banana bread or smoothies."},
  lemon:          {n:"Lemons / limes", s:["lemon","lemons","lime","limes","calamansi","kalamansi","lemon juice"], c:"produce", r:"low", u:"pcs", w:60, f:21, z:120, p:7, loc:"fridge"},
  apple:          {n:"Apples", s:["apple","apples"], c:"produce", r:"low", u:"pcs", w:180, f:30, p:7, loc:"fridge"},
  mango:          {n:"Mangoes", s:["mango","mangoes","ripe mango"], c:"produce", r:"low", u:"pcs", w:250, f:5, z:180, p:4, loc:"pantry"},
  herbs:          {n:"Fresh herbs", s:["cilantro","coriander","parsley","basil","wansoy","kinchay","celery","dill","mint"], c:"produce", r:"low", u:"bunch", w:30, f:5, z:null, p:null, loc:"fridge", fz:"Chop and freeze in oil in an ice-cube tray."},
  // ---- condiments & staples ----
  salt:           {n:"Salt", s:["salt","rock salt","sea salt"], c:"condiment", r:"low", u:"tsp", p:3650, loc:"pantry", st:true},
  pepper:         {n:"Black pepper", s:["black pepper","pepper","peppercorns","ground pepper","paminta"], c:"condiment", r:"low", u:"tsp", p:1095, loc:"pantry", st:true},
  oil:            {n:"Cooking oil", s:["oil","cooking oil","vegetable oil","olive oil","canola oil","coconut oil"], c:"condiment", r:"low", u:"tbsp", p:180, loc:"pantry", st:true},
  sugar:          {n:"Sugar", s:["sugar","brown sugar","white sugar"], c:"condiment", r:"low", u:"tsp", p:730, loc:"pantry", st:true},
  soy_sauce:      {n:"Soy sauce", s:["soy sauce","toyo","light soy sauce"], c:"condiment", r:"low", u:"tbsp", p:730, loc:"pantry", st:true},
  vinegar:        {n:"Vinegar", s:["vinegar","suka","cane vinegar","white vinegar","rice vinegar","apple cider vinegar"], c:"condiment", r:"low", u:"tbsp", p:1095, loc:"pantry", st:true},
  fish_sauce:     {n:"Fish sauce", s:["fish sauce","patis"], c:"condiment", r:"low", u:"tbsp", p:730, loc:"pantry", st:true, m2:"seafood"},
  oyster_sauce:   {n:"Oyster sauce", s:["oyster sauce"], c:"condiment", r:"low", u:"tbsp", p:365, f:180, o:180, loc:"pantry", opensTo:"fridge", st:true, m2:"seafood"},
  chili_flakes:   {n:"Chili flakes", s:["chili flakes","chilli flakes","red pepper flakes","chili","chilies","siling labuyo","chili powder"], c:"condiment", r:"low", u:"tsp", p:365, loc:"pantry", st:true},
  sesame_oil:     {n:"Sesame oil", s:["sesame oil"], c:"condiment", r:"low", u:"tsp", p:365, loc:"pantry", st:true},
  ketchup:        {n:"Ketchup", s:["ketchup","banana ketchup","catsup","tomato ketchup"], c:"condiment", r:"low", u:"tbsp", f:180, p:365, o:180, loc:"fridge", st:true},
  mayonnaise:     {n:"Mayonnaise", s:["mayonnaise","mayo"], c:"condiment", r:"med", u:"tbsp", f:60, p:365, o:60, loc:"fridge", st:true, e:true},
  cornstarch:     {n:"Cornstarch", s:["cornstarch","cornflour","corn starch"], c:"condiment", r:"low", u:"tbsp", p:730, loc:"pantry", st:true},
  stock_cube:     {n:"Stock cubes", s:["stock cube","stock cubes","bouillon","chicken cube","beef cube","broth cube","chicken stock","stock","broth"], c:"condiment", r:"low", u:"pcs", w:10, p:365, loc:"pantry", st:true},
  bay_leaf:       {n:"Bay leaves", s:["bay leaf","bay leaves","laurel"], c:"condiment", r:"low", u:"pcs", p:730, loc:"pantry", st:true},
  curry_powder:   {n:"Curry powder", s:["curry powder","curry"], c:"condiment", r:"low", u:"tbsp", p:365, loc:"pantry", st:true},
  paprika:        {n:"Paprika", s:["paprika","smoked paprika"], c:"condiment", r:"low", u:"tsp", p:365, loc:"pantry", st:true},
  cinnamon:       {n:"Cinnamon", s:["cinnamon"], c:"condiment", r:"low", u:"tsp", p:730, loc:"pantry", st:true},
  baking_powder:  {n:"Baking powder", s:["baking powder"], c:"condiment", r:"low", u:"tsp", p:365, loc:"pantry", st:true},
  honey:          {n:"Honey", s:["honey"], c:"condiment", r:"low", u:"tbsp", p:730, loc:"pantry", st:true},
  gochujang:      {n:"Gochujang", s:["gochujang","korean chili paste"], c:"condiment", r:"low", u:"tbsp", f:365, p:null, loc:"fridge", st:true},
  kimchi:         {n:"Kimchi", s:["kimchi"], c:"condiment", r:"low", u:"cup", cup:150, f:90, z:null, p:null, loc:"fridge"},
  coconut_milk:   {n:"Coconut milk", s:["coconut milk","gata","coconut cream","kakang gata"], c:"grain", r:"med", u:"ml", cup:240, f:4, z:60, p:540, loc:"pantry", o:4, opensTo:"fridge"},
  peanut_butter:  {n:"Peanut butter", s:["peanut butter"], c:"condiment", r:"low", u:"tbsp", p:90, loc:"pantry"},
  water:          {n:"Water", s:["water"], c:"condiment", r:"low", u:"cup", p:99999, loc:"pantry", free:true}
};
const LOCS = { fridge: "Fridge", freezer: "Freezer", pantry: "Cupboard" };
const DEFAULT_STAPLES = ["salt","pepper","oil","garlic","soy_sauce","sugar","vinegar","chili_flakes","butter"];
const OPTIONAL_STAPLES = ["onion","fish_sauce","oyster_sauce","flour","cornstarch","stock_cube","sesame_oil","ketchup","mayonnaise","bay_leaf","curry_powder","paprika","cinnamon","baking_powder","honey","ginger","gochujang"];

/* Synonym index, longest phrase first so "leftover rice" beats "rice". */
const SYN = [];
for (const [k, v] of Object.entries(ING)) for (const s of [v.n.toLowerCase(), ...v.s]) SYN.push([s, k]);
SYN.sort((a, b) => b[0].length - a[0].length);
function norm(s) { return String(s || "").toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9ñ\s-]/g, " ").replace(/\s+/g, " ").trim(); }
const COOKED_WORDS = /\b(leftover|leftovers|cooked|roasted|roast|fried|grilled|boiled|steamed|day-old|day old)\b/;
/* Find the ingredient key for a name. Whole-word matches only (so "hot sauce" is never "soy sauce"). */
function resolveKey(name) {
  const t = " " + norm(name) + " ";
  let hit = null;
  for (const [s, k] of SYN) { if (t.includes(" " + s + " ") || t.includes(" " + s + "s ")) { hit = k; break; } }
  if (hit && COOKED_WORDS.test(t) && ING[hit].cooked && !ING[hit].isCooked) hit = ING[hit].cooked;
  if (!hit && COOKED_WORDS.test(t)) hit = "leftover";
  return hit;
}
function ingName(k) { return ING[k] ? ING[k].n : k; }

/* ---------- Units ---------- */
const UNIT_ALIASES = { g:"g", gram:"g", grams:"g", gr:"g", kg:"kg", kilo:"kg", kilos:"kg", kilogram:"kg", kilograms:"kg",
  ml:"ml", l:"l", liter:"l", liters:"l", litre:"l", litres:"l", cup:"cup", cups:"cup", tbsp:"tbsp", tablespoon:"tbsp", tablespoons:"tbsp",
  tsp:"tsp", teaspoon:"tsp", teaspoons:"tsp", pc:"pcs", pcs:"pcs", piece:"pcs", pieces:"pcs", whole:"pcs", head:"pcs", heads:"pcs",
  clove:"clove", cloves:"clove", stalk:"stalk", stalks:"stalk", bunch:"bunch", bunches:"bunch", slice:"pcs", slices:"pcs",
  can:"can", cans:"can", tin:"can", tins:"can", pack:"pack", packs:"pack", packet:"pack", packets:"pack", bag:"pack", bags:"pack",
  serving:"servings", servings:"servings", portion:"servings", portions:"servings", block:"pcs", blocks:"pcs", bottle:"pack", jar:"pack" };
const UNITS = ["pcs","g","kg","ml","l","cup","tbsp","tsp","clove","stalk","bunch","can","pack","servings"];
const UNIT_LABEL = { pcs:"", g:"g", kg:"kg", ml:"ml", l:"L", cup:"cup", tbsp:"tbsp", tsp:"tsp", clove:"clove", stalk:"stalk", bunch:"bunch", can:"can", pack:"pack", servings:"serving" };
/* Grams for qty+unit of an ingredient, or null when it can't be known. */
function toGrams(k, qty, unit) {
  if (qty == null || isNaN(qty)) return null;
  const v = ING[k] || {};
  switch (unit) {
    case "g": return qty;
    case "kg": return qty * 1000;
    case "ml": return qty * ((v.cup || 240) / 240);
    case "l": return qty * 1000 * ((v.cup || 240) / 240);
    case "cup": return v.cup ? qty * v.cup : (v.w ? null : qty * 240);
    case "tbsp": return qty * ((v.cup || 240) / 16);
    case "tsp": return qty * ((v.cup || 240) / 48);
    case "pcs": case "clove": case "stalk": case "bunch": return v.w ? qty * v.w : null;
    case "can": case "pack": return v.w ? qty * v.w : (k === "coconut_milk" ? qty * 400 : null);
    default: return null;
  }
}
function fromGrams(k, grams, unit) {
  const one = toGrams(k, 1, unit);
  return one ? grams / one : null;
}
function fmtQty(q) {
  if (q == null) return "";
  const r = Math.round(q * 100) / 100;
  const frac = { 0.25: "¼", 0.5: "½", 0.75: "¾", 0.33: "⅓", 0.67: "⅔" };
  const whole = Math.floor(r), f = Math.round((r - whole) * 100) / 100;
  if (frac[f]) return (whole ? whole : "") + frac[f];
  if (f === 0) return String(whole);
  return String(r >= 10 ? Math.round(r) : Math.round(r * 10) / 10);
}
function fmtAmount(q, u) {
  if (q == null) return "";
  const lab = UNIT_LABEL[u] ?? u;
  const plural = q > 1 && ["cup","clove","stalk","bunch","can","pack","serving"].includes(lab) ? lab + "s" : lab;
  return (fmtQty(q) + (lab ? " " + plural : "")).trim();
}

/* ---------- Parsing what people type ---------- */
const NUMWORDS = { a:1, an:1, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10, eleven:11, twelve:12, dozen:12, half:0.5, quarter:0.25 };
function parseNumber(t) {
  t = t.trim();
  const fr = { "½":0.5, "¼":0.25, "¾":0.75, "⅓":1/3, "⅔":2/3 };
  let m = t.match(/^(\d+)\s*([½¼¾⅓⅔])$/); if (m) return +m[1] + fr[m[2]];
  if (fr[t] != null) return fr[t];
  m = t.match(/^(\d+)\s+(\d+)\/(\d+)$/); if (m) return +m[1] + m[2] / m[3];
  m = t.match(/^(\d+)\/(\d+)$/); if (m) return m[1] / m[2];
  if (/^\d+(\.\d+)?$/.test(t)) return parseFloat(t);
  if (NUMWORDS[t] != null) return NUMWORDS[t];
  return null;
}
/* "3 eggs, half a cabbage, 2 cups of rice, and one leftover chicken breast" → items */
function parseIngredientText(text) {
  const parts = String(text || "").split(/\s*(?:,|;|\n|\band\b|\+)\s*/i).map(s => s.trim()).filter(Boolean);
  return parts.map(part => {
    let rest = part.replace(/^(about|around|roughly|some)\s+/i, "");
    let qty = null, unit = null;
    // "half a cabbage", "a dozen eggs", "1 1/2 cups"
    let m = rest.match(/^(half|quarter)\s+(?:a|an|of\s+a|of)?\s*(.*)$/i);
    if (m) { qty = NUMWORDS[m[1].toLowerCase()]; rest = m[2]; }
    else {
      m = rest.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+\s*[½¼¾⅓⅔]|[½¼¾⅓⅔]|\d+(?:\.\d+)?|a dozen|dozen|an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(.*)$/i);
      if (m) { qty = m[1].toLowerCase().includes("dozen") ? 12 : parseNumber(m[1].toLowerCase()); rest = m[2]; }
    }
    m = rest.match(/^([a-z]+)\.?\s+(?:of\s+)?(.*)$/i);
    if (m && UNIT_ALIASES[m[1].toLowerCase()] && m[2]) { unit = UNIT_ALIASES[m[1].toLowerCase()]; rest = m[2]; }
    m = rest.match(/^(\d+(?:\.\d+)?)\s*(g|kg|ml|l)\b\s*(?:of\s+)?(.*)$/i); // "rice 2kg" style is rare; "200g chicken"
    if (qty == null && m) { qty = +m[1]; unit = m[2].toLowerCase(); rest = m[3]; }
    const glued = part.match(/^(\d+(?:\.\d+)?)(g|kg|ml|l)\s+(?:of\s+)?(.*)$/i);
    if (glued) { qty = +glued[1]; unit = glued[2].toLowerCase(); rest = glued[3]; }
    rest = rest.replace(/^(of|the)\s+/i, "").trim();
    const key = resolveKey(rest);
    const v = key ? ING[key] : null;
    if (!unit) unit = qty == null ? null : (v ? (v.w && !["tsp","tbsp"].includes(v.u) ? "pcs" : v.u) : "pcs");
    // "half a cabbage" → 0.5 pcs; "2 cups of rice" → 2 cup
    if (unit === "pcs" && v && v.u !== "pcs" && !v.w) unit = v.u;
    const frozen = /\bfrozen\b/i.test(part);
    const cooked = v ? !!v.isCooked : COOKED_WORDS.test(norm(part));
    let name = rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : part;
    if (v && norm(rest) === norm(v.n)) name = v.n;
    return { name, key, qty, unit, loc: frozen ? "freezer" : (cooked ? "fridge" : (v ? v.loc : "fridge")), cooked };
  }).filter(x => x.name && x.name.length < 80);
}

/* ---------- Freshness & food safety ----------
   Returns { group, daysLeft, dateISO, basis, safe, note } where group is
   check | first | soon | fresh | long. "check" items are never used in recipes. */
function shelfLife(item) {
  const v = ING[item.key] || {};
  const cooked = item.cooked || v.isCooked;
  if (item.loc === "freezer") return { days: v.z === null ? null : (v.z || 90), quality: true };
  if (cooked && !v.isCooked) return { days: (item.key === "rice_raw" || /rice/.test(norm(item.name))) ? 1 : 3, quality: false };
  let days = item.loc === "pantry" ? v.p : v.f;
  if (item.opened && v.o) days = Math.min(days ?? v.o, v.o);
  if (days === undefined) days = item.loc === "pantry" ? 14 : 5; // unknown food: be conservative
  return { days, quality: v.r === "low" };
}
function freshness(item, now) {
  const v = ING[item.key] || {};
  const highRisk = (v.r || "med") !== "low" || item.cooked;
  const today = todayISO(now);
  // 1) Unknown history of a cooked or high-risk food: don't guess.
  if (item.unknownAge && highRisk && item.loc !== "freezer") {
    return { group: "check", daysLeft: null, basis: "unknown", safe: false, note: "Unknown age. When in doubt, throw it out. Smell and looks can't tell you it's safe." };
  }
  // 2) Manufacturer use-by / expiry date = safety date.
  if (item.label && item.label.type === "useby" && parseISO(item.label.date) && item.loc !== "freezer") {
    const d = daysUntil(item.label.date, now);
    if (d < 0) return { group: "check", daysLeft: d, dateISO: item.label.date, basis: "useby", safe: false, note: "Past its use-by date. Don't eat it." };
    // An opened or cooked item can run out before the printed date.
    const est = estimate(item, now);
    if (est && est.daysLeft < d) return est;
    return { group: groupFor(d, v), daysLeft: d, dateISO: item.label.date, basis: "useby", safe: true, note: "Use by " + prettyDate(item.label.date) + " (printed date)" };
  }
  const est = estimate(item, now);
  // 3) Best-before = quality date.
  if (item.label && item.label.type === "bestbefore" && parseISO(item.label.date)) {
    const d = daysUntil(item.label.date, now);
    if (est && est.daysLeft != null && est.daysLeft < d) return est;
    if (d < 0) {
      if (highRisk) return { group: "check", daysLeft: d, dateISO: item.label.date, basis: "bestbefore", safe: false, note: "Past its best-before date, and it's a perishable food. Don't eat it." };
      return { group: "first", daysLeft: d, dateISO: item.label.date, basis: "bestbefore", safe: true, note: "Past best-before (a quality date). Quality may have dropped. Check the packaging is intact." };
    }
    return { group: groupFor(d, v), daysLeft: d, dateISO: item.label.date, basis: "bestbefore", safe: true, note: "Best before " + prettyDate(item.label.date) + " (printed quality date)" };
  }
  return est || { group: "fresh", daysLeft: null, basis: "none", safe: true, note: "No date recorded" };
}
function estimate(item, now) {
  const v = ING[item.key] || {};
  const highRisk = (v.r || "med") !== "low" || item.cooked;
  const sl = shelfLife(item);
  const start = item.opened && item.openedOn ? item.openedOn : (item.added || todayISO(now));
  if (item.est) { // a date the person set themselves
    const d = daysUntil(item.est, now);
    if (d < 0 && highRisk) return { group: "check", daysLeft: d, dateISO: item.est, basis: "own", safe: false, note: "Past the date you set. Don't eat it." };
    return { group: d < 0 ? "first" : groupFor(d, v), daysLeft: d, dateISO: item.est, basis: "own", safe: true, note: (d < 0 ? "Past the date you set: check it's still good" : "Use by " + prettyDate(item.est) + " (your date)") };
  }
  if (item.loc === "freezer") {
    if (sl.days === null) return { group: "check", daysLeft: null, basis: "estimate", safe: true, note: "Not a food that freezes well. Thaw in the fridge and use soon." };
    const d = daysUntil(addDays(start, sl.days), now);
    return { group: "long", daysLeft: d, dateISO: addDays(start, sl.days), basis: "estimate", safe: true,
      note: d < 0 ? "Frozen food stays safe, but it's past its best quality. Use it soon." : "Frozen: safe while frozen; best quality until about " + prettyDate(addDays(start, sl.days)) };
  }
  if (sl.days === null) {
    return { group: highRisk ? "check" : "soon", daysLeft: null, basis: "estimate", safe: !highRisk,
      note: highRisk ? (item.loc === "pantry" ? "This needs to be kept cold. Food left out for more than 2 hours isn't safe." : "Check how this is stored.") : "Usually stored somewhere else. Use it soon." };
  }
  const date = addDays(start, sl.days), d = daysUntil(date, now);
  if (d < 0) {
    if (highRisk) return { group: "check", daysLeft: d, dateISO: date, basis: "estimate", safe: false, note: "Past the safe storage time for this food. Don't eat it." };
    return { group: "first", daysLeft: d, dateISO: date, basis: "estimate", safe: true, note: "Past its usual freshness. Check it before using." };
  }
  return { group: groupFor(d, v), daysLeft: d, dateISO: date, basis: "estimate", safe: true,
    note: (d === 0 ? "Use today" : "Use within " + d + " day" + (d === 1 ? "" : "s")) + " (estimate)" };
}
function groupFor(d, v) { if (d <= 1) return "first"; if (d <= 4) return "soon"; if (d <= 30) return "fresh"; return "long"; }
const GROUPS = [
  ["check", "Check these first", "Food that may not be safe. When in doubt, throw it out."],
  ["first", "Use first", "Needs using today or tomorrow."],
  ["soon", "Use soon", "Best within the next few days."],
  ["fresh", "Still fresh", "Good for a while yet."],
  ["long", "Long-lasting", "Cupboard and freezer food."]
];
const GROUP_RANK = { check: 0, first: 1, soon: 2, fresh: 3, long: 4 };

/* ---------- Pantry operations ---------- */
function newItem(src, now) {
  const key = src.key !== undefined ? src.key : resolveKey(src.name);
  const v = ING[key] || {};
  let qty = src.qty == null || src.qty === "" ? null : Number(src.qty);
  if (qty != null && (!isFinite(qty) || qty <= 0 || qty > 100000)) qty = null;
  return {
    id: src.id || Math.random().toString(36).slice(2, 10),
    name: String(src.name || v.n || "Item").trim().slice(0, 60),
    key: key || null,
    qty, unit: qty == null ? (src.unit || v.u || null) : (src.unit || v.u || "pcs"),
    loc: LOCS[src.loc] ? src.loc : (v.loc || "fridge"),
    cooked: !!(src.cooked || v.isCooked),
    opened: !!src.opened, openedOn: src.openedOn || null,
    added: src.added || todayISO(now),
    label: src.label && src.label.date ? { type: src.label.type === "bestbefore" ? "bestbefore" : "useby", date: src.label.date } : null,
    est: src.est || null,
    unknownAge: !!src.unknownAge,
    notes: String(src.notes || "").slice(0, 200)
  };
}
/* Adds items, merging duplicates (same food, place and state) instead of creating copies.
   When merging, the OLDER date is kept so freshness stays conservative. */
function addToPantry(pantry, items, now) {
  const added = [], merged = [];
  for (const src of items) {
    const it = newItem(src, now);
    const same = pantry.find(p => (p.key && p.key === it.key || !p.key && norm(p.name) === norm(it.name)) && p.loc === it.loc && p.cooked === it.cooked && p.opened === it.opened && !p.unknownAge && !it.unknownAge);
    if (same) {
      if (same.qty != null && it.qty != null) {
        if (same.unit === it.unit) same.qty += it.qty;
        else { const g1 = toGrams(same.key, same.qty, same.unit), g2 = toGrams(it.key, it.qty, it.unit); if (g1 != null && g2 != null) { same.qty = round2(fromGrams(same.key, g1 + g2, same.unit)); } else { pantry.push(it); added.push(it); continue; } }
      } else if (same.qty == null && it.qty != null) { same.qty = it.qty; same.unit = it.unit; }
      if (it.added < same.added) same.added = it.added;
      merged.push(same);
    } else { pantry.push(it); added.push(it); }
  }
  return { added, merged };
}
function round2(x) { return Math.round(x * 100) / 100; }
function validateItem(it, now) {
  const errs = [];
  if (!it.name || !it.name.trim()) errs.push("Add a name.");
  if (it.qty != null && (!(it.qty > 0) || it.qty > 100000)) errs.push("Quantity must be a positive number.");
  const today = todayISO(now);
  if (it.added && (!parseISO(it.added) || it.added > today)) errs.push("The bought/made date can't be in the future.");
  if (it.opened && it.openedOn && (!parseISO(it.openedOn) || it.openedOn > today)) errs.push("The opened date can't be in the future.");
  if (it.opened && it.openedOn && it.added && it.openedOn < it.added) errs.push("It can't be opened before it was bought or made.");
  if (it.label && it.label.date && !parseISO(it.label.date)) errs.push("Check the printed date.");
  return errs;
}

/* ---------- Recipe matching ----------
   A recipe ingredient is { k, q, u, opt?, any?, subs? }.
   any: [keys] lets several foods fill one slot (e.g. "any vegetables").
   subs: [{ k, q, u, f: flavor change, t: texture change, w: how to use it }]. */
const ENOUGH = 0.75; // need at least 75% of the amount for essentials
function usableItems(pantry, now) { return pantry.map(p => ({ p, fr: freshness(p, now) })).filter(x => x.fr.safe && x.fr.group !== "check"); }
function stapleOn(staples, k) { return staples.includes(k) || (ING[k] && ING[k].free); }
function findSupply(k, usable, staples, needG) {
  const items = usable.filter(x => x.p.key === k).sort((a, b) => (GROUP_RANK[a.fr.group] - GROUP_RANK[b.fr.group]) || ((a.fr.daysLeft ?? 999) - (b.fr.daysLeft ?? 999)));
  if (items.length) {
    let haveG = 0, unknown = false;
    for (const x of items) { const g = toGrams(k, x.p.qty, x.p.unit); if (g == null) unknown = true; else haveG += g; }
    const enough = unknown || needG == null || haveG >= needG * ENOUGH;
    return { src: "pantry", items, haveG, unknown, enough, short: !unknown && needG != null && haveG < needG };
  }
  if (stapleOn(staples, k)) return { src: "staple", items: [], enough: true };
  return null;
}
function scaleQ(q, f) { return q == null ? null : q * f; }
function matchRecipe(r, pantry, staples, opts = {}, now) {
  const usable = opts._usable || usableItems(pantry, now);
  const f = (opts.servings || r.serves) / r.serves;
  const res = { recipe: r, ok: true, lines: [], swaps: [], missing: [], skipped: [], usedItems: new Set(), urgentUsed: [], notes: [], amountShort: [], servings: opts.servings || r.serves };
  for (const ing of r.ingredients) {
    const q = scaleQ(ing.q, f);
    const keys = ing.any || [ing.k];
    let line = null, ratio = null;
    if (ing.any) {
      // fill the slot from several foods, most urgent first
      const needG = toGrams(keys[0], q, ing.u) ?? (ing.u === "g" ? q : null);
      let got = 0, picks = [];
      const cands = usable.filter(x => keys.includes(x.p.key)).sort((a, b) => GROUP_RANK[a.fr.group] - GROUP_RANK[b.fr.group]);
      const minK = ing.minKinds || 1, maxK = Math.max(minK, ing.maxKinds || 4);
      for (const x of cands) {
        const kinds = new Set(picks.map(y => y.p.key)).size;
        if (needG != null && got >= needG && kinds >= minK && (minK < 2 || kinds >= maxK)) break;
        if (kinds >= maxK && !picks.some(y => y.p.key === x.p.key)) continue;
        const g = toGrams(x.p.key, x.p.qty, x.p.unit); picks.push(x); got += g ?? (needG || 0);
      }
      const kinds = new Set(picks.map(x => x.p.key)).size;
      if (picks.length && (needG == null || got >= needG * 0.6) && kinds >= (ing.minKinds || 1)) {
        line = { ing, q, src: "pantry", items: picks, name: ing.label || "Vegetables", haveG: got, needG, short: needG != null && got < needG };
      } else if (picks.length && needG && kinds >= (ing.minKinds || 1)) ratio = got / needG;
    } else {
      const needG = ing.k ? toGrams(ing.k, q, ing.u) : null;
      let sup;
      if (ing.k) sup = findSupply(ing.k, usable, staples, needG);
      else if (ing.n) { const n = norm(ing.n); const items = usable.filter(x => { const pn = norm(x.p.name); return pn === n || pn.includes(n) || n.includes(pn); }); sup = items.length ? { src: "pantry", items, enough: true, unknown: true } : null; }
      if (sup && (sup.enough || ing.opt)) line = { ing, q, src: sup.src, items: sup.items, name: ing.k ? ingName(ing.k) : ing.n, haveG: sup.haveG, needG, short: sup.short, unknown: sup.unknown };
      else if (sup && needG) ratio = sup.haveG / needG;
    }
    if (!line && ing.subs) {
      for (const s of ing.subs) {
        const sq = scaleQ(s.q, f), needG = toGrams(s.k, sq, s.u);
        const sup = findSupply(s.k, usable, staples, needG);
        if (sup && sup.enough) { line = { ing, q: sq, unit: s.u, src: sup.src, items: sup.items, name: ingName(s.k), sub: s, subFor: ing.any ? (ing.label || "the vegetables") : ingName(ing.k), needG, haveG: sup.haveG, short: sup.short, unknown: sup.unknown }; res.swaps.push(line); break; }
      }
    }
    if (!line) {
      if (ing.opt) { res.skipped.push(ing); res.lines.push({ ing, q, skipped: true, name: ing.any ? (ing.label || "Vegetables") : ingName(ing.k) }); continue; }
      res.ok = false; res.missing.push(ing.any ? (ing.label || "vegetables") : (ing.k ? ingName(ing.k) : ing.n || "an ingredient"));
      if (ratio != null) res.amountShort.push({ name: ing.any ? (ing.label || "vegetables") : ingName(ing.k), ratio });
      continue;
    }
    for (const x of line.items) { res.usedItems.add(x.p.id); if (x.fr.group === "first" || x.fr.group === "soon") res.urgentUsed.push(x.p); }
    res.lines.push(line);
  }
  // equipment, time and diet filters
  const P = opts.prefs || {};
  if (P.equipment && r.equip && !r.equip.every(e => P.equipment.includes(e))) { res.ok = false; res.blocked = "equipment"; }
  if (opts.maxTime && r.prep + r.cook > opts.maxTime) { res.ok = false; res.blocked = "time"; }
  const diet = dietOf(res);
  if (P.diet) {
    if (P.diet.includes("vegetarian") && (diet.meat.size || diet.fishSauce)) res.blocked = "diet";
    if (P.diet.includes("nopork") && diet.meat.has("pork")) res.blocked = "diet";
    if (P.diet.includes("nobeef") && diet.meat.has("beef")) res.blocked = "diet";
    if (P.diet.includes("noseafood") && (diet.meat.has("seafood") || diet.fishSauce)) res.blocked = "diet";
    if (P.diet.includes("nodairy") && diet.dairy) res.blocked = "diet";
    if (P.diet.includes("noegg") && diet.egg) res.blocked = "diet";
    if (P.diet.includes("nogluten") && diet.gluten) res.blocked = "diet";
    if (res.blocked === "diet") res.ok = false;
  }
  if (opts.cuisine && opts.cuisine !== "any" && r.cuisine !== opts.cuisine) { res.ok = false; res.blocked = "cuisine"; }
  res.usedCount = res.usedItems.size;
  res.urgentUsed = [...new Map(res.urgentUsed.map(p => [p.id, p])).values()];
  return res;
}
function dietOf(m) {
  const out = { meat: new Set(), dairy: false, egg: false, gluten: false, fishSauce: false };
  for (const l of m.lines) {
    if (l.skipped) continue;
    const keys = l.items && l.items.length ? l.items.map(x => x.p.key) : [l.sub ? l.sub.k : l.ing.k];
    for (const k of keys) { const v = ING[k] || {}; if (v.m) out.meat.add(v.m); if (v.m2) out.fishSauce = true; if (v.d) out.dairy = true; if (v.e) out.egg = true; if (v.gl) out.gluten = true; }
  }
  return out;
}

/* ---------- Ranking ----------
   Taste and reliability carry as much weight as food-waste reduction, so a
   recipe never wins just by using many ingredients. */
const URG_POINTS = { first: 14, soon: 7, fresh: 1.5, long: 0.3 };
function scoreMatch(m, mode, now) {
  const r = m.recipe;
  const quality = (r.q || 3) * 12 - m.swaps.reduce((s, l) => s + (l.sub.cost ?? 4), 0) - (r.ai ? 10 : 0);
  let urgency = 0;
  for (const l of m.lines) for (const x of (l.items || [])) urgency += URG_POINTS[x.fr.group] || 0;
  urgency = Math.min(urgency, 45);
  const use = Math.min(m.usedCount * 3, 18);
  const time = (r.prep + r.cook) <= 20 ? 4 : (r.prep + r.cook) <= 35 ? 2 : 0;
  const short = m.lines.filter(l => l.short && !l.ing.opt).length * 3;
  const w = { most: [1, 0.7, 2.2], urgent: [1, 1.8, 0.6], one: [1.1, 1, 0.8], everything: [1, 1, 1.5] }[mode] || [1, 1, 1];
  const total = quality * w[0] + urgency * w[1] + use * w[2] + time - short;
  return { total, quality, urgency, use, time };
}
/* Match, and if there isn't enough for the full batch, offer a smaller one instead of hiding the dish. */
function fitMatch(r, pantry, staples, opts = {}, now) {
  let m = matchRecipe(r, pantry, staples, opts, now);
  if (!m.ok && !m.blocked && m.missing.length && m.missing.length === m.amountShort.length) {
    for (let sv = (opts.servings || r.serves) - 1; sv >= 1; sv--) {
      const t = matchRecipe(r, pantry, staples, { ...opts, servings: sv }, now);
      if (t.ok) { t.scaledDown = true; return t; }
    }
  }
  return m;
}
/* Mode 1–3: ranked list. opts.focus = item ids that must be used (Cook with one ingredient / picked items). */
function rankRecipes(recipes, pantry, staples, opts = {}, now) {
  const usable = usableItems(pantry, now);
  const out = [];
  for (const r of recipes) {
    const m = fitMatch(r, pantry, staples, { ...opts, _usable: usable }, now);
    if (!m.ok) continue;
    if (opts.focus && opts.focus.length && !opts.focus.every(id => m.usedItems.has(id))) continue;
    m.score = scoreMatch(m, opts.mode, now);
    out.push(m);
  }
  if (opts.mode === "urgent" && out.some(m => m.urgentUsed.length)) out.forEach(m => { if (!m.urgentUsed.length) m.score.total -= 25; });
  return out.sort((a, b) => b.score.total - a.score.total);
}
/* Mode 4: use everything possible, across several dishes rather than one forced recipe.
   Greedy: pick the best dish, take what it uses out of the kitchen, repeat. */
function planEverything(recipes, pantry, staples, opts = {}, now) {
  const targets = new Set((opts.focus && opts.focus.length ? opts.focus : usableItems(pantry, now).filter(x => ING[x.p.key]?.c !== "condiment" && x.fr.group !== "long").map(x => x.p.id)));
  let kitchen = JSON.parse(JSON.stringify(pantry));
  const dishes = [], covered = new Set();
  for (let round = 0; round < 3; round++) {
    const ranked = rankRecipes(recipes.filter(r => !dishes.some(d => d.recipe.id === r.id)), kitchen, staples, { ...opts, mode: "everything", focus: null }, now)
      .map(m => ({ m, gain: [...m.usedItems].filter(id => targets.has(id) && !covered.has(id)).length }))
      .filter(x => x.gain > 0 && x.m.score.quality >= 40)
      .sort((a, b) => (b.gain * 10 + b.m.score.total) - (a.gain * 10 + a.m.score.total));
    if (!ranked.length) break;
    const best = ranked[0].m;
    dishes.push(best);
    best.usedItems.forEach(id => covered.add(id));
    kitchen = applyDeductions(kitchen, planDeductions(best)).pantry;
  }
  const left = pantry.filter(p => targets.has(p.id) && !covered.has(p.id));
  return { dishes, covered: [...covered].filter(id => targets.has(id)), left };
}

/* ---------- Cooking: what to take out of the kitchen ---------- */
function planDeductions(m) {
  const rows = [];
  for (const l of m.lines) {
    if (l.skipped || l.src !== "pantry") continue;
    let needG = l.needG;
    if (l.ing.any && needG != null && l.items.length > 1) {
      // share the amount across the chosen foods instead of emptying the first one
      const have = l.items.map(x => toGrams(x.p.key, x.p.qty, x.p.unit));
      const share = new Array(l.items.length).fill(0);
      let left = needG;
      for (let pass = 0; pass < 3 && left > 0.5; pass++) {
        const open = l.items.map((_, i) => i).filter(i => have[i] == null || share[i] < have[i]);
        if (!open.length) break;
        const each = left / open.length;
        for (const i of open) { const room = have[i] == null ? each : have[i] - share[i]; const t = Math.min(each, room); share[i] += t; left -= t; }
      }
      l.items.forEach((x, i) => {
        const p = x.p;
        if (have[i] == null) { rows.push({ id: p.id, name: p.name, qty: p.qty, unit: p.unit, take: null, all: false, unknown: true }); return; }
        if (share[i] <= 0) return;
        const take = round2(fromGrams(p.key, share[i], p.unit));
        rows.push({ id: p.id, name: p.name, qty: p.qty, unit: p.unit, take, all: take >= p.qty - 1e-6, unknown: false });
      });
      continue;
    }
    for (const x of l.items) {
      const p = x.p, k = p.key;
      const haveG = toGrams(k, p.qty, p.unit);
      let take = null, all = false;
      if (p.qty == null || haveG == null) { all = l.items.length === 1 ? false : false; take = null; }
      else if (needG == null) { take = p.qty; all = true; }
      else { const g = Math.min(haveG, needG); take = round2(fromGrams(k, g, p.unit)); needG -= g; all = take >= p.qty - 1e-6; }
      rows.push({ id: p.id, name: p.name, qty: p.qty, unit: p.unit, take, all, unknown: p.qty == null || haveG == null });
      if (needG != null && needG <= 0) break;
    }
  }
  // merge rows for the same item
  const byId = new Map();
  for (const r of rows) { const e = byId.get(r.id); if (e) { e.take = e.take == null || r.take == null ? null : round2(e.take + r.take); e.all = e.all || r.all || (e.qty != null && e.take >= e.qty); } else byId.set(r.id, { ...r }); }
  return [...byId.values()];
}
/* rows: [{id, take (in item unit) or null, all}] → new pantry + what was used */
function applyDeductions(pantry, rows) {
  const used = [];
  const next = [];
  for (const p of pantry) {
    const r = rows.find(x => x.id === p.id);
    if (!r || (!r.all && !(r.take > 0))) { next.push(p); continue; }
    if (r.all || p.qty == null || r.take >= p.qty - 1e-6) { used.push({ name: p.name, key: p.key, qty: p.qty, unit: p.unit, all: true }); continue; }
    const q = { ...p, qty: round2(p.qty - r.take) };
    used.push({ name: p.name, key: p.key, qty: r.take, unit: p.unit, all: false });
    next.push(q);
  }
  return { pantry: next, used };
}
function leftoverItem(recipe, servings, now) {
  const rice = recipe.ingredients.some(i => i.k === "rice_cooked" || i.k === "rice_raw");
  return newItem({ name: "Leftover " + recipe.title, key: rice ? "rice_cooked" : "leftover", qty: servings, unit: "servings", loc: "fridge", cooked: true, added: todayISO(now),
    notes: rice ? "Contains rice: eat within 24 hours, reheat only once until steaming hot." : "Cooked leftovers: eat within 3 days, reheat until steaming hot (74°C / 165°F)." }, now);
}
/* General safety notes that always apply to certain ingredients. */
function safetyNotes(m) {
  const keys = new Set(); for (const l of m.lines) { if (l.skipped) continue; (l.items && l.items.length ? l.items.map(x => x.p.key) : [l.sub ? l.sub.k : l.ing.k]).forEach(k => keys.add(k)); }
  const n = [];
  if (keys.has("chicken") || keys.has("ground_pork") || keys.has("ground_beef")) n.push("Cook chicken and ground meat until no pink remains and the juices run clear: 74°C (165°F) in the thickest part if you have a thermometer. Ground pork and beef: 71°C (160°F).");
  if (keys.has("pork") || keys.has("beef")) n.push("Whole cuts of pork and beef: at least 63°C (145°F), then rest 3 minutes.");
  if (keys.has("fish") || keys.has("shrimp")) n.push("Fish is done when it flakes easily and is opaque; shrimp turn pink and opaque: 63°C (145°F).");
  if (keys.has("rice_cooked") || keys.has("rice_raw")) n.push("Rice: cool leftovers within an hour, keep in the fridge, eat within 24 hours, and reheat only once until steaming hot.");
  if (keys.has("chicken_cooked") || keys.has("leftover") || keys.has("fish_cooked") || keys.has("pasta_cooked") || keys.has("potato_cooked")) n.push("Reheat cooked leftovers until steaming hot all the way through (74°C / 165°F). Reheat only once.");
  if (keys.has("egg")) n.push("Cook eggs until whites are set. For young children, older adults, pregnant people or anyone with weak immunity, cook yolks firm too.");
  n.push("Wash hands, boards and knives after handling raw meat or seafood, and keep raw meat away from food that won't be cooked.");
  return n;
}

const Engine = { ING, LOCS, GROUPS, GROUP_RANK, UNITS, UNIT_LABEL, DEFAULT_STAPLES, OPTIONAL_STAPLES, todayISO, addDays, daysUntil, prettyDate, parseISO,
  resolveKey, ingName, norm, toGrams, fromGrams, fmtQty, fmtAmount, parseIngredientText, freshness, newItem, addToPantry, validateItem,
  usableItems, matchRecipe, fitMatch, rankRecipes, planEverything, planDeductions, applyDeductions, leftoverItem, safetyNotes, scoreMatch };
if (typeof module !== "undefined") module.exports = Engine;
