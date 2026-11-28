"""Tiffo Business Phase 4: recipes & production, batches & expiry, recalls, FIFO costing, marketplace fees,
recurring billing, analytics, Philippine tax summary. Every number below was worked out by hand first. Today = 20 Nov 2026.

Bakery (average costing). Flour 10 kg @ ₱50, sugar 5 kg @ ₱60, butter 4 blocks @ ₱120 → ₱1,280 of stock.
  Ensaymada ₱45, batches on. Recipe per batch: 2 kg flour + 0.5 kg sugar + 1 butter = ₱250; makes 24; labour 100 + packaging 24 + other 26.
    Estimated cost each (250 + 150) / 24 = ₱16.67; ingredients only ₱10.42; profit each 45 − 16.67 = ₱28.33 (62.96%).
  Make 2 batches (planned 48, made 46, batch B1, expires 25 Nov): ingredients ₱500 → ₱10.8696 each. Stock value still ₱1,280.
  Make 1 batch (24, batch B2, expires 5 Dec): ₱250 → ₱10.4167 each. 70 ensaymada worth ₱750, average ₱10.7143.
  Expiring within 14 days: B1 only. Sell 50 to J. Dela Cruz for ₱2,250 at ₱10.71 → COGS ₱535.50; B1's 46 go first.
  Recall B1 → J's sale, 46 sold, 0 left.
  Marketplace order of 10 (₱450) with the owner's rule 5% + ₱10 → fee ₱32.50, received ₱417.50.
  Café Uno billed ₱4,000 monthly from 20 Sep (7 days to pay) → 3 invoices (Sep, Oct, Nov); first paid → owed ₱8,000, 1 late.
  November: sales 2,250 + 450 + 4,000 = 6,700 over 3 sales → average ₱2,233.33; both customers repeat; 1 new (J).
    October (2–31 Oct) had ₱4,000 → growth 67.5%. COGS 535.50 + 107.10 = 642.60, expenses ₱32.50 → break-even 32.50 ÷ (6,057.40 / 6,700) = ₱35.95.
Mart (FIFO): soap 10 @ ₱20 then 10 @ ₱30; one sale of 10 + 2 → COGS 200 + 60 = ₱260 (average would be ₱300); 8 left @ ₱30 = ₱240.
  Non-VAT at a 3% rate the owner typed: sales 12 × ₱50 = ₱600 → ₱18.
Grocer (VAT-registered, 12% included): bread ₱112 (VATable) + rice ₱50 (exempt) = ₱162.
  VAT = 112 − 112/1.12 = ₱12; VATable ₱100, exempt ₱50; input VAT ₱60 on a ₱560 purchase → payable ₱12 − ₱60 = −₱48.
"""
import sys, pathlib
from playwright.sync_api import sync_playwright
here = pathlib.Path(__file__).resolve().parent
html = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else here.parent / 'tiffo.html').resolve()
stub = "window.Chart=class{constructor(){}update(){}destroy(){}};Chart.defaults={font:{},color:''};"
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
    def submit(): return pg.evaluate("async () => { await UI.submitForm(); return document.getElementById('formModal').classList.contains('hidden') ? '' : (document.getElementById('formModal').innerText || '').slice(0, 300); }")
    def form(open_js, values, *a):
        js(open_js, *a) if a else js(open_js); pg.wait_for_timeout(40)
        for k, v in values.items(): fill(k, v)
        return submit()
    def err(code, *a): return js(f"(x) => {{ try {{ ({code})(x); return ''; }} catch (e) {{ return e.message; }} }}", *a) if a else js(f"() => {{ try {{ ({code})(); return ''; }} catch (e) {{ return e.message; }} }}")
    pg.evaluate("() => { window.askConfirm = async () => true; }")
    js("() => { CURRENCY = 'PHP'; LS.removeItem('tiffo.biz.staff'); Store.state = Store.blank(); Store.state.initialBalance = 10000; Store.save(); document.querySelectorAll('#authScreen,#onboarding').forEach(e => e && e.classList.add('hidden')); }")
    js("() => Biz.create({ name: 'Sunny Side Bakery', type: 'food', cash: 5000, bankName: 'BPI', bank: 20000, taxMode: 'none' })")
    bank = js("() => Biz.accounts(Biz.current().id)[1].id")
    check('bakery tools', {'m': ','.join(js("() => Biz.modules(Biz.current())"))}, m='pos,marketing,production')
    js("() => { const b = Biz.current(); b.modules = [...Biz.modules(b), 'recurring']; }")
    ing = {}
    for name, unit, qty, cost in [('Flour', 'kg', 10, 50), ('Sugar', 'kg', 5, 60), ('Butter', 'block', 4, 120)]:
        e = form("() => UI.bizItemForm()", {'name': name, 'price': 0, 'cost': cost, 'unit': unit, 'track': True, 'opening': qty, 'ingredientOnly': True})
        if e: fails.append(f'{name}: ' + e)
        ing[name] = js("(n) => Biz.items(Biz.current().id, true).find(i => i.name === n).id", name)
    check('ingredients aren’t for sale', {'f': js("(id) => Biz.find('bizItems', id).forSale", ing['Flour'])}, f=False)
    e = form("() => UI.bizItemForm()", {'name': 'Ensaymada', 'price': 45, 'cost': 0, 'unit': 'pc', 'track': True, 'batches': True})
    if e: fails.append('ensaymada: ' + e)
    ens = js("() => Biz.items(Biz.current().id).find(i => i.name === 'Ensaymada').id")
    check('starting stock value', {'v': js("() => Biz.inventoryValue(Biz.current().id)")}, v=1280)

    # Recipe through the form
    e = form("(id) => UI.bizRecipeForm(id)", {'yield': 24, 'i0': ing['Flour'], 'q0': 2, 'i1': ing['Sugar'], 'q1': 0.5, 'i2': ing['Butter'], 'q2': 1, 'labor': 100, 'packaging': 24, 'other': 26}, ens)
    if e: fails.append('recipe form: ' + e)
    check('recipe cost', js("(id) => Biz.recipeCost(Biz.find('bizItems', id))", ens), materials=250, perBatch=400, perUnit=16.67, materialsPerUnit=10.42, profit=28.33, margin=62.96)
    check('a product can’t be its own ingredient', {'e': err("(id) => Biz.saveRecipe(id, { yield: 1, lines: [{ itemId: id, qty: 1 }] })", ens)[:10]}, e='A product ')

    # Production through the form
    e = form("(id) => UI.bizProduceForm(id)", {'batches': 2, 'actual': 46, 'batchNo': 'B1', 'expiry': '2026-11-25'}, ens)
    if e: fails.append('produce 1: ' + e)
    run = js("() => Biz.col('bizProduction')[0]")
    check('production run 1', run, planned=48, actual=46, waste=2, materials=500, unitCost=10.8696)
    check('ingredients used', {'f': js("(id) => Biz.stockOf(id).qty", ing['Flour']), 's': js("(id) => Biz.stockOf(id).qty", ing['Sugar']), 'b': js("(id) => Biz.stockOf(id).qty", ing['Butter'])}, f=6, s=4, b=2)
    check('production doesn’t change stock value', {'v': js("() => Biz.inventoryValue(Biz.current().id)"), 'p': js("() => Biz.report(Biz.current().id, '2026-11-01', '2026-11-30').netProfit")}, v=1280, p=0)
    e = form("(id) => UI.bizProduceForm(id)", {'batches': 1, 'batchNo': 'B2', 'expiry': '2026-12-05'}, ens)
    if e: fails.append('produce 2: ' + e)
    check('finished stock', js("(id) => Biz.stockOf(id)", ens), qty=70, value=750)
    check('batch needed for batch items', {'e': err("(id) => Biz.produce(Biz.current().id, { itemId: id, batches: 1 })", ens)[:10]}, e='Type a bat')
    check('can’t make more than the ingredients allow', {'e': err("(id) => { try { Biz.produce(Biz.current().id, { itemId: id, batches: 5, batchNo: 'B9' }); } catch (e) { if (e.noStock) throw new Error('asked'); throw e; } }", ens)}, e='asked')
    check('expiring within 14 days', {'n': js("() => Biz.expiring(Biz.current().id).map(x => x.batchNo).join(',')")}, n='B1')

    # Sell 50: first-expiring batch first
    cust = js("() => Biz.saveCustomer(Biz.current().id, { name: 'J. Dela Cruz' }).id")
    s1 = js("([i, c]) => Biz.recordSale(Biz.current().id, { lines: [{ itemId: i, qty: 50, price: 45 }], customerId: c, paid: 2250, accountId: Biz.accounts(Biz.current().id)[0].id })", ens, cust)
    check('sale cost at average', s1, total=2250, cogs=535.5)
    bt = {x['batchNo']: x['qty'] for x in js("(id) => Biz.batchesOf(id)", ens)}
    check('first-expiring batch went first', bt, B2=20)
    check('B1 sold out', {'b1': 'B1' in bt}, b1=False)
    e = form("() => UI.bizAct4('recall', null, document.body)", {'item': ens, 'batch': 'B1', 'reason': 'supplier flour recall'})
    if e: fails.append('recall: ' + e)
    check('recall finds the sale', js("() => Biz.col('bizRecalls')[0]"), soldQty=46, inStock=0)
    check('recall lists J', {'ok': js("(s) => Biz.col('bizRecalls')[0].sales[0].saleId === s", s1['id'])}, ok=True)
    js("() => UI.closeForm && UI.closeForm()")

    # Marketplace fees from the owner's rule
    e = form("() => UI.bizAct4('fees')", {'r': 'marketplace, Commission, 5, 10'})
    if e: fails.append('fee rules: ' + e)
    o = js("([i, c]) => Biz.createOrder(Biz.current().id, { customerId: c, lines: [{ itemId: i, qty: 10, price: 45 }], channel: 'marketplace' }).id", ens, cust)
    js("(id) => UI.bizCompleteForm(id)", o); pg.wait_for_timeout(40)
    check('fee suggested from the rule', {'f': pg.evaluate("document.getElementById('fm_fee').value")}, f='32.5')
    fill('paid', 450); fill('acc', bank); e = submit()
    if e: fails.append('complete with fee: ' + e)
    sale2 = js("(id) => Biz.find('bizSales', Biz.find('bizOrders', id).saleId)", o)
    check('net received after fees', {'fees': js("(id) => Biz.saleFees(Biz.find('bizSales', id))", sale2['id']), 'net': js("(id) => Biz.netReceived(Biz.find('bizSales', id))", sale2['id']), 'bank': js("(id) => Biz.balance(Biz.find('bizAccounts', id))", bank)}, fees=32.5, net=417.5, bank=20417.5)
    check('fees can’t exceed what was paid', {'e': err("(id) => Biz.addSaleFee(id, { amount: 500 })", sale2['id'])[:9]}, e='Fees can’')

    # Recurring billing (owner confirms before anything is created)
    svc = js("() => Biz.saveItem(Biz.current().id, { kind: 'service', name: 'Catering service', price: 4000 }).id")
    uno = js("() => Biz.saveCustomer(Biz.current().id, { name: 'Café Uno' }).id")
    e = form("() => UI.bizRecurringForm()", {'cust': uno, 'it0': svc, 'q0': 1, 'every': 'month', 'start': '2026-09-20', 'dueDays': 7})
    if e: fails.append('recurring form: ' + e)
    check('3 invoices due, none made yet', {'due': js("() => Biz.recurringDue(Biz.current().id).length"), 'made': js("() => Biz.of('bizSales', Biz.current().id).filter(s => s.recurringId).length")}, due=3, made=0)
    js("() => UI.bizAct4('gen-recurring')"); pg.wait_for_timeout(150)
    r = js("() => Biz.of('bizRecurring', Biz.current().id)[0]")
    check('invoices created on their dates', {'dates': ','.join(js("(ids) => ids.map(id => Biz.find('bizSales', id).date)", r['created'])), 'next': r['next']}, dates='2026-09-20,2026-10-20,2026-11-20', next='2026-12-20')
    js("(id) => Biz.receivePayment(id, { amount: 4000, accountId: Biz.accounts(Biz.current().id)[1].id, date: '2026-09-25' })", r['created'][0])
    check('recurring results', js("(id) => Biz.recurringStats(Biz.find('bizRecurring', id))", r['id']), count=3, billed=12000, paid=4000, owed=8000, late=1)
    check('nothing more due', {'n': js("() => Biz.recurringDue(Biz.current().id).length")}, n=0)
    check('month-end dates stay sensible', {'d': js("() => Biz.stepDate('2026-01-31', 'month')")}, d='2026-02-28')

    # Analytics
    a = js("() => { const x = Biz.analytics(Biz.current().id, '2026-11-01', '2026-11-30'); return { ...x, r: undefined, p: undefined }; }")
    check('analytics', a, aov=2233.33, repeatRate=100, newCustomers=1, revenueGrowth=67.5, breakEven=35.95)
    check('cost per new customer needs marketing spend', {'c': a.get('cac') is None}, c=True)

    # FIFO business, non-VAT
    js("() => Biz.create({ name: 'Sunny Side Mart', type: 'retail', cash: 1000, taxMode: 'none' })")
    e = form("() => UI.bizAct4('costing')", {'m': 'fifo'})
    if e: fails.append('costing form: ' + e)
    soap = js("() => Biz.saveItem(Biz.current().id, { kind: 'product', name: 'Soap', price: 50, cost: 20, track: true, opening: 10 }).id")
    js("(id) => Biz.adjustStock(Biz.current().id, id, { type: 'opening', qty: 10, unitCost: 30 })", soap)
    check('FIFO stock value', js("(id) => Biz.stockOf(id)", soap), qty=20, value=500)
    sm = js("(id) => Biz.recordSale(Biz.current().id, { lines: [{ itemId: id, qty: 10, price: 50 }, { itemId: id, qty: 2, price: 50 }], paid: 600, accountId: Biz.accounts(Biz.current().id)[0].id })", soap)
    check('FIFO cost of goods sold', sm, cogs=260)
    check('FIFO stock left', js("(id) => Biz.stockOf(id)", soap), qty=8, value=240, avg=30)
    e = form("() => UI.bizTaxProfileForm()", {'reg': 'nonvat', 'ptRate': 3})
    if e: fails.append('non-VAT profile: ' + e)
    check('percentage tax estimate', js("() => Biz.taxSummary(Biz.current().id, '2026-11-01', '2026-11-30')"), gross=600, ptRate=3, ptEstimate=18)

    # VAT business with an exempt item
    js("() => Biz.create({ name: 'Sunny Side Grocer', type: 'retail', cash: 1000, taxMode: 'none' })")
    e = form("() => UI.bizTaxProfileForm()", {'reg': 'vat', 'useVat': True})
    if e: fails.append('VAT profile: ' + e)
    check('VAT set from the sourced rate', js("() => Biz.current().tax"), mode='inclusive', rate=12)
    bread = js("() => Biz.saveItem(Biz.current().id, { kind: 'product', name: 'Bread', price: 112, cost: 0 }).id")
    e = form("() => UI.bizItemForm()", {'name': 'Rice', 'price': 50, 'cost': 0, 'taxClass': 'exempt'})
    if e: fails.append('rice: ' + e)
    rice = js("() => Biz.items(Biz.current().id).find(i => i.name === 'Rice').id")
    sv = js("([a, b]) => Biz.recordSale(Biz.current().id, { lines: [{ itemId: a, qty: 1, price: 112 }, { itemId: b, qty: 1, price: 50 }], paid: 162, accountId: Biz.accounts(Biz.current().id)[0].id })", bread, rice)
    check('VAT only on the VATable item', sv, total=162, tax=12, revenue=150, vatableNet=100, exemptNet=50)
    e = form("() => UI.bizExpenseForm()", {'amount': 560, 'category': 'Supplies', 'vat': 60})
    if e: fails.append('expense with VAT: ' + e)
    check('VAT summary', js("() => Biz.taxSummary(Biz.current().id, '2026-11-01', '2026-11-30')"), gross=150, vatable=100, exempt=50, outputVat=12, inputVat=60, vatPayable=-48)
    doc = js("(id) => UI.bizDocHTML(Biz.find('bizSales', id))", sv['id'])
    check('document is honest about what it is', {'a': 'not a BIR-registered invoice' in doc, 'b': 'VAT-exempt' in doc}, a=True, b=True)
    check('all-VATable sales unchanged', js("() => Biz.totals([{ qty: 1, price: 112 }], 0, { mode: 'inclusive', rate: 12 })"), tax=12, total=112, revenue=100)

    # Screens render; backup keeps everything
    for bz in ['Sunny Side Bakery', 'Sunny Side Grocer']:
        js("(n) => Biz.setCurrent(Biz.list().find(b => b.name === n).id)", bz)
        for tab in ['overview', 'production', 'recurring', 'stock', 'reports', 'tax', 'settings', 'invoices', 'pos']:
            js("(t) => { UI.bizTab = t; UI.renderBiz(); }", tab)
            if not js("() => document.getElementById('bizBody').innerText.length"): fails.append(f'empty tab {tab} ({bz})')
    txt = js("() => { UI.bizTab = 'tax'; UI.renderBiz(); return document.getElementById('bizBody').innerText; }")
    check('tax page shows sources and limits', {'a': 'Checked' in txt, 'b': 'aren’t a tax return' in txt, 'c': 'doesn’t track filing deadlines' in txt}, a=True, b=True, c=True)
    js("() => Biz.setCurrent(Biz.list()[0].id)")
    txt = js("() => { UI.bizTab = 'overview'; UI.renderBiz(); return document.getElementById('bizBody').innerText; }")
    check('no warning when nothing expires within 14 days (B1 sold out)', {'a': 'expired or expiring soon' in txt}, a=False)
    e = form("() => UI.bizAct4('expirydays')", {'d': 20})
    if e: fails.append('expiry days: ' + e)
    txt = js("() => { UI.bizTab = 'overview'; UI.renderBiz(); return document.getElementById('bizBody').innerText; }")
    check('warns once B2 is within 20 days', {'a': 'expired or expiring soon' in txt}, a=True)
    rt = js("""() => { const keep = JSON.parse(JSON.stringify(Store.state)); const before = JSON.stringify(Biz.list().map(b => Biz.position(b.id)));
      Store.state = Backup.upgrade ? Backup.upgrade(JSON.parse(JSON.stringify(keep))) : JSON.parse(JSON.stringify(keep)); const after = JSON.stringify(Biz.list().map(b => Biz.position(b.id))); Store.state = keep;
      return { same: before === after, arrays: BIZ_ARRAYS.every((k) => Backup.ARRAYS.includes(k)) }; }""")
    check('backup keeps phase 4 data', rt, same=True, arrays=True)
    check('personal untouched', js("() => ({ cash: Store.balance() })"), cash=10000)
    if errs: fails.append('page errors: ' + '; '.join(errs[:3]))
    b.close()
print('\n'.join('FAIL ' + f for f in fails))
print(f"{passes}/{passes + len(fails)} business phase 4 checks passed")
sys.exit(1 if fails else 0)
