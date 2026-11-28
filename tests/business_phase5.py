"""Tiffo Business Phase 5: plain-language entry, receipt scanning, smart alerts, the business assistant (with and without AI)
and forecasts. Today = Friday 20 Nov 2026. Nothing may be saved from a sentence or receipt until the owner presses Save.

Stationery shop: Notebook ₱120 (cost ₱60), 50 in stock.
  "Sold three notebooks for ₱450 cash" → 3 × ₱150 = ₱450, COGS ₱180.
  "benta 5 notebooks utang si J. Dela Cruz" → invoice 5 × ₱120 = ₱600 on credit. "Customer paid ₱200 toward invoice 1" → owes ₱400.
  "Bought ₱1,200 worth of packaging from Metro Paper" → Packaging ₱1,200. "Paid the shop's monthly electricity bill" → Utilities, amount typed: ₱2,500.
  "Received 30 notebooks" (no purchase order) → +30 at ₱55 typed by the owner. "I put in ₱5,000" → owner money in.
Receipt text: Metro Paper Supply, 18 Nov 2026, TOTAL ₱1,340.00, VAT 12% ₱143.57 → Packaging ₱1,340, VAT ₱143.57.
Forecast shop (gift wrapping, service): last 56 days, ₱700 every Saturday and ₱100 every other day, all paid on the day; one ₱560 expense.
  Next 30 days (21 Nov – 20 Dec) have 5 Saturdays → 5 × 700 + 25 × 100 = ₱6,000; every week is ₱1,300 so the range is exactly ₱6,000.
  Expenses 560 / 56 days × 30 = ₱300 → profit ₱5,700. Cash now 1,000 + 10,400 − 560 = ₱10,840 → ₱16,540 at the end.
"""
import sys, pathlib, json
from playwright.sync_api import sync_playwright
here = pathlib.Path(__file__).resolve().parent
html = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else here.parent / 'tiffo.html').resolve()
stub = "window.Chart=class{constructor(){}update(){}destroy(){}};Chart.defaults={font:{},color:''};"
PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
fails, passes = [], 0
def check(name, got, **want):
    global passes
    got = got or {}
    bad = {k: (v, got.get(k)) for k, v in want.items() if got.get(k) is None or (abs(got.get(k) - v) > 0.011 if isinstance(v, (int, float)) and not isinstance(v, bool) else got.get(k) != v)}
    if bad: fails.append(f"{name}: " + ', '.join(f"{k} want {w} got {g}" for k, (w, g) in bad.items()))
    else: passes += 1
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = b.new_context(timezone_id='Asia/Manila', viewport={'width': 1200, 'height': 900}).new_page(); pg.add_init_script(stub)
    pg.clock.set_fixed_time('2026-11-20T10:00:00+08:00')
    for pat in ['**/chart.umd.min.js', '**/cdn.tailwindcss.com/**', '**/supabase-js@2**', '**/js.puter.com/**']: pg.route(pat, lambda r: r.fulfill(body='', content_type='text/javascript'))
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(html.as_uri()); pg.wait_for_timeout(700)
    js = lambda code, *a: pg.evaluate(code, (a[0] if len(a) == 1 else list(a)) if a else None)
    def fill(k, v): pg.evaluate("([k, v]) => { const el = document.getElementById('fm_' + k); if (el.type === 'checkbox') el.checked = !!v; else el.value = v; el.dispatchEvent(new Event('change', {bubbles: true})); }", [k, v])
    def val(k): return pg.evaluate("(k) => { const el = document.getElementById('fm_' + k); return el ? (el.type === 'checkbox' ? el.checked : el.value) : null; }", k)
    def submit(): return pg.evaluate("async () => { await UI.submitForm(); return document.getElementById('formModal').classList.contains('hidden') ? '' : (document.getElementById('formModal').innerText || ''); }")
    def tell(t): js("(t) => UI.bizTell(t)", t); pg.wait_for_timeout(60)
    def answer(): return js("() => UI.bizAns")
    def sales(): return js("() => Biz.of('bizSales', Biz.current().id).length")
    pg.evaluate("() => { window.askConfirm = async () => true; }")
    js("() => { CURRENCY = 'PHP'; LS.removeItem('tiffo.biz.staff'); Store.state = Store.blank(); Store.state.initialBalance = 10000; Store.save(); document.querySelectorAll('#authScreen,#onboarding').forEach(e => e && e.classList.add('hidden')); }")
    js("() => Biz.create({ name: 'Sunny Side Stationery', type: 'retail', cash: 5000, bankName: 'BPI', bank: 20000, taxMode: 'none' })")
    cash, bank = js("() => Biz.accounts(Biz.current().id).map(a => a.id)")
    nb = js("() => Biz.saveItem(Biz.current().id, { kind: 'product', name: 'Notebook', price: 120, cost: 60, track: true, opening: 50 }).id")
    cust = js("() => Biz.saveCustomer(Biz.current().id, { name: 'J. Dela Cruz' }).id")
    sup = js("() => Biz.saveSupplier(Biz.current().id, { name: 'Metro Paper', terms: 30 }).id")
    js("() => { Nav.go('business'); UI.bizTab = 'overview'; UI.renderBiz(); }")

    # 1. A sale from a sentence: the form is filled, nothing saved until Save
    tell('Sold three notebooks for ₱450 cash.')
    check('sale understood', {'it': val('it0') == nb, 'q': val('q0'), 'p': val('p0'), 'paid': val('paid'), 'saved': sales()}, it=True, q='3', p='150', paid='450', saved=0)
    check('says what was typed', {'s': 'Sold three notebooks' in pg.inner_text('#formModal')}, s=True)
    e = submit()
    if e: fails.append('sale save: ' + e)
    s1 = js("() => Biz.of('bizSales', Biz.current().id).at(-1)")
    check('sale saved after Save', s1, total=450, cogs=180, method='cash')
    # 2. Credit sale in Taglish, then a payment toward the invoice
    tell('benta 5 notebooks utang si J. Dela Cruz')
    check('credit sale understood', {'q': val('q0'), 'paid': val('paid'), 'c': val('cust') == cust}, q='5', paid='0', c=True)
    e = submit()
    if e: fails.append('credit sale save: ' + e)
    inv = js("() => Biz.of('bizSales', Biz.current().id).at(-1)")
    check('invoice on credit', inv, kind='invoice', total=600)
    tell('Customer paid ₱200 toward invoice 1')
    check('payment matched to the invoice', {'s': val('sale') == inv['id'], 'a': val('amount')}, s=True, a='200')
    e = submit()
    if e: fails.append('payment save: ' + e)
    check('still owed', {'d': js("(id) => Biz.dueOn(Biz.find('bizSales', id))", inv['id'])}, d=400)
    tell('J. Dela Cruz bought 2 notebooks')
    check('a customer buying is a sale, not an expense', {'t': js("() => document.getElementById('fmTitle')?.textContent || document.querySelector('#formModal h2, #formModal h3')?.textContent || ''").startswith('Sale')}, t=True)
    js("() => UI.closeForm()")
    check('closing the preview saves nothing', {'n': sales()}, n=2)
    # 3. Expenses from sentences
    tell('Bought ₱1,200 worth of packaging from Metro Paper')
    check('expense understood', {'a': val('amount'), 'c': val('category'), 'v': val('vendor')}, a='1200', c='Packaging', v='Metro Paper')
    e = submit()
    if e: fails.append('expense save: ' + e)
    tell("Paid the shop's monthly electricity bill.")
    check('missing amount left empty, not guessed', {'a': val('amount'), 'c': val('category')}, a='', c='Utilities')
    e = submit()
    check('can’t save without the amount', {'e': 'Type the amount' in e}, e=True)
    fill('amount', 2500); e = submit()
    if e: fails.append('electricity save: ' + e)
    # 4. Stock received: with no purchase order the owner types the cost; with one, the order is filled in
    tell('Received 30 notebooks')
    check('receive understood', {'i': val('item') == nb, 'q': val('qty'), 'c': val('cost')}, i=True, q='30', c='')
    e = submit()
    check('cost is required', {'e': 'what each one cost' in e}, e=True)
    fill('cost', 55); e = submit()
    if e: fails.append('receive save: ' + e)
    check('stock after sentences', js("(id) => Biz.stockOf(id)", nb), qty=72)
    po = js("([s, i]) => Biz.createPurchase(Biz.current().id, { supplierId: s, lines: [{ itemId: i, qty: 20, unitCost: 60 }], expected: '2026-11-15' }).id", sup, nb)
    tell('Dumating na yung 20 notebooks')
    check('matched to the purchase order', {'g': val('g0')}, g='20')
    js("() => UI.closeForm()")
    # 5. Owner money and an unknown sentence
    tell('I put in ₱5,000')
    check('owner money understood', {'d': val('dir'), 'a': val('amount')}, d='in', a='5000')
    js("() => UI.closeForm()")
    tell('hello there')
    check('unknown sentences get help, not a guess', {'k': 'didn’t understand' in (answer() or {}).get('text', '')}, k=True)

    # 6. Ask about the business (from the records)
    tell('Who owes me?')
    a = answer(); check('who owes me', {'src': a.get('source'), 'row': json.dumps(a.get('rows'), ensure_ascii=False)}, src='records', row='[["J. Dela Cruz", "₱400.00"]]')
    tell('How much did I spend on packaging this month?')
    check('spending on packaging', {'t': '₱1,200.00' in answer()['text']}, t=True)
    tell('Which products made the most profit this month?')
    check('most profitable', {'r': answer()['rows'][0][0]}, r='Notebook')
    tell('Can I afford a ₱20,000 printer?')
    a = answer(); check('afford answer is labelled as an estimate', {'est': a.get('est'), 't': 'It’s your call' in a['text']}, est=True, t=True)
    js("(id) => { Biz.find('bizItems', id).reorder = 100; }", nb)
    tell('What should I reorder?')
    check('reorder list', {'r': answer()['rows'][0][0]}, r='Notebook')
    tell('Why was profit lower this month?')
    check('profit explanation', {'t': 'Net profit' in answer()['text']}, t=True)
    tell('What is the meaning of life?')
    a = answer(); check('no made-up answer', {'ai': a.get('askAI')}, ai=True)

    # 7. AI answers: only after consent, only a summary (no names)
    js("() => UI.bizAiConsentForm()"); e = submit()
    check('consent needs the tick', {'e': 'Tick the box' in e}, e=True)
    fill('ok', True); e = submit()
    if e: fails.append('consent: ' + e)
    check('consent is device-only', {'c': js("() => Store.state.settings.bizAiConsent"), 'd': js("() => Backup.DEVICE_SETTINGS.includes('bizAiConsent')")}, c=True, d=True)
    summ = js("() => JSON.stringify(BizAsk.summary(Biz.current().id))")
    check('summary has no customer or supplier names', {'c': 'Dela Cruz' in summ, 's': 'Metro Paper' in summ, 'n': 'Notebook' in summ}, c=False, s=False, n=True)
    js("() => { window.__sent = null; AI.available = () => true; AI.call = async (x) => { window.__sent = x.prompt; return '{\"answer\":\"Notebooks are your only product.\"}'; }; }")
    js("() => UI.bizAskAI()"); pg.wait_for_timeout(100)
    a = answer(); check('AI answer labelled', {'src': a.get('source'), 't': a.get('text')}, src='ai', t='Notebooks are your only product.')
    check('what was sent has no customer names', {'c': 'Dela Cruz' in (js("() => window.__sent") or 'x')}, c=False)
    check('shows what was shared', {'s': 'What was shared with the AI' in pg.inner_text('#bizAnswer')}, s=True)

    # 8. Receipts: read, never guess, review before saving
    r = js("(t) => BizReceipt.fromText(t)", "METRO PAPER SUPPLY\nDate: 11/18/2026\nBond paper 5 reams 1,250.00\nPacking tape 2x 90.00\nVATable Sales 1,196.43\nVAT 12% 143.57\nTOTAL 1,340.00")
    check('receipt fields', r, vendor='METRO PAPER SUPPLY', amount=1340, date='2026-11-18', vat=143.57, category='Packaging')
    r2 = js("(t) => BizReceipt.fromText(t)", "CORNER STORE\nCoffee 3x 90.00\nThank you")
    check('no TOTAL or date → left empty', {'a': r2.get('amount') is None, 'd': r2.get('date') is None, 'u': ','.join(r2['unsure'])}, a=True, d=True, u='amount,date,category')
    n0 = js("() => Biz.of('bizExpenses', Biz.current().id).length")
    js("(png) => { BizReceipt.read = async () => ({ ...BizReceipt.fromText('CORNER STORE\\nCoffee 3x 90.00'), thumb: png, source: 'device' }); }", PNG)
    js("() => UI.bizScanReceipt({})"); pg.wait_for_timeout(100)
    check('receipt form waits for review', {'a': val('amount'), 'd': val('date'), 'n': js("() => Biz.of('bizExpenses', Biz.current().id).length") - n0}, a='', d='', n=0)
    fill('amount', 270); e = submit()
    check('date required from the receipt', {'e': 'Type the date' in e}, e=True)
    fill('date', '2026-11-19'); e = submit()
    if e: fails.append('receipt save: ' + e)
    ex = js("() => Biz.of('bizExpenses', Biz.current().id).at(-1)")
    check('receipt saved with its photo', {'a': ex['amount'], 'p': ex.get('receiptThumb') == PNG}, a=270, p=True)
    check('bad photo data isn’t stored', {'p': 'receiptThumb' in js("() => Biz.addExpense(Biz.current().id, { amount: 1, category: 'Other', accountId: Biz.accounts(Biz.current().id)[0].id, receiptThumb: 'data:image/png;base64,AAA\" onerror=\"x' })")}, p=False)

    # 9. Smart alerts
    for d in ['2026-10-05', '2026-10-12', '2026-10-19']:
        js("(d) => Biz.addExpense(Biz.current().id, { amount: 800, category: 'Utilities', accountId: Biz.accounts(Biz.current().id)[0].id, date: d })", d)
    js("([i, c]) => Biz.recordSale(Biz.current().id, { kind: 'invoice', customerId: c, lines: [{ itemId: i, qty: 1, price: 120 }], paid: 0, dueDate: '2026-11-10', date: '2026-11-01' })", nb, cust)
    js("(i) => Biz.recordSale(Biz.current().id, { lines: [{ itemId: i, qty: 1, price: 40 }], paid: 40, accountId: Biz.accounts(Biz.current().id)[0].id, allowBelowCost: true })", nb)
    types = lambda: js("() => Biz.alerts(Biz.current().id).map(a => a.type)")
    t = types()
    for k in ['overdue', 'lowstock', 'bigexpense', 'latepo', 'lowmargin']:
        check(f'alert: {k}', {'on': k in t}, on=True)
    check('most serious first', {'first': js("() => Biz.alerts(Biz.current().id)[0].sev")}, first='high')
    key = js("() => Biz.alerts(Biz.current().id).find(a => a.type === 'overdue').key")
    js("(k) => UI.bizAct5('snooze', k)", key)
    check('hidden for 7 days', {'on': 'overdue' in types(), 'all': 'overdue' in js("() => Biz.alerts(Biz.current().id, { all: true }).map(a => a.type)")}, on=False, all=True)
    js("() => { Biz.current().alertsOff = ['lowstock']; }")
    check('alert type turned off', {'on': 'lowstock' in types()}, on=False)
    js("(s) => Biz.addExpense(Biz.current().id, { amount: 1000000, category: 'Rent', unpaid: true, supplierId: s, dueDate: '2026-11-25' })", sup)
    check('cash shortage and bills due', {'c': 'cashshort' in types(), 'b': 'billsdue' in types()}, c=True, b=True)
    js("() => { UI.bizTab = 'overview'; UI.renderBiz(); }")
    check('overview shows alerts', {'a': 'Cash could run short' in js("() => document.getElementById('bizBody').innerText")}, a=True)

    # 10. Forecast
    js("() => Biz.create({ name: 'Sunny Side Wraps', type: 'service', cash: 1000, taxMode: 'none' })")
    check('not enough history', js("() => Biz.forecast(Biz.current().id, 30)"), ok=False)
    js("""() => { const id = Biz.current().id, a = Biz.accounts(id)[0].id, w = Biz.saveItem(id, { kind: 'service', name: 'Gift wrapping', price: 100 });
      for (let i = 0; i < 56; i++) { const d = new Date(Date.now() - i * 864e5), sat = d.getDay() === 6; Biz.recordSale(id, { lines: [{ itemId: w.id, qty: 1, price: sat ? 700 : 100 }], paid: sat ? 700 : 100, accountId: a, date: toISODate(d) }); }
      Biz.addExpense(id, { amount: 560, category: 'Supplies', accountId: a, date: toISODate(new Date(Date.now() - 10 * 864e5)) }); }""")
    check('30-day forecast', js("() => Biz.forecast(Biz.current().id, 30)"), ok=True, sales=6000, low=6000, high=6000, grossProfit=6000, expenses=300, profit=5700, cashNow=10840, cashEnd=16540, cashShare=100)
    js("() => { UI.bizTab = 'reports'; UI.renderBiz(); }")
    check('forecast on the Reports page', {'t': 'Forecast' in js("() => document.getElementById('bizBody').innerText")}, t=True)

    # Screens render; personal money untouched except the linked owner money (not saved here)
    for tab in ['overview', 'expenses', 'reports', 'settings']:
        js("(t) => { UI.bizTab = t; UI.renderBiz(); }", tab)
        if not js("() => document.getElementById('bizBody').innerText.length"): fails.append('empty tab ' + tab)
    check('personal untouched', js("() => ({ cash: Store.balance() })"), cash=10000)
    if errs: fails.append('page errors: ' + '; '.join(errs[:3]))
    b.close()
print('\n'.join('FAIL ' + f for f in fails))
print(f"{passes}/{passes + len(fails)} business phase 5 checks passed")
sys.exit(1 if fails else 0)
