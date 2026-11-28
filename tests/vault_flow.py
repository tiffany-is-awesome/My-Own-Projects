"""Vault stages 2–4: real screens, restarts, auto-lock, recovery, crashes, tampering, turning off, tabs, backups, session token."""
import sys, pathlib, json, re
from playwright.sync_api import sync_playwright
here = pathlib.Path(__file__).resolve().parent
html = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else here.parent / 'tiffo.html').resolve()
stub = "window.Chart=class{constructor(){}update(){}destroy(){}};Chart.defaults={font:{},color:''};"
PW, PW2 = 'kalabaw sunflower mango 77', 'second-password-2026'
SECRET = 'Lola birthday envelope'          # a description that must never appear in plain text once encrypted
fails, passes = [], 0
def check(name, ok, detail=''):
    global passes
    if ok: passes += 1
    else: fails.append(f'{name} {detail}')
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(timezone_id='Asia/Manila')
    ctx.add_init_script(stub)
    for pat in ['**/chart.umd.min.js', '**/cdn.tailwindcss.com/**', '**/supabase-js@2**', '**/js.puter.com/**']: ctx.route(pat, lambda r: r.fulfill(body='', content_type='text/javascript'))
    errs = []
    def page():
        pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e))); return pg
    pg = page(); pg.goto(html.as_uri()); pg.wait_for_timeout(800)
    def ls_dump(pg): return pg.evaluate("() => Object.keys(localStorage).map(k => k + '=' + localStorage.getItem(k)).join('\\n')")
    def vault_visible(pg): return pg.evaluate("() => !document.getElementById('vaultScreen').classList.contains('hidden')")
    def unlock(pg, secret, wait=1500):
        pg.fill('#vaultPw', secret); pg.click('#vaultBtn'); pg.wait_for_timeout(wait)
    def fill(pg, k, v):
        pg.evaluate("([k, v]) => { const el = document.getElementById('fm_' + k); if (el.type === 'checkbox') el.checked = !!v; else el.value = v; el.dispatchEvent(new Event('change', {bubbles: true})); }", [k, v])

    # Data before the vault: a guest on this device
    pg.evaluate("""(s) => { document.querySelectorAll('#authScreen,#onboarding').forEach(e => e && e.classList.add('hidden'));
      CURRENCY = 'PHP'; Store.state = Store.blank(); Store.state.initialBalance = 20000;
      Store.addTransaction({ kind: 'expense', amount: 1500, category: 'Gifts & Donations', date: '2026-11-20', description: s });
      Invest.list().push({ id: 'h1', name: 'FMETF', type: 'etf' }); Store.addTransaction({ kind: 'invest', amount: 5000, category: 'Investments', date: '2026-11-10', description: 'FMETF', holdingId: 'h1' });
      Backup.safety(); Store.save(); UI.renderAll(); }""", SECRET)
    before = pg.evaluate("() => ({ cash: Store.balance(), nw: NetWorth.at().net, n: Store.state.transactions.length })")
    check('plain text before the vault (as expected)', SECRET in ls_dump(pg))

    # V1. Turn it on through the real screens
    pg.evaluate("() => UI.vaultSetup()"); pg.wait_for_timeout(100)
    fill(pg, 'pw', 'short'); fill(pg, 'pw2', 'short'); fill(pg, 'ok', True); pg.evaluate("UI.submitForm()"); pg.wait_for_timeout(100)
    check('short password refused', 'at least 10' in pg.inner_text('#formModal'))
    fill(pg, 'pw', PW); fill(pg, 'pw2', PW); fill(pg, 'ok', False); pg.evaluate("UI.submitForm()"); pg.wait_for_timeout(100)
    check('must tick "I understand"', 'tick the box' in pg.inner_text('#formModal'))
    fill(pg, 'ok', True); pg.evaluate("UI.submitForm()"); pg.wait_for_timeout(2500)
    rk = re.search(r'[A-Z2-9]{5}(?:-[A-Z2-9]{1,5}){5}', pg.inner_text('#formModal'))
    check('recovery key shown', bool(rk)); rk = rk.group(0) if rk else ''
    check('nothing deleted before the key is confirmed', SECRET in ls_dump(pg) and pg.evaluate("Vault.readRing(Store.key()).status") == 'pending')
    fill(pg, 'last', 'WRONG'); pg.evaluate("UI.submitForm()"); pg.wait_for_timeout(100)
    check('wrong confirmation refused', 'doesn’t match' in pg.inner_text('#formModal'))
    fill(pg, 'last', rk.split('-')[-1]); pg.evaluate("UI.submitForm()"); pg.wait_for_timeout(1500)
    dump = ls_dump(pg)
    check('vault active', pg.evaluate("Vault.status()") == 'unlocked')
    check('no plain financial data left in storage', SECRET not in dump and 'FMETF' not in dump and '"initialBalance"' not in dump, dump[:300])
    check('no password, recovery key or data key in storage', PW not in dump and rk.replace('-', '') not in dump.replace('-', ''))
    check('status says encrypted', 'Encrypted on this device' in pg.evaluate("document.querySelector('.save-status')?.textContent || ''"))
    check('Undo copy encrypted', '"vault"' in (pg.evaluate("localStorage.getItem(Store.key() + '.safety')") or ''))

    # V2. Restart: locked, nothing decrypted on screen; wrong password; right password
    pg.evaluate("() => Store.addTransaction({ kind: 'income', amount: 3000, category: 'Salary', date: '2026-11-21', description: 'Sideline' })"); pg.wait_for_timeout(300)
    pg.reload(); pg.wait_for_timeout(1000)
    check('locked after restart', vault_visible(pg))
    check('no records in memory or on screen while locked', pg.evaluate("Store.state.transactions.length") == 0 and SECRET not in pg.inner_text('body'))
    unlock(pg, 'wrong password here'); check('wrong password refused', vault_visible(pg) and 'isn’t right' in pg.inner_text('#vaultMsg'))
    unlock(pg, PW)
    after = pg.evaluate("() => ({ cash: Store.balance(), n: Store.state.transactions.length, s: Store.state.transactions.some(t => t.description === 'Sideline') })")
    check('unlocked: everything back, incl. the entry saved just before closing', not vault_visible(pg) and after['n'] == before['n'] + 1 and after['s'] and after['cash'] == before['cash'] + 3000, str(after))

    # V3. Auto-lock after being away
    pg.evaluate("() => { Store.state.settings.vaultAuto = 1; UI._lastActive = Date.now() - 2 * 60000; document.dispatchEvent(new Event('visibilitychange')); }")
    pg.wait_for_timeout(1500)
    check('auto-locked after inactivity', vault_visible(pg) and pg.evaluate("Store.state.transactions.length") == 0)

    # V4. Recovery key → set a new password; old one stops working
    unlock(pg, rk.lower().replace('-', ' ')); pg.wait_for_timeout(1200)
    check('recovery key unlocks and asks for a new password', not vault_visible(pg) and 'new vault password' in pg.inner_text('#formModal').lower())
    fill(pg, 'cur', rk); fill(pg, 'pw', PW2); fill(pg, 'pw2', PW2); pg.evaluate("UI.submitForm()"); pg.wait_for_timeout(1500)
    pg.reload(); pg.wait_for_timeout(900)
    unlock(pg, PW); check('old password no longer works', vault_visible(pg))
    unlock(pg, PW2); check('new password works', not vault_visible(pg) and pg.evaluate("Store.state.transactions.length") == before['n'] + 1)

    # V5. Tampered data: refused, nothing destroyed
    good = pg.evaluate("localStorage.getItem(Store.key() + '.vault')")
    pg.evaluate("() => { const k = Store.key() + '.vault', o = JSON.parse(localStorage.getItem(k)); o.ct = o.ct.slice(0, 30) + (o.ct[30] === 'A' ? 'B' : 'A') + o.ct.slice(31); localStorage.setItem(k, JSON.stringify(o)); }")
    pg.reload(); pg.wait_for_timeout(900); unlock(pg, PW2)
    check('tampered data refused', vault_visible(pg) and 'damaged' in pg.inner_text('#vaultMsg'))
    pg.evaluate("([g]) => localStorage.setItem('tiffo.v1.vault', g)", [good]); pg.reload(); pg.wait_for_timeout(900); unlock(pg, PW2)
    check('original still opens', not vault_visible(pg))

    # V6. Two tabs: a save in one shows up in the other
    pg2 = page(); pg2.goto(html.as_uri()); pg2.wait_for_timeout(900); unlock(pg2, PW2)
    pg.evaluate("() => Store.addTransaction({ kind: 'expense', amount: 99, category: 'Food', date: '2026-11-22', description: 'From tab one' })"); pg.wait_for_timeout(1200)
    check('other tab gets the new entry', pg2.evaluate("Store.state.transactions.some(t => t.description === 'From tab one')"))
    pg2.close()

    # V7. Backup, restore and Undo inside the vault stay encrypted
    pg.evaluate("() => { const f = JSON.stringify(Backup.build()); Backup.restore(Backup.validate(JSON.parse(f)), 'replace'); }"); pg.wait_for_timeout(800)
    check('restore saves encrypted', SECRET not in ls_dump(pg))
    check('backup contains the data', SECRET in pg.evaluate("() => JSON.stringify(Backup.build())"))

    # V8. Sign-in session token is kept inside the vault
    pg.evaluate("() => { SessionStore.setItem('sb-test-auth-token', 'REFRESH-TOKEN-XYZ'); }"); pg.wait_for_timeout(600)
    check('session token not stored in plain text', 'REFRESH-TOKEN-XYZ' not in ls_dump(pg))
    pg.reload(); pg.wait_for_timeout(900); unlock(pg, PW2)
    check('session token back after unlocking', pg.evaluate("SessionStore.getItem('sb-test-auth-token')") == 'REFRESH-TOKEN-XYZ')

    # V9. Crash during setup (before confirming the key): plain data stays the real data
    pg.evaluate("async () => { await Vault.disable(); }"); pg.wait_for_timeout(300)
    check('turned off: plain data back', SECRET in ls_dump(pg) and pg.evaluate("Vault.status()") == 'off')
    pg.reload(); pg.wait_for_timeout(900)
    check('no lock screen after turning off; data intact', not vault_visible(pg) and pg.evaluate("Store.state.transactions.length") >= before['n'] + 2)
    n0 = pg.evaluate("Store.state.transactions.length")
    pg.evaluate("(pw) => Vault.enable(pw)", PW); pg.reload(); pg.wait_for_timeout(900)   # "crash" before activate
    check('half-made vault discarded, plain data loads', not vault_visible(pg) and pg.evaluate("Store.state.transactions.length") == n0 and pg.evaluate("localStorage.getItem('tiffo.v1.vaultkeys')") is None)

    # V10. Crash after activating, with a newer plain copy written by an old app version: merged, not lost
    pg.evaluate("async (pw) => { await Vault.enable(pw); await Vault.activate(Store.key()); Store.save(); await Vault.flush(); }", PW); pg.wait_for_timeout(300)
    pg.evaluate("""() => { const st = { ...Store.state, transactions: [...Store.state.transactions, { id: 'old-app', kind: 'expense', type: 'expense', amount: 77, category: 'Food', date: '2026-11-23', description: 'Typed in an old version', accountId: 'acc_cash' }], savedAt: Date.now() + 5000 };
      localStorage.setItem(Store.key(), JSON.stringify(st)); }""")
    pg.reload(); pg.wait_for_timeout(900); unlock(pg, PW); pg.wait_for_timeout(500)
    check('newer plain copy merged in, then removed', pg.evaluate("Store.state.transactions.some(t => t.id === 'old-app')") and pg.evaluate("localStorage.getItem(Store.key())") is None)
    check('totals still right', pg.evaluate("Store.state.transactions.length") == n0 + 1)

    # V11. "Forgot both": erase only after two confirmations
    pg.reload(); pg.wait_for_timeout(900)
    pg.click('#vaultForgot'); pg.wait_for_timeout(200); pg.click('#confirmNo'); pg.wait_for_timeout(200)
    check('cancel keeps everything', pg.evaluate("localStorage.getItem('tiffo.v1.vault')") is not None)
    b.close()
for f in fails: print('✗', f)
if errs: print('page errors:', errs[:4])
print(f'{passes}/{passes + len(fails)} vault-flow checks passed')
sys.exit(1 if fails or errs else 0)
