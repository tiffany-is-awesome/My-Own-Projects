"""Audit B: net worth and assets. Every number is worked out by hand first."""
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

    # B1. Everything together: each thing counted once
    reset(10000)
    js("() => { const g = Accounts.create('GCash', 'ewallet'); g.opening = 5000; const c = Accounts.create('BPI Card', 'credit'); Store.save(); }")
    card, gcash = js("() => [Accounts.find('BPI Card').id, Accounts.find('GCash').id]")
    js("([c]) => { Store.addTransaction({ kind: 'expense', amount: 3000, category: 'Shopping', date: '2026-10-05', accountId: c, description: 'Shoes' }); }", card)
    js("([c]) => { Store.addTransaction({ kind: 'transfer', amount: 1000, category: 'Transfer', date: '2026-10-20', fromAccountId: 'acc_cash', toAccountId: c, description: 'Paid card' }); }", card)
    js("() => { Store.addTransaction({ kind: 'lend', amount: 2000, person: 'Maria', category: 'Loans', date: '2026-11-01', description: 'Lent Maria' }); Store.addTransaction({ kind: 'borrow', amount: 1000, person: 'Mom', category: 'Loans', date: '2026-11-02', description: 'From Mom' }); }")
    js("() => { const h = { id: 'h1', name: 'FMETF', type: 'etf' }; Invest.list().push(h); Store.addTransaction({ kind: 'invest', amount: 4000, category: 'Investments', date: '2026-11-03', holdingId: 'h1', description: 'FMETF' }); }")
    err = asset_form(name='Toyota Vios', type='vehicle', value=300000, since='2024-01-01')
    if err: fails.append('B1 asset form: ' + err)
    n = nw()
    check('B1 each part', n, cash=14000 - 2000 + 1000 - 4000, theyOwe=2000, invest=4000, assets=300000, debts=2000, youOwe=1000, net=9000 + 2000 + 4000 + 300000 - 2000 - 1000)
    check('B1 matches spending/cash elsewhere', {'cash': js("Store.balance()"), 'spent': js("Store.totals().expense"), 'theyOwe': js("Loans.totals().theyOwe"), 'youOwe': js("Loans.totals().youOwe"), 'owed': js("Accounts.owed()")}, cash=9000, spent=3000, theyOwe=2000, youOwe=1000, owed=2000)
    check('B1 card before purchase', nw('2026-09-30'), debts=0, cash=15000)
    check('B1 card after purchase, before payment', nw('2026-10-10'), debts=3000, cash=15000)
    check('B1 card after payment', nw('2026-10-31'), debts=2000, cash=14000)
    check('B1 car counted from 2024', nw('2025-06-30'), assets=300000)
    check('B1 pockets don\'t change net worth', {'d': (js("() => { const p = Pockets.create('Rainy day'); Pockets.move(3000, null, p.id); if (Pockets.balance(p) !== 3000) return -1; return NetWorth.at().net; }") or 0) - n['net']}, d=0)

    # B2. Asset bought with cash, then sold; deleting the sale undoes it
    reset(100000)
    err = asset_form(name='Honda Click', type='vehicle', value=50000, bought=True, price=50000, since='2026-06-01')
    if err: fails.append('B2 asset form: ' + err)
    check('B2 buying swaps cash for the asset', {'before': nw('2026-05-31')['net'], 'after': nw('2026-06-01')['net'], 'spent': js("Store.totals().expense")}, before=100000, after=100000, spent=0)
    aid = js("Assets.list()[0].id")
    pg.evaluate("([id]) => UI.assetSellForm(Assets.get(id))", [aid])
    pg.evaluate("() => { document.getElementById('fm_price').value = 45000; document.getElementById('fm_date').value = '2026-09-01'; UI.submitForm(); }")
    check('B2 sold: cash in, asset out, not income', {**nw(), 'income': js("Store.totals().income"), 'active': js("Assets.active().length")}, cash=95000, assets=0, net=95000, income=0, active=0)
    check('B2 before the sale it still counted', nw('2026-08-31'), assets=50000, net=100000)
    sale = js("Store.state.transactions.find(t => t.kind === 'asset_sell').id")
    pg.evaluate("([id]) => UI.deleteEntry(id)", [sale])
    check('B2 deleting the sale puts the asset back', {**nw(), 'active': js("Assets.active().length")}, cash=50000, assets=50000, net=100000, active=1)
    js("([id]) => { Store.restoreTransaction(id); }", sale)
    check('B2 restoring the sale sells it again', nw(), cash=95000, assets=0)

    # B3. Something owned for years, value typed today
    reset(0)
    js("() => { const a = { id: 'a1', name: 'Lot in Batangas', type: 'property', since: '2015-03-01', history: [] }; Assets.list().push(a); Assets.setValue(a, 1200000, '2026-11-20'); }")
    check('B3 owned since 2015: counted in past months', nw('2026-01-31'), assets=1200000)
    check('B3 not before it was owned', nw('2014-12-31'), assets=0)

    # B4. Double counting guards
    reset(10000)
    js("() => { Accounts.create('BDO Savings', 'bank'); Invest.list().push({ id: 'h9', name: 'Gold savings', type: 'other' }); Store.save(); }")
    e1 = asset_form(name='BDO Savings', type='other', value=50000)
    e2 = asset_form(name='Gold savings', type='valuables', value=20000)
    check('B4 asset that is really an account or investment is refused', {'n': js("Assets.list().length"), 'msg1': 1 if 'Accounts' in e1 else 0, 'msg2': 1 if 'Investments' in e2 else 0}, n=0, msg1=1, msg2=1)

    # B5. Someone else's money isn't yours
    reset(10000)
    js("() => { const a = Accounts.create('Mom\\'s GCash', 'ewallet'); a.notMine = true; a.opening = 8000; Store.save(); }")
    check('B5 others\' accounts excluded', nw(), cash=10000, net=10000)

    # B6. Family loans agree with the Family & friends page, even with odd dates
    reset(10000)
    note('I lent Ana 1,000'); js("() => { Store.state.transactions[0].date = '2026-11-10'; Store.addTransaction({ kind: 'repay_in', amount: 400, person: 'Ana', category: 'Loans', date: '2026-11-05', description: 'Ana paid' }); }")
    check('B6 repayment dated before the loan', {'nw': nw()['theyOwe'], 'loans': js("Loans.totals().theyOwe")}, nw=600, loans=600)

    # B7. The chart only shows months Tiffo knows about
    reset(10000)
    js("() => { Store.state.createdAt = new Date('2026-08-15T10:00:00+08:00').getTime(); Store.addTransaction({ kind: 'expense', amount: 500, category: 'Meals', date: '2026-09-03', description: 'x' }); }")
    ser = js("NetWorth.series(12).map(x => x.date)")
    check('B7 chart starts when your records start', {'n': len(ser), 'first': 1 if ser[0] >= '2026-08' else 0}, n=4, first=1)
    js("() => UI.renderNetWorth()")
    check('B7 chart draws with few months', {'bars': js("document.querySelectorAll('#nwBars > div').length")}, bars=4)

    # B8. Deleting a purchase asks whether the thing goes too
    reset(100000)
    asset_form(name='Laptop', type='gadgets', value=60000, bought=True, price=60000, since='2026-10-01')
    buy = js("Store.state.transactions[0].id")
    pg.evaluate("([id]) => { UI.deleteEntry(id); }", [buy]); pg.wait_for_timeout(50)
    asked = 'Remove Laptop' in pg.inner_text('#confirmModal')
    pg.evaluate("() => document.getElementById('confirmYes').click()"); pg.wait_for_timeout(50)
    check('B8 asks, then removes both', {'asked': 1 if asked else 0, **nw()}, asked=1, cash=100000, assets=0, net=100000)

    b.close()
for f in fails: print('✗', f)
if errs: print('page errors:', errs[:3])
print(f'{passes}/{passes + len(fails)} net-worth checks passed')
sys.exit(1 if fails or errs else 0)
