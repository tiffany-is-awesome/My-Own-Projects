# "How to use" tour: every step points at a real, visible button; the card stays on screen; Back/Esc work;
# "Your turn!" does the thing; "New here?" disappears once the tour was opened. Desktop and phone.
import sys
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1].startswith('http') else 'http://localhost:8765/wearwise.html'
res = []
def ok(n, c, d=''): res.append(bool(c)); print('PASS' if c else 'FAIL', n, d)
STATE = """() => { const t = document.querySelector('.tour-tip'), s = document.querySelector('.tour-spot');
  if (!t) return null; const r = t.getBoundingClientRect(), q = s.getBoundingClientRect();
  return { title: t.querySelector('.tour-title').textContent, count: t.querySelector('.tour-count').textContent,
    tipOnScreen: r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1,
    spot: q.width > 4 ? [Math.round(q.left), Math.round(q.top), Math.round(q.width), Math.round(q.height)] : null,
    spotOnScreen: q.width <= 4 || (q.top >= -8 && q.bottom <= innerHeight + 8), overlap: !(r.bottom <= q.top || r.top >= q.bottom || r.right <= q.left || r.left >= q.right) && q.width > 4 }; }"""
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    for name, vp, mob in [('desktop', {'width': 1280, 'height': 860}, False), ('phone', {'width': 390, 'height': 844}, True)]:
        c = b.new_context(viewport=vp, is_mobile=mob, has_touch=mob); pg = c.new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:150]))
        pg.goto(URL); pg.wait_for_timeout(400); pg.evaluate("() => { localStorage.clear(); localStorage.setItem('wearwise.autoDemoPhotos', 'off'); }"); pg.reload(); pg.wait_for_timeout(700)
        ok(f'{name}: first visit shows "New here?"', pg.get_by_role('button', name='New here? Take the 1-minute tour →').count() == 1)
        pg.goto(URL + '#/settings'); pg.wait_for_timeout(300); pg.get_by_role('button', name='Add the demo closet').click(); pg.wait_for_timeout(500)
        pg.goto(URL + '#/home'); pg.wait_for_timeout(600)
        pg.get_by_role('button', name='New here? Take the 1-minute tour →').click(); pg.wait_for_timeout(500)
        seen, bad = [], []
        for k in range(20):
            s = pg.evaluate(STATE)
            if not s: break
            seen.append(s['title'])
            if not s['tipOnScreen'] or not s['spotOnScreen'] or s['overlap']: bad.append((s['count'], s['title'], s))
            if k in (2, 5, 9): pg.screenshot(path=f'/tmp/wearwise-e2e/tour-{name}-{k+1}.png')
            if k == 3:  # Back works
                pg.get_by_role('button', name='Back').click(); pg.wait_for_timeout(450)
                back = pg.evaluate(STATE)['title']; pg.locator('.tour-tip .btn.accent').click(); pg.wait_for_timeout(450)
                ok(f'{name}: Back goes to the previous step', back == seen[2], back)
            last = 'Your turn' in s['title']
            pg.locator('.tour-tip .btn.accent').click(); pg.wait_for_timeout(2500 if last else 500)
            if last: break
        spots = [t for t in seen]
        ok(f'{name}: walks through all 13 steps', len(seen) == 13, ' / '.join(seen))
        ok(f'{name}: card and highlight always on screen, card never covers the highlighted button', not bad, str(bad[:2]))
        ok(f'{name}: "Your turn!" did the thing (outfits created)', pg.locator('.outfit-card').count() >= 1 and pg.locator('.tour-tip').count() == 0)
        pg.goto(URL + '#/home'); pg.wait_for_timeout(500)
        ok(f'{name}: "New here?" gone after the tour', pg.get_by_role('button', name='New here? Take the 1-minute tour →').count() == 0)
        # reopen from More / Settings, Esc closes
        if mob: pg.goto(URL + '#/more'); pg.wait_for_timeout(400); pg.get_by_role('button', name='How to use Wearwise').click()
        else: pg.goto(URL + '#/settings'); pg.wait_for_timeout(400); pg.get_by_role('button', name='How to use Wearwise').click()
        pg.wait_for_timeout(500)
        opened = pg.locator('.tour-tip').count() == 1
        pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
        ok(f'{name}: reopens from {"More" if mob else "Settings"}; Esc closes', opened and pg.locator('.tour').count() == 0)
        ok(f'{name}: no page errors', not errs, str(errs))
        c.close()
    # empty closet: last step opens "Add clothes"
    c = b.new_context(viewport={'width': 1280, 'height': 860}); pg = c.new_page()
    pg.goto(URL); pg.wait_for_timeout(400); pg.evaluate("() => localStorage.clear()"); pg.reload(); pg.wait_for_timeout(600)
    pg.locator('.footer').get_by_role('button', name='How to use').click(); pg.wait_for_timeout(400)
    for k in range(13): pg.locator('.tour-tip .btn.accent').click(); pg.wait_for_timeout(350)
    ok('empty closet: "Your turn!" opens Add clothes', pg.locator('.modal').count() == 1 and pg.locator('.tour').count() == 0)
    b.close()
print('SUMMARY', sum(res), '/', len(res))
