"""Audit A: investment accounting. Every number is worked out by hand first."""
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

    # A1. Two buys at different prices with fees, partial sale by units, dividend, full sale
    reset(50000); h = hold('FMETF')
    trade(h, 'buy', '2026-01-10', amount=10000, units=100, fees=100)
    trade(h, 'buy', '2026-03-01', amount=6000, units=50, fees=60)
    c = calc(h); check('A1 two buys: average cost incl. fees', {**c, 'avg': c['cost'] / c['units']}, cost=16000, units=150, avg=106.6667, fees=160, invested=16000)
    check('A1 buying is not spending', money(), cash=34000, spent=0, income=0, nw=50000)
    trade(h, 'value', '2026-06-30', amount=18000)
    check('A1 valuation', calc(h), value=18000, unrealized=2000, gain=2000)
    check('A1 valuation is not income', money(), income=0, nw=52000)
    trade(h, 'sell', '2026-08-01', amount=7100, units=60, fees=50)
    check('A1 partial sale (average cost)', calc(h), units=90, cost=9600, realized=700, withdrawn=7100, value=10850, unrealized=1250, gain=1950, fees=210)
    check('A1 sale is not income', money(), cash=41100, income=0, spent=0, nw=51950)
    trade(h, 'div', '2026-09-15', amount=300)
    check('A1 dividend', calc(h), dividends=300, gain=2250)
    check('A1 dividend is income', money(), cash=41400, income=300)
    trade(h, 'sell', '2026-10-01', amount=11000, all=True)
    c = calc(h); check('A1 full sale closes it', {**c, 'closed': 1 if c['closed'] else 0}, closed=1, value=0, units=0, cost=0, realized=2100, gain=2400)
    check('A1 after full sale', money(), cash=52400, income=300, spent=0, nw=52400)
    check('A1 history: before 2nd buy', calc(h, '2026-02-01'), value=10000, cost=10000)
    check('A1 history: after valuation', calc(h, '2026-07-01'), value=18000)
    check('A1 history: after partial sale', calc(h, '2026-09-01'), value=10850, realized=700)
    check('A1 history: net worth then', pg.evaluate("() => ({ nw: NetWorth.at('2026-07-01').net })"), nw=34000 + 18000)

    # A2. Something you already had: no cash moves, no income
    reset(10000); h = pg.evaluate("""() => { UI.holdingForm(null, {}); const s = (k, v) => { const el = document.getElementById('fm_' + k); el.value = v; el.dispatchEvent(new Event('change', {bubbles:true})); };
      s('name', 'COL stocks'); s('type', 'stock'); s('how', 'have'); s('amount', 20000); s('value', 25000); s('date', '2026-01-01'); UI.submitForm(); return Invest.list()[0].id; }""")
    check('A2 opening holding', calc(h), invested=20000, cost=20000, value=25000, gain=5000)
    check('A2 opening moves no cash', money(), cash=10000, income=0, spent=0, nw=35000)

    # A3. Withdrawal without units uses the value at the time
    reset(20000); h = hold('Pag-IBIG MP2', 'retirement')
    trade(h, 'buy', '2026-01-05', amount=5000); trade(h, 'buy', '2026-02-05', amount=5000)
    trade(h, 'value', '2026-06-01', amount=11000)
    trade(h, 'sell', '2026-07-01', amount=5500)
    check('A3 withdrawal: half the value = half the cost', calc(h), cost=5000, realized=500, value=5500, gain=1000)

    # A4. Time deposit with interest: each placement earns from its own date
    reset(200000); h = hold('BDO time deposit', 'time_deposit', rate=6)
    trade(h, 'buy', '2025-11-20', amount=100000)
    check('A4 one year of 6%', calc(h, '2026-11-20'), value=106000)
    trade(h, 'buy', '2026-05-20', amount=50000)
    check('A4 later placement earns from its own date', calc(h, '2026-11-20'), value=round(100000 * 1.06 + 50000 * (1 + 0.06 * 184 / 365), 2))
    reset(200000); h = hold('BDO time deposit', 'time_deposit', rate=6)
    trade(h, 'buy', '2025-11-20', amount=100000)
    trade(h, 'sell', '2026-11-20', amount=53000)
    check('A4 partial withdrawal after interest', calc(h, '2026-11-20'), cost=50000, realized=3000, value=53000)

    # A5. Buying more after a valuation: fees aren't worth anything
    reset(50000); h = hold('Index fund', 'mutual_fund')
    trade(h, 'buy', '2026-01-10', amount=10000); trade(h, 'value', '2026-06-01', amount=12000)
    trade(h, 'buy', '2026-07-01', amount=1000, fees=20)
    check('A5 value after buying more', calc(h), value=12980, cost=11000)

    # A6. Reinvested dividend: income, but no cash moves
    reset(50000); h = hold('REIT', 'stock')
    trade(h, 'buy', '2026-01-10', amount=10000)
    trade(h, 'div', '2026-03-10', amount=300, reinvest=True)
    check('A6 reinvested dividend', {**calc(h), **money()}, cash=40000, income=300, spent=0, invested=10300, cost=10300, dividends=300, gain=300)

    # A7. Allocation adds up to total value
    reset(100000); a = hold('A', 'stock'); bb = hold('B', 'mutual_fund'); cc = hold('C', 'stock')
    trade(a, 'buy', '2026-01-10', amount=10000); trade(bb, 'buy', '2026-01-10', amount=20000); trade(cc, 'buy', '2026-01-10', amount=5000)
    t = pg.evaluate("Invest.totals()")
    check('A7 allocation', {'stock': t['byType'].get('stock'), 'mutual_fund': t['byType'].get('mutual_fund'), 'value': t['value']}, stock=15000, mutual_fund=20000, value=35000)

    # A8. "Sold all" even if units were also typed: nothing left
    reset(50000); h = hold('X', 'stock')
    trade(h, 'buy', '2026-01-10', amount=10000, units=100)
    pg.evaluate("([id]) => { Store.addTransaction({ kind: 'invest_out', amount: 9000, units: 40, all: true, category: 'Investments', date: '2026-02-01', holdingId: id }); }", [h])
    c = calc(h); check('A8 sold all with units typed', {**c, 'closed': 1 if c['closed'] else 0}, closed=1, units=0, realized=-1000)

    # A9. Can't sell more units than you have
    reset(50000); h = hold('Y', 'stock'); trade(h, 'buy', '2026-01-10', amount=10000, units=100)
    pg.evaluate("([id]) => UI.tradeForm(Invest.get(id), 'sell')", [h])
    pg.evaluate("() => { document.getElementById('fm_amount').value = 15000; document.getElementById('fm_units').value = 150; UI.submitForm(); }")
    check('A9 overselling refused', {'saved': pg.evaluate("Store.state.transactions.length")}, saved=1)
    pg.evaluate("UI.closeForm()")

    # A10. Notes: "Invested 2,000 in MP2" when MP2 exists → saved, not spending
    reset(10000); h = hold('Pag-IBIG MP2', 'retirement'); trade(h, 'buy', '2026-01-05', amount=1000)
    pg.evaluate("async t => { document.getElementById('noteInput').value = t; await UI.submitNote(t); }", 'MP2 2,000')
    check('A10 note into existing investment', {**money(), 'cost': calc(h)['cost']}, cash=7000, spent=0, cost=3000)

    b.close()
for f in fails: print('✗', f)
if errs: print('page errors:', errs[:3])
print(f'{passes}/{passes + len(fails)} investment checks passed')
sys.exit(1 if fails or errs else 0)
