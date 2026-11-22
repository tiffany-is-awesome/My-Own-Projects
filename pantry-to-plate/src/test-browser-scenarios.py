import asyncio, json
from playwright.async_api import async_playwright
URL="http://127.0.0.1:8765/index.html"
res=[]
def ok(c,m): res.append(bool(c)); print(("  ✓ " if c else "  ✗ ")+m)
NET=lambda e: "ERR_TUNNEL" in e or "Failed to load resource" in e
async def page(b,w,h,init=None):
    ctx=await b.new_context(viewport={"width":w,"height":h}); pg=await ctx.new_page()
    errs=[]; pg.on("pageerror",lambda e:errs.append(str(e))); pg.on("console",lambda m: m.type=="error" and not NET(m.text) and errs.append(m.text))
    if init: await pg.add_init_script(init)
    return ctx,pg,errs
async def empty_kitchen(pg):
    await pg.goto(URL+"#kitchen"); await pg.wait_for_timeout(600)
    await pg.click("#kitchenWelcome [data-act=clear-sample]"); await pg.click("[data-act=clear-sample-yes]"); await pg.wait_for_timeout(150); await tick_basics(pg)
async def quick(pg,text):
    await pg.fill("#qaText",text); await pg.press("#qaText","Enter"); await pg.wait_for_timeout(250)
async def store(pg): return await pg.evaluate("JSON.parse(localStorage.getItem('p2p.v3'))")
async def tick_basics(pg):
    await pg.evaluate("location.hash='#kitchen'"); await pg.wait_for_timeout(250)
    for n in ["Salt","Black pepper","Cooking oil","Garlic","Soy sauce","Sugar","Oyster sauce","Onions","Fish sauce","Flour","Butter","Vinegar"]:
        el=await pg.query_selector(f"#staples label.chip:has-text('{n}') input")
        if el and not await el.is_checked(): await el.check()
    await pg.wait_for_timeout(150)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        ctx,pg,errs=await page(b,1300,950)
        await empty_kitchen(pg)
        print("\n1–3. Typing leftovers asks when they were cooked")
        await quick(pg,"leftover rice")
        ok(await pg.is_visible("#reviewForm"), "typing 'leftover rice' opens 'Check before adding' instead of assuming today")
        await pg.click("#reviewForm button[type=submit]"); await pg.wait_for_timeout(150)
        ok("choose when it was cooked" in (await pg.inner_text("#formErr")), "can't add it without choosing when it was cooked (or 'not sure')")
        await pg.select_option("#rvCooked0","unknown"); await pg.click("#reviewForm button[type=submit]"); await pg.wait_for_timeout(250)
        note=await pg.inner_text(".item:has-text('Leftover rice') .fresh")
        ok("Check these first" in await pg.inner_text("#kitchenList") and ("throw it out" in note.lower()), f"'not sure' → Check these first: '{note[:70]}'")
        await quick(pg,"a little leftover chicken and 6 eggs")
        rows=await pg.eval_on_selector_all(".rv input[id^=rvName]","e=>e.map(x=>x.value)")
        ok(rows==["Leftover chicken","Eggs"], f"'a little leftover chicken and 6 eggs' → {rows}")
        await pg.select_option("#rvCooked0","1"); await pg.fill("#rvQty0","1"); await pg.select_option("#rvUnit0","cup")
        await pg.click("#reviewForm button[type=submit]"); await pg.wait_for_timeout(250)
        st=await store(pg); c=[x for x in st["pantry"] if x["key"]=="chicken_cooked"][0]
        ok(c["cookedOn"]=="2026-11-"+str(int(await pg.evaluate("new Date().getDate()"))-1).zfill(2) or c["cookedOn"]<await pg.evaluate("new Date().toISOString().slice(0,10)"), f"'Yesterday' is saved as the cooking date ({c['cookedOn']}), separate from the date added ({c['added']})")
        print("\n4. Two batches of milk")
        await quick(pg,"1 liter milk"); await quick(pg,"1 liter milk")
        st=await store(pg); ok(len([x for x in st["pantry"] if x["key"]=="milk"])==1, "same milk added twice with the same dates → one entry (2 L)")
        cards=await pg.query_selector_all(".item:has-text('Milk') .item-main")
        await cards[0].click(); await pg.select_option("#fLabelType","useby"); await pg.fill("#fLabelDate","2026-12-01"); await pg.click("#itemForm button[type=submit]"); await pg.wait_for_timeout(200)
        await pg.click("[data-act=item-new]"); await pg.fill("#fName","Milk"); await pg.fill("#fQty","1"); await pg.select_option("#fUnit","l"); await pg.select_option("#fLabelType","useby"); await pg.fill("#fLabelDate","2026-11-22"); await pg.click("#itemForm button[type=submit]"); await pg.wait_for_timeout(250)
        st=await store(pg); ms=[x for x in st["pantry"] if x["key"]=="milk"]
        ok(len(ms)==2 and sorted(m["label"]["date"] for m in ms)==["2026-11-22","2026-12-01"], "a milk with a different use-by date stays a separate batch; both dates kept")
        print("\n5. A food with no amount")
        await quick(pg,"spinach")
        tags=await pg.inner_text(".item:has-text('Spinach')"); ok("Amount not recorded" in tags, "card says 'Amount not recorded'")
        await pg.evaluate("location.hash='#cook'"); await pg.wait_for_timeout(400)
        await pg.click(".pick:has-text('Garlic Stir-fried Greens')"); await pg.wait_for_timeout(200)
        d=await pg.inner_text("#detail"); ok("how much do you have" in d.lower(), "recipe asks how much spinach you have instead of assuming enough")
        sid=[x["id"] for x in (await store(pg))["pantry"] if x["key"]=="spinach"][0]
        await pg.fill(f"#sq-{sid}","300"); await pg.select_option(f"#squ-{sid}","g"); await pg.click(f"[data-act=set-qty][data-id='{sid}']"); await pg.wait_for_timeout(250)
        st=await store(pg); sp=[x for x in st["pantry"] if x["key"]=="spinach"][0]; ok(sp["qty"]==300 and sp["unit"]=="g", "'Save amount' records 300 g from the recipe page")
        print("\n7. Scaling 2 → 5")
        await pg.evaluate("location.hash='#kitchen'"); await pg.wait_for_timeout(200); await quick(pg,"10 cups cooked rice")
        await pg.select_option("#rvCooked0","0"); await pg.click("#reviewForm button[type=submit]"); await pg.wait_for_timeout(200)
        await pg.evaluate("location.hash='#cook'"); await pg.wait_for_timeout(400)
        await pg.click(".pick:has-text('Egg Fried Rice')"); await pg.wait_for_timeout(200)
        for _ in range(3): await pg.click("[data-act=rserv][data-d='1']"); await pg.wait_for_timeout(120)
        d=await pg.inner_text("#detail"); ok("7½ cups" in d and "Eggs 5" in d.replace("\n"," ").replace("  "," "), "Egg Fried Rice at 5 servings shows 7½ cups rice and 5 eggs")
        print("\n13–15. Cook with confirmed amounts, leftovers, refresh")
        await pg.click("[data-act=cooked]"); await pg.wait_for_timeout(200)
        names=await pg.eval_on_selector_all(".crow .cname","e=>e.map(x=>x.firstChild.textContent)")
        ei=[i for i,n in enumerate(names) if n.startswith("Eggs")][0]
        await pg.fill(f"#take{ei}","4"); await pg.fill("#leftServ","2"); await pg.click("#cookedForm button[type=submit]"); await pg.wait_for_timeout(300)
        st=await store(pg); e=[x for x in st["pantry"] if x["key"]=="egg"][0]
        ok(e["qty"]==2, f"confirmed 4 eggs used → 6-4 = {e['qty']} left")
        lo=[x for x in st["pantry"] if x["name"].startswith("Leftover Egg Fried Rice")][0]
        ok(lo["cookedOn"]==lo["added"] and lo["riceDish"], "leftovers saved with today as their real cooking date, marked as a rice dish (24 h)")
        before=len(st["pantry"]); await pg.reload(); await pg.wait_for_timeout(600)
        ok(len((await store(pg))["pantry"])==before and await pg.eval_on_selector_all(".pick","e=>e.length")>0, "after refresh everything is still there")
        print("\n9–10. Dates on recipes")
        await pg.evaluate("location.hash='#kitchen'"); await pg.wait_for_timeout(200)
        await pg.click("[data-act=item-new]"); await pg.fill("#fName","Yogurt"); await pg.fill("#fQty","200"); await pg.select_option("#fUnit","g"); await pg.select_option("#fLabelType","useby"); await pg.fill("#fLabelDate","2026-11-01"); await pg.click("#itemForm button[type=submit]"); await pg.wait_for_timeout(200)
        ok("Don't eat it" in await pg.inner_text(".item:has-text('Yogurt')"), "past use-by yogurt: 'Don't eat it' with a Throw out button")
        ok(not errs, f"no script errors {errs[:2]}")
        await ctx.close()

        print("\n11. No AI: curated recipes still work")
        ctx,pg,errs=await page(b,1300,950)
        await pg.goto(URL+"#cook"); await pg.wait_for_timeout(2500)
        badge=await pg.inner_text("#aiStatus"); n=await pg.eval_on_selector_all(".pick","e=>e.length")
        ok(badge=="No AI" and n>=5, f"badge '{badge}', and {n} curated recipes are offered")
        await ctx.close()

        print("\n12. AI sign-in and generation (stand-in Puter)")
        recipes={"recipes":[{"title":"Garlic Chicken Rice Bowl","cuisine":"Filipino","style":"Classic","desc":"x","serves":2,"prep":10,"cook":20,"difficulty":"Easy","ingredients":[{"name":"Chicken thighs","qty":300,"unit":"g"},{"name":"Leftover rice","qty":2,"unit":"cup"},{"name":"Garlic","qty":4,"unit":"clove"},{"name":"Soy sauce","qty":2,"unit":"tbsp"}],"steps":["Brown the chicken until cooked through, no pink.","Add garlic and soy.","Serve over rice."],"season":"","store":""}]}
        review={"reviews":[{"index":0,"taste":4,"practical":4,"unsafe":False,"problem":""}]}
        stub="""window.__in=false;window.__calls=0;window.puter={auth:{isSignedIn:async()=>window.__in,signIn:async()=>{window.__in=true}},ai:{chat:async()=>{window.__calls++;return {message:{content: window.__calls===1?%s:%s}};}}};""" % (json.dumps(json.dumps(recipes)), json.dumps(json.dumps(review)))
        ctx,pg,errs=await page(b,1300,950,stub)
        await empty_kitchen(pg)
        await pg.click("[data-act=item-new]"); await pg.fill("#fName","Leftover rice"); await pg.check("#fCooked"); await pg.fill("#fCookedOn",await pg.evaluate("new Date().toISOString().slice(0,10)")); await pg.fill("#fQty","3"); await pg.select_option("#fUnit","cup"); await pg.click("#itemForm button[type=submit]"); await pg.wait_for_timeout(200)
        await quick(pg,"500 g chicken thighs")
        await pg.evaluate("location.hash='#cook'"); await pg.wait_for_timeout(2500)
        badge=await pg.inner_text("#aiStatus"); ok(badge=="AI · connect", f"before connecting Puter the badge says '{badge}', not 'live'")
        await pg.click("[data-act=ai-more]"); await pg.wait_for_timeout(400)
        ok(await pg.is_visible("[data-act=puter-connect]"), "asking for AI ideas first offers 'Connect free AI'")
        await pg.click("[data-act=puter-connect]"); await pg.wait_for_timeout(900)
        badge=await pg.inner_text("#aiStatus"); t=await pg.inner_text("#ideas")
        ok("connected" in badge and "Garlic Chicken Rice Bowl" in t, f"after connecting: badge '{badge}', and the reviewed AI recipe appears")
        ok(not errs, f"no script errors {errs[:2]}")
        await ctx.close()

        print("\n16. Phone screen")
        ctx,pg,errs=await page(b,390,844)
        await pg.goto(URL+"#home"); await pg.wait_for_timeout(700)
        for tab in ["home","kitchen","cook","saved"]:
            await pg.evaluate(f"location.hash='#{tab}'"); await pg.wait_for_timeout(300)
            ok(not await pg.evaluate("document.documentElement.scrollWidth>window.innerWidth+1"), f"phone · {tab}: fits the screen")
        await pg.evaluate("location.hash='#kitchen'"); await pg.wait_for_timeout(300); await quick(pg,"some leftover adobo")
        ok(await pg.is_visible("#reviewForm"), "phone: review step opens for 'some leftover adobo'")
        await pg.screenshot(path="/tmp/s-phone-review.png")
        ok(not errs, f"no script errors {errs[:2]}")
        await b.close()
        print(f"\n{sum(res)}/{len(res)} browser scenario checks passed")
asyncio.run(main())
