"""Tiffo Business Phase 3: POS & cash drawer, promos, loyalty, campaigns, locations, staff mode & permissions,
attendance, payroll, projects & time, shipping, activity history. Every number below was worked out by hand first.

"Sunny Side Café" (restaurant): Cash drawer ₱2,000, BPI ₱50,000, no tax.
Coffee ₱120 (cost 40, 50 in stock, barcode 4800001), Ensaymada ₱60 (cost 25, 30 in stock). Bodega location: move 10 coffee there.
Promo SALE10 = 10% off from ₱200, part of campaign "FB November" (ad spend ₱500 from BPI). Loyalty: 1 point per ₱100, ₱1 each.
Drawer opened with ₱2,000.
  POS 1 (scanned + tapped): 2 coffee + 1 ensaymada = 300 − SALE10 30 = ₱270 cash, J. Dela Cruz earns 2 points. Paid 500 → change 230.
  POS 2: 1 coffee for J using 2 points = 120 − 2 = ₱118 cash; earns 1 point → J has 1.
  POS 3: 3 ensaymada = ₱180 by GCash (into BPI, not the drawer).
  Drawer: 3 sales in the shift; expected cash 2,000 + 270 + 118 = 2,388; counted 2,380 → ₱8 short.
Sales 600 − discounts 32 = 568; COGS 105 + 40 + 75 = 220; gross profit 348.
Payroll (amounts are the owner's entries for the test, not official rates):
  Ana: ₱18,000/month paid twice a month → 9,000 + 4 OT h × 100 + 500 allowance = gross 9,900.
    SSS 450 / 950 fixed, PhilHealth 2.5% / 2.5% = 247.50 each, Pag-IBIG 100 / 100 → employee 797.50, employer 1,297.50, net 9,102.50.
  Ben: ₱80/hour × 16 recorded hours = 1,280, no deductions.
  Paid from BPI: net 10,382.50. Held: SSS 1,400, PhilHealth 495, Pag-IBIG 200 = 2,095. Remit SSS 1,400 → 695 left.
Expenses: wages 11,180 + employer 1,297.50 + ads 500 + drawer short 8 = 12,985.50 → net −12,637.50.
BPI 50,000 − 500 + 180 − 10,382.50 − 1,400 = 37,897.50; cash 2,380 → ₱40,277.50.
Campaign: spent 500, 1 tagged sale (₱270, gross profit 165) → ₱0.54 of sales per ₱1.
Project "Catering for Reyes" (₱500/h): owner 3 h + Ben 2 h (cost ₱80/h) + ₱300 supplies → billed 5 h = ₱2,500; costs 460; profit ₱2,040.
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
    js("() => { CURRENCY = 'PHP'; LS.removeItem('tiffo.biz.staff'); Store.state = Store.blank(); Store.state.initialBalance = 10000; Store.save(); document.querySelectorAll('#authScreen,#onboarding').forEach(e => e && e.classList.add('hidden')); }")
    js("() => { const b = Biz.create({ name: 'Sunny Side Café', type: 'resto', cash: 2000, bankName: 'BPI', bank: 50000, taxMode: 'none' }); Biz.accounts(b.id)[0].name = 'Cash drawer'; }")
    ids = js("() => { const b = Biz.current(), a = Biz.accounts(b.id); return { cash: a[0].id, bank: a[1].id }; }")
    check('restaurant tools on by default', {'m': ','.join(js("() => Biz.modules(Biz.current())"))}, m='pos,team,marketing,production')
    js("() => { const b = Biz.current(); b.modules = [...Biz.modules(b), 'projects', 'locations']; }")
    coffee = js("() => Biz.saveItem(Biz.current().id, { kind: 'product', name: 'Coffee', price: 120, cost: 40, track: true, opening: 50, category: 'Drinks' }).id")
    ens = js("() => Biz.saveItem(Biz.current().id, { kind: 'product', name: 'Ensaymada', price: 60, cost: 25, track: true, opening: 30, category: 'Pastry' }).id")
    js("(id) => { const i = Biz.find('bizItems', id); i.barcode = '4800001'; }", coffee)
    cust = js("() => Biz.saveCustomer(Biz.current().id, { name: 'J. Dela Cruz' }).id")

    # Locations
    e = form("() => UI.bizAct3('location')", {'name': 'Bodega', 'type': 'warehouse'})
    if e: fails.append('location form: ' + e)
    bodega = js("() => Biz.of('bizLocations', Biz.current().id)[0].id")
    js("(id) => UI.bizTransferForm(id)", coffee); fill('from', ''); fill('to', bodega); fill('qty', 10); e = submit()
    if e: fails.append('transfer form: ' + e)
    check('stock moved between locations', {'main': js("(id) => Biz.stockAt(id, null)", coffee), 'bodega': js("([i, l]) => Biz.stockAt(i, l)", coffee, bodega), 'total': js("(id) => Biz.stockOf(id).qty", coffee), 'value': js("(id) => Biz.stockOf(id).value", coffee)}, main=40, bodega=10, total=50, value=2000)
    check('can’t move more than is there', {'e': err("([i, l]) => Biz.transferStock(Biz.current().id, { itemId: i, from: l, to: null, qty: 11 })", [coffee, bodega])[:7]}, e='Only 10')

    # Marketing setup
    e = form("() => UI.bizCampaignForm()", {'name': 'FB November', 'platform': 'facebook', 'budget': 1000})
    if e: fails.append('campaign form: ' + e)
    camp = js("() => Biz.of('bizCampaigns', Biz.current().id)[0].id")
    e = form("() => UI.bizPromoForm()", {'code': 'sale10', 'type': 'percent', 'value': 10, 'minSpend': 200, 'camp': camp})
    if e: fails.append('promo form: ' + e)
    e = form("() => UI.bizLoyaltyForm()", {'on': True, 'spend': 100, 'value': 1, 'tiers': 'Gold, 1000'})
    if e: fails.append('loyalty form: ' + e)
    e = form("() => UI.bizExpenseForm()", {'amount': 500, 'category': 'Advertising & marketing', 'acc': ids['bank'], 'camp': camp})
    if e: fails.append('ad expense: ' + e)
    check('promo code too small', {'e': err("() => Biz.promoFor(Biz.current().id, 'SALE10', 120)")[:21]}, e='SALE10 needs a purcha')

    # Drawer + POS through the screen
    js("() => { Nav.go('business'); UI.bizTab = 'pos'; UI.renderBiz(); }")
    js("() => UI.bizAct3('open-shift')"); fill('float', 2000); e = submit()
    if e: fails.append('open drawer: ' + e)
    pg.fill('#posSearch', '4800001'); pg.press('#posSearch', 'Enter'); pg.wait_for_timeout(60)
    pg.fill('#posSearch', '4800001'); pg.press('#posSearch', 'Enter'); pg.wait_for_timeout(60)
    js("(id) => UI.bizAct3('add', id)", ens)
    pg.select_option('#posCust', cust); pg.wait_for_timeout(40)
    pg.fill('#posPromo', 'sale10'); pg.dispatch_event('#posPromo', 'change'); pg.wait_for_timeout(40)
    pg.fill('#posTender', '500'); pg.wait_for_timeout(40)
    check('POS cart and change', {'cart': js("() => UI.posCart.lines.map(l => l.qty + ' ' + l.name).join(', ')"), 'total': js("() => UI.posTotals(Biz.current()).total"), 'change': 'Change: ₱230.00' in pg.inner_text('#posChange')}, cart='2 Coffee, 1 Ensaymada', total=270, change=True)
    pg.click('[data-biz3="charge"]'); pg.wait_for_timeout(150)
    s1 = js("() => Biz.of('bizSales', Biz.current().id).at(-1)")
    check('POS sale 1', s1, total=270, revenue=270, cogs=105, promoDiscount=30, method='cash')
    check('J earned points', {'p': js("(c) => Biz.pointsOf(c)", cust)}, p=2)
    js("(id) => UI.bizAct3('add', id)", coffee); pg.select_option('#posCust', cust); pg.wait_for_timeout(40)
    pg.fill('#posPts', '5'); pg.wait_for_timeout(40)
    check('can’t use more points than they have', {'pts': js("() => UI.posCart.points")}, pts=2)
    pg.click('[data-biz3="charge"]'); pg.wait_for_timeout(150)
    check('POS sale 2 with points', js("() => Biz.of('bizSales', Biz.current().id).at(-1)"), total=118, pointsRedeemed=2, pointsDiscount=2)
    check('points after using and earning', {'p': js("(c) => Biz.pointsOf(c)", cust)}, p=1)
    js("(id) => { UI.posAdd(id); UI.posAdd(id); UI.posAdd(id); UI.posCart.method = 'gcash'; }", ens)
    js("() => UI.posCharge()"); pg.wait_for_timeout(150)
    check('GCash sale goes to the bank', js("() => { const s = Biz.of('bizSales', Biz.current().id).at(-1); return { total: s.total, method: s.method, acc: Biz.col('bizPayments').find(p => p.saleId === s.id).accountId }; }"), total=180, method='gcash', acc=ids['bank'])
    check('stock at the location', {'main': js("(id) => Biz.stockAt(id, null)", coffee), 'nostock': js("(id) => { try { Biz.recordSale(Biz.current().id, { lines: [{ itemId: id, qty: 38, price: 120 }], paid: 0 }); return 'sold'; } catch (e) { return e.noStock ? 'asked' : e.message; } }", coffee)}, main=37, nostock='asked')
    sh = js("() => Biz.openShiftFor(Biz.current().id).id")
    check('drawer expected', js("(id) => Biz.shiftExpected(Biz.find('bizShifts', id))", sh), cashIn=388, out=0, expected=2388, count=3)
    js("(id) => UI.bizAct3('close-shift', id)", sh); fill('counted', 2380); e = submit()
    if e: fails.append('close drawer: ' + e)
    check('drawer short recorded', js("(id) => Biz.find('bizShifts', id)", sh), status='closed', expected=2388, counted=2380, diff=-8)
    check('cash drawer balance = what was counted', {'b': js("(id) => Biz.balance(Biz.find('bizAccounts', id))", ids['cash'])}, b=2380)

    # Staff, attendance, payroll
    e = form("() => UI.bizEmpForm()", {'name': 'Ana', 'role': 'cashier', 'payType': 'monthly', 'rate': 18000, 'payFreq': 'semi', 'otRate': 100, 'dn0': 'SSS', 'dm0': 'fixed', 'de0': 450, 'dr0': 950, 'dn1': 'PhilHealth', 'dm1': 'percent', 'de1': 2.5, 'dr1': 2.5, 'dn2': 'Pag-IBIG', 'dm2': 'fixed', 'de2': 100, 'dr2': 100})
    if e: fails.append('employee form: ' + e)
    e = form("() => UI.bizEmpForm()", {'name': 'Ben', 'role': 'staff', 'payType': 'hourly', 'rate': 80})
    if e: fails.append('employee 2: ' + e)
    ana, ben = js("() => Biz.employees(Biz.current().id).map(e => e.id)")
    check('empty deduction rows aren’t saved', {'n': js("(id) => Biz.find('bizEmployees', id).deductions.length", ben)}, n=0)
    for d in ['2026-11-18', '2026-11-19']:
        e = form("() => UI.bizAttendForm()", {'emp': ben, 'kind': 'work', 'hours': 8, 'date': d})
        if e: fails.append('attendance: ' + e)
    js("(id) => { UI.bizPayrollForm(); }")
    fill('from', '2026-11-01'); fill('to', '2026-11-30'); fill(f'ot_{ana}', 4); fill(f'al_{ana}', 500); fill('acc', ids['bank'])
    check('hours filled in from attendance', {'h': pg.evaluate(f"document.getElementById('fm_hours_{ben}').value")}, h='16')
    pg.evaluate("() => { window.__ask = window.askConfirm; window.askConfirm = async (m) => { window.__msg = m; return true; }; }")
    e = submit(); pg.wait_for_timeout(150)
    if e: fails.append('payroll form: ' + e)
    run = js("() => Biz.of('bizPayruns', Biz.current().id)[0]")
    check('payroll totals', run or {}, gross=11180, eeTotal=797.5, erTotal=1297.5, net=10382.5)
    check('Ana’s pay', (run or {'lines': [{}]})['lines'][0], base=9000, ot=400, allowances=500, gross=9900, eeTotal=797.5, erTotal=1297.5, net=9102.5)
    check('payroll preview shown before paying', {'m': 'net ₱9,102.50' in (pg.evaluate("window.__msg") or '')}, m=True)
    check('held for agencies', js("() => Biz.payrollOwed(Biz.current().id)"), **{'SSS': 1400, 'PhilHealth': 495, 'Pag-IBIG': 200})
    e = form("() => UI.bizAct3('remit', 'SSS')", {'amount': 1400, 'acc': ids['bank']})
    if e: fails.append('remit: ' + e)
    check('after paying SSS', {'t': js("() => Biz.payrollOwedTotal(Biz.current().id)"), 'e': err("() => Biz.remit(Biz.current().id, { name: 'PhilHealth', amount: 999, accountId: Biz.accounts(Biz.current().id)[0].id })")[:7]}, t=695, e='Only ₱4')
    check('overtime needs a rate', {'e': err("(id) => Biz.payFor(id, { hours: 1, otHours: 2 })", ben)[:7]}, e='Set Ben')

    # The month so far
    R = lambda: js("() => { const id = Biz.current().id, r = Biz.report(id, '2026-11-01', '2026-11-30'); return { ...r, byItem: undefined, cash: Biz.cash(id) }; }")
    r = R()
    check('November P&L', r, grossSales=600, discounts=32, netSales=568, cogs=220, grossProfit=348, expenses=12985.5, netProfit=-12637.5, cash=40277.5)
    check('expense lines', r['byCat'], **{'Salaries & wages': 11180, 'Employer contributions': 1297.5, 'Advertising & marketing': 500, 'Cash short / over': 8})
    check('cash flow', r, cashIn=568, payroll=11782.5, cashDiff=-8)
    check('bank balance', {'b': js("(id) => Biz.balance(Biz.find('bizAccounts', id))", ids['bank'])}, b=37897.5)
    check('position shows payroll owed', js("() => Biz.position(Biz.current().id)"), payroll=695)
    check('campaign results (tagged only)', js("(id) => Biz.campaignStats(Biz.find('bizCampaigns', id))", camp), spend=500, count=1, revenue=270, profit=165, perPeso=0.54)
    check('promo results', js("() => Biz.promoStats(Biz.of('bizPromos', Biz.current().id)[0])"), uses=1, revenue=270, discount=30)
    bm = {x['label']: x['revenue'] for x in js("() => Biz.breakdown(Biz.current().id, '2026-11-01', '2026-11-30', 'method')")}
    check('sales by payment method', bm, Cash=388, GCash=180)

    # Returns take back points; stock goes back where it was sold
    js("(id) => Biz.returnItems(id, { lines: [{ i: 0, qty: 1 }], refund: 108, accountId: Biz.accounts(Biz.current().id)[0].id })", s1['id'])
    check('return takes back points in proportion', {'p': js("(c) => Biz.pointsOf(c)", cust), 'main': js("(id) => Biz.stockAt(id, null)", coffee)}, p=0, main=38)

    # Projects & time
    e = form("() => UI.bizProjectForm()", {'name': 'Catering for Reyes', 'cust': cust, 'rate': 500, 'quoted': 5000})
    if e: fails.append('project form: ' + e)
    proj = js("() => Biz.of('bizProjects', Biz.current().id)[0].id")
    e = form("() => UI.bizTimeForm()", {'emp': '', 'project': proj, 'hours': 3})
    if e: fails.append('time 1: ' + e)
    e = form("() => UI.bizTimeForm()", {'emp': ben, 'project': proj, 'start': '13:00', 'end': '15:00'})
    if e: fails.append('time 2: ' + e)
    js("(id) => { const e = Biz.find('bizEmployees', id); e.costRate = 0; }", ben)
    e = form("() => UI.bizExpenseForm()", {'amount': 300, 'category': 'Supplies', 'acc': ids['bank'], 'proj': proj})
    if e: fails.append('project expense: ' + e)
    check('project before billing', js("(id) => Biz.projectSummary(Biz.find('bizProjects', id))", proj), hours=5, unbilledHours=5, unbilledValue=2500, labor=160, expenses=300)
    inv = js("(id) => Biz.invoiceTime(id, {})", proj)
    check('hours billed as one invoice', inv, kind='invoice', total=2500)
    check('project after billing', js("(id) => Biz.projectSummary(Biz.find('bizProjects', id))", proj), unbilledHours=0, invoiced=2500, costs=460, profit=2040, unpaid=2500)
    check('can’t bill the same hours twice', {'e': err("(id) => Biz.invoiceTime(id)", proj)[:11]}, e='No approved')
    e = form("() => UI.bizTaskForm()", {'title': 'Buy napkins', 'project': proj, 'checklist': '[x] white\nblue'})
    if e: fails.append('task: ' + e)
    check('task checklist', {'n': js("() => Biz.col('bizTasks')[0].checklist.filter(c => c.done).length + '/' + Biz.col('bizTasks')[0].checklist.length")}, n='1/2')

    # Shipping cost becomes a linked expense
    o = js("([i, c]) => Biz.createOrder(Biz.current().id, { customerId: c, lines: [{ itemId: i, qty: 2, price: 60 }] }).id", ens, cust)
    js("(id) => UI.bizShipForm(id)", o); fill('method', 'courier'); fill('courier', 'Lalamove'); fill('cost', 150); fill('acc', ids['bank']); e = submit()
    if e: fails.append('ship form: ' + e)
    check('shipping cost recorded once', js("(id) => { const o = Biz.find('bizOrders', id), e = Biz.find('bizExpenses', o.shipping.costExpenseId); return { cat: e.category, amt: e.amount, link: e.orderId === o.id, again: (() => { try { Biz.setShipping(id, { cost: 10, accountId: e.accountId }); return 'twice'; } catch (x) { return 'once'; } })() }; }", o), cat='Shipping', amt=150, link=True, again='once')

    # Staff mode & permissions
    check('staff mode needs the owner’s lock', {'e': err("(id) => Biz.enterStaff(id)", ana)[:9]}, e='Set an ap')
    js("() => { window.__secOn = Sec.on; Sec.on = () => true; UI.requirePin = async () => true; }")
    js("(id) => UI.bizAct3('staff-mode')"); fill('emp', ana); e = submit()
    if e: fails.append('staff mode: ' + e)
    tabs = js("() => [...document.querySelectorAll('[data-biztab]')].map(x => x.dataset.biztab).join(',')")
    check('cashier sees only their tabs', {'t': tabs}, t='pos,sell,invoices,orders,customers,team,projects')
    check('staff mode locks the device to Business', {'page': js("() => { Nav.go('money'); return Nav.page; }"), 'cls': js("() => document.documentElement.classList.contains('staff-mode')"), 'pick': js("() => document.querySelectorAll('#bizPick option').length")}, page='business', cls=True, pick=1)
    check('cashier can’t run payroll', {'e': err("() => Biz.runPayroll(Biz.current().id, { from: '2026-11-01', to: '2026-11-30', accountId: 'x', lines: [] })")[:9]}, e='Your role')
    check('cashier can’t change prices', {'e': err("(id) => Biz.saveItem(Biz.current().id, { kind: 'product', name: 'Coffee', price: 10, cost: 40 }, Biz.find('bizItems', id))", coffee)[:9]}, e='Your role')
    check('cashier can’t refund', {'e': err("(id) => Biz.voidSale(id)", inv['id'])[:9]}, e='Your role')
    js("(id) => { UI.posAdd(id); UI.posCart.method = 'cash'; UI.posCart.customerId = ''; }", ens); js("() => UI.posCharge()"); pg.wait_for_timeout(150)
    check('cashier sale is credited to them', {'by': js("() => Biz.of('bizSales', Biz.current().id).at(-1).soldBy")}, by=ana)
    check('cashier records only their own time', js("([p, b]) => Biz.addTime(Biz.current().id, { projectId: p, hours: 1 })", proj, ben), empId=ana, approved=False)
    js("(id) => UI.bizAct3('clock', id)", ana)
    check('clocked in', {'n': js("(id) => Biz.col('bizAttend').filter(a => a.empId === id && !a.out).length", ana)}, n=1)
    js("() => UI.bizAct3('leave-staff')"); pg.wait_for_timeout(100)
    check('owner back after the PIN', {'staff': js("() => !!Biz.staff()"), 'cls': js("() => document.documentElement.classList.contains('staff-mode')")}, staff=False, cls=False)
    log = js("() => Biz.of('bizLog', Biz.current().id).map(x => x.byName + ': ' + x.action)")
    check('activity history says who', {'a': 'Ana: Sale recorded' in log, 'b': 'Owner: Payroll run' in log, 'c': 'Ana: Staff mode started' in log or 'Owner: Staff mode started' in log, 'd': any('Drawer closed' in x for x in log)}, a=True, b=True, c=True, d=True)
    check('staff sales by person', {k['label']: k['count'] for k in js("() => Biz.breakdown(Biz.current().id, '2026-11-01', '2026-11-30', 'employee')")}, Ana=1)

    # Screens render, modules hide tabs, personal untouched, backup round-trip
    for tab in ['pos', 'team', 'projects', 'marketing', 'settings', 'stock', 'reports', 'orders']:
        js("(t) => { UI.bizTab = t; UI.renderBiz(); }", tab)
        if not js("() => document.getElementById('bizBody').innerText.length"): fails.append('empty tab ' + tab)
    js("() => { const b = Biz.current(); b.modules = []; UI.bizTab = 'overview'; UI.renderBiz(); }")
    check('tools turned off hide their tabs', {'t': js("() => ['pos','team','projects','marketing'].filter(k => document.querySelector(`[data-biztab=\"${k}\"]`)).length")}, t=0)
    check('personal untouched', js("() => ({ cash: Store.balance() })"), cash=10000)
    rt = js("""() => { const before = JSON.stringify(Biz.position(Biz.current().id)); const keep = JSON.parse(JSON.stringify(Store.state));
      Store.state = Backup.upgrade ? Backup.upgrade(JSON.parse(JSON.stringify(keep))) : JSON.parse(JSON.stringify(keep)); const after = JSON.stringify(Biz.position(Biz.current().id)); Store.state = keep;
      return { same: before === after, arrays: BIZ_ARRAYS.every((k) => Backup.ARRAYS.includes(k)) }; }""")
    check('backup keeps phase 3 data', rt, same=True, arrays=True)
    if errs: fails.append('page errors: ' + '; '.join(errs[:3]))
    b.close()
print('\n'.join('FAIL ' + f for f in fails))
print(f"{passes}/{passes + len(fails)} business phase 3 checks passed")
sys.exit(1 if fails else 0)
