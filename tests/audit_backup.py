"""Audit E: backup and restore. Every number is worked out by hand first."""
import sys, pathlib
from playwright.sync_api import sync_playwright
here = pathlib.Path(__file__).resolve().parent
html = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else here.parent / 'tiffo.html').resolve()
stub = "window.Chart=class{constructor(){}update(){}destroy(){}};Chart.defaults={font:{},color:''};"
fails, passes = [], 0
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = b.new_context(timezone_id='Asia/Manila').new_page()
    pg.clock.set_fixed_time('2026-11-20T10:00:00+08:00')
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route('**/chart.umd.min.js', lambda r: r.fulfill(body=stub, content_type='text/javascript'))
    pg.add_init_script(stub)
    for pat in ['**/cdn.tailwindcss.com/**', '**/supabase-js@2**', '**/js.puter.com/**']: pg.route(pat, lambda r: r.fulfill(body='', content_type='text/javascript'))
    pg.goto(html.as_uri()); pg.wait_for_timeout(600)
    def reset(cash):
        pg.evaluate(f"() => {{ CURRENCY='PHP'; Store.state = Store.blank(); Store.state.currency='PHP'; Store.state.initialBalance={cash}; Store.save(); }}")
    def hold(name, typ='etf', **kw):
        return pg.evaluate("([n, t, kw]) => { const h = { id: uid(), name: n, type: t, createdAt: Date.now(), ...kw }; Invest.list().push(h); Store.save(); return h.id; }", [name, typ, kw])
    def trade(hid, mode, date, **f):
        """Use the real form, like a person would."""
        pg.evaluate("([id, m]) => UI.tradeForm(Invest.get(id), m)", [hid, mode])
        f['date'] = date
        for k, v in f.items():
            pg.evaluate("([k, v]) => { const el = document.getElementById('fm_' + k); if (!el) throw new Error('no field ' + k); if (el.type === 'checkbox') el.checked = !!v; else el.value = v; el.dispatchEvent(new Event('change', {bubbles: true})); }", [k, v])
        err = pg.evaluate("async () => { await UI.submitForm(); return document.getElementById('formModal').classList.contains('hidden') ? '' : document.getElementById('formModal').innerText.slice(0, 200); }")
        if err: fails.append(f'form refused {mode}: {err}')
        pg.wait_for_timeout(20)
    def calc(hid, iso=None):
        return pg.evaluate("([id, iso]) => Invest.calc(Invest.get(id), iso || undefined)", [hid, iso])
    def money():
        return pg.evaluate("() => ({ cash: Store.balance(), income: Store.totals().income, spent: Store.totals().expense, nw: NetWorth.at(toISODate(new Date())).net })")
    def check(name, got, **want):
        global passes
        bad = {k: (v, got.get(k)) for k, v in want.items() if got.get(k) is None or abs(got.get(k) - v) > 0.011}
        if bad: fails.append(f"{name}: " + ', '.join(f"{k} want {w} got {g}" for k, (w, g) in bad.items()))
        else: passes += 1


    def nw(iso=None):
        return pg.evaluate("iso => NetWorth.at(iso || toISODate(new Date()))", iso)
    def js(code, *a):
        return pg.evaluate(code, list(a) if a else None)
    def note(t):
        pg.evaluate("async t => { document.getElementById('noteInput').value = t; await UI.submitNote(t); }", t); pg.wait_for_timeout(30)
        if not pg.evaluate("document.getElementById('formModal').classList.contains('hidden')"): pg.evaluate("UI.submitForm()"); pg.wait_for_timeout(30)
    def asset_form(**f):
        pg.evaluate("() => UI.assetForm(null, {})")
        for k, v in f.items():
            pg.evaluate("([k, v]) => { const el = document.getElementById('fm_' + k); if (el.type === 'checkbox') el.checked = !!v; else el.value = v; el.dispatchEvent(new Event('change', {bubbles: true})); }", [k, v])
        err = pg.evaluate("async () => { await UI.submitForm(); return document.getElementById('formModal').classList.contains('hidden') ? '' : document.getElementById('fmError')?.innerText || document.getElementById('formModal').innerText.slice(0, 160); }")
        pg.evaluate("UI.closeForm()")
        return err


    def acct(name, typ, **kw):
        return js("([n, t, kw]) => { const a = Accounts.create(n, t); Object.assign(a, kw); Store.save(); return a.id; }", name, typ, kw)
    def pay(aid, **f):
        pg.evaluate("([id]) => UI.payDebtForm(Accounts.get(id), {})", [aid])
        for k, v in f.items():
            pg.evaluate("([k, v]) => { const el = document.getElementById('fm_' + k); if (el.type === 'checkbox') el.checked = !!v; else el.value = v; el.dispatchEvent(new Event('change', {bubbles: true})); }", [k, v])
        err = pg.evaluate("async () => { await UI.submitForm(); return document.getElementById('formModal').classList.contains('hidden') ? '' : document.getElementById('formModal').innerText.slice(0, 200); }")
        pg.evaluate("UI.closeForm()"); return err
    def tx(**t):
        js("([t]) => { Store.addTransaction({ category: 'Shopping', description: 'x', ...t }); }", t)
    def owed(aid, upTo=None):
        return js("([id, u]) => Accounts.owedOn(Accounts.get(id), u)", aid, upTo)
    def S():
        return js("() => ({ cash: Store.balance(), spent: Store.totals().expense, income: Store.totals().income })")


    def bill(**kw):
        return js("([kw]) => { const b = { id: uid(), kind: 'bill', freq: 'month', category: 'Utilities', createdAt: Date.now(), ...kw }; Bills.list().push(b); Bills.syncReminder(b); Store.save(); return b.id; }", kw)
    def B(bid):
        return js("([id]) => { const b = Bills.get(id); return { ...b, paidTx: Store.state.transactions.filter(t => t.billId === id).length }; }", bid)
    def is_(x): return 1 if x else 0


    def full_state():
        """One of everything Tiffo stores."""
        reset(50000)
        js("""() => {
          const g = Accounts.create('GCash', 'ewallet'); g.opening = 3000;
          const card = Accounts.create('BPI Card', 'credit'); card.limit = 30000; card.statementDay = 5; card.dueDay = 25;
          const loan = Accounts.create('Car loan', 'loan'); Object.assign(loan, { principal: 100000, rate: 12, term: 12, dueDay: 15, startDate: '2026-10-15' }); Accounts.setOpening(loan, -100000);
          Store.addTransaction({ kind: 'expense', amount: 1200, category: 'Food', date: '2026-11-02', description: 'Groceries', accountId: card.id });
          Store.addTransaction({ kind: 'income', amount: 30000, category: 'Salary', date: '2026-11-15', description: 'Salary' });
          Store.addTransaction({ kind: 'expense', amount: 1000, category: 'Interest & Fees', date: '2026-11-15', description: 'Interest · Car loan', debtId: loan.id });
          Store.addTransaction({ kind: 'transfer', amount: 7884.88, category: 'Transfer', date: '2026-11-15', description: 'Payment · Car loan', fromAccountId: 'acc_cash', toAccountId: loan.id });
          Store.addTransaction({ kind: 'lend', amount: 2000, person: 'Maria', category: 'Loans', date: '2026-11-03', description: 'Lent Maria' });
          const p = Pockets.create('Emergency fund'); Pockets.move(5000, null, p.id);
          Store.state.budgets.push({ id: 'bu1', name: 'Food', category: 'Food', amount: 8000 });
          Store.addReminder({ title: 'Renew passport', remindAt: Date.now() + 864e5 * 30, eventDate: '2026-12-20' });
          Invest.list().push({ id: 'h1', name: 'FMETF', type: 'etf' });
          Store.addTransaction({ kind: 'invest', amount: 10000, category: 'Investments', date: '2026-11-04', description: 'FMETF', holdingId: 'h1', units: 100 });
          Assets.list().push({ id: 'a1', name: 'Toyota Vios', type: 'vehicle', since: '2024-01-01', history: [{ date: '2026-11-01', value: 450000, at: 1 }] });
          Bills.list().push({ id: 'b1', name: 'Meralco', kind: 'bill', amount: 2400, freq: 'month', nextDue: '2026-11-25', category: 'Utilities' });
          Policies.list().push({ id: 'p1', type: 'health', provider: 'Maxicare', premium: 18000, freq: 'year', nextDue: '2026-12-01', policyNo: 'MX-99812345' });
          Debts.plans().push({ id: 'pl1', name: 'Phone', total: 12000, count: 6, perPay: 2000, accountId: card.id, via: 'card', date: '2026-10-01', firstDue: '2026-11-05', freq: 'month' });
          Store.state.documents.push({ id: 'd1', name: 'Lease.pdf', createdAt: Date.now(), result: { title: 'Lease' } });
          Loans.setMeta(Store.state.transactions.find(t => t.kind === 'lend').id, { expect: '2026-12-31' });
          Store.save();
        }""")
    def snapshot():
        return js("""() => ({ nw: NetWorth.at().net, cash: Store.balance(), spent: Store.totals().expense, income: Store.totals().income, owed: Accounts.owed(), invest: Invest.totals().value,
          counts: Backup.ARRAYS.filter(k => k !== 'trash').map(k => k + ':' + (Store.state[k] || []).length).join(' ') })""")

    # E1. Full backup → replace on an empty device: every module comes back, every total the same
    full_state(); before = snapshot(); file = js("() => JSON.stringify(Backup.build())")
    reset(0)
    v = js("([f]) => Backup.validate(JSON.parse(f))", file)
    js("([f]) => { Backup.restore(Backup.validate(JSON.parse(f)), 'replace'); }", file)
    after = snapshot()
    check('E1 replace restores all totals', after, nw=before['nw'], cash=before['cash'], spent=before['spent'], income=before['income'], owed=before['owed'], invest=before['invest'])
    check('E1 every module restored', {'same': 1 if after['counts'] == before['counts'] else 0}, same=1)
    if after['counts'] != before['counts']: fails.append('counts ' + before['counts'] + ' → ' + after['counts'])
    check('E1 preview counts every module', {k: v['summary'][k] for k in ['holdings', 'assets', 'bills', 'policies', 'plans', 'documents']}, holdings=1, assets=1, bills=1, policies=1, plans=1, documents=1)

    # E2. Password-protected backup
    enc = js("async ([f]) => JSON.stringify(await Sec.encrypt(JSON.parse(f), 'kalabaw-2026'))", file)
    check('E2 nothing readable inside', {'plain': sum(1 for w in ['Groceries', 'Maria', 'Maxicare', 'FMETF', 'MX-998'] if w in enc)}, plain=0)
    ok = js("async ([e, f]) => JSON.stringify(await Sec.decrypt(JSON.parse(e), 'kalabaw-2026')) === f", enc, file)
    bad = js("async ([e]) => { try { await Sec.decrypt(JSON.parse(e), 'wrong'); return 'opened'; } catch (x) { return 'refused'; } }", enc)
    check('E2 right password opens, wrong one doesn\'t', {'ok': 1 if ok else 0, 'bad': 1 if bad == 'refused' else 0}, ok=1, bad=1)

    # E3. Merging the same backup again: nothing doubles
    full_state(); before = snapshot(); file = js("() => JSON.stringify(Backup.build())")
    r = js("([f]) => Backup.restore(Backup.validate(JSON.parse(f)), 'merge')", file)
    after = snapshot()
    check('E3 merge same data: nothing added', {'added': r['added'], 'nw': after['nw'], 'same': 1 if after['counts'] == before['counts'] else 0}, added=0, nw=before['nw'], same=1)

    # E4. Backup from another phone: same investment / bill / loan under different ids
    reset(50000)
    js("""() => { Invest.list().push({ id: 'mine', name: 'FMETF', type: 'etf' }); Store.addTransaction({ kind: 'invest', amount: 5000, category: 'Investments', date: '2026-10-01', description: 'FMETF', holdingId: 'mine' });
      Bills.list().push({ id: 'myb', name: 'Meralco', kind: 'bill', amount: 2400, freq: 'month', nextDue: '2026-11-25', category: 'Utilities' });
      const l = Accounts.create('Car loan', 'loan'); l.id = 'myloan'; Store.save(); }""")
    other = {'app': 'Tiffo', 'format': 1, 'data': {'v': 3, 'accounts': [{'id': 'acc_cash', 'name': 'Cash', 'type': 'cash'}, {'id': 'theirloan', 'name': 'Car loan', 'type': 'loan'}],
      'holdings': [{'id': 'theirs', 'name': 'FMETF', 'type': 'etf'}], 'bills': [{'id': 'theirb', 'name': 'Meralco', 'kind': 'bill', 'amount': 2400, 'freq': 'month', 'nextDue': '2026-11-25'}],
      'transactions': [{'id': 'x1', 'kind': 'invest', 'type': 'expense', 'amount': 3000, 'category': 'Investments', 'date': '2026-11-01', 'description': 'FMETF top-up', 'holdingId': 'theirs', 'accountId': 'acc_cash'},
                       {'id': 'x2', 'kind': 'expense', 'type': 'expense', 'amount': 2400, 'category': 'Utilities', 'date': '2026-10-25', 'description': 'Meralco Oct', 'billId': 'theirb', 'accountId': 'acc_cash'},
                       {'id': 'x3', 'kind': 'expense', 'type': 'expense', 'amount': 900, 'category': 'Interest & Fees', 'date': '2026-11-15', 'description': 'Interest', 'debtId': 'theirloan', 'accountId': 'acc_cash'}]}}
    import json as _j
    js("([f]) => Backup.restore(Backup.validate(JSON.parse(f)), 'merge')", _j.dumps(other))
    check('E4 matched by name, links follow', {'holdings': js("Invest.list().length"), 'bills': js("Bills.list().length"), 'cost': js("Invest.calc(Invest.get('mine')).cost"),
      'billLink': 1 if js("Store.state.transactions.find(t => t.id === 'x2').billId") == 'myb' else 0, 'debtLink': 1 if js("Store.state.transactions.find(t => t.id === 'x3').debtId") == 'myloan' else 0},
      holdings=1, bills=1, cost=8000, billLink=1, debtLink=1)

    # E5. A very old backup (first version: no kinds, no accounts)
    reset(1000)
    old = {'transactions': [{'id': 'o1', 'type': 'expense', 'amount': 250, 'date': '2026-05-01', 'description': 'Jollibee', 'category': 'Food'}, {'id': 'o2', 'type': 'income', 'amount': 5000, 'date': '2026-05-15', 'description': 'Pay', 'category': 'Salary'}], 'initialBalance': 0}
    r = js("([f]) => Backup.restore(Backup.validate(JSON.parse(f)), 'merge')", _j.dumps(old))
    t = js("Store.state.transactions.find(t => t.id === 'o1')")
    check('E5 old backup upgraded on merge', {'added': r['added'], 'kind': 1 if t.get('kind') == 'expense' else 0, 'acct': 1 if t.get('accountId') == 'acc_cash' else 0, **S()}, added=2, kind=1, acct=1, cash=5750, spent=250, income=5000)

    # E6. Damaged and wrong files
    res = js("""() => [Backup.validate('nope').ok, Backup.validate({ hello: 1 }).ok, Backup.validate({ app: 'Tiffo', format: 99, data: { transactions: [] } }).ok,
      Backup.validate({ transactions: [{ id: 'a', date: '2026-01-01', amount: 5, description: 'ok' }, { id: 'b', date: 'yesterday', amount: 5, description: 'x' }, { id: 'c', date: '2026-01-01', amount: -5, description: 'x' }, null] }).dropped]""")
    check('E6 damaged files refused, bad entries skipped', {'n': sum(1 for x in res[:3] if x), 'dropped': res[3]}, n=0, dropped=2)

    # E7. Replace keeps this device's lock, AI consent and household link
    full_state()
    js("async () => { await Sec.setPin('4831', 5); Store.state.settings.aiConsent = false; Store.save(); }")
    mylock = js("Store.state.settings.lock.hash")
    theirs = js("([f]) => { const o = JSON.parse(f); o.data.settings = { lock: { hash: 'THEIRS', salt: 'x' }, aiConsent: true, hhSync: { id: 'other' }, billDismissed: ['x'] }; return JSON.stringify(o); }", js("() => JSON.stringify(Backup.build())"))
    js("([f]) => Backup.restore(Backup.validate(JSON.parse(f)), 'replace')", theirs)
    st = js("Store.state.settings")
    check('E7 device settings kept', {'lock': 1 if st.get('lock', {}).get('hash') == mylock else 0, 'ai': 1 if not st.get('aiConsent') else 0, 'hh': 1 if 'hhSync' not in st else 0, 'other': 1 if st.get('billDismissed') == ['x'] else 0}, lock=1, ai=1, hh=1, other=1)

    # E8. Undo after replace
    full_state(); before = snapshot()
    js("() => Backup.restore(Backup.validate({ transactions: [] }), 'replace')")
    gone = js("Store.state.transactions.length")
    js("() => Backup.undo()")
    check('E8 undo brings it all back', {'gone': gone, 'nw': snapshot()['nw'], 'same': 1 if snapshot()['counts'] == before['counts'] else 0}, gone=0, nw=before['nw'], same=1)

    # E9. Preview shows the new modules
    full_state(); f = js("() => JSON.stringify(Backup.build())"); reset(0)
    js("([f]) => UI.restoreForm(Backup.validate(JSON.parse(f)), 'tiffo-backup.json')", f)
    txt = pg.inner_text('#formModal'); js("() => UI.closeForm()")
    check('E9 preview lists everything', {'n': sum(1 for w in ['investment', 'thing you own', 'bill or subscription', 'insurance policy', 'installment plan', 'document'] if w in txt)}, n=6)

    b.close()
for f in fails: print('✗', f)
if errs: print('page errors:', errs[:3])
print(f'{passes}/{passes + len(fails)} backup checks passed')
sys.exit(1 if fails or errs else 0)
