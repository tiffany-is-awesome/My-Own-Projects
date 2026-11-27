"""Vault stage 1: crypto core. Real Web Crypto in a real browser."""
import sys, pathlib
from playwright.sync_api import sync_playwright
here = pathlib.Path(__file__).resolve().parent
html = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else here.parent / 'tiffo.html').resolve()
stub = "window.Chart=class{constructor(){}update(){}destroy(){}};Chart.defaults={font:{},color:''};"
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = b.new_context().new_page(); pg.add_init_script(stub)
    for pat in ['**/chart.umd.min.js', '**/cdn.tailwindcss.com/**', '**/supabase-js@2**', '**/js.puter.com/**']: pg.route(pat, lambda r: r.fulfill(body='', content_type='text/javascript'))
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(html.as_uri()); pg.wait_for_timeout(600)
    r = pg.evaluate("""async () => {
      const out = {}, t = async (f) => { try { return await f(); } catch (e) { return 'threw'; } };
      const pw = 'Mabuhay-Tiffo-2026';
      const { ring, raw, rk } = await Vault.create(pw);
      out.iter = ring.pw.iter; out.rkFormat = /^[A-Z2-9]{5}(-[A-Z2-9]{1,5}){5}$/.test(rk);
      out.noSecretsInRing = !JSON.stringify(ring).includes(pw) && !JSON.stringify(ring).includes(Vault.normRK(rk)) && !JSON.stringify(ring).includes(Sec.b64(raw));
      out.viaPassword = (await Vault.rawFrom(ring, pw)).via;
      out.viaRecovery = (await Vault.rawFrom(ring, rk.toLowerCase().replace(/-/g, ' '))).via;
      out.wrongPassword = await t(() => Vault.rawFrom(ring, 'nope'));
      await Vault.useRaw((await Vault.rawFrom(ring, pw)).raw, ring, 'slotA');
      out.nonExtractable = await t(() => crypto.subtle.exportKey('raw', Vault.key));
      const data = { transactions: Array.from({ length: 6000 }, (_, i) => ({ id: 'tx' + i, amount: i * 1.25, description: 'Entry ' + i + ' ' + 'x'.repeat(200) })) };
      const box = await Vault.seal(data, 'slotA|state');
      out.bigSize = box.ct.length > 1_000_000;
      out.roundTrip = JSON.stringify(await Vault.open(box, 'slotA|state')) === JSON.stringify(data);
      out.noPlaintextInBox = !JSON.stringify(box).includes('Entry 5');
      out.freshIv = (await Vault.seal(data, 'x')).iv !== box.iv;
      const bad = { ...box, ct: box.ct.slice(0, 40) + (box.ct[40] === 'A' ? 'B' : 'A') + box.ct.slice(41) };
      out.tampered = await t(() => Vault.open(bad, 'slotA|state'));
      out.wrongSlot = await t(() => Vault.open(box, 'slotB|state'));
      const other = await Vault.create(pw); const save = [Vault.key, Vault.ring];
      await Vault.useRaw(other.raw, other.ring, 'slotA');
      out.otherVault = await t(() => Vault.open(box, 'slotA|state'));
      [Vault.key, Vault.ring] = save;
      // password change: new works, old doesn't, recovery still works, data still opens
      LS.setItem = ((orig) => function (k, v) { return orig.call(this, k, v); })(LS.setItem);
      await Vault.changePassword(pw, 'New-Password-777');
      out.oldPwAfterChange = await t(() => Vault.rawFrom(Vault.ring, pw));
      out.newPw = (await Vault.rawFrom(Vault.ring, 'New-Password-777')).via;
      out.rkAfterChange = (await Vault.rawFrom(Vault.ring, rk)).via;
      out.dataAfterChange = (await Vault.open(box, 'slotA|state')).transactions.length;
      // forgot password: recovery key sets a new one
      await Vault.changePassword(rk, 'Third-Password-888');
      out.resetViaRecovery = (await Vault.rawFrom(Vault.ring, 'Third-Password-888')).via;
      const rk2 = await Vault.newRecovery('Third-Password-888');
      out.oldRkRevoked = await t(() => Vault.rawFrom(Vault.ring, rk));
      out.newRk = (await Vault.rawFrom(Vault.ring, rk2)).via;
      out.stillOpens = (await Vault.open(box, 'slotA|state')).transactions.length;
      out.cloudKeysNoStatus = !('status' in Vault.cloudKeys()) && !!Vault.cloudKeys().pw;
      const t0 = performance.now(); await Vault.rawFrom(Vault.ring, 'Third-Password-888'); out.unlockMs = Math.round(performance.now() - t0);
      return out;
    }""")
    b.close()
want = {'iter': 600000, 'rkFormat': True, 'noSecretsInRing': True, 'viaPassword': 'password', 'viaRecovery': 'recovery', 'wrongPassword': 'threw', 'nonExtractable': 'threw',
        'bigSize': True, 'roundTrip': True, 'noPlaintextInBox': True, 'freshIv': True, 'tampered': 'threw', 'wrongSlot': 'threw', 'otherVault': 'threw',
        'oldPwAfterChange': 'threw', 'newPw': 'password', 'rkAfterChange': 'recovery', 'dataAfterChange': 6000, 'resetViaRecovery': 'password', 'oldRkRevoked': 'threw', 'newRk': 'recovery', 'stillOpens': 6000, 'cloudKeysNoStatus': True}
fails = [f'{k}: want {v} got {r.get(k)}' for k, v in want.items() if r.get(k) != v]
for f in fails: print('✗', f)
if errs: print('page errors:', errs[:3])
print(f"{len(want) - len(fails)}/{len(want)} vault-core checks passed (unlock took {r.get('unlockMs')} ms)")
sys.exit(1 if fails or errs else 0)
