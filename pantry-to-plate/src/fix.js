/* Demo fixes that name what's actually in your kitchen. Each: [candidates, fix using {x}, why, fallback fix]. */
function firstOwned(c){for(const n of c){const o=owns(n);if(o)return o.item.name;}return null;}
const FIX={
  "Too salty":[[["rice","gnocchi","tortilla","potato","noodle","bread"],"Stir in more {x}, unseasoned.","More base spreads the salt out.","Add a splash of water and simmer to stretch the sauce."],
    [["lime","lemon","calamansi","vinegar"],"Add a squeeze of your {x}.","Acid doesn't remove salt, but it rebalances how salty it tastes.","Serve it with something plain on the side."],
    [["greek yogurt","yogurt","butter","milk","cream"],"Swirl in a spoon of {x} off the heat.","Fat and dairy soften how salty it reads.","Add a drizzle of oil off the heat to round it out."]],
  "Too watery":[[[],"","",""],
    [["rice","gnocchi","potato","tofu"],"Mash a little {x} into the sauce.","The starch thickens it naturally.","Simmer uncovered for 3 to 4 minutes to reduce it."],
    [["flour"],"Whisk 1 tsp of {x} into cold water and stir it in.","Simmer a minute more to cook out the raw taste.","Push the solids aside and boil the liquid hard for 2 minutes."]],
  "Needs brightness":[[["lime","lemon","calamansi","vinegar"],"Finish with a squeeze of your {x}.","Acid wakes up every other flavor.","A pinch of salt at the end often does the same job."],
    [["cilantro","scallion","basil","parsley"],"Scatter over fresh {x}.","Raw herbs add a fresh top note.","Add a few raw, thinly sliced vegetables on top for crunch."],
    [["kimchi","pickle","tomato"],"Add a spoonful of {x} on the side.","Something sharp or fermented cuts richness.","Serve with something crisp and raw alongside."]],
  "Needs more depth":[[["soy sauce","fish sauce"],"Add a splash of {x}.","It brings instant savory, umami backbone.","Let it simmer a few minutes longer so the flavors concentrate."],
    [["garlic"],"Fry sliced {x} in oil until golden, then stir it in.","Toasted aromatics add a darker, rounder flavor.","Brown the next batch harder before adding liquid."],
    [["gochujang","kimchi","butter","cheddar","bacon"],"Stir in a little {x}.","Fermented, aged or browned ingredients add depth fast.","Add a small pinch of sugar: it rounds out flat sauces."]],
  "Too spicy":[[["greek yogurt","yogurt","milk","cheddar","cheese"],"Stir in or top with {x}.","Dairy fat binds the heat.","Add more of the base to spread the heat out."],
    [["sugar","honey"],"Add a pinch of {x}.","Sweetness masks heat.","Add a splash of water to dilute it."],
    [["rice","tortilla","bread","egg"],"Serve with extra {x}.","Something plain on the side cools each bite.","Serve smaller spoonfuls over something plain."]],
  "Too bland":[[["salt"],"Add {x} in small pinches, tasting between each.","Most bland food is simply under-salted.","Add soy sauce a few drops at a time."],
    [["lime","lemon","calamansi","vinegar"],"Add a squeeze of your {x}.","Brightness makes the other flavors pop.","Taste again after salting: it may be all it needed."],
    [["chili flakes","cilantro","scallion","garlic"],"Finish with {x}.","A hot or fresh finish adds contrast.","Toast any spices you're using in oil before adding them."]]
};
function demoFixes(p){
  return (FIX[p]||FIX["Too bland"]).filter(f=>f[1]||f[3]).map(([c,t,w,fb])=>{const x=c.length?firstOwned(c):null;return x?[t.replace("{x}",x.toLowerCase()),w]:[fb,"Uses no extra ingredients."];});
}
async function rescue(p){
  const r=getRecipe(S.ui.currentId), box=$("#fixes");
  const show=fx=>{box.innerHTML=fx.map(([f,w])=>`<div class="fix">${esc(f)}<span>${esc(w)}</span></div>`).join("")};
  if(!AI.ready){show(demoFixes(p));return;}
  box.innerHTML=`<div class="loading">Finding a fix with what you have…</div>`;
  try{
    const res=await AI.json(`A home cook is mid-way through making "${r.title}". Problem: "${p}".
Ingredients they have: ${S.pantry.map(x=>x.name).join(", ")}; staples: ${S.staples.filter(s=>s.on).map(s=>s.name).join(", ")}.
Give 3 quick fixes using ONLY those ingredients or techniques. JSON only: {"fixes":[{"fix":"short instruction","why":"one short sentence"}]}`,{fast:true});
    const fx=(res&&res.fixes||[]).slice(0,3).map(x=>[x.fix,x.why]);
    show(fx.length?fx:demoFixes(p));
  }catch(e){show(demoFixes(p));
    if(e&&e.code==="puter_sign_in") openPuterConnect(()=>rescue(p));
    else if(e&&e.code==="sign_in") toast("Sign in to get AI fixes. Showing quick fixes for now.");}
}

