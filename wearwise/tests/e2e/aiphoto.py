# AI photo test with a FAKE Puter (no real AI is called; it returns a plain colored test image).
# Checks: the buttons, the "AI photo"/"AI impression" labels, that her own photos are never replaced, that AI photos
# are saved (in photo storage) and kept with saved outfits, and that a signed-out click asks for Puter sign-in.
import json, sys
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1].startswith('http') else 'http://localhost:8765/wearwise.html'
res = []
def ok(n, c, d=''): res.append(bool(c)); print('PASS' if c else 'FAIL', n, d)

FAKE = """
window.__calls = { img: [], signIn: 0 };
window.__signedIn = %s;
window.puter = {
  auth: { isSignedIn: async () => window.__signedIn, getUser: async () => ({ username: 'tester' }),
          signIn: async () => { window.__calls.signIn++; window.__signedIn = true; return { username: 'tester' }; }, signOut() {} },
  ai: {
    chat: async () => { throw new Error('model not found'); },
    txt2img: async (prompt, opts) => {
      window.__calls.img.push({ prompt, model: opts && opts.model, ref: !!(opts && opts.input_image) });
      await new Promise(r => setTimeout(r, 150));
      const c = document.createElement('canvas'); c.width = 400; c.height = 500; const x = c.getContext('2d');
      const d = x.createImageData(400, 500); for (let k = 0; k < d.data.length; k++) d.data[k] = (k &3) === 3 ? 255 : (Math.random() * 256) | 0; x.putImageData(d, 0, 0);
      const i = new Image(); i.src = c.toDataURL('image/png'); return i;
    },
  },
  fs: { write: async () => ({ path: 'x' }), delete: async () => {} },
};
"""

def fresh(b, signed_in=True):
    ctx = b.new_context(viewport={'width': 1280, 'height': 900})
    ctx.add_init_script(FAKE % ('true' if signed_in else 'false'))
    pg = ctx.new_page(); pg.goto(URL); pg.wait_for_timeout(400)
    pg.evaluate("() => localStorage.clear()"); pg.reload(); pg.wait_for_timeout(600)
    return ctx, pg

ADD_OWN = """() => {  // one hand-added piece with NO photo, and one with her own photo
  const s = JSON.parse(localStorage.getItem('wearwise.v1')); const me = s.activeProfile;
  const base = s.garments.find(g => g.category === 'top');
  const c = document.createElement('canvas'); c.width = c.height = 120; const x = c.getContext('2d'); x.fillStyle = '#c0392b'; x.fillRect(0,0,120,120);
  for (let i = 0; i < 40; i++) { x.fillStyle = `hsl(${i*9},70%,50%)`; x.fillRect(i*3, i*2, 30, 30); }
  s.garments.push({ ...base, id: 'mine-plain', ownerId: me, demo: false, manual: true, name: 'My Green Polo', colors: [{ name: 'green', hex: '#2e7d32' }], image: null });
  s.garments.push({ ...base, id: 'mine-photo', ownerId: me, demo: false, uploaded: true, name: 'My Red Tee', image: c.toDataURL('image/webp', 0.95) });
  localStorage.setItem('wearwise.v1', JSON.stringify(s));
}"""
GARMENT = "id => (JSON.parse(localStorage.getItem('wearwise.v1')).garments.find(g => g.id === id) || {})"

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx, pg = fresh(b)
    pg.goto(URL + '#/settings'); pg.wait_for_timeout(300)
    pg.get_by_role('button', name='Add the demo closet').click(); pg.wait_for_timeout(800)
    pg.evaluate(ADD_OWN); own_before = pg.evaluate(GARMENT, 'mine-photo')['image']; pg.reload(); pg.wait_for_timeout(1500)
    pg.goto(URL + '#/closet'); pg.wait_for_timeout(800)
    bulk = pg.locator('.ai-bulk button').first
    ok('closet offers AI photos for pieces without a photo (only hers, not demo)', bulk.count() == 1 and 'for 1 piece' in bulk.inner_text().lower(), bulk.inner_text() if bulk.count() else '')
    # Piece without a photo → make one
    pg.locator('.card-name', has_text='My Green Polo').first.click(); pg.wait_for_timeout(400)
    pg.get_by_role('button', name='✦ Make a realistic AI photo').click(); pg.wait_for_timeout(2500)
    modal = pg.locator('.modal').first
    ok('AI photo appears, labelled "AI photo"', modal.locator('img.ai-photo').count() == 1 and modal.locator('.card-flag.ai').count() == 1)
    prompt = pg.evaluate("() => window.__calls.img[0]?.prompt || ''")
    ok('prompt is built from the piece\'s own details', 'My Green Polo' in prompt and 'green' in prompt and 'no text' in prompt, prompt[:90])
    pg.wait_for_timeout(600)
    g = pg.evaluate(GARMENT, 'mine-plain')
    ok('AI photo saved separately (photo storage), own photo field untouched', str(g.get('aiImage', '')).startswith('wwphoto:') and not g.get('image'), str(g.get('aiImage'))[:30])
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # Piece WITH her photo → no AI button, photo unchanged
    pg.locator('.card-name', has_text='My Red Tee').first.click(); pg.wait_for_timeout(400)
    ok('a piece with her own photo gets no AI button', pg.get_by_role('button', name='✦ Make a realistic AI photo').count() == 0)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    ok('her own photo is never replaced', pg.evaluate(GARMENT, 'mine-photo')['image'] in (own_before,) or str(pg.evaluate(GARMENT, 'mine-photo')['image']).startswith('wwphoto:'))
    ok('closet card for the AI piece shows the "AI photo" label', pg.locator('.card', has_text='My Green Polo').locator('.card-flag.ai').count() >= 1)
    pg.reload(); pg.wait_for_timeout(1500); pg.goto(URL + '#/closet'); pg.wait_for_timeout(800)
    ok('AI photo still there after reload', pg.locator('.card', has_text='My Green Polo').locator('img.ai-photo').count() >= 1)

    # Outfit: AI impression
    pg.goto(URL + '#/create/go'); pg.wait_for_timeout(2500)
    btn = pg.get_by_role('button', name='✦ Realistic photo (AI)').first
    ok('outfit suggestions offer an AI photo', btn.count() == 1)
    btn.click(); pg.wait_for_timeout(2500)
    card = pg.locator('.ai-look').first
    note = card.locator('figcaption').inner_text() if card.count() else ''
    ok('outfit AI photo shows with "AI impression" label and an honest note', card.count() == 1 and 'ai impression' in card.inner_text().lower() and "isn't you" in note, note[:100])
    call = pg.evaluate("() => window.__calls.img.at(-1)")
    ok('outfit prompt is neck-down (never pretends to be her) and lists the pieces', 'neck down' in call['prompt'] and ';' in call['prompt'], call['prompt'][:100])
    pg.screenshot(path='/tmp/wearwise-e2e/ai-outfit.png')
    # Save it → saved outfit keeps the AI photo
    pg.locator('.outfit-card').first.locator('.heart, button[aria-label*="Save"], button:has-text("Save")').first.click(); pg.wait_for_timeout(1200)
    pg.goto(URL + '#/saved'); pg.wait_for_timeout(1000)
    ok('saved outfit keeps its AI photo, labelled', pg.locator('.saved-card .card-flag.ai').count() >= 1)
    pg.screenshot(path='/tmp/wearwise-e2e/ai-saved.png')
    ctx.close()

    # Signed out of Puter: the click asks to sign in first, then makes the photo
    ctx, pg = fresh(b, signed_in=False)
    pg.goto(URL + '#/settings'); pg.wait_for_timeout(300)
    pg.get_by_role('button', name='Add the demo closet').click(); pg.wait_for_timeout(800)
    pg.evaluate(ADD_OWN); pg.reload(); pg.wait_for_timeout(1500)
    pg.goto(URL + '#/closet'); pg.wait_for_timeout(800)
    pg.locator('.card-name', has_text='My Green Polo').first.click(); pg.wait_for_timeout(400)
    pg.get_by_role('button', name='✦ Make a realistic AI photo').click(); pg.wait_for_timeout(2500)
    ok('signed out: asks for Puter sign-in, then makes the photo', pg.evaluate("() => window.__calls.signIn") == 1 and pg.locator('.modal img.ai-photo').count() == 1)
    ctx.close()
    b.close()
print('SUMMARY', sum(res), '/', len(res))
