"""Audit D: bills, subscriptions, insurance. Every number is worked out by hand first."""
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

    # D1. Paying a bill from a note: matched, due date moves, reminder follows
    reset(10000); m = bill(name='Meralco', amount=2400, variable=True, nextDue='2026-11-25', day=25)
    note('Meralco 2,450')
    b_ = B(m)
    check('D1 note pays the bill', {**S(), 'paid': b_['paidTx'], 'next': is_(b_['nextDue'] == '2026-12-25'), 'rem': is_(js("([id]) => { const b = Bills.get(id); const r = Store.state.reminders.find(r => r.id === b.reminderId); return r && r.eventDate === '2026-12-25' && !r.done; }", m))}, cash=7550, spent=2450, paid=1, next=1, rem=1)
    # D2. Deleting that payment: the bill is due again; restoring it: paid again
    tid = js("Store.state.transactions.find(t => t.billId).id")
    pg.evaluate("([id]) => UI.deleteEntry(id)", [tid]); pg.wait_for_timeout(40)
    check('D2 deleted payment = due again', {'next': is_(B(m)['nextDue'] == '2026-11-25'), **S()}, next=1, cash=10000, spent=0)
    pg.evaluate("([id]) => { Store.restoreTransaction(id); UI.relinkObligations(Store.state.transactions.find(t => t.id === id)); }", [tid])
    check('D2 restored payment = paid again', {'next': is_(B(m)['nextDue'] == '2026-12-25'), **S()}, next=1, spent=2450)

    # D3. Late payment, early payment, month-end dates
    reset(50000); r = bill(name='Rent', amount=15000, category='Housing', nextDue='2026-10-31', day=31)
    js("([id]) => Bills.pay(Bills.get(id), { date: '2026-11-03' })", r)
    check('D3 late payment: next due is the next cycle after it', {'next': is_(B(r)['nextDue'] == '2026-11-30')}, next=1)
    js("([id]) => Bills.pay(Bills.get(id), { date: '2026-11-20' })", r)
    check('D3 early payment: skips this cycle, keeps the 31st', {'next': is_(B(r)['nextDue'] == '2026-12-31')}, next=1)
    q = bill(name='Water', amount=600, freq='quarter', nextDue='2026-11-30', day=30)
    js("([id]) => Bills.pay(Bills.get(id), { date: '2026-11-28' })", q)
    check('D3 every 3 months', {'next': is_(B(q)['nextDue'] == '2027-02-28')}, next=1)

    # D4. Due dates are never paid automatically
    reset(10000); n = bill(name='Netflix', kind='subscription', amount=549, category='Subscriptions', nextDue='2026-11-01', day=1, autopay=True)
    js("() => { UI.renderAll(); Insights.list?.(); Timeline.items(45); }")
    it = js("Timeline.items(45).find(x => x.title === 'Netflix')") or {}
    check('D4 overdue bill shows, nothing recorded', {**S(), 'tx': js("Store.state.transactions.length"), 'overdue': is_(it.get('overdue'))}, cash=10000, spent=0, tx=0, overdue=1)

    # D5. Duplicates: two Spotify bills; the same charge twice
    reset(10000)
    bill(name='Spotify', kind='subscription', amount=149, category='Subscriptions', nextDue='2026-12-01'); bill(name='Spotify Premium', kind='subscription', amount=149, category='Subscriptions', nextDue='2026-12-03')
    tx(kind='expense', amount=850, date='2026-11-18', description='Grab Food', category='Food'); tx(kind='expense', amount=850, date='2026-11-19', description='Grab Food', category='Food')
    d = js("Bills.duplicates().map(x => x.type)")
    check('D5 duplicates found', {'bills': d.count('bills'), 'charge': d.count('charge')}, bills=1, charge=1)

    # D6. Spotting a repeating charge asks first, never adds a bill by itself
    reset(10000)
    for dt in ['2026-08-05', '2026-09-05', '2026-10-05', '2026-11-05']: tx(kind='expense', amount=1299, date=dt, description='PLDT Fiber', category='Utilities')
    det = js("Bills.detect().map(x => x.freq + ':' + x.amount)")
    check('D6 detected, not added', {'found': is_('month:1299' in det), 'bills': js("Bills.list().length")}, found=1, bills=0)

    # D7. Insurance premium: spending, next due moves a year; deleting it moves it back
    reset(30000)
    js("() => { Policies.list().push({ id: 'p1', type: 'health', provider: 'Maxicare', premium: 18000, freq: 'year', nextDue: '2026-12-01' }); Store.save(); }")
    note('Maxicare premium 18,000')
    pol = js("Policies.get('p1')")
    check('D7 premium paid', {**S(), 'next': is_(pol['nextDue'] == '2027-12-01'), 'linked': js("Store.state.transactions.filter(t => t.policyId === 'p1').length")}, cash=12000, spent=18000, next=1, linked=1)
    pg.evaluate("() => UI.deleteEntry(Store.state.transactions.find(t => t.policyId === 'p1').id)"); pg.wait_for_timeout(40)
    check('D7 deleted premium = due again', {'next': is_(js("Policies.get('p1').nextDue") == '2026-12-01')}, next=1)

    # D8. Deleting an older payment doesn't move the due date back
    reset(50000); w = bill(name='Globe', amount=1499, nextDue='2026-09-10', day=10)
    js("([id]) => { Bills.pay(Bills.get(id), { date: '2026-09-10' }); Bills.pay(Bills.get(id), { date: '2026-10-10' }); Bills.pay(Bills.get(id), { date: '2026-11-10' }); }", w)
    old = js("Store.state.transactions.filter(t => t.billId).sort((a, b) => a.date.localeCompare(b.date))[0].id")
    pg.evaluate("([id]) => UI.deleteEntry(id)", [old]); pg.wait_for_timeout(40)
    check('D8 older payment deleted, still paid up', {'next': is_(B(w)['nextDue'] == '2026-12-10')}, next=1)

    # D9. Monthly total of everything recurring
    reset(0)
    bill(name='A', amount=1200, freq='month', nextDue='2026-12-01'); bill(name='B', amount=12000, freq='year', nextDue='2027-01-01'); bill(name='C', amount=300, freq='quarter', nextDue='2026-12-15')
    check('D9 monthly total', {'t': js("Bills.monthlyTotal()")}, t=1200 + 1000 + 100)

    b.close()
for f in fails: print('✗', f)
if errs: print('page errors:', errs[:3])
print(f'{passes}/{passes + len(fails)} bill checks passed')
sys.exit(1 if fails or errs else 0)
