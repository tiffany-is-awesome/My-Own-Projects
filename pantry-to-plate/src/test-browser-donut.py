import asyncio
from playwright.async_api import async_playwright
res=[]
def ok(c,m): res.append(bool(c)); print(("  ✓ " if c else "  ✗ ")+m)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        pg=await (await b.new_context(viewport={"width":1300,"height":900})).new_page(); errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
        await pg.goto("file:///home/claude/p2p-src/index.html#home"); await pg.wait_for_timeout(1200)
        n=await pg.eval_on_selector_all(".tipjar","e=>e.length"); ok(n==0,"no QR or link set → donut card hidden (no dead buttons)")
        pg2=await (await b.new_context(viewport={"width":1300,"height":900})).new_page(); pg2.on("pageerror",lambda e:errs.append(str(e)))
        await pg2.goto("file:///tmp/tiptest.html#home"); await pg2.wait_for_timeout(1200)
        t=await pg2.inner_text(".tipjar"); ok("Saved you time? Buy the developer a donut!" in t,"home shows 'Saved you time? Buy the developer a donut!'")
        el=await pg2.query_selector(".tipjar"); await el.scroll_into_view_if_needed(); await el.screenshot(path="/tmp/tip-card.png")
        await pg2.click("[data-act=tip-gcash]"); await pg2.wait_for_timeout(400)
        ok(await pg2.is_visible(".tip-modal .qr") and "GCash ·" in await pg2.inner_text("#authBox"),"GCash button opens the QR to scan")
        await (await pg2.query_selector("#authBox")).screenshot(path="/tmp/tip-qr.png")
        await pg2.click("#authBox [data-act=auth-close]")
        href=await pg2.get_attribute("a[data-act=tip-link]","href"); tgt=await pg2.get_attribute("a[data-act=tip-link]","target")
        ok(href=="https://example.com/tip" and tgt=="_blank","Card / PayPal opens your tip page in a new tab")
        await pg2.evaluate("location.hash='#saved'"); await pg2.wait_for_timeout(500)
        ok(await pg2.is_visible("#view-saved .tipjar"),"also at the bottom of Saved recipes")
        pg3=await (await b.new_context(viewport={"width":360,"height":800})).new_page()
        await pg3.goto("file:///tmp/tiptest.html#home"); await pg3.wait_for_timeout(1200)
        ok(await pg3.evaluate("document.documentElement.scrollWidth<=innerWidth+1"),"phone (360px): fits the screen")
        el=await pg3.query_selector(".tipjar"); await el.scroll_into_view_if_needed(); await el.screenshot(path="/tmp/tip-phone.png")
        ok(not errs, f"no script errors {errs[:2]}")
        print(f"{sum(res)}/{len(res)} donut checks passed"); await b.close()
asyncio.run(main())
