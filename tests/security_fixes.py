"""Security fixes: consent before third-party AI code, damaged household posts, invalid amounts, password reset, signed-out-elsewhere, restore keeps device settings."""
import sys, pathlib
from playwright.sync_api import sync_playwright
here = pathlib.Path(__file__).resolve().parent
html = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else here.parent / 'tiffo.html').resolve()
stub = "window.Chart=class{constructor(){}update(){}destroy(){}};Chart.defaults={font:{},color:''};"
fails, passes = [], 0
def check(name, ok, detail=''):
    global passes
    if ok: passes += 1
    else: fails.append(f'{name} {detail}')
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = b.new_context(timezone_id='Asia/Manila').new_page()
    pg.add_init_script(stub)
    puter_requests = []
    pg.route('**/js.puter.com/**', lambda r: (puter_requests.append(r.request.url), r.fulfill(body='', content_type='text/javascript')))
    for pat in ['**/chart.umd.min.js', '**/cdn.tailwindcss.com/**', '**/supabase-js@2**']: pg.route(pat, lambda r: r.fulfill(body='', content_type='text/javascript'))
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(html.as_uri()); pg.wait_for_timeout(700)
    pg.evaluate("() => { CURRENCY = 'PHP'; Store.state = Store.blank(); Store.state.initialBalance = 1000; Store.save(); }")

    # 1. Turning on AI: nothing from Puter loads unless you agree
    pg.evaluate("() => { UI.toggleAI(); }"); pg.wait_for_timeout(300)
    asked = pg.evaluate("!document.getElementById('confirmModal').classList.contains('hidden')")
    before = len(puter_requests)
    pg.evaluate("() => document.getElementById('confirmNo').click()"); pg.wait_for_timeout(300)
    check('AI consent asked first', asked)
    check('no Puter code loaded before or after saying no', before == 0 and len(puter_requests) == 0, str(puter_requests))
    check('AI stays off after saying no', not pg.evaluate("!!Store.state.settings.aiConsent"))

    # 2. Household posts from other accounts are checked
    bad = pg.evaluate("""() => [
      { kind: 'split', data: { desc: 'x', total: 'abc', payer: 'Ana', shares: { Me: 1 } } },
      { kind: 'split', data: { desc: 'x', total: 1000, payer: 'Ana', shares: { Me: 5000 } } },
      { kind: 'split', data: { desc: 'x', total: -50, payer: 'Ana', shares: { Me: 1 } } },
      { kind: 'split', data: { desc: 'x', total: 1e15, payer: 'Ana', shares: { Me: 1 } } },
      { kind: 'settle', data: { from: 'Ana', to: 'Me', amount: NaN } },
      { kind: 'split', data: { desc: 'x', total: 100, payer: 'Ana', shares: { Me: 50 }, date: 'not a date' } },
      { kind: 'goal', data: {} }].map(i => HHSync.valid(i))""")
    good = pg.evaluate("() => HHSync.valid({ kind: 'split', data: { desc: 'Groceries', total: 3000, payer: 'Ana', shares: { Ana: 1500, Me: 1500 }, date: '2026-11-20' } })")
    check('damaged household posts refused', not any(bad), str(bad))
    check('normal household post accepted', good)
    imported = pg.evaluate("() => { try { HHSync.importItem({ id: 'x', kind: 'split', data: { desc: 'x', total: 'abc', payer: 'Ana', shares: { Me: 1 } } }); return 'added'; } catch (e) { return 'refused'; } }")
    check('damaged post can\'t be added', imported == 'refused')

    # 3. Entries must have a real amount: totals can't be turned into NaN
    r = pg.evaluate("() => { const out = []; for (const a of [NaN, 'abc', Infinity, 1e13]) { try { Store.addTransaction({ kind: 'expense', amount: a, category: 'Food', date: '2026-11-20', description: 'x' }); out.push('saved'); } catch (e) { out.push('refused'); } } return out; }")
    check('invalid amounts refused', r == ['refused'] * 4, str(r))
    check('balance still a number', pg.evaluate("Number.isFinite(Store.balance()) && Store.balance() === 1000"))

    # 4. Password reset link → asked for a new password
    pg.evaluate("() => UI.newPasswordForm()"); pg.wait_for_timeout(50)
    check('new-password form, hidden input', pg.evaluate("document.getElementById('fm_pw')?.type === 'password'"))
    pg.evaluate("() => { document.getElementById('fm_pw').value = 'short'; document.getElementById('fm_pw2').value = 'short'; UI.submitForm(); }"); pg.wait_for_timeout(50)
    check('short password refused', pg.evaluate("!document.getElementById('formModal').classList.contains('hidden')"))
    pg.evaluate("() => UI.closeForm()")

    # 5. Signed out elsewhere: the status says so instead of "offline"
    pg.evaluate("() => { CONFIG.AUTH_PROVIDER = 'supabase'; Auth.user = { id: 'sb:u', uid: 'u', name: 'x', email: 'a@b.co', provider: 'cloud' }; Cloud.noteAuthError({ status: 401, message: 'JWT expired' }); Cloud.setStatus('error'); }")
    check('signed-out status shown', 'Signed out of the cloud' in pg.evaluate("Cloud.label()"))
    pg.evaluate("() => { Cloud.authLost = false; Cloud.noteAuthError(new Error('Failed to fetch')); }")
    check('a network error is still just "offline"', 'Offline' in pg.evaluate("Cloud.label()"))
    pg.evaluate("() => { Auth.user = null; Cloud.authLost = false; }")
    b.close()
for f in fails: print('✗', f)
if errs: print('page errors:', errs[:3])
print(f'{passes}/{passes + len(fails)} security-fix checks passed')
sys.exit(1 if fails or errs else 0)
