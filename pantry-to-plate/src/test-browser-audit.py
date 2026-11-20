import asyncio, json
from playwright.async_api import async_playwright
URL="file:///home/claude/p2p-src/index.html"
res=[]
def ok(c,m): res.append(c); print(("  ✓ " if c else "  ✗ ")+m)
NET=lambda e: "ERR_TUNNEL" in e or "Failed to load resource" in e
async def page(b,w,h,init=None):
    ctx=await b.new_context(viewport={"width":w,"height":h}); pg=await ctx.new_page()
    errs=[]; pg.on("pageerror",lambda e:errs.append(str(e))); pg.on("console",lambda m: m.type=="error" and not NET(m.text) and errs.append(m.text))
    if init: await pg.add_init_script(init)
    return ctx,pg,errs
async def click_all(pg,tab):
    await pg.evaluate(f"location.hash='#{tab}'"); await pg.wait_for_timeout(300)
    acts=await pg.eval_on_selector_all(f"#view-{tab} [data-act]","es=>es.filter(e=>e.offsetParent).map((e,i)=>i)")
    n=0
    for i in range(min(len(acts),60)):
        els=await pg.query_selector_all(f"#view-{tab} [data-act]")
        vis=[e for e in els if await e.is_visible()]
        if i>=len(vis): break
        act=await vis[i].get_attribute("data-act")
        if act in ("clear-sample","item-delete","item-toss","unsave","cooked","tab"): continue
        try: await vis[i].click(timeout=1500); n+=1
        except Exception: pass
        await pg.keyboard.press("Escape"); await pg.wait_for_timeout(60)
        if await pg.evaluate("location.hash")!="#"+tab: await pg.evaluate(f"location.hash='#{tab}'"); await pg.wait_for_timeout(150)
    return n
async def answer_review(pg):
    if await pg.is_visible("#reviewForm"):
        for sel in await pg.query_selector_all("select[id^=rvCooked]"): await sel.select_option("0")
        await pg.click("#reviewForm button[type=submit]"); await pg.wait_for_timeout(200)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        print("\n7. EVERY BUTTON, EVERY SCREEN")
        for (w,h,name) in [(1300,950,"desktop"),(390,844,"phone"),(820,1180,"tablet")]:
            ctx,pg,errs=await page(b,w,h)
            await pg.goto(URL+"#home"); await pg.wait_for_timeout(800)
            total=0
            for tab in ["home","kitchen","cook","saved"]:
                total+=await click_all(pg,tab)
                ov=await pg.evaluate("document.documentElement.scrollWidth>window.innerWidth+1")
                ok(not ov, f"{name} · {tab}: no sideways scrolling")
            ok(not errs, f"{name}: clicked {total} buttons with no script errors {errs[:2]}")
            await ctx.close()
        print("\n8. FORMS, DEDUCTIONS, LEFTOVERS, SAVING")
        ctx,pg,errs=await page(b,1300,950)
        await pg.goto(URL+"#kitchen"); await pg.wait_for_timeout(700)
        await pg.click("[data-act=clear-sample]"); await pg.click("[data-act=clear-sample-yes]"); await pg.wait_for_timeout(200)
        await pg.fill("#qaText","6 eggs, 3 cups leftover rice, 1 cup leftover chicken, half a cabbage, 2 carrots"); await pg.press("#qaText","Enter"); await pg.wait_for_timeout(200); await answer_review(pg)
        n=await pg.eval_on_selector_all(".item","e=>e.length"); ok(n==5,f"bulk add made 5 items ({n})")
        await pg.fill("#qaText","3 eggs"); await pg.press("#qaText","Enter"); await pg.wait_for_timeout(200)
        eggs=await pg.evaluate("JSON.parse(localStorage.getItem('p2p.v3')).pantry.filter(p=>p.key==='egg')")
        ok(len(eggs)==1 and eggs[0]["qty"]==9,"adding eggs again merges: 9 eggs, one entry")
        # own expiry date via form
        await pg.click(".item-main >> text=Carrots"); await pg.select_option("#fLabelType","own"); await pg.fill("#fLabelDate","2026-12-31"); await pg.click("#itemForm button[type=submit]"); await pg.wait_for_timeout(200)
        note=await pg.inner_text(".item:has-text('Carrots') .fresh"); ok("your date" in note, f"own expiry date shown: '{note}'")
        # validation
        await pg.click("[data-act=item-new]"); await pg.fill("#fName","Tofu"); await pg.check("#fOpened"); await pg.fill("#fAdded","2026-11-19"); await pg.fill("#fOpenedOn","2026-11-10"); await pg.click("#itemForm button[type=submit]")
        err=await pg.inner_text("#formErr"); ok("opened before" in err, f"opened-before-bought is caught: '{err[:60]}'")
        await pg.keyboard.press("Escape")
        # cook with edited amounts
        await pg.evaluate("location.hash='#cook'"); await pg.wait_for_timeout(500)
        await pg.click(".pick:has-text('Chicken & Cabbage Fried Rice')"); await pg.wait_for_timeout(200)
        await pg.click("[data-act=cooked]"); await pg.wait_for_timeout(200)
        rows=await pg.eval_on_selector_all(".crow .cname","e=>e.map(x=>x.firstChild.textContent)")
        idx=[i for i,r in enumerate(rows) if r.startswith("Eggs")][0]
        await pg.fill(f"#take{idx}","3"); await pg.fill("#leftServ","2")
        await pg.click("#cookedForm button[type=submit]"); await pg.wait_for_timeout(300)
        st=await pg.evaluate("JSON.parse(localStorage.getItem('p2p.v3'))")
        e=[x for x in st["pantry"] if x["key"]=="egg"]; ok(e and e[0]["qty"]==6, f"user changed eggs used to 3 → 9-3 = {e[0]['qty'] if e else '?'} left")
        lo=[x for x in st["pantry"] if x["name"].startswith("Leftover Chicken & Cabbage")]
        ok(lo and lo[0]["qty"]==2 and lo[0]["riceDish"] and lo[0]["loc"]=="fridge", "leftovers recorded: 2 servings, in the fridge, marked as a rice dish")
        ok(len(st["history"])==1 and st["history"][0]["servings"]>=1, "meal recorded in history")
        await pg.evaluate("location.hash='#kitchen'"); await pg.wait_for_timeout(300)
        lonote=await pg.inner_text(".item:has-text('Leftover Chicken') .fresh"); ok("today" in lonote.lower() or "1 day" in lonote, f"leftover guidance: '{lonote}'")
        # persistence across reload
        n1=await pg.eval_on_selector_all(".item","e=>e.length")
        await pg.reload(); await pg.wait_for_timeout(600)
        n2=await pg.eval_on_selector_all(".item","e=>e.length"); ok(n2==n1 and n2>=3, f"after reload the kitchen is exactly as it was ({n1} → {n2} items)")
        # drinks
        await pg.fill("#qaText","3 ripe bananas, 2 mangoes, 1 liter milk"); await pg.press("#qaText","Enter")
        await pg.evaluate("location.hash='#cook'"); await pg.wait_for_timeout(300); await pg.click("[data-act=kind][data-k=drinks]"); await pg.wait_for_timeout(300)
        t=await pg.inner_text("#ideas"); ok("Mango Shake" in t and "Banana" in t, "Drinks shows mango shake and banana smoothie")
        await pg.click(".pick:has-text('Mango Shake')"); await pg.wait_for_timeout(500)
        d=(await pg.inner_text("#detail")).lower(); ok("makes" in d and "glasses" in d and "unpasteurized" in d, "drink page: 'Makes 2 glasses' + juice safety note")
        await pg.screenshot(path="/tmp/a-drink.png")
        ok(not errs, f"no script errors {errs[:2]}")
        await ctx.close()

        print("\n9. CLOUD SYNC NEVER OVERWRITES NEWER DATA (stand-in Supabase)")
        mock="""
        const L=localStorage; window.__store={get row(){return JSON.parse(L.getItem('__row')||'null')},set row(v){L.setItem('__row',JSON.stringify(v))}};
        Object.defineProperty(window,'__signed',{get(){return L.getItem('__signed')==='1'},set(v){L.setItem('__signed',v?'1':'0')}});
        window.supabase={createClient:()=>({
          auth:{getSession:async()=>({data:{session:window.__signed?{user:{id:'u1',email:'a@b.c',user_metadata:{name:'Tiff'}},access_token:'t'}:null}}),
                onAuthStateChange:()=>{}, signOut:async()=>{}},
          from:()=>{const q={select(){return q},eq(){return q},
            maybeSingle:async()=>({data:window.__store.row,error:null}),
            upsert:async(r)=>{window.__store.row={data:r.data,updated_at:r.updated_at};return {error:null}}};return q;}
        })};"""
        ctx,pg,errs=await page(b,1300,950,mock)
        await pg.goto(URL+"#kitchen"); await pg.wait_for_timeout(2500)
        # A: signed-out device kitchen, then first sign-in to an account that already has data
        await pg.evaluate("""()=>{localStorage.setItem('p2p.v3',JSON.stringify({v:3,owner:null,sample:false,savedAt:Date.now(),pantry:[{name:'Local cheese',key:'cheese',qty:200,unit:'g',loc:'fridge',added:'2026-11-18'}],staples:['salt'],saved:[],collections:[],week:[],history:[],prefs:{}}));
          window.__signed=true; window.__store.row={data:{v:3,owner:'u1',savedAt:1000,pantry:[{name:'Account eggs',key:'egg',qty:6,unit:'pcs',loc:'fridge',added:'2026-11-18'}],staples:['salt'],saved:[],collections:[],week:[],history:[],prefs:{}},updated_at:'2026-01-01'};}""")
        await pg.reload(); await pg.wait_for_timeout(900)
        names=await pg.eval_on_selector_all(".item .name","e=>e.map(x=>x.textContent)")
        modal=await pg.is_visible("#authModal")
        ok(names==["Account eggs"] and modal, f"first sign-in: older account data is NOT overwritten by this device; it asks first (shows {names}, modal={modal})")
        await pg.click("[data-act=merge-yes]"); await pg.wait_for_timeout(1700)
        names=sorted(await pg.eval_on_selector_all(".item .name","e=>e.map(x=>x.textContent)"))
        remote=await pg.evaluate("window.__store.row.data.pantry.map(p=>p.name).sort()")
        ok(names==["Account eggs","Local cheese"] and remote==names, f"'Add them' combines both and saves to the account {remote}")
        # B: another device saved something newer → this device's next save must not overwrite it
        await pg.evaluate("""()=>{const r=window.__store.row; r.data={...r.data,savedAt:Date.now()+60000,pantry:[...r.data.pantry,{name:'Phone mangoes',key:'mango',qty:2,unit:'pcs',loc:'pantry',added:'2026-11-19'}]}; window.__store.row=r;}""")
        await pg.fill("#qaText","1 cucumber"); await pg.press("#qaText","Enter"); await pg.wait_for_timeout(1800)
        remote=await pg.evaluate("window.__store.row.data.pantry.map(p=>p.name)")
        local=await pg.eval_on_selector_all(".item .name","e=>e.map(x=>x.textContent)")
        ok("Phone mangoes" in remote and "Phone mangoes" in local, f"newer copy from another device is kept and shown, not overwritten (remote {remote})")
        # C: normal case: newest local change is saved
        await pg.fill("#qaText","2 apples"); await pg.press("#qaText","Enter"); await pg.wait_for_timeout(1800)
        remote=await pg.evaluate("window.__store.row.data.pantry.map(p=>p.name)")
        ok("Apples" in remote, "a normal change is saved to the account")
        ok(not errs, f"no script errors {errs[:2]}")
        await ctx.close()

        print("\n10. AI RECIPES MUST BE SENSIBLE, SAFE AND RATED TASTY (stand-in AI)")
        recipes={"recipes":[
          {"title":"Garlic Chicken Rice Bowl","cuisine":"Filipino","style":"Classic","desc":"x","serves":2,"prep":10,"cook":20,"difficulty":"Easy","ingredients":[{"name":"Chicken thighs","qty":300,"unit":"g"},{"name":"Leftover rice","qty":2,"unit":"cup"},{"name":"Garlic","qty":4,"unit":"clove"},{"name":"Soy sauce","qty":2,"unit":"tbsp"}],"steps":["Brown the chicken.","Add garlic and soy.","Serve over rice."],"season":"","store":""},
          {"title":"Salt Bomb Eggs","cuisine":"Any","style":"Classic","desc":"x","serves":2,"prep":5,"cook":5,"difficulty":"Easy","ingredients":[{"name":"Eggs","qty":4,"unit":"pcs"},{"name":"Salt","qty":5,"unit":"tbsp"}],"steps":["a","b","c"],"season":"","store":""},
          {"title":"Truffle Risotto","cuisine":"Italian","style":"Classic","desc":"x","serves":2,"prep":5,"cook":30,"difficulty":"Medium","ingredients":[{"name":"Truffle","qty":20,"unit":"g"},{"name":"Leftover rice","qty":2,"unit":"cup"}],"steps":["a","b","c"],"season":"","store":""}]}
        review={"reviews":[{"index":0,"taste":4,"practical":5,"unsafe":False,"problem":""}]}
        stub="""window.__calls=0;window.puter={auth:{isSignedIn:async()=>true,signIn:async()=>{}},ai:{chat:async(p,o)=>{window.__calls++;return {message:{content: window.__calls===1?%s:%s}};}}};""" % (json.dumps(json.dumps(recipes)), json.dumps(json.dumps(review)))
        ctx,pg,errs=await page(b,1300,950,stub)
        await pg.goto(URL+"#kitchen"); await pg.wait_for_timeout(500)
        await pg.click("[data-act=clear-sample]"); await pg.click("[data-act=clear-sample-yes]")
        await pg.fill("#qaText","500 g chicken thighs, 3 cups leftover rice, 6 eggs"); await pg.press("#qaText","Enter"); await pg.wait_for_timeout(200); await answer_review(pg)
        await pg.evaluate("location.hash='#cook'"); await pg.wait_for_timeout(2500)
        await pg.click("[data-act=ai-more]"); await pg.wait_for_timeout(800)
        toast=await pg.inner_text("#toast"); t=await pg.inner_text("#ideas")
        ok("Garlic Chicken Rice Bowl" in t and "Salt Bomb" not in t and "Truffle" not in t, f"kept the good one; rejected too-salty and needs-truffle: '{toast}'")
        await pg.click(".pick:has-text('Garlic Chicken Rice Bowl')"); await pg.wait_for_timeout(200)
        d=await pg.inner_text("#detail")
        ok("74°C" in d.split("Method")[1].split("Seasoning")[0] if "Seasoning" in d else "74°C" in d, "missing 'cook chicken through' step was added automatically")
        ok("reviewed for taste and safety" in d and "ai recipe" in d.lower(), "labelled as an AI recipe, reviewed, not test-cooked")
        ok(not errs, f"no script errors {errs[:2]}")
        await ctx.close(); await b.close()
        print(f"\n{sum(res)}/{len(res)} browser checks passed")
asyncio.run(main())
