"""Vault stage 4: end-to-end encrypted cloud sync across devices (each device = its own browser storage).
The fake server copies the real database's rules: conditional writes and the vault guard trigger."""
import sys, pathlib, json, datetime
from playwright.sync_api import sync_playwright
here = pathlib.Path(__file__).resolve().parent
html = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else here.parent / 'tiffo.html').resolve()
stub = "window.Chart=class{constructor(){}update(){}destroy(){}};Chart.defaults={font:{},color:''};"
row = {'r': None}; refused = []
def guard(old, new):   # same rule as supabase/vault-guard.sql
    return not ('vault' in (old or {}) and 'vault' not in new and str(new.get('vaultOff')).lower() != 'true')
def srv(op, payload):
    if op == 'get': return json.loads(json.dumps(row['r'])) if row['r'] else None
    if op == 'insert':
        if row['r']: return {'error': 'duplicate key 23505'}
        row['r'] = {'data': payload['data'], 'updated_at': payload['updated_at']}; return {'n': 1}
    if op == 'update':
        if not row['r'] or (payload.get('expect') and row['r']['updated_at'] != payload['expect']): return {'n': 0}
        if not guard(row['r']['data'], payload['data']): refused.append(1); return {'error': 'This Tiffo account is encrypted; refusing to replace it with unencrypted data.'}
        row['r'] = {'data': payload['data'], 'updated_at': payload['updated_at']}; return {'n': 1}
FAKE = r"""() => {
  const q = () => { let op = 'get', payload = null, expect = null;
    const o = { select() { return o; }, eq(k, v) { if (k === 'updated_at') expect = v; return o; },
      insert(p) { op = 'insert'; payload = p; return o; }, update(p) { op = 'update'; payload = p; return o; },
      maybeSingle() { return window.srv('get', null).then((d) => ({ data: d, error: null })); },
      then(a, b) { const p = op === 'insert' ? window.srv('insert', payload) : window.srv('update', { ...payload, expect });
        return p.then((r) => r.error ? { data: null, error: { message: r.error } } : { data: r.n ? [{ user_id: 'u1' }] : [], error: null }).then(a, b); } };
    return o; };
  Auth.sb = { from: q, auth: { onAuthStateChange() {} } }; CONFIG.AUTH_PROVIDER = 'supabase';
  Auth.user = { id: 'sb:u1', uid: 'u1', name: 'x', email: 'a@b.co', provider: 'cloud' };
  Cloud.schedule = () => {}; UI.vaultCloudPrompt = () => {};
  CURRENCY = 'PHP'; Store.state = Store.blank(); Store.state.initialBalance = 10000; Store.saveLocal();
}"""
PW = 'mango kalabaw sunflower 9'
fails, passes = [], 0
def check(name, ok, detail=''):
    global passes
    if ok: passes += 1
    else: fails.append(f'{name} {detail}')
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    errs = []
    def device():
        ctx = b.new_context(timezone_id='Asia/Manila'); ctx.add_init_script(stub)
        for pat in ['**/chart.umd.min.js', '**/cdn.tailwindcss.com/**', '**/supabase-js@2**', '**/js.puter.com/**']: ctx.route(pat, lambda r: r.fulfill(body='', content_type='text/javascript'))
        pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e))); pg.expose_function('srv', srv)
        pg.goto(html.as_uri()); pg.wait_for_timeout(700); pg.evaluate(FAKE); return pg
    def add(pg, d, a=100): pg.evaluate("([d, a]) => Store.addTransaction({ kind: 'expense', amount: a, category: 'Food', date: '2026-11-20', description: d })", [d, a])
    def descs(pg): return sorted(pg.evaluate("Store.state.transactions.map(t => t.description)"))
    def sync(pg): return pg.evaluate("async () => { try { await Cloud.sync(); return 'ok'; } catch (e) { return e.vault ? 'vault' : 'error: ' + e.message; } }")
    def cloud_text(): return json.dumps(row['r'])
    def vault_on(pg, pw=PW): return pg.evaluate("async (pw) => { const rk = await Vault.enable(pw); await Vault.activate(Store.key()); Store.save(); await Vault.flush(); return rk; }", pw)

    A = device(); add(A, 'Groceries SM'); sync(A)
    check('cloud starts unencrypted (as before)', 'Groceries SM' in cloud_text())
    rkA = vault_on(A); r = sync(A)
    check('A: cloud copy now encrypted', r == 'ok' and row['r']['data'].get('vault') == 1 and 'Groceries SM' not in cloud_text(), r)
    check('cloud holds only ciphertext + wrapped keys', set(row['r']['data'].keys()) == {'vault', 'kid', 'iv', 'ct', 'keys', 'savedAt'} and PW not in cloud_text())

    # B: another device with its own unencrypted entries
    B = device(); add(B, 'Jeep fare', 13)
    check('B can\'t read the encrypted cloud copy without the password', sync(B) == 'vault' and pg_is(B) if False else sync(B) == 'vault')
    check('B didn\'t overwrite it with plain text', row['r']['data'].get('vault') == 1 and 'Jeep fare' not in cloud_text())
    keys = B.evaluate("Cloud.vaultNeeded.keys")
    bad = B.evaluate("async (k) => { try { await Vault.adopt(k, 'wrong password!!'); return 'opened'; } catch (e) { return 'refused'; } }", keys)
    check('wrong vault password refused on B', bad == 'refused' and B.evaluate("Vault.status()") == 'off' and 'Jeep fare' in B.evaluate("localStorage.getItem(Store.key())"))
    B.evaluate("async ([k, pw]) => { await Vault.adopt(k, pw); Store.save(); await Vault.flush(); }", [keys, PW]); r = sync(B)
    check('B joins: both devices\' entries merged', r == 'ok' and descs(B) == ['Groceries SM', 'Jeep fare'], f'{r} {descs(B)}')
    check('B is encrypted locally now', B.evaluate("Vault.status()") == 'unlocked' and 'Jeep fare' not in B.evaluate("() => Object.values(localStorage).join('|')"))
    sync(A); check('A gets B\'s entry through the encrypted cloud', descs(A) == ['Groceries SM', 'Jeep fare'])

    # Both change things, delete and edit
    add(A, 'Meralco', 2400); B.evaluate("() => { const t = Store.state.transactions.find(t => t.description === 'Jeep fare'); Store.removeTransaction(t.id); }")
    sync(A); sync(B); sync(A)
    check('changes from both devices kept, delete carried over', descs(A) == descs(B) == ['Groceries SM', 'Meralco'], f'{descs(A)} {descs(B)}')
    check('cloud still encrypted', 'Meralco' not in cloud_text() and row['r']['data'].get('vault') == 1)

    # Old app version (or a device that never unlocked) tries to write plain text: refused by the server
    n = len(refused); r = srv('update', {'data': {'transactions': [], 'savedAt': 1}, 'updated_at': 'x', 'expect': row['r']['updated_at']})
    check('server refuses a plain overwrite', len(refused) == n + 1 and row['r']['data'].get('vault') == 1)

    # Password changed on A: B picks up the new key wrappers on its next sync
    A.evaluate("async (pw) => { await Vault.changePassword(pw, 'new vault pass 2027'); }", PW); sync(A); sync(B)
    check('password change reaches B (new works, old doesn\'t)', B.evaluate("Vault.verify('new vault pass 2027')") and not B.evaluate("Vault.verify(arguments[0])", PW) if False else (B.evaluate("(p) => Vault.verify(p)", 'new vault pass 2027') and not B.evaluate("(p) => Vault.verify(p)", PW)))
    check('recovery key still works on B', B.evaluate("(p) => Vault.verify(p)", rkA))

    # C: made its own vault before ever syncing (a different key): switches to the account's vault, keeps its entries
    C = device(); add(C, 'Tricycle', 40); vault_on(C, 'c device own pass 1')
    check('C notices the different vault', sync(C) == 'vault' and C.evaluate("Cloud.vaultNeeded.mismatch"))
    C.evaluate("async ([k, pw]) => { await Vault.adopt(k, pw); Store.save(); await Vault.flush(); }", [row['r']['data']['keys'], 'new vault pass 2027']); sync(C)
    check('C switched vaults and merged', descs(C) == ['Groceries SM', 'Meralco', 'Tricycle'] and C.evaluate("Vault.ring.id") == A.evaluate("Vault.ring.id"))

    # Turning it off on A: cloud goes back to plain (marked); B is told and keeps its data
    A.evaluate("async () => { await Cloud.sync(); Cloud.turningOff = true; await Cloud.sync(); Cloud.turningOff = false; await Vault.disable(); }")
    check('turned off: cloud plain again, marked', 'Meralco' in cloud_text() and row['r']['data'].get('vaultOff') is True)
    r = sync(B)
    check('B is told, and doesn\'t re-encrypt or lose anything', r == 'vault' and B.evaluate("Cloud.vaultNeeded.off") and 'vault' not in row['r']['data'] and len(descs(B)) >= 2)
    A.evaluate("() => Store.addTransaction({ kind: 'expense', amount: 5, category: 'Food', date: '2026-11-21', description: 'After turning off' })"); sync(A)
    check('A syncs normally after turning off', 'After turning off' in cloud_text())
    b.close()
for f in fails: print('✗', f)
if errs: print('page errors:', errs[:4])
print(f'{passes}/{passes + len(fails)} encrypted-sync checks passed')
sys.exit(1 if fails or errs else 0)
