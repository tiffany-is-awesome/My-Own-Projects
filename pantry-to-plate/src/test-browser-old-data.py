import asyncio, json
from playwright.async_api import async_playwright
URL="file:///home/claude/p2p-src/index.html"
v2={"pantry":[{"id":"a","name":"milk","qty":"","cat":"other","days":5},{"id":"b","name":"leftover adobo","qty":"","cat":"other","days":5},{"id":"c","name":"pita wrap","qty":"","cat":"other","days":5},{"id":"d","name":"eggs","qty":"6","cat":"other","days":5}],"staples":[],"saved":[],"collections":[],"week":[],"savedAt":1794549576945}
res=[]
def ok(c,m): res.append(bool(c)); print(("  ✓ " if c else "  ✗ ")+m)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(); pg=await ctx.new_page(); errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
        await pg.goto(URL); await pg.evaluate("localStorage.clear()")
        await pg.evaluate(f"localStorage.setItem('p2p.v2', {json.dumps(json.dumps(v2))})"); await pg.reload(); await pg.wait_for_timeout(800)
        d1=await pg.evaluate("JSON.parse(localStorage.getItem('p2p.v3'))")
        ok(d1 is not None and len(d1["pantry"])==4, "old kitchen converted and saved once (4 items)")
        ok(all(x["added"]=="2026-11-13" and not x.get("est") for x in d1["pantry"]), "items dated from the old save (Nov 13), no invented 'your date'")
        lo=[x for x in d1["pantry"] if "adobo" in x["name"].lower()][0]
        ok(not lo.get("cookedOn"), "old leftovers don't get a cooking date they never had")
        await pg.evaluate("location.hash='#kitchen'"); await pg.wait_for_timeout(300)
        t=await pg.inner_text("#kitchenList")
        ok("your date" not in t, "no item labelled 'your date'")
        ok("Check these first" in t, "milk / leftovers past their estimate are flagged to check")
        await pg.reload(); await pg.wait_for_timeout(600)
        d2=await pg.evaluate("JSON.parse(localStorage.getItem('p2p.v3'))")
        ok([x["added"] for x in d2["pantry"]]==[x["added"] for x in d1["pantry"]] and [x["id"] for x in d2["pantry"]]==[x["id"] for x in d1["pantry"]], "after reloading, dates stay put (no daily drift)")
        old3={"v":3,"pantry":[{"id":"x1","name":"Leftover rice","key":"rice_cooked","qty":2,"unit":"cup","loc":"fridge","cooked":True,"added":"2026-11-19"},{"id":"x2","name":"Leftover Chicken Adobo","key":"leftover","qty":2,"unit":"servings","loc":"fridge","cooked":True,"added":"2026-11-19"}],"staples":[],"saved":[],"collections":[],"week":[],"history":[],"prefs":None,"sample":False,"savedAt":1}
        await pg.evaluate(f"localStorage.clear(); localStorage.setItem('p2p.v3', {json.dumps(json.dumps(old3))})"); await pg.reload(); await pg.wait_for_timeout(700)
        await pg.evaluate("location.hash='#kitchen'"); await pg.wait_for_timeout(300)
        rice=await pg.inner_text(".item:has-text('Leftover rice')"); ado=await pg.inner_text(".item:has-text('Leftover Chicken Adobo')")
        ok("When was this cooked" in rice and "Cooked Nov" not in rice, "older save, typed-in leftover rice with no cooking date → asks 'When was this cooked?', no date invented")
        ok("Cooked Nov 19" in ado, "older save, leftovers the app made via 'I made this' keep their real cooking day")
        ok(not errs, f"no script errors {errs[:2]}")
        await b.close(); print(f"{sum(res)}/{len(res)} migration checks passed")
asyncio.run(main())
