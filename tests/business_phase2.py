"""Tiffo Business Phase 2: stock, purchases, suppliers, returns, loans, cash flow.
Every number below was worked out by hand first.

Shop "Sunny Side Tees": cash 5,000 + bank 20,000. T-shirt sells ₱400, cost ₱150, 10 in stock → stock ₱1,500.
PO-0001 to Metro Textile (pay within 30 days): 20 tees @ ₱180 + ₱200 shipping (ordered ₱3,600).
  Arrived: 15 good, 2 damaged, 3 missing. Landed cost each = 180 + 200 × 180/3,600 = ₱190.
  Stock 25, average (1,500 + 15×190) / 25 = ₱174 → ₱4,350.  Damaged 2 × 190 = ₱380 stock loss.
  Billed (15+2)×180 + 200 × 3,060/3,600 = 3,060 + 170 = ₱3,230. Paid ₱1,000 → owe ₱2,230.
Cash sale 5 tees: revenue 2,000, COGS 5 × 174 = 870 → stock 20.
Invoice 4 tees to J. Dela Cruz (due 1 Dec), paid 600: revenue 1,600, COGS 696, owes 1,000 → stock 16.
Return 1 tee from the invoice, back into stock, no cash: −400 sales, −174 COGS, owes 600 → stock 17 (₱2,958).
Return 1 damaged tee from the cash sale, ₱400 cash refund: −400 sales; its cost stays in COGS.
Rent bill ₱1,500 not paid yet (due 5 Dec). Supplies ₱300 paid.
Loan ₱12,000 at 12%/yr, 12 monthly payments: payment = 120 / (1 − 1.01^−12) = ₱1,066.19.
  First payment: interest 12,000 × 1% = ₱120, principal ₱946.19 → owe ₱11,053.81.
November: net sales 2,000 + 1,600 − 800 = 2,800; COGS 870 + 696 − 174 = 1,392; gross 1,408.
  Expenses 1,500 + 300 + 380 + 120 = 2,300 → net −892.
Cash 25,000 + 2,000 + 600 − 1,000 − 400 − 300 + 12,000 − 1,066.19 = ₱36,833.81.
Position: own 36,833.81 + 600 + 2,958 = 40,391.81; owe 3,730 + 11,053.81 = 14,783.81; worth ₱25,608
  = starting 25,000 + starting stock 1,500 − 892 loss. ✓
Next 30 days (to 20 Dec): +600 in; −2,230 PO (due 20 Dec) −1,500 rent −1,066.19 loan → expected ₱32,637.62.
"""
import sys, pathlib
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
    def submit(): return pg.evaluate("async () => { await UI.submitForm(); return document.getElementById('formModal').classList.contains('hidden') ? '' : (document.getElementById('formModal').innerText || '').slice(0, 300); }")
    def form(open_js, values, *a):
        js(open_js, *a) if a else js(open_js); pg.wait_for_timeout(40)
        for k, v in values.items(): fill(k, v)
        return submit()
    js("() => { CURRENCY = 'PHP'; Store.state = Store.blank(); Store.state.initialBalance = 10000; Store.save(); document.querySelectorAll('#authScreen,#onboarding').forEach(e => e && e.classList.add('hidden')); }")
    js("() => { Biz.create({ name: 'Sunny Side Tees', type: 'retail', cash: 5000, bankName: 'BPI Business', bank: 20000, taxMode: 'none' }); }")
    bid = js("Biz.current().id"); cashAcc = js("Biz.accounts(Biz.current().id)[0].id")
    R = lambda: js("() => { const id = Biz.current().id, r = Biz.report(id, '2026-11-01', '2026-11-30'); return { ...r, byCat: undefined, byItem: undefined, cash: Biz.cash(id), ar: Biz.receivables(id), ap: Biz.payables(id), inv: Biz.inventoryValue(id) }; }")
    S = lambda: js("(id) => Biz.stockOf(id)", tee)

    # 1. Tracked product with starting stock, through the real form
    e = form("() => UI.bizItemForm()", {'name': 'T-shirt', 'price': 400, 'cost': 150, 'track': True, 'opening': 10})
    if e: fails.append('item form: ' + e)
    tee = js("() => Biz.items(Biz.current().id)[0].id")
    check('starting stock', S(), qty=10, avg=150, value=1500)
    check('older products stay untracked', {'t': js("() => Biz.tracked({ kind: 'product' })")}, t=False)

    # 2. Supplier and purchase order: nothing changes until it arrives
    e = form("() => UI.bizSupplierForm()", {'name': 'Metro Textile', 'terms': 30})
    if e: fails.append('supplier form: ' + e)
    sup = js("() => Biz.suppliers(Biz.current().id)[0].id")
    po = js("([s, t]) => Biz.createPurchase(Biz.current().id, { supplierId: s, lines: [{ itemId: t, qty: 20, unitCost: 180 }], shipping: 200 }).id", sup, tee)
    check('PO: no stock, no debt, no cash yet', {**R(), 'incoming': js("(t) => Biz.incoming(t)", tee), **{'q': S()['qty']}}, q=10, ap=0, cash=25000, incoming=20, expenses=0)

    # 3. Receive through the form: 15 good, 2 damaged, 3 missing
    js("(id) => UI.bizReceiveForm(id)", po); fill('g0', 15); fill('d0', 2); fill('m0', 3); e = submit()
    if e: fails.append('receive form: ' + e)
    check('stock at weighted average landed cost', S(), qty=25, avg=174, value=4350)
    check('purchase billed for what arrived', {'billed': js("(id) => Biz.purchaseBilled(Biz.find('bizPurchases', id))", po), 'st': js("(id) => Biz.find('bizPurchases', id).status", po), **R()}, billed=3230, st='received', ap=3230, cogs=0, cash=25000)
    check('damaged on arrival is a stock loss, not stock', R(), expenses=380, netProfit=-380)
    e = form("(id) => UI.bizPaySupplierForm('po', id)", {'amount': 1000, 'acc': cashAcc}, po)
    if e: fails.append('pay supplier: ' + e)
    check('part-paid supplier', R(), ap=2230, cash=24000, cashOut=1000, supplierPaid=1000)
    check('cannot overpay a supplier', {'err': js("(id) => { try { Biz.paySupplier(Biz.current().id, { purchaseId: id, amount: 5000, accountId: Biz.accounts(Biz.current().id)[0].id }); return ''; } catch (e) { return e.message; } }", po)[:7]}, err='Only ₱2')

    # 4. Sales use the average cost and take stock out
    cust = js("() => Biz.saveCustomer(Biz.current().id, { name: 'J. Dela Cruz' }).id")
    s1 = js("([t, a]) => Biz.recordSale(Biz.current().id, { lines: [{ itemId: t, qty: 5, price: 400 }], paid: 2000, accountId: a }).id", tee, cashAcc)
    s2 = js("([t, a, c]) => Biz.recordSale(Biz.current().id, { kind: 'invoice', customerId: c, lines: [{ itemId: t, qty: 4, price: 400 }], paid: 600, accountId: a, dueDate: '2026-12-01' }).id", tee, cashAcc, cust)
    check('stock after two sales', S(), qty=16, avg=174, value=2784)
    check('COGS at average cost', R(), netSales=3600, cogs=1566, ar=1000)
    check('selling more than in stock needs a yes', {'e': js("(t) => { try { Biz.recordSale(Biz.current().id, { lines: [{ itemId: t, qty: 99, price: 400 }], paid: 0 }); return 'no'; } catch (e) { return e.noStock ? 'asked' : e.message; } }", tee)}, e='asked')

    # 5. Returns through the form
    js("(id) => UI.bizReturnForm(id)", s2); fill('q0', 1); fill('r0', True); e = submit()
    if e: fails.append('return form: ' + e)
    check('restocked return lowers what is owed', {**R(), 'due': js("(id) => Biz.dueOn(Biz.find('bizSales', id))", s2)}, due=600, ar=600, netSales=3200, returns=400, cogs=1392)
    check('restocked at the cost it left with', S(), qty=17, avg=174, value=2958)
    bad = js("([s, a]) => { try { Biz.returnItems(s, { lines: [{ i: 0, qty: 1 }], refund: 0 }); return 'no'; } catch (e) { return e.message.slice(0, 22); } }", s1, cashAcc)
    check('paid-in-full return needs a cash refund', {'e': bad}, e='The customer only owes')
    js("(id) => UI.bizReturnForm(id)", s1); fill('q0', 1); fill('r0', False); fill('refund', 400); fill('acc', cashAcc); fill('reason', 'torn seam'); e = submit()
    if e: fails.append('refund form: ' + e)
    check('damaged return: refund, no restock, cost stays', {**R(), 'q': S()['qty'], 'due': js("(id) => Biz.dueOn(Biz.find('bizSales', id))", s1)}, q=17, due=0, netSales=2800, cogs=1392, refunds=400, cash=26200)
    check('cannot return more than sold', {'e': js("(id) => { try { Biz.returnItems(id, { lines: [{ i: 0, qty: 9 }] }); return 'no'; } catch (e) { return e.message.slice(0, 5); } }", s1)}, e='Only ')
    check('paid sale can’t be voided', {'e': js("(id) => { try { Biz.voidSale(id); return 'no'; } catch (e) { return e.message.slice(0, 20); } }", s1)}, e='This sale has paymen')

    # 6. An unpaid bill and a paid expense
    e = form("() => UI.bizExpenseForm()", {'amount': 1500, 'category': 'Rent', 'unpaid': True, 'dueDate': '2026-12-05'})
    if e: fails.append('bill form: ' + e)
    js("(a) => Biz.addExpense(Biz.current().id, { amount: 300, category: 'Supplies', accountId: a })", cashAcc)
    check('unpaid bill: expense now, cash later', R(), cash=25900, ap=3730, expenses=2180)

    # 7. Business loan reusing the personal loan maths
    e = form("() => UI.bizLoanForm()", {'lender': 'Coop Bank', 'principal': 12000, 'rate': 12, 'term': 12, 'acc': cashAcc, 'date': '2026-11-01'})
    if e: fails.append('loan form: ' + e)
    loan = js("() => Biz.of('bizLoans', Biz.current().id)[0].id")
    check('loan: money in, not revenue', {**R(), 'pay': js("(id) => Biz.loanPayment(Biz.find('bizLoans', id))", loan)}, pay=1066.19, cash=37900, netSales=2800, loanIn=12000)
    e = form("(id) => UI.bizPayLoanForm(id)", {'amount': 1066.19, 'acc': cashAcc}, loan)
    if e: fails.append('loan payment: ' + e)
    lp = js("() => Biz.col('bizLoanPays')[0]")
    check('loan payment split like personal loans', lp, interest=120, principal=946.19)
    check('owed after first payment', {'o': js("(id) => Biz.loanOwed(Biz.find('bizLoans', id))", loan)}, o=11053.81)

    # 8. The whole month
    check('November P&L', R(), netSales=2800, cogs=1392, grossProfit=1408, expenses=2300, netProfit=-892, cash=36833.81, ar=600, ap=3730, inv=2958)
    check('cash flow sections', R(), cashIn=2600, cashOut=1700, loanIn=12000, loanOut=1066.19)
    check('business position adds up', js("() => Biz.position(Biz.current().id)"), cash=36833.81, receivables=600, inventory=2958, own=40391.81, payables=3730, loans=11053.81, owe=14783.81, net=25608)
    check('30-day estimate', js("() => Biz.projection(Biz.current().id, 30)"), expIn=600, expOut=4796.19, end=32637.62)
    check('balances add up per account', {'sum': js("() => round2(Biz.accounts(Biz.current().id).reduce((x, a) => x + Biz.balance(a), 0))")}, sum=36833.81)

    # 9. Low stock + suggested reorder: sold 9 in 60 days, 14-day lead, warn at 18, 17 available
    js("(id) => { const i = Biz.find('bizItems', id); i.reorder = 18; i.leadDays = 14; }", tee)
    check('low-stock alert', {'n': js("() => Biz.lowStock(Biz.current().id).length")}, n=1)
    check('suggested reorder = ceil(9/60×14 + 18 − 17)', {'s': js("(id) => Biz.suggestReorder(Biz.find('bizItems', id))", tee)}, s=4)

    # 10. Orders: held, not revenue; completing makes the sale
    o = js("([t, c]) => Biz.createOrder(Biz.current().id, { customerId: c, lines: [{ itemId: t, qty: 2, price: 400 }] }).id", tee, cust)
    check('order holds stock, not revenue', {**R(), 'res': js("(t) => Biz.reserved(t)", tee), 'q': S()['qty']}, res=2, q=17, netSales=2800)
    js("(id) => Biz.setOrderStatus(id, 'shipped', { shipping: { courier: 'J&T', tracking: 'JT123' } })", o)
    js("(id) => UI.bizCompleteForm(id)", o); fill('paid', 800); fill('acc', cashAcc); e = submit()
    if e: fails.append('complete order: ' + e)
    check('completed order became a sale', {**R(), 'res': js("(t) => Biz.reserved(t)", tee), 'q': S()['qty'], 'st': js("(id) => Biz.find('bizOrders', id).status", o)}, res=0, q=15, st='completed', netSales=3600, cogs=1740)
    check('completed order is closed', {'e': js("(id) => { try { Biz.completeOrder(id); return 'no'; } catch (e) { return 'closed'; } }", o)}, e='closed')

    # 11. Stock adjustments with reasons; void puts stock back
    check('adjustment needs a reason', {'e': js("(t) => { try { Biz.adjustStock(Biz.current().id, t, { type: 'damage', qty: 1 }); return 'no'; } catch (e) { return e.message.slice(0, 7); } }", tee)}, e='Say why')
    js("(t) => Biz.adjustStock(Biz.current().id, t, { type: 'expired', qty: 1, reason: 'faded stock' })", tee)
    check('written off at average cost', {**R(), 'q': S()['qty']}, q=14, expenses=2474)
    s3 = js("([t, c]) => Biz.recordSale(Biz.current().id, { kind: 'invoice', customerId: c, lines: [{ itemId: t, qty: 3, price: 400 }], paid: 0, dueDate: '2026-12-10' }).id", tee, cust)
    js("(id) => Biz.voidSale(id)", s3)
    check('void returns the stock', {**R(), 'q': S()['qty']}, q=14, netSales=3600)

    # 12. Personal money untouched; screens render; backup round-trip
    check('personal untouched', js("() => ({ cash: Store.balance(), nw: NetWorth.at().net })"), cash=10000, nw=10000)
    for tab in ['overview', 'orders', 'stock', 'suppliers', 'invoices', 'reports', 'settings', 'products', 'expenses']:
        js("(t) => { UI.bizTab = t; UI.renderBiz(); }", tab)
        if not js("() => document.getElementById('bizBody').innerText.length"): fails.append('empty tab ' + tab)
    txt = js("() => { UI.bizTab = 'reports'; UI.renderBiz(); return document.getElementById('bizBody').innerText; }")
    check('reports show cash flow and position', {'a': 'Cash flow' in txt, 'b': 'Business position' in txt, 'c': 'Coming up' in txt}, a=True, b=True, c=True)
    rt = js("""() => { const j = JSON.stringify(Backup.payload ? Backup.payload() : Store.state); const before = Biz.position(Biz.current().id).net;
      const keep = JSON.parse(JSON.stringify(Store.state)); const data = JSON.parse(j); Store.state = Backup.upgrade ? Backup.upgrade(data.data || data) : (data.data || data);
      const after = Biz.position(Biz.current().id).net; Store.state = keep; return { before, after, arrays: BIZ_ARRAYS.every((k) => Backup.ARRAYS.includes(k)) }; }""")
    check('backup keeps everything', rt, arrays=True)
    check('round-trip position', {'d': abs(rt['before'] - rt['after'])}, d=0)
    if errs: fails.append('page errors: ' + '; '.join(errs[:3]))
    b.close()
print('\n'.join('FAIL ' + f for f in fails))
print(f"{passes}/{passes + len(fails)} business phase 2 checks passed")
sys.exit(1 if fails else 0)
