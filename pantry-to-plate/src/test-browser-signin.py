import asyncio, json
from playwright.async_api import async_playwright
URL="http://127.0.0.1:8765/index.html"
res=[]
def ok(c,m): res.append(bool(c)); print(("  ✓ " if c else "  ✗ ")+m)
# Stand-in Puter: sign-in state + per-app key-value store kept in this browser's localStorage ("the cloud")
STUB="""(()=>{const L=localStorage;const kvGet=k=>{const v=L.getItem('__kv:'+k);return v==null?null:JSON.parse(v)};
window.__signins=0;
window.puter={auth:{isSignedIn:async()=>L.getItem('__puterIn')==='1',signIn:async()=>{window.__signins++;await new Promise(r=>setTimeout(r,150));L.setItem('__puterIn','1')},signOut:()=>L.removeItem('__puterIn'),getUser:async()=>({uuid:'u-123',username:'tiffany'})},
 kv:{MAX_VALUE_SIZE:%d,get:async k=>kvGet(k),set:async(k,v)=>{L.setItem('__kv:'+k,JSON.stringify(v));return true}},
 ai:{chat:async()=>({message:{content:'{"recipes":[]}'}})}};})();"""
async def ctx_with(b, cloud=None, signed=False, maxv=400000, w=1300):
    ctx=await b.new_context(viewport={"width":w,"height":900})
    seed=""
    if cloud: seed+="".join(f"localStorage.getItem('__seeded')||localStorage.setItem({json.dumps(k)},{json.dumps(v)});" for k,v in cloud.items())
    if signed: seed+="localStorage.getItem('__seeded')||localStorage.setItem('__puterIn','1');"
    seed+="localStorage.setItem('__seeded','1');"
    await ctx.add_init_script(seed+(STUB%maxv))
    return ctx
async def settle(pg, js, ms=4000):
    for _ in range(ms//200):
        if await pg.evaluate(js): return True
        await pg.wait_for_timeout(200)
    return False
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch()
    ctx=await ctx_with(b); pg=await ctx.new_page(); errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    reports=[]
    async def fb(route):
        reports.append(json.loads(route.request.post_data)); await route.fulfill(status=201, body="")
    await ctx.route("**/rest/v1/pantry_feedback", fb)
    print("\nSigned out")
    await pg.goto(URL+"#home"); await pg.wait_for_timeout(1500)
    ok(await pg.inner_text("#acctBtn")=="Sign in" and await pg.inner_text("#aiStatus")=="AI · connect", "header shows 'Sign in' and 'AI · connect'")
    await pg.click("#acctBtn"); await pg.wait_for_timeout(200)
    t=await pg.inner_text("#authBox")
    ok("Sign in with Puter" in t and "Saves your kitchen" in t and "Turns on the free AI" in t and "password" not in t.lower(), "one sign-in dialog: saves kitchen + turns on AI, no email/password form")
    print("\nOne sign-in")
    await pg.click("#authBox [data-act=puter-connect]"); await pg.wait_for_timeout(900)
    ok(await pg.evaluate("window.__signins")==1, "one click → exactly one Puter sign-in")
    ok(await pg.inner_text("#acctBtn")=="TAccount" or "Account" in await pg.inner_text("#acctBtn"), "header now shows Account")
    ok("connected" in await pg.inner_text("#aiStatus"), f"AI badge turned on by the same sign-in: '{await pg.inner_text('#aiStatus')}'")
    cloud=await pg.evaluate("Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('__kv:')).map(k=>[k,localStorage.getItem(k)]))")
    ok("__kv:p2p.kitchen" in cloud, "kitchen saved to the person's own Puter storage")
    await pg.click("#acctBtn"); await pg.wait_for_timeout(200); t=await pg.inner_text("#authBox")
    ok("tiffany" in t and "Synced" in t, "account dialog: signed in as tiffany · Synced"); await pg.click("#authBox [data-act=auth-close]")
    print("\nChanges sync, refresh stays signed in")
    await pg.evaluate("location.hash='#kitchen'"); await pg.wait_for_timeout(300)
    await pg.fill("#qaText","5 mangoes"); await pg.press("#qaText","Enter"); await pg.wait_for_timeout(1800)
    k=await pg.evaluate("JSON.parse(localStorage.getItem('__kv:p2p.kitchen'))")
    ok(any(x["key"]=="mango" for x in k["pantry"]), "adding mangoes saves them to the account within ~1 second")
    await pg.wait_for_timeout(400); await pg.close(); pg=await ctx.new_page(); pg.on("pageerror",lambda e:errs.append(str(e))); await pg.goto(URL+"#kitchen"); await pg.wait_for_timeout(1500)
    good=await settle(pg,"document.querySelector('#acctBtn').innerText.includes('Account') && document.querySelector('#aiStatus').innerText.includes('connected')")
    ok(good, "after refresh: still signed in, AI still on (no second sign-in)" + ("" if good else f" — saw {await pg.inner_text('#acctBtn')!r} / {await pg.inner_text('#aiStatus')!r}"))
    ok(await pg.evaluate("window.__signins")==0, "no sign-in window on refresh")
    print("\nAnother device")
    cloud=await pg.evaluate("Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('__kv:')).map(k=>[k,localStorage.getItem(k)]))")
    ctx2=await ctx_with(b,cloud=cloud,signed=False); pg2=await ctx2.new_page(); pg2.on("pageerror",lambda e:errs.append(str(e)))
    await pg2.goto(URL+"#kitchen"); await pg2.wait_for_timeout(1300)
    await pg2.click("#kitchenWelcome [data-act=clear-sample]"); await pg2.click("[data-act=clear-sample-yes]"); await pg2.wait_for_timeout(200)
    await pg2.fill("#qaText","2 lemons"); await pg2.press("#qaText","Enter"); await pg2.wait_for_timeout(300)
    await pg2.click("#acctBtn"); await pg2.click("#authBox [data-act=puter-connect]")
    await settle(pg2,"!!document.querySelector('[data-act=merge-yes]') || [...document.querySelectorAll('.item .name')].some(n=>/Mango/.test(n.textContent))")
    names=await pg2.eval_on_selector_all(".item .name","e=>e.map(x=>x.textContent)")
    ok(any("Mango" in n for n in names), "signing in on a 2nd device brings the account's kitchen (mangoes)")
    ok(await pg2.is_visible("[data-act=merge-yes]"), "and asks before adding this device's own food (lemons) — nothing merged silently")
    await pg2.click("[data-act=merge-yes]"); await pg2.wait_for_timeout(1700)
    k=await pg2.evaluate("JSON.parse(localStorage.getItem('__kv:p2p.kitchen'))")
    ok(any(x["key"]=="lemon" for x in k["pantry"]) and any(x["key"]=="mango" for x in k["pantry"]), "after 'yes': both mangoes and lemons saved to the account")
    print("\nBig kitchens are split safely")
    ctx3=await ctx_with(b,signed=True,maxv=24000); pg3=await ctx3.new_page(); pg3.on("pageerror",lambda e:errs.append(str(e)))
    await pg3.goto(URL+"#kitchen"); await pg3.wait_for_timeout(1500)
    items=", ".join(f"{i+1} item{i}" for i in range(150))
    await pg3.fill("#qaText",items[:3000]); await pg3.press("#qaText","Enter"); await pg3.wait_for_timeout(400)
    if await pg3.is_visible("#reviewForm"): await pg3.click("#reviewForm button[type=submit]")
    await pg3.wait_for_timeout(1800)
    head=await pg3.evaluate("JSON.parse(localStorage.getItem('__kv:p2p.kitchen'))")
    ok(head.get("parts",0)>=2, f"kitchen bigger than one storage entry → split into {head.get('parts')} parts")
    before=await pg3.evaluate("JSON.parse(localStorage.getItem('p2p.v3')).pantry.length")
    await pg3.evaluate("localStorage.removeItem('p2p.v3')"); await pg3.wait_for_timeout(400); await pg3.close(); pg3=await ctx3.new_page(); await pg3.goto(URL+"#kitchen"); await pg3.wait_for_timeout(1800)
    await settle(pg3, "JSON.parse(localStorage.getItem('p2p.v3')||'{\"pantry\":[]}').pantry.length>50", 8000)
    after=await pg3.evaluate("JSON.parse(localStorage.getItem('p2p.v3')||'{\"pantry\":[]}').pantry.length")
    if after!=before: print("     debug:", await pg3.evaluate("[localStorage.getItem('__puterIn'), !!localStorage.getItem('__kv:p2p.kitchen'), Object.keys(localStorage).filter(k=>k.startsWith('__kv')).length]"), await pg3.inner_text("#acctBtn"))
    ok(after==before and after>50, f"…and read back whole from the account ({after} items)")
    print("\nSign out, feedback without an account")
    await pg.click("#acctBtn"); await pg.click("#authBox [data-act=sign-out]"); await pg.wait_for_timeout(500)
    ok(await pg.inner_text("#acctBtn")=="Sign in" and await pg.inner_text("#aiStatus")=="AI · connect", "sign out → 'Sign in' and AI back to 'connect'")
    await pg.evaluate("location.hash='#cook'"); await pg.wait_for_timeout(400); await pg.click(".pick >> nth=0"); await pg.wait_for_timeout(300)
    await pg.click("#detail [data-act=feedback]"); await pg.wait_for_timeout(250); await pg.click("label.fb-amounts"); await pg.fill("#fbNote","needed more water"); await pg.click("#feedbackForm button[type=submit]"); await pg.wait_for_timeout(500)
    ok(len(reports)==1 and reports[0]["reason"]=="The quantities were wrong" and "user_id" not in reports[0], f"report sent without an account: {reports[:1]}")
    print("\nAI asks for the same sign-in")
    await pg.click("[data-act=ai-more]"); await pg.wait_for_timeout(400)
    ok("Sign in with Puter" in await pg.inner_text("#authBox"), "asking for AI ideas opens the same single sign-in")
    ok(not errs, f"no script errors {errs[:3]}")
    print(f"\n{sum(res)}/{len(res)} sign-in checks passed")
    await b.close()
asyncio.run(main())
