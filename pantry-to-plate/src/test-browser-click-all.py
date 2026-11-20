import asyncio
from playwright.async_api import async_playwright
URL="file:///home/claude/p2p-src/index.html"
NET=lambda e: "ERR_TUNNEL" in e or "Failed to load resource" in e or "ERR_" in e
async def sweep(b,w,h,label):
    ctx=await b.new_context(viewport={"width":w,"height":h}); pg=await ctx.new_page()
    errs=[]; pg.on("pageerror",lambda e:errs.append(str(e))); pg.on("console",lambda m: m.type=="error" and not NET(m.text) and errs.append(m.text))
    pg.on("dialog",lambda d: asyncio.ensure_future(d.dismiss()))
    await pg.goto(URL+"#home"); await pg.wait_for_timeout(2200)
    clicked=0; acts=set()
    for tab in ["home","kitchen","cook","plan","rescue","saved"]:
        for rnd in range(1):
            await pg.evaluate(f"location.hash='#{tab}'"); await pg.wait_for_timeout(250)
            n=await pg.eval_on_selector_all("[data-act]","e=>e.length")
            for i in range(n):
                await pg.evaluate(f"location.hash='#{tab}'")
                els=await pg.query_selector_all("[data-act]")
                if i>=len(els): break
                el=els[i]
                act=await el.get_attribute("data-act")
                if act in ("clear-sample-yes","reset-sample","signout","account-delete","puter-connect","pl-clear-yes","rs-toss","item-delete","item-toss","scan-photo","scan-receipt") or not await el.is_visible(): continue
                try:
                    await el.click(timeout=800); clicked+=1; acts.add(act); await pg.wait_for_timeout(60)
                except Exception: pass
                for _ in range(2):
                    await pg.keyboard.press("Escape")
                for sel in ["#authModal","#gc"]:
                    await pg.evaluate(f"(()=>{{const m=document.querySelector('{sel}'); if(m) m.hidden=true;}})()")
        ov=await pg.evaluate("document.documentElement.scrollWidth>window.innerWidth+1")
        if ov: errs.append(f"overflow on {tab}")
    await ctx.close()
    print(f"{label}: clicked {clicked} buttons ({len(acts)} different actions); errors: {errs[:5] or 'none'}")
    return not errs
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        r=[await sweep(b,1300,950,"desktop"), await sweep(b,390,844,"phone"), await sweep(b,768,1024,"tablet")]
        await b.close(); print("ALL CLEAN" if all(r) else "PROBLEMS FOUND")
asyncio.run(main())
