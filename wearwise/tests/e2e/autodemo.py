# Automatic realistic demo photos + Undo, with a FAKE Puter (no real AI is called).
import sys
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1].startswith('http') else 'http://localhost:8765/wearwise.html'
res = []
def ok(n, c, d=''): res.append(bool(c)); print('PASS' if c else 'FAIL', n, d)
FAKE = """
window.__n = 0; window.__signedIn = %s; window.__limitAfter = %d;
window.puter = {
  auth: { isSignedIn: async () => window.__signedIn, getUser: async () => ({ username: 'tester' }),
          signIn: async () => { window.__signedIn = true; return { username: 'tester' }; }, signOut() {} },
  ai: { chat: async () => { throw new Error('model not found'); },
        txt2img: async () => {
          if (window.__limitAfter >= 0 && window.__n >= window.__limitAfter) throw { error: { code: 'insufficient_funds', message: 'insufficient funds' } };
          window.__n++; await new Promise(r => setTimeout(r, 60));
          const c = document.createElement('canvas'); c.width = 200; c.height = 250; const x = c.getContext('2d');
          const d = x.createImageData(200, 250); for (let k = 0; k < d.data.length; k++) d.data[k] = (k & 3) === 3 ? 255 : (Math.random() * 256) | 0; x.putImageData(d, 0, 0);
          const i = new Image(); i.src = c.toDataURL('image/png'); return i; } },
};
"""
COUNT = "() => { const g = JSON.parse(localStorage.getItem('wearwise.v1')).garments.filter(g => g.demo); return { demo: g.length, ai: g.filter(x => x.aiImage).length }; }"
def fresh(b, signed, limit=-1):
    c = b.new_context(viewport={'width': 1280, 'height': 900}); c.add_init_script(FAKE % ('true' if signed else 'false', limit))
    pg = c.new_page(); pg.goto(URL); pg.wait_for_timeout(400); pg.evaluate("() => localStorage.clear()"); pg.reload(); pg.wait_for_timeout(500)
    pg.goto(URL + '#/settings'); pg.wait_for_timeout(300); pg.get_by_role('button', name='Add the demo closet').click(); pg.wait_for_timeout(500)
    return c, pg

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    # Signed out: drawings + note, nothing generated
    c, pg = fresh(b, False)
    pg.goto(URL + '#/closet'); pg.wait_for_timeout(1500)
    note = pg.locator('.demo-banner').inner_text()
    ok('signed out: note says demo pieces are drawings until you sign in to AI', 'drawings' in note and 'Turn on AI' in note, note[:160])
    ok('signed out: no photos made', pg.evaluate("() => window.__n") == 0)
    pg.locator('.demo-banner .linklike').click(); pg.wait_for_timeout(1500)
    ok('after signing in, photos start by themselves', pg.locator('.auto-pill').count() == 1 or pg.evaluate("() => window.__n") > 0)
    pg.wait_for_timeout(9000)
    n = pg.evaluate(COUNT)
    ok('all demo pieces get a realistic photo (labelled AI)', n['ai'] == n['demo'] and pg.locator('.card-flag.ai').count() > 5, f"{n}")
    ok('progress pill gone when finished, note updated', pg.locator('.auto-pill').count() == 0 and 'AI-made sample photos' in pg.locator('.demo-banner').inner_text())
    made = pg.evaluate("() => window.__n")
    pg.reload(); pg.wait_for_timeout(3000)
    ok('made once: nothing is made again on the next visit', pg.evaluate("() => window.__n") == 0, f'{made} made the first time')
    # Undo
    pg.goto(URL + '#/saved'); pg.wait_for_timeout(600)
    before = pg.locator('.saved-card').count()
    pg.locator('.saved-card').first.get_by_role('button', name='Delete').click(); pg.locator('.saved-card').first.get_by_role('button', name='Click to delete').click(); pg.wait_for_timeout(300)
    after = pg.locator('.saved-card').count()
    pg.get_by_role('button', name='Undo').click(); pg.wait_for_timeout(400)
    ok('Undo brings a deleted outfit back', after == before - 1 and pg.locator('.saved-card').count() == before, f'{before} → {after} → {pg.locator(".saved-card").count()}')
    c.close()
    # Signed in from the start, allowance runs out after 5, then Stop / switched off
    c, pg = fresh(b, True, 5)
    pg.goto(URL + '#/closet'); pg.wait_for_timeout(5000)
    n = pg.evaluate(COUNT); note = pg.locator('.demo-banner').inner_text()
    ok('allowance runs out: stops, keeps the 5 made, says so honestly', n['ai'] == 5 and 'allowance ran out' in note, f"{n} | {note[-120:]}")
    c.close()
    c, pg = fresh(b, True)
    pg.goto(URL + '#/closet'); pg.wait_for_timeout(700)
    pg.get_by_role('button', name='Stop').click(); pg.wait_for_timeout(1500)
    k = pg.evaluate("() => window.__n"); pg.wait_for_timeout(1500)
    ok('Stop stops it', pg.evaluate("() => window.__n") <= k + 1 and pg.evaluate(COUNT)['ai'] < pg.evaluate(COUNT)['demo'])
    c.close()
    c, pg = fresh(b, False)
    pg.goto(URL + '#/settings'); pg.wait_for_timeout(400)
    pg.get_by_label('Make realistic photos for the demo pieces').uncheck()
    pg.evaluate("() => { window.__signedIn = true; }"); pg.reload(); pg.wait_for_timeout(3000)
    ok('switched off in Settings: nothing is made', pg.evaluate("() => window.__n") == 0)
    c.close(); b.close()
print('SUMMARY', sum(res), '/', len(res))
