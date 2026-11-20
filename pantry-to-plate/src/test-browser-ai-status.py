import asyncio, json
from playwright.async_api import async_playwright
URL="file:///home/claude/p2p-src/index.html"
res=[]
def ok(c,m): res.append(bool(c)); print(("  ✓ " if c else "  ✗ ")+m)
recipes={"recipes":[{"title":"Garlic Chicken Rice Bowl","cuisine":"Filipino","style":"Classic","desc":"x","serves":2,"prep":10,"cook":20,"difficulty":"Easy","ingredients":[{"name":"Chicken thighs","qty":300,"unit":"g"},{"name":"Leftover rice","qty":2,"unit":"cup"},{"name":"Garlic","qty":4,"unit":"clove"},{"name":"Soy sauce","qty":2,"unit":"tbsp"}],"steps":["Brown the chicken until cooked through, no pink.","Add garlic and soy.","Serve over rice."]}]}
review={"reviews":[{"index":0,"taste":4,"practical":4,"unsafe":False,"problem":""}]}
stub="""window.__in=false;window.__fail=false;window.__n=0;window.puter={auth:{isSignedIn:async()=>window.__in,signIn:async()=>{window.__in=true}},ai:{chat:async()=>{if(window.__fail) throw new Error('quota');window.__n++;return {message:{content: window.__n%%2===1?%s:%s}};}}};""" % (json.dumps(json.dumps(recipes)), json.dumps(json.dumps(review)))
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={"width":1300,"height":950}); pg=await ctx.new_page()
        errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
        await pg.add_init_script(stub)
        await pg.goto(URL+"#cook"); await pg.wait_for_timeout(2500)
        badge=lambda: pg.inner_text("#aiStatus")
        ok(await badge()=="AI · connect", f"not signed in to Puter → '{await badge()}'")
        await pg.click("[data-act=ai-more]"); await pg.wait_for_timeout(300); await pg.click("[data-act=puter-connect]"); await pg.wait_for_timeout(1000)
        ok(await badge()=="AI · Gemini connected", f"after signing in and a working request → '{await badge()}'")
        await pg.evaluate("window.__fail=true"); await pg.click("[data-act=ai-more]"); await pg.wait_for_timeout(800)
        ok(await badge()=="AI · not responding", f"AI request fails (e.g. allowance used up) → '{await badge()}', not 'connected'")
        n=await pg.eval_on_selector_all(".pick","e=>e.length"); ok(n>0, f"curated recipes still shown ({n})")
        await pg.click("#aiStatus"); await pg.wait_for_timeout(200); ok("isn't responding" in await pg.inner_text("#authBox"), "badge explains what 'not responding' means"); await pg.click("[data-act=auth-close]")
        await pg.evaluate("window.__fail=false"); await pg.click("[data-act=ai-more]"); await pg.wait_for_timeout(900)
        ok(await badge()=="AI · Gemini connected", f"next request works → back to '{await badge()}'")
        await pg.evaluate("window.__in=false; window.dispatchEvent(new Event('focus'))"); await pg.wait_for_timeout(400)
        ok(await badge()=="AI · connect", f"signed out of Puter elsewhere, back on the tab → '{await badge()}'")
        await pg.evaluate("window.__in=true; window.dispatchEvent(new Event('focus'))"); await pg.wait_for_timeout(400)
        await pg.evaluate("window.__in=false"); await pg.click("[data-act=ai-more]"); await pg.wait_for_timeout(500)
        ok(await badge()=="AI · connect" and await pg.is_visible("[data-act=puter-connect]"), "session expires mid-use → badge says connect and the Connect button appears")
        await ctx.set_offline(True); await pg.evaluate("window.dispatchEvent(new Event('offline'))"); await pg.wait_for_timeout(200)
        ok(await badge()=="Offline", f"offline → '{await badge()}'"); await ctx.set_offline(False)
        ok(not errs, f"no script errors {errs[:2]}")
        await b.close(); print(f"\n{sum(res)}/{len(res)} AI status checks passed")
asyncio.run(main())
