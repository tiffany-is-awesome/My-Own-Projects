/* =====================================================================
   FEATURES: icons & illustrations, Rescue My Food, Meal Planner,
   guided cooking, photo & receipt scanning.
   Shares state (S), helpers ($, esc, toast, openModal…) with app.js.
   ===================================================================== */

/* ---------- One line-icon style for the whole app ---------- */
const IC = {
  home: '<path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/><path d="M10 20v-5h4v5"/>',
  fridge: '<rect x="6" y="3" width="12" height="18" rx="2.5"/><path d="M6 10h12M9 6v2M9 13v3"/>',
  pot: '<path d="M4 10h16v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M2 10h2M20 10h2M9 6.5c0-1.2 1-1.2 1-2.5M14 6.5c0-1.2 1-1.2 1-2.5"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16M9 3v4M15 3v4M8 14h3M8 17h6"/>',
  rescue: '<path d="M12 20.5c-4.8-2.8-8-6.2-8-10A4.4 4.4 0 0 1 12 8a4.4 4.4 0 0 1 8 2.5c0 3.8-3.2 7.2-8 10z"/><path d="M12 11.5v5M9.5 14h5"/>',
  bookmark: '<path d="M7 4h10v16l-5-3.8L7 20z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4.5l3 2"/>',
  alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.2v.3"/>',
  stop: '<path d="M8.5 3.5h7l5 5v7l-5 5h-7l-5-5v-7z"/><path d="M9.5 9.5l5 5M14.5 9.5l-5 5"/>',
  snow: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="M9.5 4.5L12 6.5l2.5-2M9.5 19.5l2.5-2 2.5 2"/>',
  flame: '<path d="M12 21c-3.9 0-6.5-2.6-6.5-6 0-3.5 3-5.3 3.5-9 2 1.2 3 3 3 4.5 1-.8 1.6-2 1.7-3 2 1.6 4.8 4.3 4.8 7.5 0 3.4-2.6 6-6.5 6z"/>',
  jar: '<path d="M8 3h8v3H8z"/><path d="M7 6h10l1 3v9a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V9z"/><path d="M7 12h10"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
  oven: '<rect x="3.5" y="4" width="17" height="16" rx="2.5"/><path d="M3.5 9h17M7 6.5h.01M10 6.5h.01"/><rect x="7" y="12" width="10" height="5" rx="1"/>',
  knife: '<path d="M4 20l9.5-9.5M13.5 10.5l5-5.5c1 1.5 1 3.5-.5 5l-3 3z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  receipt: '<path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  cart: '<path d="M3 4h2.5l2.2 10.5h10L20 7H7"/><circle cx="9" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  left: '<path d="M15 5l-7 7 7 7"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  timer: '<circle cx="12" cy="13.5" r="7"/><path d="M12 10v3.5l2 1.5M10 3h4M12 3v3.5"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  reset: '<path d="M4.5 12a7.5 7.5 0 1 0 2.3-5.4"/><path d="M4 4v4.5h4.5"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
  leaf: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14z"/><path d="M5 19l8-8"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  star: '<path d="M12 4l2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.3"/>'
};
const icon = (n, c = "") => `<svg class="ic${c ? " " + c : ""}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${IC[n] || ""}</svg>`;

/* ---------- Ingredient art: small, consistent food marks ---------- */
const FOOD = {
  carrot: ['#E8833A', '<path d="M7 19l9-9-2.5-2.5-9 9z" fill="var(--fc)"/><path d="M14 8l2.5-4M15.5 9.5l4-2.5M15 8.5l3-3" stroke="#4E9A5B"/>'],
  leaf: ['#6DB36F', '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14z" fill="var(--fc)"/><path d="M5 19l8-8" stroke="#2E6B5A"/>'],
  tomato: ['#D9443A', '<circle cx="12" cy="13.5" r="6.5" fill="var(--fc)"/><path d="M9 7.5l3 2 3-2M12 9.5V6" stroke="#4E9A5B"/>'],
  fruit: ['#F4B400', '<path d="M12 8c3-2 7 0 7 5s-3.5 7-7 7-7-2-7-7 4-7 7-5z" fill="var(--fc)"/><path d="M12 8c0-2 1-3.5 2.5-4" stroke="#4E9A5B"/>'],
  egg: ['#FFFFFF', '<path d="M12 4c3.3 0 6 5 6 9.5a6 6 0 0 1-12 0C6 9 8.7 4 12 4z" fill="var(--fc)"/><circle cx="12" cy="14" r="2.6" fill="#F4B400" stroke="none"/>'],
  meat: ['#C8705A', '<path d="M14.5 4.5a5 5 0 0 1 3 8.5c-2 2-5 2.5-6.5 1L8 17.5" fill="var(--fc)"/><path d="M8 17.5l-2.5 2.5M5 17l1.5 1.5"/>'],
  fish: ['#7FA7C9', '<path d="M3.5 12c3-4.5 9-5.5 13 0-4 5.5-10 4.5-13 0z" fill="var(--fc)"/><path d="M16.5 12l4-3.5v7z" fill="var(--fc)"/><circle cx="7.5" cy="11.3" r=".6" fill="#2A2B29"/>'],
  rice: ['#F5F1E6', '<path d="M4 12h16a8 8 0 0 1-16 0z" fill="var(--fc)"/><path d="M7 12c1-3 2-3.5 2.5-4M11 12c.5-3 1-4 1-5M15 12c-.5-2.5-1-3.5-1.5-4.5"/>'],
  bread: ['#E3B47A', '<path d="M5 10a4 4 0 0 1 3-6h8a4 4 0 0 1 3 6v9H5z" fill="var(--fc)"/><path d="M9 9v6M15 9v6"/>'],
  noodles: ['#F1D58A', '<path d="M4 12h16a8 8 0 0 1-16 0z" fill="var(--fc)"/><path d="M8 12c0-3 1-5 3-7M12 12c0-3 1-5 3-7M15 4l4 4"/>'],
  milk: ['#EAF1F6', '<path d="M8 7l2-3h4l2 3v13H8z" fill="var(--fc)"/><path d="M8 11h8"/>'],
  cheese: ['#F4C95D', '<path d="M3.5 16l9-9 8 4v6z" fill="var(--fc)"/><circle cx="12" cy="14" r="1.2"/><circle cx="16.5" cy="15" r=".9"/>'],
  can: ['#B9C4C9', '<ellipse cx="12" cy="6" rx="6" ry="2" fill="var(--fc)"/><path d="M6 6v12c0 1.1 2.7 2 6 2s6-.9 6-2V6" fill="var(--fc)"/><path d="M6 10h12"/>'],
  jar: ['#D9A066', '<path d="M8 4h8v3H8z"/><path d="M7 7h10l1 3v8a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 6 18v-8z" fill="var(--fc)"/>'],
  bowl: ['#DCEBE3', '<path d="M4 11h16a8 8 0 0 1-16 0z" fill="var(--fc)"/><path d="M9 7c0-1.2 1-1.2 1-2.5M14 7c0-1.2 1-1.2 1-2.5"/>'],
  glass: ['#F6C27A', '<path d="M7 4h10l-1.5 16h-7z" fill="var(--fc)"/><path d="M7.5 9h9"/>'],
  beans: ['#9C6B4E', '<ellipse cx="9" cy="10" rx="3.2" ry="4.2" fill="var(--fc)" transform="rotate(-20 9 10)"/><ellipse cx="15" cy="14" rx="3.2" ry="4.2" fill="var(--fc)" transform="rotate(20 15 14)"/>'],
  potato: ['#D6B07A', '<path d="M6 9c2-4 9-5 12-1s0 10-6 10-8-5-6-9z" fill="var(--fc)"/><path d="M10 10h.01M14 13h.01M11 15h.01"/>'],
  onion: ['#C9A0C6', '<path d="M12 5c4 3 7 6 7 9.5a7 7 0 0 1-14 0C5 11 8 8 12 5z" fill="var(--fc)"/><path d="M12 5V3M12 9c-2 2-2.5 6 0 10M12 9c2 2 2.5 6 0 10"/>'],
  herb: ['#8CC084', '<path d="M12 21V9M12 13c-4 0-6-2-6-5 3 0 6 2 6 5zM12 11c3.5 0 5.5-2 5.5-5-3 0-5.5 2-5.5 5z" fill="var(--fc)"/>'],
  spice: ['#E0B15A', '<path d="M8 8h8v12H8z" fill="var(--fc)"/><path d="M9 4h6v4H9zM10.5 6h.01M13.5 6h.01"/>']
};
const FOOD_KEYS = [
  [/egg/, "egg"], [/rice|sinangag/, "rice"], [/noodle|pasta|spaghetti|macaroni|pancit|bihon/, "noodles"], [/bread|pandesal|tortilla|pita|wrap/, "bread"],
  [/tomato/, "tomato"], [/carrot|squash|kalabasa|sweet_potato/, "carrot"], [/potato|taro|gabi/, "potato"], [/onion|garlic|shallot/, "onion"],
  [/spinach|kangkong|pechay|cabbage|lettuce|greens|malunggay|bok|broccoli|okra|sitaw|green_beans|beans_green|cucumber|sayote|eggplant|ampalaya|bell_pepper|pepper/, "leaf"],
  [/basil|cilantro|scallion|herb|parsley|ginger|lemongrass/, "herb"],
  [/banana|mango|apple|papaya|pineapple|berries|orange|calamansi|lemon|lime|watermelon|avocado|grape|fruit/, "fruit"],
  [/fish|tuna|sardine|shrimp|bangus|tilapia|squid|seafood/, "fish"], [/chicken|pork|beef|meat|bacon|ham|hotdog|longganisa|tocino|spam|corned|sausage/, "meat"],
  [/milk|cream|yogurt/, "milk"], [/cheese|mozzarella/, "cheese"], [/bean|monggo|mung|lentil|chickpea|tofu/, "beans"],
  [/sauce|vinegar|ketchup|mayo|bagoong|paste|oil|honey|sugar|jam/, "jar"], [/salt|pepper_black|cumin|chili|spice|paprika|curry/, "spice"],
  [/juice|soda|drink/, "glass"], [/leftover|soup|stew|adobo|curry|sinigang/, "bowl"]
];
function foodKind(p) {
  const k = (p.key || "") + " " + E.norm(p.name || "");
  if (p.key === "leftover" || (p.cooked && !/rice|egg/.test(k))) return "bowl";
  for (const [re, f] of FOOD_KEYS) if (re.test(k)) return f;
  const c = (E.ING[p.key] || {}).c;
  return { protein: "meat", grain: "rice", cooked: "bowl", dairy: "milk", produce: "leaf", condiment: "jar" }[c] || "jar";
}
function foodArt(p, size = "") {
  const [fc, body] = FOOD[foodKind(p)];
  return `<span class="food-art${size ? " " + size : ""}${p.loc === "freezer" ? " frozen" : ""}" aria-hidden="true"><svg viewBox="0 0 24 24" style="--fc:${fc}">${body}</svg>${p.loc === "freezer" ? `<i class="fz">${icon("snow")}</i>` : ""}</span>`;
}
/* Freshness as a label + icon, never colour alone */
const FRESH_BADGE = { check: ["stop", "Check now"], first: ["alert", "Use first"], soon: ["clock", "Use soon"], fresh: ["check", "Fresh"], long: ["snow", "Keeps well"] };
function freshBadge(f) {
  const [ic, label] = f.group === "check" && f.safe === false ? ["stop", "Don't eat"] : FRESH_BADGE[f.group] || FRESH_BADGE.fresh;
  return `<span class="fbadge fb-${f.group}${f.safe === false ? " unsafe" : ""}">${icon(ic)}${label}</span>`;
}

/* ---------- Spot illustrations for empty states and onboarding ---------- */
const ILL = {
  fridge: `<rect x="48" y="10" width="64" height="100" rx="10" fill="#FFFFFF" stroke="#2E6B5A" stroke-width="2.5"/><path d="M48 46h64" stroke="#2E6B5A" stroke-width="2.5"/><path d="M58 24v10M58 56v14" stroke="#2E6B5A" stroke-width="3" stroke-linecap="round"/><rect x="70" y="58" width="32" height="5" rx="2.5" fill="#DCEBE3"/><circle cx="76" cy="52" r="5" fill="#D9443A"/><rect x="86" y="44" width="9" height="13" rx="2" fill="#EAF1F6" stroke="#9BB8AC"/><path d="M72 82h30" stroke="#DCEBE3" stroke-width="5" stroke-linecap="round"/><ellipse cx="80" cy="77" rx="7" ry="4" fill="#6DB36F"/><path d="M92 74l6-6" stroke="#E8833A" stroke-width="4" stroke-linecap="round"/><ellipse cx="80" cy="114" rx="44" ry="4" fill="#2A2B29" opacity=".06"/>`,
  pot: `<ellipse cx="80" cy="112" rx="50" ry="5" fill="#2A2B29" opacity=".06"/><path d="M34 60h92v26a22 22 0 0 1-22 22H56a22 22 0 0 1-22-22z" fill="#FFFFFF" stroke="#2E6B5A" stroke-width="2.5"/><path d="M26 60h108" stroke="#2E6B5A" stroke-width="2.5" stroke-linecap="round"/><path d="M22 66h12M126 66h12" stroke="#2E6B5A" stroke-width="4" stroke-linecap="round"/><rect x="34" y="72" width="92" height="6" fill="#DCEBE3"/><g class="ill-steam" stroke="#9BB8AC" stroke-width="3" fill="none" stroke-linecap="round"><path d="M64 48c-5-6 5-10 0-16"/><path d="M80 44c-5-6 5-10 0-16"/><path d="M96 48c-5-6 5-10 0-16"/></g>`,
  basket: `<ellipse cx="80" cy="112" rx="52" ry="5" fill="#2A2B29" opacity=".06"/><circle cx="62" cy="52" r="14" fill="#D9443A"/><path d="M56 40l6 4 6-4" stroke="#4E9A5B" stroke-width="2.5" fill="none"/><path d="M84 30l18 30-10 4z" fill="#E8833A"/><path d="M98 30l-6 6M102 34l-4 6" stroke="#4E9A5B" stroke-width="2.5" stroke-linecap="round"/><path d="M78 56c0-16 10-24 26-24-2 16-10 24-26 24z" fill="#6DB36F"/><path d="M28 62h104l-12 44H40z" fill="#FBF5E6" stroke="#2E6B5A" stroke-width="2.5" stroke-linejoin="round"/><path d="M44 74h72M48 88h64" stroke="#E3CFA3" stroke-width="2.5"/>`,
  freezer: `<rect x="34" y="26" width="92" height="80" rx="10" fill="#FFFFFF" stroke="#2E6B5A" stroke-width="2.5"/><path d="M34 54h92M34 80h92" stroke="#2E6B5A" stroke-width="2.5"/><path d="M74 40h12M74 66h12M74 92h12" stroke="#2E6B5A" stroke-width="3" stroke-linecap="round"/><g stroke="#7FA7C9" stroke-width="2.5" stroke-linecap="round"><path d="M116 8v24M105.6 14l20.8 12M105.6 26l20.8-12"/></g><ellipse cx="80" cy="112" rx="48" ry="4" fill="#2A2B29" opacity=".06"/>`,
  shelf: `<path d="M24 50h112M24 92h112" stroke="#2E6B5A" stroke-width="2.5" stroke-linecap="round"/><rect x="40" y="28" width="16" height="22" rx="3" fill="#FBF5E6" stroke="#9BB8AC" stroke-width="2"/><rect x="104" y="70" width="18" height="22" rx="3" fill="#DCEBE3" stroke="#9BB8AC" stroke-width="2"/><path d="M62 92a10 6 0 0 1 20 0" fill="#F5F1E6" stroke="#9BB8AC" stroke-width="2"/><g stroke="#9BB8AC" stroke-width="2" stroke-dasharray="3 5" fill="none"><rect x="70" y="26" width="22" height="24" rx="3"/></g>`,
  plate: `<ellipse cx="80" cy="76" rx="58" ry="22" fill="#FFFFFF" stroke="#D3D4D0" stroke-width="2.5"/><ellipse cx="80" cy="73" rx="38" ry="13" fill="#F5F1E6"/><circle cx="68" cy="68" r="7" fill="#E8833A"/><circle cx="92" cy="70" r="6" fill="#D9443A"/><ellipse cx="80" cy="64" rx="9" ry="5" fill="#FFFFFF"/><circle cx="80" cy="64" r="3" fill="#F4B400"/><path d="M74 76q6-9 13-3-6 7-13 3z" fill="#6DB36F"/><path d="M128 40l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z" fill="#F4B400"/><path d="M30 32l1.8 4.2 4.2 1.8-4.2 1.8-1.8 4.2-1.8-4.2-4.2-1.8 4.2-1.8z" fill="#9BB8AC"/>`,
  calendar: `<rect x="36" y="22" width="88" height="80" rx="10" fill="#FFFFFF" stroke="#2E6B5A" stroke-width="2.5"/><path d="M36 44h88M60 14v16M100 14v16" stroke="#2E6B5A" stroke-width="2.5" stroke-linecap="round"/><g fill="#DCEBE3"><rect x="48" y="54" width="16" height="12" rx="3"/><rect x="72" y="54" width="16" height="12" rx="3"/><rect x="48" y="74" width="16" height="12" rx="3"/></g><rect x="96" y="54" width="16" height="12" rx="3" fill="#E8833A"/><rect x="72" y="74" width="16" height="12" rx="3" fill="#6DB36F"/>`,
  scan: `<rect x="44" y="18" width="72" height="88" rx="12" fill="#FFFFFF" stroke="#2E6B5A" stroke-width="2.5"/><circle cx="80" cy="58" r="20" fill="#DCEBE3"/><circle cx="74" cy="54" r="6" fill="#D9443A"/><path d="M80 62l10-12" stroke="#E8833A" stroke-width="5" stroke-linecap="round"/><path d="M52 34v-8h8M108 34v-8h-8M52 82v8h8M108 82v8h-8" stroke="#2E6B5A" stroke-width="2.5" fill="none" stroke-linecap="round"/><path class="ill-scanline" d="M54 58h52" stroke="#2E6B5A" stroke-width="2" stroke-dasharray="4 4"/>`
};
const ill = (n, cls = "") => `<svg class="ill${cls ? " " + cls : ""}" viewBox="0 0 160 120" aria-hidden="true">${ILL[n] || ""}</svg>`;
function emptyState(art, title, text, actions = "") {
  return `<div class="empty-state">${ill(art)}<h3>${title}</h3><p>${text}</p>${actions ? `<div class="es-actions">${actions}</div>` : ""}</div>`;
}

/* =====================================================================
   RESCUE MY FOOD
   ===================================================================== */
/* Food-specific ways to save something before it spoils. Each option:
   [kind, title, how, extra]  kind: cook | freeze | preserve | stock | transform | bake | prep
   extra: { recipes:[ids], makes:{name,key,unit,days} } — "makes" adds what you made to the kitchen. */
const RESCUE = [
  [/banana/, [
    ["freeze", "Freeze for smoothies and baking", "Peel, slice and freeze on a tray, then bag. Best within about 3 months. Use straight from frozen in smoothies, or thaw for baking."],
    ["bake", "Banana pancakes", "Very ripe bananas are perfect here: they make pancakes sweeter and softer.", { recipes: ["banana-pancakes"] }],
    ["transform", "Blend a smoothie", "Ripe bananas make smoothies naturally sweet, so you won't need sugar.", { recipes: ["banana-smoothie", "fruit-yogurt-smoothie"] }]]],
  [/tomato/, [
    ["cook", "Cook them now", "Soft tomatoes are ideal for cooking: they break down into a rich sauce.", { recipes: ["tomato-egg", "shakshuka", "tuna-tomato-pasta"] }],
    ["preserve", "Make a quick tomato sauce", "Chop, then simmer with a little oil, garlic and salt for 20 minutes until thick. Cool, then refrigerate up to 4 days or freeze in portions up to 3 months.", { makes: { name: "Tomato sauce (homemade)", unit: "cup" } }],
    ["freeze", "Freeze whole for cooking", "Freeze whole in a bag. The skins slip off as they thaw. Use only in cooked dishes (they go soft). Best within 2 months."]]],
  [/spinach|kangkong|pechay|leafy|greens|malunggay|bok/, [
    ["cook", "Stir-fry with garlic", "Wilted greens are still great cooked. Remove any slimy or yellow leaves first.", { recipes: ["garlic-greens", "veg-frittata"] }],
    ["freeze", "Blanch and freeze", "Boil 1–2 minutes, plunge into ice water, squeeze dry and freeze in portions. Best within about 6 months. Add straight to soups and stews."],
    ["transform", "Into a soup or smoothie", "Stir into a soup at the end of cooking, or blend a handful into a smoothie.", { recipes: ["veg-soup", "green-smoothie", "tinola"] }]]],
  [/cabbage|carrot|broccoli|squash|sayote|eggplant|green_beans|bell_pepper|okra|corn|peas|celery|radish|ampalaya/, [
    ["cook", "Cook it now", "Vegetables that are a little soft are perfect for soups, stews and stir-fries.", { recipes: ["veg-soup", "pinakbet", "ginisang-repolyo", "coconut-veg-curry", "stir-fried-noodles"] }],
    ["freeze", "Blanch and freeze", "Cut into pieces, boil 2–3 minutes, cool in ice water, dry well and freeze flat. Best within about 8 months. Cook from frozen."],
    ["stock", "Make stock from the trimmings", "Simmer clean peels, ends and stalks (onion, carrot, celery, mushroom) in water for 45 minutes, strain. Fridge 3–4 days, or freeze. Skip cabbage and broccoli scraps: they make stock bitter.", { makes: { name: "Vegetable stock (homemade)", unit: "cup" } }]]],
  [/potato/, [
    ["cook", "Make a crispy hash", "Potatoes that are starting to sprout are fine once you cut off the sprouts and any green parts. Throw them out if they're shrivelled, soft or very green.", { recipes: ["potato-hash", "corned-beef-potatoes", "chicken-afritada"] }],
    ["prep", "Boil now, use later", "Boil until tender, cool quickly and refrigerate. Use within 2 days for hash, salads or mash. Don't freeze raw potatoes."]]],
  [/mango|papaya|pineapple|berries|watermelon|apple|orange|fruit|avocado/, [
    ["freeze", "Freeze in chunks", "Peel and cut into chunks, freeze on a tray, then bag. Best within about 6 months. Blend straight from frozen."],
    ["transform", "Blend a shake or smoothie", "Ripe fruit makes the best shakes.", { recipes: ["mango-shake", "fruit-yogurt-smoothie", "papaya-milk-shake", "watermelon-juice", "pineapple-juice", "avocado-shake"] }],
    ["preserve", "Cook a simple compote", "Simmer chopped fruit with a spoon of sugar and a splash of water for 10–15 minutes until soft. Cool and refrigerate up to 1 week. Great on pancakes or yogurt.", { makes: { name: "Fruit compote (homemade)", unit: "cup" } }]]],
  [/milk|cream/, [
    ["transform", "Use it in breakfast", "Milk is the base of pancakes, French toast and shakes.", { recipes: ["banana-pancakes", "french-toast", "mango-shake", "banana-smoothie"] }],
    ["freeze", "Freeze it", "Pour into a container, leaving room for it to expand. It separates a little when thawed, so use it for cooking, baking or smoothies. Thaw in the fridge; use within 3 months."]]],
  [/yogurt/, [
    ["transform", "Blend a smoothie", "Yogurt makes smoothies creamy and tangy.", { recipes: ["fruit-yogurt-smoothie", "banana-smoothie"] }],
    ["freeze", "Freeze in portions", "Freeze in ice-cube trays for smoothies. The texture changes, so it's best blended, not eaten plain."]]],
  [/cheese|mozzarella/, [
    ["cook", "Melt it into something", "Quesadillas, pasta and egg dishes all welcome extra cheese.", { recipes: ["quesadilla", "carbonara", "veg-frittata"] }],
    ["freeze", "Grate and freeze", "Grate, freeze in a bag and use straight from frozen in cooking. Best within 3–4 months. Throw out soft cheese with any mould."]]],
  [/bread|pandesal|tortilla/, [
    ["transform", "French toast", "Day-old bread is actually better for French toast: it soaks up the egg without falling apart.", { recipes: ["french-toast", "chicken-sandwich"] }],
    ["freeze", "Freeze it", "Slice first, then freeze in a bag and toast from frozen. Best within 3 months. Throw out bread with any mould."],
    ["preserve", "Make breadcrumbs", "Toast slices until dry, blitz or crush, and keep in an airtight jar for up to 2 weeks.", { makes: { name: "Breadcrumbs (homemade)", unit: "cup", dry: true } }]]],
  [/egg/, [
    ["cook", "Cook them now", "Eggs are the start of many quick meals.", { recipes: ["veg-frittata", "tomato-egg", "tortang-talong", "egg-fried-rice", "shakshuka"] }],
    ["freeze", "Freeze beaten eggs", "Never freeze eggs in the shell. Beat them with a pinch of salt, freeze in a container (note how many), and use within 6 months in cooked dishes."]]],
  [/rice_cooked|sinangag/, [
    ["cook", "Make fried rice today", "Day-old rice makes the best fried rice. Reheat until steaming hot, and only reheat it once.", { recipes: ["egg-fried-rice", "chicken-cabbage-fried-rice", "sinangag-itlog", "kimchi-fried-rice", "arroz-caldo"] }],
    ["prep", "Next time: freeze it straight away", "Rice keeps best when frozen as soon as it has cooled (within an hour of cooking). Rice that has already been in the fridge should be eaten within 24 hours rather than frozen."]]],
  [/chicken_cooked|fish_cooked|leftover|pasta_cooked|potato_cooked/, [
    ["transform", "Turn it into a new dish", "Leftovers make great fried rice, sandwiches, quesadillas and soups. Reheat to steaming hot (74°C / 165°F).", { recipes: ["chicken-cabbage-fried-rice", "chicken-sandwich", "quesadilla", "oyakodon", "arroz-caldo"] }],
    ["freeze", "Freeze it in portions", "Freeze in shallow containers before its fridge time is up. Best within 2–3 months. Thaw in the fridge and reheat until steaming hot."]]],
  [/chicken|pork|beef|ground|fish|shrimp|longganisa|tocino|bacon|meat/, [
    ["freeze", "Freeze it today", "Freeze raw meat and fish before the date runs out, in a flat bag with the date written on it. Thaw in the fridge, never on the counter."],
    ["cook", "Cook it now", "Cooking now gives you 3 more days in the fridge as a cooked dish (or months in the freezer).", { recipes: ["chicken-adobo", "chicken-afritada", "tinola", "pork-menudo", "bistek-tagalog", "sinigang-na-baboy"] }],
    ["prep", "Cook it for later meals", "Cook it plainly (boiled, roasted or pan-fried until cooked through), cool within 2 hours and refrigerate. Use within 3 days in fried rice, sandwiches or soups.", { makes: { name: "Cooked meat for later", key: "leftover", cooked: true, unit: "cup" } }]]],
  [/basil|cilantro|scallion|parsley|herb|lemongrass|ginger/, [
    ["preserve", "Freeze in oil", "Chop, pack into an ice-cube tray, cover with oil and freeze. Drop a cube into the pan when cooking. Best within 6 months."],
    ["prep", "Keep them fresher", "Trim the stems and stand them in a glass of water in the fridge, loosely covered, like flowers."]]]
];
function rescueOptions(p) {
  const k = (p.key || "") + " " + E.norm(p.name);
  for (const [re, opts] of RESCUE) if (re.test(k)) return opts;
  return [["cook", "Cook with it now", "Find recipes that build a meal around it.", {}],
    ["freeze", "Freeze it if it freezes well", "Most cooked dishes, breads, meats and chopped vegetables freeze well. Cream sauces, lettuce and cucumbers don't."]];
}
const RESCUE_KIND = { cook: ["flame", "Cook now"], freeze: ["snow", "Freeze"], preserve: ["jar", "Preserve"], stock: ["pot", "Make stock"], transform: ["spark", "Transform"], bake: ["oven", "Bake"], prep: ["knife", "Prepare"] };

function rescueList() {
  return S.pantry.map(p => ({ p, f: fr(p) })).filter(x => ["check", "first", "soon"].includes(x.f.group))
    .sort((a, b) => (E.GROUP_RANK[a.f.group] - E.GROUP_RANK[b.f.group]) || ((a.f.daysLeft ?? -99) - (b.f.daysLeft ?? -99)));
}
function renderRescue() {
  const list = rescueList();
  if (!list.length) {
    $("#rescueBody").innerHTML = emptyState("basket", "Nothing needs rescuing right now", "Everything in your kitchen has a little time left. Come back here when food is close to its date.",
      `<button class="btn primary" data-act="tab" data-tab="cook">${icon("pot")}Find something to cook</button><button class="btn" data-act="tab" data-tab="kitchen">${icon("fridge")}Open my kitchen</button>`);
    return;
  }
  if (!S.ui.rescueId || !list.some(x => x.p.id === S.ui.rescueId)) S.ui.rescueId = list[0].p.id;
  const sel = list.find(x => x.p.id === S.ui.rescueId);
  $("#rescueBody").innerHTML = `<div class="rescue-layout">
    <div class="rescue-list" role="list" aria-label="Food that needs attention">${list.map(({ p, f }) => `<button role="listitem" class="rs-item${p.id === sel.p.id ? " on" : ""}" data-act="rs-pick" data-id="${p.id}" aria-pressed="${p.id === sel.p.id}">
      ${foodArt(p)}<span class="rs-txt"><b>${esc(p.name)}</b><small>${esc(amountLabel(p))} · ${esc(E.LOCS[p.loc])}</small></span>${freshBadge(f)}</button>`).join("")}</div>
    <div class="rescue-panel" id="rescuePanel" aria-live="polite">${rescuePanel(sel.p, sel.f)}</div></div>`;
}
function rescuePanel(p, f) {
  const head = `<div class="rp-head">${foodArt(p, "lg")}<div><h2>${esc(p.name)}</h2><p>${freshBadge(f)} <span class="muted">${esc(f.note)}</span></p></div></div>`;
  // Unsafe or unknown history: never suggest tasting or "checking" it.
  if (f.group === "check") {
    const cookedNoDate = (p.cooked || (E.ING[p.key] || {}).isCooked) && !p.cookedOn && !p.unknownAge && p.loc !== "freezer";
    return head + `<div class="rs-danger">${icon("stop")}<div><b>${cookedNoDate ? "When was this cooked?" : "This shouldn't be eaten"}</b>
      <p>${cookedNoDate ? "Without the cooking date there's no way to know if it's still safe. If you know the day, add it. If you're not sure, it's safest to throw it out." : "It's past the safe storage time, or its history is unknown. Smell, taste and looks can't tell you if food is safe, so don't taste it to check."}</p>
      <div class="es-actions">${cookedNoDate ? `<button class="btn" data-act="item-edit" data-id="${p.id}">Add the cooking date</button>` : ""}<button class="btn danger" data-act="rs-toss" data-id="${p.id}">${icon("trash")}Throw it out</button></div></div></div>
      <p class="small muted">Next time: cool leftovers within 2 hours, label them with the date, and freeze what you won't eat within 3 days.</p>`;
  }
  const opts = rescueOptions(p).filter(o => !(o[0] === "freeze" && p.loc === "freezer"));
  const canMake = id => { const r = getRecipe(id); return r && match(r).ok ? r : null; };
  return head + `<p class="rs-lead">Here's how to use it before it spoils. Pick whatever suits you:</p><div class="rs-options">${opts.map(([kind, title, how, extra = {}], i) => {
    const [ic, label] = RESCUE_KIND[kind];
    const recs = (extra.recipes || []).map(canMake).filter(Boolean).slice(0, 3);
    let act = "";
    if (kind === "freeze") act = `<button class="btn primary small" data-act="rs-freeze" data-id="${p.id}">${icon("snow")}I froze it</button>`;
    else if (extra.makes) act = `<button class="btn primary small" data-act="rs-made" data-id="${p.id}" data-i="${i}">${icon("check")}I made it</button>`;
    if (kind === "cook" || kind === "transform" || kind === "bake") act += `<button class="btn small" data-act="rs-cookwith" data-id="${p.id}">${icon("pot")}Recipes with ${esc(p.name.toLowerCase())}</button>`;
    return `<article class="rs-opt" style="--i:${i}"><div class="rs-kind">${icon(ic)}<span>${label}</span></div><h3>${esc(title)}</h3><p>${esc(how)}</p>
      ${recs.length ? `<div class="rs-recs">${recs.map(r => `<button class="rs-rec" data-act="open-recipe" data-id="${esc(r.id)}"><canvas data-pthumb="${esc(r.id)}" width="96" height="96"></canvas><span>${esc(r.title)}</span></button>`).join("")}</div>` : ""}
      ${act ? `<div class="es-actions">${act}</div>` : ""}</article>`;
  }).join("")}</div>`;
}
function afterRescuePaint() { document.querySelectorAll("#rescueBody canvas[data-pthumb]").forEach(cv => paint(cv, getRecipe(cv.dataset.pthumb))); }
function rescueAct(act, t) {
  const p = S.pantry.find(x => x.id === t.dataset.id);
  switch (act) {
    case "rs-pick": S.ui.rescueId = t.dataset.id; renderRescue(); afterRescuePaint(); if (innerWidth < 820) $("#rescuePanel").scrollIntoView({ behavior: "smooth", block: "start" }); return true;
    case "rs-toss": if (!p) return true; S.pantry = S.pantry.filter(x => x !== p); persist(); toast(`${p.name} removed from your kitchen.`); renderRescue(); afterRescuePaint(); renderNavCounts(); return true;
    case "rs-freeze": if (!p) return true;
      { const i = S.pantry.indexOf(p); S.pantry[i] = E.newItem({ ...p, loc: "freezer", thawedOn: null }); }
      persist(); toast(`${p.name} moved to the freezer. Write today's date on it.`); renderRescue(); afterRescuePaint(); sparkle("#rescuePanel .rp-head", 6); return true;
    case "rs-made": if (!p) return true; {
      const opt = rescueOptions(p)[+t.dataset.i]; const mk = opt && opt[3] && opt[3].makes; if (!mk) return true;
      openModal(`<h2 id="authTitle">${esc(opt[1])}: done!</h2><p>I'll take ${esc(p.name.toLowerCase())} out of your kitchen and add what you made, dated today.</p>
        <form id="rsMadeForm" data-id="${p.id}" data-i="${t.dataset.i}"><label>How much did you make?<span class="row2"><input type="number" id="rsMadeQty" min="0" step="any" value="2"><span class="unit">${esc(mk.unit)}s</span></span></label>
        <div class="form-actions"><button class="btn primary" type="submit">Update my kitchen</button><button class="linkbtn" type="button" data-act="auth-close">Cancel</button></div></form>`, "#rsMadeQty");
      return true; }
    case "rs-cookwith": if (!p) return true; S.ui.mode = "one"; S.ui.oneId = p.id; S.ui.focus = []; S.ui.currentId = null; S.prefs.kind = "both"; setTab("cook"); return true;
  }
  return false;
}
function submitRsMade(form) {
  const p = S.pantry.find(x => x.id === form.dataset.id); if (!p) { closeAuth(); return; }
  const mk = rescueOptions(p)[+form.dataset.i][3].makes, qty = Number($("#rsMadeQty").value) || null;
  S.pantry = S.pantry.filter(x => x !== p);
  const today = E.todayISO();
  E.addToPantry(S.pantry, [{ name: mk.name, key: mk.key || (mk.dry ? null : "leftover"), qty, unit: mk.unit, loc: mk.dry ? "pantry" : "fridge", cooked: !mk.dry, cookedOn: mk.dry ? null : today, added: today }]);
  persist(); closeAuth(); sparkle("#rescueBody", 8); toast(`Rescued! ${mk.name} is in your ${mk.dry ? "cupboard" : "fridge"}, dated today.`); renderRescue(); afterRescuePaint(); renderNavCounts();
}

/* =====================================================================
   MEAL PLANNER (+ shopping list for what's genuinely missing)
   ===================================================================== */
const SLOTS = [["b", "Breakfast"], ["l", "Lunch"], ["d", "Dinner"], ["s", "Snack"]];
const BREAKFASTY = /pancake|french-toast|sinangag|potato-hash|smoothie|shake|juice|frittata|shakshuka|arroz-caldo|tomato-egg|oyakodon|tortang/;
const SNACKY = /shake|smoothie|juice|cooler|quesadilla|coleslaw|sandwich|pancake|okonomiyaki|french-toast/;
function slotFits(r, k) {
  if (k === "b") return BREAKFASTY.test(r.id) || r.meal === "breakfast" || r.kind === "drink";
  if (k === "s") return SNACKY.test(r.id) || r.meal === "snack" || r.meal === "dessert" || r.kind === "drink";
  return r.kind !== "drink" && !["breakfast", "dessert"].includes(r.meal) && r.id !== "banana-cue";
}
function planDays() { const n = S.ui.planRange === "day" ? 1 : 7, t = E.todayISO(); return Array.from({ length: n }, (_, i) => E.addDays(S.ui.planStart || t, i)); }
function planDay(iso) { S.plan = S.plan || { days: {} }; return S.plan.days[iso] || (S.plan.days[iso] = { b: [], l: [], d: [], s: [] }); }
function cleanPlan() { // drop past days and empty ones
  if (!S.plan) S.plan = { days: {} };
  const t = E.todayISO();
  for (const d of Object.keys(S.plan.days)) { const v = S.plan.days[d]; if (d < t || SLOTS.every(([k]) => !(v[k] || []).length)) delete S.plan.days[d]; }
}
/* Walk the plan in date order and give each meal its own share of the kitchen,
   so two meals never count on the same eggs. Returns status per entry + a shopping list. */
function simulatePlan() {
  let virt = JSON.parse(JSON.stringify(S.pantry));
  const status = {}, shop = new Map();
  const days = Object.keys((S.plan || {}).days || {}).sort();
  for (const d of days) for (const [k] of SLOTS) for (const e of (S.plan.days[d][k] || [])) {
    const r = getRecipe(e.rid);
    if (!r) { status[e.id] = { state: "gone" }; continue; }
    if (e.done) { status[e.id] = { state: "done" }; continue; }
    const m = E.matchRecipe(r, virt, S.staples, opts({ servings: e.sv }));
    if (m.ok) {
      const rows = E.planDeductions(m);
      virt = E.applyDeductions(virt, rows).pantry;
      status[e.id] = { state: "ready", urgent: m.urgentUsed.map(p => p.name), unconfirmed: m.unconfirmed.length };
    } else {
      const need = shortfall(r, e.sv, virt);
      need.forEach(n => { const cur = shop.get(n.key) || { ...n, g: 0, meals: [] }; cur.g += n.g; cur.meals.push(r.title); shop.set(n.key, cur); });
      status[e.id] = { state: "missing", need };
      // assume the cook buys what's missing: take what is there so later meals don't count on it
      const rows = E.planDeductions({ ...m, lines: m.lines.filter(l => l.src === "pantry" && l.enough !== false) });
      virt = E.applyDeductions(virt, rows).pantry;
    }
  }
  return { status, shop: [...shop.values()], left: virt };
}
/* Exactly how much of each essential is missing for this recipe at this size. */
function shortfall(r, sv, pantry) {
  const f = sv / r.serves, usable = E.usableItems(pantry), out = [];
  for (const ing of r.ingredients) {
    if (ing.opt || ing.optional) continue;
    if (ing.any) {
      const keys = ing.any, needG = E.toGrams(ing.k, ing.q * f, ing.u) || 0;
      const have = usable.filter(x => keys.includes(x.key)).reduce((s, x) => s + (E.toGrams(x.key, x.qty, x.unit) || 0), 0);
      if (have < needG * (ing.tol || 1) - 1e-6) out.push({ key: "any:" + (ing.label || ing.k), name: ing.label || "Vegetables (any mix)", g: needG - have, unitKey: ing.k, unit: ing.u });
      continue;
    }
    const k = ing.k; if (!k || S.staples.includes(k)) continue;
    const needG = E.toGrams(k, ing.q * f, ing.u); if (needG == null) continue;
    const have = usable.filter(x => x.key === k).reduce((s, x) => s + (E.toGrams(k, x.qty, x.unit) || 0), 0);
    const subOk = (ing.subs || []).some(sb => usable.some(x => x.key === (sb.k || sb)));
    if (have < needG * (ing.tol || 1) - 1e-6 && !subOk) out.push({ key: k, name: E.ingName(k), g: needG - have, unitKey: k, unit: ing.u });
  }
  return out;
}
function shopAmount(n) {
  const u = (E.ING[n.unitKey] || {}).u || n.unit || "g";
  let q = E.fromGrams(n.unitKey, n.g, u);
  if (q == null || !isFinite(q)) return E.fmtAmount(Math.ceil(n.g), "g");
  q = ["pcs", "clove", "can", "pack", "bunch", "stalk"].includes(u) ? Math.ceil(q - 1e-6) : Math.ceil(q * 4) / 4;
  return E.fmtAmount(q, u);
}
function renderPlan() {
  cleanPlan();
  S.ui.planStart = S.ui.planStart && S.ui.planStart >= E.todayISO() ? S.ui.planStart : E.todayISO();
  const days = planDays(), sim = simulatePlan();
  const planned = days.reduce((n, d) => n + SLOTS.reduce((m, [k]) => m + ((S.plan.days[d] || {})[k] || []).length, 0), 0);
  const urgentLeft = rescueList().filter(x => x.f.group !== "check" && !Object.values(sim.status).some(s => (s.urgent || []).includes(x.p.name)));
  $("#planTools").innerHTML = `<div class="seg" role="group" aria-label="Plan length"><button data-act="pl-range" data-v="day" aria-pressed="${S.ui.planRange === "day"}">Today</button><button data-act="pl-range" data-v="week" aria-pressed="${S.ui.planRange !== "day"}">7 days</button></div>
    <button class="btn" data-act="pl-auto">${icon("spark")}Suggest meals</button>
    <button class="btn" data-act="pl-shop">${icon("cart")}Shopping list${sim.shop.length ? ` <span class="count-pill">${sim.shop.length}</span>` : ""}</button>
    ${planned ? `<button class="linkbtn" data-act="pl-clear">Clear plan</button>` : ""}`;
  $("#planSide").innerHTML = `<div class="card plan-side"><span class="label">Kitchen check</span>
    <h3>${planned ? `${Object.values(sim.status).filter(s => s.state === "ready").length} of ${Object.values(sim.status).filter(s => s.state !== "gone").length} planned meals ready` : "No meals planned yet"}</h3>
    <p class="small muted">${planned ? "Each meal gets its own share of your food, in date order, so two meals never count on the same ingredients." : "Tap “Suggest meals” and I'll fill lunches and dinners from what you have, using what needs using first."}</p>
    ${urgentLeft.length ? `<span class="label" style="margin-top:12px">Needs using, not planned yet</span><ul class="mini">${urgentLeft.slice(0, 6).map(x => `<li>${foodArt(x.p, "sm")}<span>${esc(x.p.name)}</span>${freshBadge(x.f)}</li>`).join("")}</ul>` : ""}</div>`;
  $("#planDays").innerHTML = days.map(d => {
    const day = S.plan.days[d] || {};
    const isToday = d === E.todayISO();
    return `<section class="plan-day${isToday ? " today" : ""}"><div class="pd-head"><h2>${isToday ? "Today" : esc(new Date(E.parseISO(d)).toLocaleDateString(undefined, { weekday: "long" }))}</h2><span class="muted small">${esc(E.prettyDate(d))}</span></div>
      ${SLOTS.map(([k, label]) => `<div class="slot"><span class="slot-name">${label}</span><div class="slot-items">${(day[k] || []).map(e => planEntry(d, k, e, sim.status[e.id] || {})).join("")}
        <button class="slot-add" data-act="pl-add" data-d="${d}" data-k="${k}" aria-label="Add ${label.toLowerCase()} on ${esc(E.prettyDate(d))}">${icon("plus")}<span>Add</span></button></div></div>`).join("")}</section>`;
  }).join("");
  document.querySelectorAll("#planDays canvas[data-pthumb]").forEach(cv => paint(cv, getRecipe(cv.dataset.pthumb)));
}
function planEntry(d, k, e, st) {
  const r = getRecipe(e.rid); if (!r) return "";
  const chip = st.state === "done" ? `<span class="pchip ok">${icon("check")}Cooked</span>`
    : st.state === "ready" ? `<span class="pchip ok">${icon("check")}Ready${st.unconfirmed ? " · check amounts" : ""}</span>`
    : st.state === "missing" ? `<span class="pchip warn">${icon("cart")}Needs ${esc(st.need.map(n => n.name.toLowerCase()).slice(0, 2).join(", "))}${st.need.length > 2 ? "…" : ""}</span>` : "";
  return `<div class="pentry${e.done ? " done" : ""}"><button class="pe-open" data-act="pl-open" data-d="${d}" data-k="${k}" data-id="${e.id}"><canvas data-pthumb="${esc(r.id)}" width="96" height="96"></canvas><span class="pe-t"><b>${esc(r.title)}</b>${chip}${(st.urgent || []).length ? `<small class="urg">Uses up ${esc(st.urgent.join(", "))}</small>` : ""}</span></button>
    <div class="pe-ctl"><div class="stepper sm" role="group" aria-label="Servings"><button data-act="pl-sv" data-d="${d}" data-k="${k}" data-id="${e.id}" data-v="-1" aria-label="Fewer servings">${icon("minus")}</button><span>${e.sv}</span><button data-act="pl-sv" data-d="${d}" data-k="${k}" data-id="${e.id}" data-v="1" aria-label="More servings">${icon("plus")}</button></div>
    <button class="iconbtn" data-act="pl-del" data-d="${d}" data-k="${k}" data-id="${e.id}" aria-label="Remove ${esc(r.title)}">${icon("close")}</button></div></div>`;
}
function openPlanPicker(d, k) {
  S.ui.pick = { d, k, q: "" };
  const sim = simulatePlan();
  const lib = LIB.filter(r => slotFits(r, k));
  const rows = lib.map(r => { const m = E.matchRecipe(r, sim.left, S.staples, opts({})); return { r, ok: m.ok, urgent: m.ok ? m.urgentUsed.length : 0 }; })
    .sort((a, b) => (b.ok - a.ok) || (b.urgent - a.urgent) || a.r.title.localeCompare(b.r.title));
  openModal(`<h2 id="authTitle">Add ${SLOTS.find(s => s[0] === k)[1].toLowerCase()} · ${esc(E.prettyDate(d))}</h2>
    <label class="sr" for="pickQ">Search recipes</label><input type="search" id="pickQ" placeholder="Search recipes" autocomplete="off">
    <div class="picker" id="pickList">${rows.map(({ r, ok, urgent }) => `<button class="pick-row" data-act="pl-choose" data-id="${esc(r.id)}" data-t="${esc(E.norm(r.title + " " + r.cuisine))}">
      <canvas data-pthumb="${esc(r.id)}" width="80" height="80"></canvas><span><b>${esc(r.title)}</b><small>${esc(r.cuisine)} · ${r.prep + r.cook} min</small></span>
      ${ok ? `<span class="pchip ok">${icon("check")}${urgent ? "Uses food that needs using" : "You have it all"}</span>` : `<span class="pchip warn">${icon("cart")}Needs shopping</span>`}</button>`).join("")}</div>
    <div class="form-actions"><button class="linkbtn" type="button" data-act="auth-close">Close</button></div>`, "#pickQ");
  document.querySelectorAll("#pickList canvas[data-pthumb]").forEach(cv => paint(cv, getRecipe(cv.dataset.pthumb)));
}
function autoPlan() {
  cleanPlan();
  const days = planDays(); let added = 0;
  for (const d of days) for (const k of ["l", "d"]) {
    const day = planDay(d); if ((day[k] || []).length) continue;
    const sim = simulatePlan();
    const used = new Set(Object.values(S.plan.days).flatMap(v => SLOTS.flatMap(([s]) => (v[s] || []).map(e => e.rid))));
    const cands = LIB.filter(r => slotFits(r, k) && r.meal !== "snack" && !used.has(r.id) && !(S.feedback && S.feedback[r.id] && S.feedback[r.id].kind === "bad"))
      .map(r => ({ r, m: E.matchRecipe(r, sim.left, S.staples, opts({ servings: S.prefs.servings || r.serves })) })).filter(x => x.m.ok)
      .sort((a, b) => (b.m.urgentUsed.length - a.m.urgentUsed.length) || ((b.r.q || 3) - (a.r.q || 3)) || (b.m.usedCount - a.m.usedCount));
    if (!cands.length) continue;
    day[k].push({ id: uid(), rid: cands[0].r.id, sv: cands[0].m.servings }); added++;
  }
  persist(); renderPlan();
  if (added) requestAnimationFrame(() => document.querySelectorAll(".pentry").forEach((el, i) => i < 6 && setTimeout(() => sparkle(el, 3), i * 110)));
  toast(added ? `Planned ${added} meal${added > 1 ? "s" : ""} from what you have, using what needs using first.` : "I couldn't fit more meals from what's in your kitchen. Add food, or pick recipes yourself (I'll list what's missing).");
}
function openShopList() {
  const sim = simulatePlan();
  if (!sim.shop.length) { openModal(`${ill("basket")}<h2 id="authTitle">Nothing to buy</h2><p>Every planned meal can be made from what's already in your kitchen.</p><div class="form-actions"><button class="btn primary" data-act="auth-close">Great</button></div>`); return; }
  const text = sim.shop.map(n => `${n.name}: ${shopAmount(n)}`).join("\n");
  openModal(`<h2 id="authTitle">Shopping list</h2><p>Only what's genuinely missing for your planned meals, after counting what you already have.</p>
    <ul class="shop">${sim.shop.map((n, i) => `<li><label><input type="checkbox" id="shop${i}"> <b>${esc(n.name)}</b> <span class="amt">${esc(shopAmount(n))}</span></label><small class="muted">For ${esc([...new Set(n.meals)].join(", "))}</small></li>`).join("")}</ul>
    <div class="form-actions"><button class="btn primary" data-act="pl-copy" data-text="${esc(text)}">${icon("copy")}Copy list</button><button class="linkbtn" data-act="auth-close">Close</button></div>`);
}
function planAct(act, t) {
  const day = t.dataset.d && planDay(t.dataset.d), list = day && t.dataset.k ? day[t.dataset.k] : null;
  switch (act) {
    case "pl-range": S.ui.planRange = t.dataset.v; renderPlan(); return true;
    case "pl-add": openPlanPicker(t.dataset.d, t.dataset.k); return true;
    case "pl-choose": { const { d, k } = S.ui.pick || {}; const r = getRecipe(t.dataset.id); if (!d || !r) return true;
      planDay(d)[k].push({ id: uid(), rid: r.id, sv: S.prefs.servings || r.serves }); persist(); closeAuth(); renderPlan(); toast(`${r.title} planned for ${E.prettyDate(d)}.`); requestAnimationFrame(() => sparkle([...document.querySelectorAll(`.pe-open[data-d="${d}"][data-k="${k}"]`)].pop(), 5)); return true; }
    case "pl-del": if (list) { day[t.dataset.k] = list.filter(e => e.id !== t.dataset.id); persist(); renderPlan(); } return true;
    case "pl-sv": if (list) { const e = list.find(x => x.id === t.dataset.id); if (e) { e.sv = Math.max(1, Math.min(20, e.sv + Number(t.dataset.v))); persist(); renderPlan(); } } return true;
    case "pl-open": { const e = list && list.find(x => x.id === t.dataset.id); if (!e) return true; S.ui.currentId = e.rid; S.ui.planEntry = { d: t.dataset.d, k: t.dataset.k, id: e.id }; S.ui.servingsOverride[e.rid] = e.sv; S.ui.mode = "urgent"; S.ui.focus = [];
      const r = getRecipe(e.rid); if (r) S.prefs.kind = r.kind === "drink" ? "drinks" : "meals"; setTab("cook"); return true; }
    case "pl-auto": autoPlan(); return true;
    case "pl-shop": openShopList(); return true;
    case "pl-clear": openModal(`<h2 id="authTitle">Clear the plan?</h2><p>This removes every planned meal. Your kitchen isn't changed.</p><div class="form-actions"><button class="btn danger" data-act="pl-clear-yes">Clear plan</button><button class="linkbtn" data-act="auth-close">Cancel</button></div>`); return true;
    case "pl-clear-yes": S.plan = { days: {} }; persist(); closeAuth(); renderPlan(); return true;
    case "pl-copy": navigator.clipboard && navigator.clipboard.writeText(t.dataset.text).then(() => toast("Shopping list copied."), () => toast("Couldn't copy. Select the list and copy it instead.")); return true;
  }
  return false;
}
/* When a planned meal is cooked, tick it off */
function markPlanCooked(rid) {
  const t = E.todayISO(); const day = S.plan && S.plan.days[t]; if (!day) return;
  const pe = S.ui.planEntry;
  for (const [k] of SLOTS) for (const e of day[k] || []) if (!e.done && e.rid === rid && (!pe || pe.id === e.id)) { e.done = true; S.ui.planEntry = null; return; }
}
function upcomingMeals(n = 3) {
  cleanPlan(); const out = [];
  for (const d of Object.keys(S.plan.days).sort()) for (const [k, label] of SLOTS) for (const e of S.plan.days[d][k] || []) if (!e.done && getRecipe(e.rid)) out.push({ d, k, label, e, r: getRecipe(e.rid) });
  return out.slice(0, n);
}

/* =====================================================================
   GUIDED COOKING
   ===================================================================== */
let wakeLock = null, gcTimer = null;
function startCooking(resume) {
  const r = getRecipe(resume ? S.cooking.rid : S.ui.currentId); if (!r) { S.cooking = null; persist(); return; }
  const m = match(r);
  if (!resume) S.cooking = { rid: r.id, step: 0, sv: m.servings, at: Date.now() };
  S.ui.currentId = r.id;
  persist();
  $("#gc").hidden = false; document.body.classList.add("gc-open");
  try { if (navigator.wakeLock) navigator.wakeLock.request("screen").then(l => { wakeLock = l; }, () => {}); } catch (e) {}
  renderCooking("none");
  $("#gc .gc-next").focus();
}
function cookingLines(r, m) {
  return m.lines.filter(l => !l.skipped).map(l => ({ name: (l.sub ? l.name : (l.ing.any ? (l.items.map(x => x.p.name).join(" + ") || l.ing.label) : l.name)), amt: l.ing.q == null ? (l.ing.amountText || "") : niceAmount(l.q, l.unit || l.ing.u, l.ing.k), note: l.ing.note || "" }));
}
const STEP_WARN = [
  [/raw (chicken|pork|beef|meat|fish)|chicken|pork|ground|shrimp|fish/i, /cook|simmer|fry|brown|boil|until/i, "Cook meat and seafood through: chicken 74°C (165°F), ground meat 71°C (160°F), fish 63°C (145°F). Wash hands and boards after touching raw meat."],
  [/hot oil|deep|smoking|sizzl|fry/i, null, "Hot oil spits: lower food in gently, away from you, and keep a lid nearby. Never put water on an oil fire."],
  [/blend/i, /hot|soup/i, "Blending hot liquids: fill the blender only halfway and hold the lid with a folded towel."],
  [/egg/i, /runny|soft|raw/i, "Runny eggs aren't recommended for young children, pregnant people, older adults or anyone with weak immunity."]
];
function stepWarnings(s) { return STEP_WARN.filter(([a, b]) => a.test(s) && (!b || b.test(s))).map(w => w[2]); }
function stepMinutes(s) {
  const m = s.match(/(\d+(?:\.\d+)?)\s*(?:(?:to|-|–)\s*(\d+(?:\.\d+)?)\s*)?(minutes?|mins?|hours?|hrs?)\b/i);
  if (!m) return null; const lo = parseFloat(m[1]), hi = m[2] ? parseFloat(m[2]) : lo; const mult = /^h/i.test(m[3]) ? 60 : 1;
  return { min: Math.round(lo * mult), max: Math.round(hi * mult), text: m[0] };
}
function renderCooking(dir) {
  const r = getRecipe(S.cooking.rid); if (!r) return;
  const m = match(r, { servings: S.cooking.sv }), n = r.steps.length, i = Math.min(S.cooking.step, n - 1);
  const s = r.steps[i], lines = cookingLines(r, m);
  const words = E.norm(s);
  const here = lines.filter(l => { const nm = E.norm(l.name).split(" ").filter(w => w.length > 3); return nm.some(w => words.includes(w.replace(/s$/, ""))); });
  const t = stepMinutes(s), warns = stepWarnings(s);
  $("#gcTitle").textContent = r.title;
  $("#gcProg").innerHTML = `<div class="gc-bar"><i style="width:${((i + 1) / n) * 100}%"></i></div><span>Step ${i + 1} of ${n}</span>`;
  $("#gcBody").innerHTML = `<div class="gc-step ${dir === "back" ? "from-left" : dir === "none" ? "" : "from-right"}" aria-live="polite">
      <span class="gc-num">${i + 1}</span><p class="gc-text">${esc(s)}</p>
      ${stepNotes(s, m).map(n => `<div class="gc-note ${n.kind}">${icon(n.kind === "skip" ? "minus" : "spark")}<span>${esc(n.text)}</span></div>`).join("")}
      ${here.length ? `<ul class="gc-ings">${here.map(l => `<li><b>${esc(l.amt)}</b> ${esc(l.name)}${l.note ? ` <small>${esc(l.note)}</small>` : ""}</li>`).join("")}</ul>` : ""}
      ${warns.map(w => `<div class="gc-warn">${icon("alert")}<span>${esc(w)}</span></div>`).join("")}
      ${t ? `<div class="gc-timer" id="gcTimer" data-sec="${t.min * 60}"><div class="ring" style="--p:0">${icon("timer")}<b id="gcTime">${fmtClock(t.min * 60)}</b></div>
        <div><span class="small muted">${t.min !== t.max ? `Recipe says ${esc(t.text)}: timer set to ${t.min} min, then check.` : `Timer for ${t.min} min`}</span>
        <div class="es-actions"><button class="btn primary small" data-act="gc-timer">${icon("play")}Start timer</button><button class="btn small" data-act="gc-timer-reset">${icon("reset")}Reset</button></div></div></div>` : ""}
    </div>`;
  $("#gcIngs").innerHTML = `<h3>Ingredients <span class="muted small">for ${m.servings}</span></h3><ul>${lines.map(l => `<li><b>${esc(l.amt)}</b> ${esc(l.name)}</li>`).join("")}</ul>`;
  $("#gc .gc-prev").disabled = i === 0;
  $("#gc .gc-next").innerHTML = i === n - 1 ? `${icon("check")}Finish` : `Next step${icon("right")}`;
  if (gcTimer && gcTimer.step !== i) stopTimer();
}
const fmtClock = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
function stopTimer() { if (gcTimer) clearInterval(gcTimer.iv); gcTimer = null; }
function toggleTimer() {
  const box = $("#gcTimer"); if (!box) return;
  const btn = box.querySelector('[data-act="gc-timer"]');
  if (gcTimer && gcTimer.running) { gcTimer.running = false; clearInterval(gcTimer.iv); btn.innerHTML = `${icon("play")}Resume`; box.classList.remove("running"); return; }
  const total = +box.dataset.sec;
  if (!gcTimer) gcTimer = { step: S.cooking.step, left: total, total };
  gcTimer.running = true; box.classList.add("running"); btn.innerHTML = `${icon("pause")}Pause`;
  const end = Date.now() + gcTimer.left * 1000;
  gcTimer.iv = setInterval(() => {
    gcTimer.left = Math.max(0, Math.round((end - Date.now()) / 1000));
    const el = $("#gcTime"); if (!el) { stopTimer(); return; }
    el.textContent = fmtClock(gcTimer.left); box.querySelector(".ring").style.setProperty("--p", 1 - gcTimer.left / gcTimer.total);
    if (gcTimer.left <= 0) { clearInterval(gcTimer.iv); gcTimer.running = false; box.classList.remove("running"); box.classList.add("done"); btn.innerHTML = `${icon("check")}Time's up`; sparkle(box, 7); ding(); toast("Timer done: check your food."); }
  }, 250);
}
function ding() {
  try { const a = new (window.AudioContext || window.webkitAudioContext)(); [0, .25, .5].forEach(t => { const o = a.createOscillator(), g = a.createGain(); o.frequency.value = 880; o.connect(g); g.connect(a.destination); g.gain.setValueAtTime(.18, a.currentTime + t); g.gain.exponentialRampToValueAtTime(.001, a.currentTime + t + .22); o.start(a.currentTime + t); o.stop(a.currentTime + t + .24); }); } catch (e) {}
  try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) {}
}
function closeCooking(keep = true) {
  stopTimer(); $("#gc").hidden = true; document.body.classList.remove("gc-open");
  try { wakeLock && wakeLock.release(); } catch (e) {} wakeLock = null;
  if (!keep) { S.cooking = null; persist(); }
  if (S.tab === "home") renderHome();
}
function cookAct(act) {
  if (!S.cooking && act !== "gc-start" && act !== "gc-resume") return false;
  const r = S.cooking && getRecipe(S.cooking.rid);
  switch (act) {
    case "gc-start": startCooking(false); return true;
    case "gc-resume": if (S.cooking) { if (S.tab !== "cook") { S.ui.currentId = S.cooking.rid; setTab("cook"); } startCooking(true); } return true;
    case "gc-next": if (!r) return true;
      if (S.cooking.step >= r.steps.length - 1) { closeCooking(false); S.ui.currentId = r.id; if (S.tab !== "cook") setTab("cook"); openCooked(); return true; }
      S.cooking.step++; persist(); renderCooking("next"); return true;
    case "gc-prev": if (S.cooking.step > 0) { S.cooking.step--; persist(); renderCooking("back"); } return true;
    case "gc-close": closeCooking(true); toast("Paused. Pick up where you left off from the home page."); return true;
    case "gc-quit": closeCooking(false); return true;
    case "gc-timer": toggleTimer(); return true;
    case "gc-timer-reset": stopTimer(); renderCooking("none"); return true;
  }
  return false;
}
document.addEventListener("keydown", e => {
  if ($("#gc") && !$("#gc").hidden && !e.target.closest("input,textarea,select")) {
    if (e.key === "ArrowRight") { e.preventDefault(); cookAct("gc-next"); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); cookAct("gc-prev"); }
    else if (e.key === "Escape") { e.preventDefault(); cookAct("gc-close"); }
  }
});

/* =====================================================================
   PHOTO & RECEIPT SCANNING (uses the free AI; you confirm everything)
   ===================================================================== */
const VISION_MODELS = ["google/gemini-3.5-flash", "gemini-3-flash-preview", "gpt-6-luna"];
function scanAvailable() { return AI.ready && AI.mode === "puter"; }
function openScan(kind) {
  if (!scanAvailable()) {
    openModal(`${ill("scan")}<h2 id="authTitle">Scanning needs the free AI</h2><p>Recognising food in photos and receipts uses AI, which isn't available right now${navigator.onLine ? "" : " (you're offline)"}. You can still type everything at once, like “3 eggs, half a cabbage, leftover rice”.</p>
      <div class="form-actions"><button class="btn primary" data-act="auth-close">OK</button></div>`); return;
  }
  if (!S.puterConnected) { openPuterConnect(() => openScan(kind)); return; }
  const inp = $("#scanFile"); inp.dataset.kind = kind; inp.value = ""; inp.click();
}
async function runScan(file, kind) {
  if (!file) return;
  if (!/^image\//.test(file.type)) { toast("Please choose a photo (JPG or PNG)."); return; }
  if (file.size > 12e6) { toast("That photo is very large. Try one under 12 MB."); return; }
  let cancelled = false; S.ui.scanCancel = () => { cancelled = true; };
  openModal(`<div class="scan-wait">${ill("scan", "scanning")}<h2 id="authTitle">${kind === "receipt" ? "Reading your receipt…" : "Looking at your photo…"}</h2><p class="muted">This usually takes 5–20 seconds. Nothing is added until you check it.</p></div>
    <div class="form-actions"><button class="linkbtn" data-act="scan-cancel">Cancel</button></div>`);
  const prompt = kind === "receipt"
    ? `This is a photo of a grocery receipt. List only the FOOD and DRINK items bought (skip bags, cleaning products, toiletries, discounts, totals). Expand abbreviations into plain food names. Use the quantity bought when shown (for weighed items use the weight). Also give the purchase date if printed (YYYY-MM-DD).
JSON only: {"date":"YYYY-MM-DD or empty","items":[{"name":"plain food name","qty":number or null,"unit":"pcs|g|kg|ml|l|pack|can|bunch or empty","where":"fridge|freezer|pantry"}]}`
    : `Identify the food items clearly visible in this photo of a kitchen, fridge, counter or grocery bag. Only list items you can actually see; do not guess hidden items. Estimate counts only when they are clearly countable. Say if something looks like cooked leftovers.
JSON only: {"items":[{"name":"plain food name","qty":number or null,"unit":"pcs|g|kg|ml|l|pack|can|bunch or empty","where":"fridge|freezer|pantry","cooked":true|false,"sure":true|false}]}`;
  let res = null, lastErr = null;
  for (const model of VISION_MODELS) {
    if (cancelled) return;
    try { res = parseJSON(puterText(await window.puter.ai.chat(prompt, file, false, { model }))); if (res && Array.isArray(res.items)) break; }
    catch (e) { lastErr = e; if (e && /sign/i.test(e.message || "")) break; }
  }
  if (cancelled) return;
  if (!res || !Array.isArray(res.items)) {
    AI.onResult && AI.onResult(false, "scan_failed");
    openModal(`${ill("scan")}<h2 id="authTitle">I couldn't read that ${kind === "receipt" ? "receipt" : "photo"}</h2><p>${navigator.onLine ? "The AI didn't answer or couldn't make sense of the image. A brighter, closer, straight-on photo usually works better." : "You're offline."}</p>
      <div class="form-actions"><button class="btn primary" data-act="scan-${kind}">Try another photo</button><button class="linkbtn" data-act="auth-close">Close</button></div>`); return;
  }
  AI.onResult && AI.onResult(true);
  const date = kind === "receipt" && /^\d{4}-\d{2}-\d{2}$/.test(res.date || "") && res.date <= E.todayISO() ? res.date : null;
  const items = res.items.filter(x => x && x.name).slice(0, 40).map(x => {
    const name = String(x.name).slice(0, 60), key = E.resolveKey(name);
    const qty = typeof x.qty === "number" && x.qty > 0 ? x.qty : null;
    const unit = qty == null ? null : (E.UNITS.includes(x.unit) ? x.unit : (E.ING[key] || {}).u || "pcs");
    const cooked = !!x.cooked || !!(E.ING[key] || {}).isCooked;
    return { name, key, qty, unit, loc: ["fridge", "freezer", "pantry"].includes(x.where) ? x.where : (E.ING[key] || {}).loc || "fridge", cooked, added: date || E.todayISO(), uncertain: true, vague: qty == null };
  });
  if (!items.length) { openModal(`${ill("scan")}<h2 id="authTitle">No food found</h2><p>I couldn't spot any food in that ${kind}. Try a closer photo, or type what you have.</p><div class="form-actions"><button class="btn primary" data-act="auth-close">OK</button></div>`); return; }
  openReview(items);
  const h = $("#authBox h2"); if (h) h.textContent = `I found ${items.length} item${items.length > 1 ? "s" : ""}: check before adding`;
  const p = $("#authBox h2 + p"); if (p) p.textContent = "AI can make mistakes. Remove anything wrong and fix amounts. Nothing is added until you tap “Add to my kitchen”." + (date ? ` Bought on ${E.prettyDate(date)} (from the receipt).` : "");
}

/* ---------- small helpers ---------- */
function flash(sel) { requestAnimationFrame(() => { const el = document.querySelector(sel); if (el) { el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); } }); }

/* ---------- wire up ---------- */
TABS.push("plan", "rescue");
RENDER.plan = renderPlan;
RENDER.rescue = () => { renderRescue(); afterRescuePaint(); };
document.addEventListener("click", e => {
  const t = e.target.closest("[data-act]"); if (!t) return;
  const act = t.dataset.act;
  if (act.startsWith("rs-") && rescueAct(act, t)) return;
  if (act.startsWith("pl-") && planAct(act, t)) return;
  if (act.startsWith("gc-") && cookAct(act)) return;
  if (act === "scan-photo") openScan("photo");
  else if (act === "scan-receipt") openScan("receipt");
  else if (act === "scan-cancel") { S.ui.scanCancel && S.ui.scanCancel(); closeAuth(); toast("Scan cancelled."); }
});
document.addEventListener("input", e => {
  if (e.target.id === "pickQ") { const q = E.norm(e.target.value); document.querySelectorAll("#pickList .pick-row").forEach(b => b.hidden = q && !b.dataset.t.includes(q)); }
});
document.addEventListener("submit", e => { if (e.target.id === "rsMadeForm") { e.preventDefault(); submitRsMade(e.target); } });
document.addEventListener("change", e => { if (e.target.id === "scanFile") runScan(e.target.files && e.target.files[0], e.target.dataset.kind); });
