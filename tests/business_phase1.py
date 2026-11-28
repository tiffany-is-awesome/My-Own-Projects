"""Tiffo Business Phase 1. Every number is worked out by hand first.
Bakery: Ensaymada box ₱300 (cost ₱120), Pan de sal pack ₱50 (cost ₱20)."""
import sys, pathlib, json
from playwright.sync_api import sync_playwright
here = pathlib.Path(__file__).resolve().parent
html = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else here.parent / 'tiffo.html').resolve()
stub = "window.Chart=class{constructor(){}update(){}destroy(){}};Chart.defaults={font:{},color:''};"
fails, passes = [], 0
def check(name, got, **want):
    global passes
    bad = {k: (v, got.get(k)) for k, v in want.items() if got.get(k) is None or (abs(got.get(k) - v) > 0.011 if isinstance(v, (int, float)) and not isinstance(v, bool) else got.get(k) != v)}
    if bad: fails.append(f"{name}: " + ', '.join(f"{k} want {w} got {g}" for k, (w, g) in bad.items()))
    else: passes += 1
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = b.new_context(timezone_id='Asia/Manila').new_page(); pg.add_init_script(stub)
    pg.clock.set_fixed_time('2026-11-20T10:00:00+08:00')
    for pat in ['**/chart.umd.min.js', '**/cdn.tailwindcss.com/**', '**/supabase-js@2**', '**/js.puter.com/**']: pg.route(pat, lambda r: r.fulfill(body='', content_type='text/javascript'))
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(html.as_uri()); pg.wait_for_timeout(700)
    js = lambda code, *a: pg.evaluate(code, (a[0] if len(a) == 1 else list(a)) if a else None)
    def fill(k, v): pg.evaluate("([k, v]) => { const el = document.getElementById('fm_' + k); if (el.type === 'checkbox') el.checked = !!v; else el.value = v; el.dispatchEvent(new Event('change', {bubbles: true})); }", [k, v])
    def submit(): return pg.evaluate("async () => { await UI.submitForm(); return document.getElementById('formModal').classList.contains('hidden') ? '' : (document.getElementById('formModal').innerText || '').slice(0, 200); }")
    js("() => { CURRENCY = 'PHP'; Store.state = Store.blank(); Store.state.initialBalance = 10000; Store.save(); document.querySelectorAll('#authScreen,#onboarding').forEach(e => e && e.classList.add('hidden')); }")
    personal = lambda: js("() => ({ cash: Store.balance(), spent: Store.totals().expense, income: Store.totals().income, nw: NetWorth.at().net })")
    R = lambda bid=None: js("(id) => { const b = id ? Biz.get(id) : Biz.current(); const r = Biz.report(b.id, '2026-11-01', '2026-11-30'); return { ...r, cash: Biz.cash(b.id), ar: Biz.receivables(b.id), byCat: undefined, byItem: undefined }; }", bid)

    # 1. Set up through the real form (Business button → setup)
    js("() => { document.getElementById('bizBtn').click(); }"); pg.wait_for_timeout(100)
    check('business page opens', {'page': js("Nav.page")}, page='business')
    js("() => document.querySelector('[data-biz=\"new\"]').click()"); pg.wait_for_timeout(80)
    for k, v in {'name': 'Sunny Side Bakery', 'type': 'food', 'cash': 5000, 'bankName': 'BPI Business', 'bank': 20000}.items(): fill(k, v)
    err = submit()
    if err: fails.append('setup form: ' + err)
    check('business created with its accounts', {'n': js("Biz.list().length"), 'accs': js("Biz.accounts(Biz.current().id).length"), **R()}, n=1, accs=2, cash=25000, netSales=0)
    check('personal money untouched', personal(), cash=10000, spent=0, income=0, nw=10000)
    bid = js("Biz.current().id")

    # 2. Products through the real form
    for name, price, cost in [('Ensaymada (box of 6)', 300, 120), ('Pan de sal (pack)', 50, 20)]:
        js("() => UI.bizItemForm()"); fill('name', name); fill('price', price); fill('cost', cost); e = submit()
        if e: fails.append('item form: ' + e)
    ens, pds = js("() => Biz.items(Biz.current().id).map(i => i.id)")
    check('margin', {'m': js("(id) => Biz.margin(Biz.find('bizItems', id))", ens)}, m=60)

    # 3. A quick cash sale through the Sell screen
    js("() => { UI.bizTab = 'sell'; UI.bizDraft = null; UI.renderBiz(); }")
    def add_line(item, qty, price=None):
        pg.select_option('#bz_item', item); pg.wait_for_timeout(20)
        pg.fill('#bz_qty', str(qty))
        if price is not None: pg.fill('#bz_price', str(price))
        pg.click('[data-biz="add-line"]'); pg.wait_for_timeout(20)
    add_line(ens, 2); add_line(pds, 5)
    check('totals shown before saving', {'ok': 1 if '₱850.00' in pg.inner_text('#bz_totals') else 0}, ok=1)
    pg.click('[data-biz="save-sale"]'); pg.wait_for_timeout(100)
    check('cash sale: revenue, cost, cash', R(), count=1, netSales=850, cogs=340, grossProfit=510, cashIn=850, cash=25850, ar=0)
    check('…and nothing in personal', personal(), cash=10000, spent=0, income=0)

    # 4. Invoice on credit to a customer, with a discount
    js("() => UI.bizCustomerForm()"); fill('name', 'J. Dela Cruz'); fill('phone', '0917 000 0000'); submit()
    cid = js("Biz.customers(Biz.current().id)[0].id")
    inv = js("([b, e, c]) => Biz.recordSale(b, { kind: 'invoice', customerId: c, lines: [{ itemId: e, qty: 10, price: 300 }], discount: 200, date: '2026-11-15', dueDate: '2026-11-30' }).id", bid, ens, cid)
    check('invoice: revenue yes, cash no', R(), count=2, netSales=3650, cogs=1540, cashIn=850, cash=25850, ar=2800)
    check('invoice status', {'st': js("(id) => Biz.payStatus(Biz.find('bizSales', id))", inv)}, st='unpaid')
    # 5. Part payment into the bank: receivable down, cash up, NOT a new sale
    js("() => UI.bizPayForm(arguments[0])", inv) if False else js("(id) => UI.bizPayForm(id)", inv)
    fill('amount', 1000); fill('acc', js("Biz.accounts(Biz.current().id)[1].id")); e = submit()
    if e: fails.append('pay form: ' + e)
    check('part payment', {**R(), 'sales': js("Biz.of('bizSales', Biz.current().id).length"), 'st': js("(id) => Biz.payStatus(Biz.find('bizSales', id))", inv), 'cust': js("(id) => Biz.customerBalance(Biz.find('bizCustomers', id))", cid)},
          sales=2, netSales=3650, cashIn=1850, cash=26850, ar=1800, st='partial', cust=1800)
    over = js("(id) => { try { Biz.receivePayment(id, { amount: 2000, accountId: Biz.accounts(Biz.current().id)[0].id }); return 'took'; } catch (e) { return 'refused'; } }", inv)
    check('overpayment refused', {'r': over}, r='refused')

    # 6. Expense
    js("() => UI.bizExpenseForm()"); fill('amount', 400); fill('category', 'Packaging'); fill('vendor', 'Supplier'); e = submit()
    if e: fails.append('expense form: ' + e)
    check('expense and net profit', R(), expenses=400, grossProfit=2110, netProfit=1710, cash=26450)

    # 7. Owner money, linked to personal, counted once on each side
    js("() => UI.bizOwnerForm()"); fill('dir', 'in'); fill('amount', 10000); fill('acc', js("Biz.accounts(Biz.current().id)[1].id")); fill('personal', True); e = submit()
    if e: fails.append('owner form: ' + e)
    check('owner puts in: business cash up, not revenue', R(), cash=36450, netSales=3650, netProfit=1710, ownerIn=10000)
    check('owner puts in: personal cash down, not spending', personal(), cash=0, spent=0, income=0)
    js("() => Biz.ownerMove(Biz.current().id, { dir: 'out', amount: 3000, accountId: Biz.accounts(Biz.current().id)[0].id, personal: true })")
    check('owner takes out: not an expense', R(), cash=33450, expenses=400, netProfit=1710, ownerOut=3000)
    check('owner takes out: personal cash up, not income', personal(), cash=3000, income=0, spent=0)
    check('personal entries are linked', {'n': js("Store.state.transactions.filter(t => t.bizOwnerId).length")}, n=2)

    # 8. Selling below cost needs a yes
    low = js("([b, p]) => { try { Biz.recordSale(b, { lines: [{ itemId: p, qty: 1, price: 15 }], paid: 0 }); return 'saved'; } catch (e) { return e.belowCost ? 'asked' : e.message; } }", bid, pds)
    check('below cost stopped', {'r': low}, r='asked')
    lowId = js("([b, p]) => Biz.recordSale(b, { lines: [{ itemId: p, qty: 1, price: 15 }], paid: 0, allowBelowCost: true }).id", bid, pds)
    js("(id) => Biz.voidSale(id, 'mistake')", lowId)
    check('voided sale is out of every total', R(), count=2, netSales=3650, ar=1800)
    paidVoid = js("(id) => { try { Biz.voidSale(id); return 'voided'; } catch (e) { return 'refused'; } }", inv)
    check('sale with payments can\'t be voided', {'r': paidVoid}, r='refused')

    # 9. Tax (owner-configured) and a second business kept separate
    b2 = js("() => Biz.create({ name: 'Kape Corner', type: 'resto', taxMode: 'exclusive', taxRate: 12, cash: 0 }).id")
    js("(b) => Biz.recordSale(b, { lines: [{ name: 'Latte', qty: 10, price: 100 }], paid: 1120, accountId: Biz.accounts(b)[0].id })", b2)
    check('tax on top: tax isn\'t revenue', R(b2), netSales=1000, tax=120, cashIn=1120, cash=1120)
    js("(b) => { Biz.get(b).tax = { mode: 'inclusive', rate: 12 }; Biz.recordSale(b, { lines: [{ name: 'Latte', qty: 1, price: 112 }], paid: 112, accountId: Biz.accounts(b)[0].id }); }", b2)
    check('tax inside the price', R(b2), netSales=1100, tax=132)
    check('first business unaffected by the second', R(bid), netSales=3650, cash=33450)
    check('personal still unaffected', personal(), cash=3000, income=0, spent=0)

    # 10. Overview, invoice view, report screen and CSV show the right figures
    js("(b) => { Biz.setCurrent(b); UI.bizTab = 'overview'; UI.renderBiz(); }", bid)
    ov = pg.inner_text('#bizRoot')
    check('overview figures', {'ok': 1 if all(x in ov for x in ['₱3,650.00', '₱1,800.00', '₱1,710.00', '₱33,450.00']) else 0}, ok=1)
    js("(id) => UI.bizViewSale(id)", inv); doc = pg.inner_text('#formModal'); js("() => UI.closeForm()")
    check('invoice shows balance due', {'ok': 1 if 'INVOICE' in doc and '₱1,800.00' in doc and 'J. Dela Cruz' in doc else 0}, ok=1)
    js("() => { UI.bizTab = 'reports'; UI.bizPeriod = 'month'; UI.renderBiz(); }")
    rp = pg.inner_text('#bizRoot')
    check('report screen', {'ok': 1 if all(x in rp for x in ['₱3,650.00', '₱1,540.00', '₱2,110.00', '₱1,710.00']) else 0}, ok=1)
    csv = js("(b) => Biz.csvReport(b, '2026-11-01', '2026-11-30')", bid)
    check('CSV for the accountant', {'ok': 1 if '"Net profit","1710"' in csv and '"Net sales (excl. tax)","3650"' in csv else 0}, ok=1)

    # 11. Backup → restore on an empty device: same figures; merge again adds nothing
    snap = R(bid); f = js("() => JSON.stringify(Backup.build())")
    js("() => { Store.state = Store.blank(); Store.save(); }")
    js("(f) => Backup.restore(Backup.validate(JSON.parse(f)), 'replace')", f)
    check('restored business figures', R(bid), netSales=snap['netSales'], netProfit=snap['netProfit'], cash=snap['cash'], ar=snap['ar'])
    js("(f) => Backup.restore(Backup.validate(JSON.parse(f)), 'merge')", f)
    check('merge doesn\'t double', {'sales': js("Biz.col('bizSales').length"), 'biz': js("Biz.list().length")}, sales=5, biz=2)

    # 12. Two devices each record a sale: sync merge keeps both
    m = js("""() => { const base = JSON.parse(JSON.stringify(Store.state)); const a = JSON.parse(JSON.stringify(base)), c = JSON.parse(JSON.stringify(base));
      a.bizSales.push({ id: 'dev-a', bizId: Biz.current().id, kind: 'sale', no: 'S-A', date: '2026-11-20', lines: [], status: 'open', gross: 0, discount: 0, net: 0, tax: 0, total: 0, revenue: 0, cogs: 0 }); a.savedAt = 2;
      c.bizSales.push({ id: 'dev-c', bizId: Biz.current().id, kind: 'sale', no: 'S-C', date: '2026-11-20', lines: [], status: 'open', gross: 0, discount: 0, net: 0, tax: 0, total: 0, revenue: 0, cogs: 0 }); c.savedAt = 3;
      const out = SyncMerge.merge(a, c, SyncMerge.fingerprint(base)); return ['dev-a', 'dev-c'].filter(id => out.bizSales.some(s => s.id === id)).length; }""")
    check('sales from two devices both kept', {'n': m}, n=2)

    # 13. Names with HTML stay text
    js("() => { Biz.saveCustomer(Biz.current().id, { name: '<img src=x onerror=\"window.__bx=1\">' }); UI.bizTab = 'customers'; UI.renderBiz(); }"); pg.wait_for_timeout(100)
    check('customer names can\'t run code', {'ran': 1 if js("!!window.__bx") else 0}, ran=0)
    b.close()
for f in fails: print('✗', f)
if errs: print('page errors:', errs[:4])
print(f'{passes}/{passes + len(fails)} business checks passed')
sys.exit(1 if fails or errs else 0)
