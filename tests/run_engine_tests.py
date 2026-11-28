"""Money-engine scenarios: every check is a real situation with the exact numbers expected.
Usage: python3 tests/run_engine_tests.py [path/to/tiffo.html] [--chrome /usr/bin/google-chrome]"""
import sys, pathlib, json
from playwright.sync_api import sync_playwright
here = pathlib.Path(__file__).resolve().parent
html = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else here.parent / 'tiffo.html').resolve()
chrome = sys.argv[sys.argv.index('--chrome') + 1] if '--chrome' in sys.argv else None
stub = "window.Chart=class{constructor(){}update(){}destroy(){}};Chart.defaults={font:{},color:''};"
fails, passes, errs = [], 0, []

with sync_playwright() as p:
    b = p.chromium.launch(**({'executable_path': chrome} if chrome else {}), args=['--no-sandbox'])
    pg = b.new_context(timezone_id='Asia/Manila').new_page()
    pg.clock.set_fixed_time('2026-11-20T10:00:00+08:00')
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route('**/chart.umd.min.js', lambda r: r.fulfill(body=stub, content_type='text/javascript'))
    pg.add_init_script(stub)
    for pat in ['**/cdn.tailwindcss.com/**', '**/supabase-js@2**', '**/js.puter.com/**']:
        pg.route(pat, lambda r: r.fulfill(body='', content_type='text/javascript'))
    pg.goto(html.as_uri()); pg.wait_for_timeout(600)

    def reset(cash=10000):
        pg.evaluate(f"""() => {{ CURRENCY='PHP'; Store.state = Store.blank(); Store.state.currency='PHP'; Store.state.initialBalance={cash}; Store.save(); }}""")
    def note(text, confirm=True):
        """Type a note like a user. If Tiffo asks to confirm, accept its suggestion."""
        pg.evaluate("async t => { document.getElementById('noteInput').value = t; await UI.submitNote(t); }", text); pg.wait_for_timeout(40)
        if confirm and not pg.evaluate("document.getElementById('formModal').classList.contains('hidden')"):
            pg.evaluate("UI.submitForm()"); pg.wait_for_timeout(40)
    def state():
        return pg.evaluate("""() => ({ cash: Store.balance(), owed: Accounts.owed(), income: Store.totals().income, spent: Store.totals().expense,
          theyOwe: Loans.totals().theyOwe, youOwe: Loans.totals().youOwe, entries: Store.state.transactions.length })""")
    def check(name, got, **want):
        global passes
        bad = {k: (v, got.get(k)) for k, v in want.items() if abs((got.get(k) or 0) - v) > 0.005}
        if bad: fails.append(f"{name}: " + ', '.join(f"{k} want {w} got {g}" for k, (w, g) in bad.items()))
        else: passes += 1

    # 1. Ordinary spending and income
    reset(); note('Sahod 18,000'); note('Groceries 1,500'); note('Jollibee 350')
    check('salary & spending', state(), cash=10000 + 18000 - 1500 - 350, income=18000, spent=1850)

    # 2. Refund lowers spending, adds cash
    reset(); note('Shopee 1,299 for shoes'); note('got a refund of 1,299 from Shopee')
    check('full refund', state(), cash=10000, spent=0)

    # 3. Transfer between own accounts changes nothing overall
    reset(); pg.evaluate("Accounts.create('GCash','ewallet')"); note('cash in 2000 to GCash')
    s = state(); check('cash-in transfer', s, cash=10000, income=0, spent=0)
    check('GCash got it', {'g': pg.evaluate("Accounts.balance(Accounts.find('GCash'))")}, g=2000)

    # 4. Informal loan with partial repayments and forgiveness (never income/spending)
    reset(); note('I lent Maria ₱2,000'); note('Maria paid back 500'); note('Maria paid back 700')
    check('loan partial repayments', state(), cash=10000 - 2000 + 1200, income=0, spent=0, theyOwe=800)
    note('I forgave Maria\'s remaining debt')
    check('loan forgiven', state(), theyOwe=0, cash=9200, spent=0)

    # 5. Borrowing and paying back
    reset(); note('Mom lent me ₱5,000'); note('I paid back ₱2,000 to Mom')
    check('borrow & repay', state(), cash=13000, youOwe=3000, income=0, spent=0)

    # 6. Credit card: purchase = spending + debt; payment = cash down + debt down, NOT spending again
    reset(); pg.evaluate("Accounts.create('BPI Credit Card','credit')")
    note('Bought shoes ₱2,000 using my credit card')
    check('card purchase', state(), cash=10000, owed=2000, spent=2000)
    note('Paid ₱2,000 toward my credit card')
    check('card payment', state(), cash=8000, owed=0, spent=2000)
    note('Groceries 1,000 with my credit card'); note('got a refund of 300 from Puregold on my credit card')
    check('card refund', state(), owed=700, spent=2700, cash=8000)
    note('Paid ₱400 toward my credit card')
    check('card partial payment', state(), owed=300, cash=7600, spent=2700)

    # 7. Investment purchase is not spending
    reset(); note('invested 5000 in MP2')
    check('investment not spending', state(), spent=0, income=0, cash=5000)

    # 8. Pocket allocation is internal
    reset(); note('send 1000 to my toys account')
    check('pocket allocation', state(), cash=10000, spent=0)
    check('pocket balance', {'p': pg.evaluate("Pockets.balance(Pockets.find('toys'))"), 'free': pg.evaluate("Pockets.free()")}, p=1000, free=9000)

    # 9. Several entries in one note
    reset(); note('lunch 200, coffee 150, grab 180')
    check('multi-entry note', state(), spent=530, entries=3)

    # 10. Delete goes to Recently deleted; restore brings it back
    reset(); note('Groceries 800'); tid = pg.evaluate("Store.state.transactions[0].id")
    pg.evaluate(f"UI.deleteEntry('{tid}')"); check('deleted', state(), spent=0, entries=0)
    pg.evaluate(f"Store.restoreTransaction('{tid}')"); check('restored from bin', state(), spent=800, entries=1)

    # 11. Editing keeps history
    pg.evaluate(f"Store.updateTransaction('{tid}', {{ amount: 850 }})")
    check('edit amount', state(), spent=850)
    check('edit history kept', {'h': pg.evaluate(f"Store.state.transactions.find(t=>t.id==='{tid}').history.at(-1).was.amount")}, h=800)

    # 12. Backup round-trip: merge skips duplicates (even with new ids), replace restores exactly
    reset(); note('Groceries 500'); note('Sahod 18,000')
    backup = pg.evaluate("JSON.stringify(Backup.build())")
    note('Jollibee 350')
    r = pg.evaluate("b => { const v = Backup.validate(JSON.parse(b)); v.data.transactions.forEach(t => t.id = 'x' + t.id); return Backup.restore(v, 'merge'); }", backup)
    check('merge skips duplicates', {'added': r['added'], 'skipped': r['skipped'], **state()}, added=0, skipped=2, entries=3)
    pg.evaluate("b => Backup.restore(Backup.validate(JSON.parse(b)), 'replace')", backup)
    check('replace restores', state(), entries=2, spent=500, income=18000)
    pg.evaluate("Backup.undo()"); check('undo restore', state(), entries=3)
    check('bad file rejected', {'ok': 1 if pg.evaluate("Backup.validate({hello:1}).ok") else 0}, ok=0)
    v = pg.evaluate("Backup.validate({transactions:[{id:'a',date:'2026-11-01',amount:5,description:'ok'},{id:'b',date:'nope',amount:5,description:'bad'}]})")
    check('damaged entries skipped', {'n': v['summary']['entries'], 'd': v['dropped']}, n=1, d=1)

    # 13. Old saved data (before accounts existed) upgrades without changing the balance
    old = {"initialBalance": 1000, "transactions": [{"id": "t1", "date": "2026-11-01", "type": "income", "amount": 2000, "category": "Sales", "description": "Client"},
                                                    {"id": "t2", "date": "2026-11-02", "type": "expense", "amount": 300, "category": "Meals", "description": "Lunch"}]}
    pg.evaluate("o => { Store.adopt(o); }", old)
    check('migration keeps balance', state(), cash=2700, income=2000, spent=300)


    # ---------- Phase B: cards, loans, installments ----------
    def form_submit(js, fill=None):
        pg.evaluate(js); pg.wait_for_timeout(30)
        if fill: pg.evaluate(fill)
        err = pg.evaluate("UI.submitForm().then(()=> document.getElementById('fmError').classList.contains('hidden') ? '' : document.getElementById('fmError').textContent)")
        pg.wait_for_timeout(30)
        if not pg.evaluate("document.getElementById('formModal').classList.contains('hidden')"): pg.evaluate("UI.closeForm()")
        return err

    # 14. New bank loan: money arrives (cash up, debt up, not income); payment splits into principal + interest
    reset(50000)
    form_submit("UI.accountForm(null,'loan',{name:'BDO loan', owed:100000, drawdown:true})",
                "document.getElementById('fm_rate').value=12; document.getElementById('fm_term').value=12;")
    check('loan received', state(), cash=150000, owed=100000, income=0, spent=0)
    check('loan payment amount', {'p': pg.evaluate("Debts.payment(Accounts.find('BDO loan'))")}, p=8884.88)
    form_submit("UI.payDebtForm(Accounts.find('BDO loan'))")
    check('loan payment split', state(), cash=150000 - 8884.88, owed=92115.12, spent=1000)
    form_submit("UI.payDebtForm(Accounts.find('BDO loan'), {amount: 10000, extra: true})")
    check('extra payment all principal', state(), owed=82115.12, spent=1000)
    err = form_submit("UI.payDebtForm(Accounts.find('BDO loan'), {amount: 999999})")
    check('overpayment refused', {'refused': 1 if err else 0, **state()}, refused=1, owed=82115.12)
    sch = pg.evaluate("Debts.schedule(Accounts.find('BDO loan'))")
    check('schedule pays off to zero', {'left': sch['rows'][-1]['left'], 'never': 1 if sch.get('never') else 0}, left=0, never=0)

    # 15. Card installment: full price owed at once, but each statement bills one installment
    reset(50000)
    pg.evaluate("""() => { const c = Accounts.create('BPI Card','credit'); Object.assign(c, {statementDay: 5, dueDay: 25, limit: 50000}); }""")
    form_submit("UI.installmentForm({name:'Laptop', total:30000, count:6, via: Accounts.find('BPI Card').id, firstDue:'2026-11-05', date:'2026-10-20'})")
    check('card installment purchase', state(), spent=30000, owed=30000, cash=50000)
    st = pg.evaluate("Debts.statement(Accounts.find('BPI Card'))")
    check('statement bills one installment', {'billed': st['billed'], 'unbilled': st['unbilled'], 'due': st['due']}, billed=5000, unbilled=25000, due=5000)
    note('Paid ₱5,000 toward my credit card')
    st = pg.evaluate("Debts.statement(Accounts.find('BPI Card'))")
    check('statement paid', {'due': st['due'], **state()}, due=0, owed=25000, spent=30000, cash=45000)

    # 16. Pay-later plan with add-on interest: 6 × 650 for a 3,600 phone
    reset(50000)
    form_submit("UI.installmentForm({name:'Phone', total:3600, count:6, via:'new', lender:'SPayLater', firstDue:'2026-12-15'})", "document.getElementById('fm_perPay').value=650;")
    check('pay-later purchase', state(), spent=3600, owed=3600)
    for i in range(6): form_submit("UI.payDebtForm(Accounts.find('SPayLater'))")
    ps = pg.evaluate("Object.values(Debts.planStatus())[0]")
    check('pay-later fully paid', {'done': ps['done'], 'left': ps['left'], **state()}, done=6, left=0, owed=0, spent=3600 + 300, cash=50000 - 3900)

    # 17. Credit card purchase, refund and interest
    reset(10000); pg.evaluate("Accounts.create('Card','credit')")
    note('Bought shoes 2,000 using my credit card'); note('card interest 150 on my credit card')
    check('card interest is spending', state(), spent=2150, owed=2150, cash=10000)

    # ---------- Phase C: assets & net worth ----------
    def nw(date=None):
        return pg.evaluate("d => NetWorth.at(d || undefined)", date)

    # 18. Net worth adds cash, money owed to you, assets; subtracts debts and family borrowing
    reset(20000)
    pg.evaluate("Accounts.create('BPI Card','credit')")
    note('Bought shoes 2,000 using my credit card')
    note('I lent Maria ₱3,000'); note('Mom lent me ₱5,000')
    form_submit("UI.assetForm(null, {name:'Toyota Vios', type:'vehicle', value: 450000})")
    n = nw()
    check('net worth parts', n, cash=20000 - 3000 + 5000, theyOwe=3000, assets=450000, debts=2000, youOwe=5000)
    check('net worth total', n, net=22000 + 3000 + 450000 - 2000 - 5000)

    # 19. Revaluation changes net worth, not income
    before = state()
    form_submit("UI.assetView(Assets.list()[0])", "document.getElementById('fm_value').value=420000;")
    check('revaluation not income', {**state(), 'net': nw()['net']}, income=before['income'], spent=before['spent'], net=22000 + 3000 + 420000 - 7000)

    # 20. Buying an asset with cash: cash → asset, not spending; selling: asset → cash, not income
    reset(100000)
    form_submit("UI.assetForm(null, {name:'Lot', type:'property', value: 80000, price: 80000, bought: true})")
    check('asset bought with cash', {**state(), 'net': nw()['net'], 'assets': nw()['assets']}, cash=20000, spent=0, income=0, net=100000, assets=80000)
    form_submit("UI.assetSellForm(Assets.list()[0])", "document.getElementById('fm_price').value=95000;")
    check('asset sold', {**state(), 'net': nw()['net'], 'assets': nw()['assets']}, cash=115000, income=0, assets=0, net=115000)

    # 21. Net worth on a past date uses what was true then
    reset(10000)
    pg.evaluate("""() => { Store.addTransaction({kind:'income', amount:5000, category:'Salary', date:'2026-09-15', description:'old pay'});
      const a = { id:'h1', name:'House', type:'property', since:'2026-10-01', history:[] }; Assets.list().push(a);
      Assets.setValue(a, 1000000, '2026-10-01'); Assets.setValue(a, 1100000, '2026-11-10'); }""")
    check('net worth in Sept', nw('2026-09-30'), net=15000, assets=0)
    check('net worth in Oct', nw('2026-10-31'), net=1015000)
    check('net worth now', nw(), net=1115000)
    check('series covers only months with records (Sep–Nov)', {'n': len(pg.evaluate("NetWorth.series(12)")), 'last': pg.evaluate("NetWorth.series(12).at(-1).net")}, n=3, last=1115000)

    # 22. Asset notes
    reset(50000)
    form_submit("UI.assetForm(null, {name:'Car', type:'vehicle', value: 500000})")
    check('asset note intent', {'v': 1 if pg.evaluate("Parser.assetIntent('My car is now worth ₱480,000')?.type === 'asset_value'") else 0,
                                'b': 1 if pg.evaluate("Parser.assetIntent('Bought a lot for 1.2M')?.type === 'asset_buy'") else 0,
                                'g': 1 if not pg.evaluate("Parser.assetIntent('Gas for the car 500')") else 0,
                                's': 1 if pg.evaluate("Parser.assetIntent('Sold my car for 450k')?.type === 'asset_sell'") else 0}, v=1, b=1, g=1, s=1)

    # ---------- Phase D: investments & retirement ----------
    # 23. Buying is not spending; selling part uses average cost; dividends are income; values move net worth only
    reset(100000)
    form_submit("UI.holdingForm(null, {name:'FMETF', type:'etf', amount:10000})", "document.getElementById('fm_units').value=100;")
    check('investment buy not spending', {**state(), 'inv': pg.evaluate("Invest.totals().value")}, cash=90000, spent=0, income=0, inv=10000)
    note('invested 12,000 in FMETF')
    pg.evaluate("Store.state.transactions.filter(t=>t.holdingId).at(-1).units = 100")
    check('second buy via note', {**state(), 'cost': pg.evaluate("Invest.calc(Invest.list()[0]).cost")}, cash=78000, spent=0, cost=22000)
    form_submit("UI.tradeForm(Invest.list()[0], 'sell', {amount: 6000})", "document.getElementById('fm_units').value=50;")
    c = pg.evaluate("Invest.calc(Invest.list()[0])")
    check('partial sale average cost', {**c, **state()}, realized=500, cost=16500, units=150, cash=84000, income=0)
    note('Received ₱300 dividends from FMETF')
    pg.evaluate("UI.submitForm()"); pg.wait_for_timeout(30)
    check('dividend is income', state(), income=300, cash=84300)
    note('FMETF is now worth 19,500'); pg.evaluate("UI.submitForm()"); pg.wait_for_timeout(30)
    c = pg.evaluate("Invest.calc(Invest.list()[0])")
    check('value update', {**c, 'income': state()['income'], 'nwInv': nw()['invest']}, value=19500, unrealized=3000, gain=3800, income=300, nwInv=19500)

    # 24. Withdraw part of something with only a typed value (no units)
    reset(50000)
    form_submit("UI.holdingForm(null, {name:'Pag-IBIG MP2', type:'retirement', amount:20000})")
    pg.evaluate("Invest.list()[0].valuations=[{date: toISODate(new Date()), value:22000, how:'manual', at: Date.now() + 1}]")   # typed after buying
    note('withdrew 11,000 from MP2'); pg.evaluate("UI.submitForm()"); pg.wait_for_timeout(30)
    pg.evaluate("Store.state.transactions.at(-1).createdAt = Date.now() + 2")   # (the test clock is frozen; real entries are seconds apart)
    c = pg.evaluate("Invest.calc(Invest.list()[0])")
    check('partial withdrawal by value', {**c, **state()}, cost=10000, realized=1000, value=11000, cash=41000, income=0)

    # 25. Older "invested" entries become investments (migration v3)
    pg.evaluate("Store.adopt({v:2, initialBalance:1000, transactions:[{id:'a',date:'2026-05-01',kind:'invest',type:'expense',amount:5000,description:'invested 5000 in MP2'}]})")
    check('old investments migrated', {'h': pg.evaluate("Invest.list().length"), 'v': pg.evaluate("Store.state.v"), 'inv': pg.evaluate("Invest.totals().value"), 'cash': state()['cash']}, h=1, v=3, inv=5000, cash=-4000)

    # 26. Retirement math
    r = pg.evaluate("Retire.project({age:30, retireAge:40, lifeTo:60, savings:0, monthly:1000, desired:5000, ret:0, infl:0})")
    check('retire: no growth', {'n': r['nominal'], 'inc': r['income']}, n=120000, inc=500)
    r = pg.evaluate("Retire.project({age:30, retireAge:60, lifeTo:85, savings:100000, monthly:2000, desired:20000, ret:6, infl:4})")
    fv = 100000*(1+0.005)**360 + 2000*((1+0.005)**360-1)/0.005
    check('retire: compound growth', {'n': r['nominal']}, n=round(fv, 2))
    r2 = pg.evaluate(f"Retire.project({{age:30, retireAge:60, lifeTo:85, savings:100000, monthly:{r['needMonthly']}, desired:20000, ret:6, infl:4}})")
    check('retire: needed contribution reaches goal', {'inc': round(r2['income'])}, inc=20000)

    # ---------- Phase E: bills, insurance, timeline, records ----------
    def bill(**kw):
        js = "o => { const b = { id: 'b' + Math.random().toString(36).slice(2), freq:'month', category:'Utilities', kind:'bill', ...o }; b.day = +b.nextDue.slice(8,10); Bills.list().push(b); Bills.syncReminder(b); Store.save(); return b.id; }"
        return pg.evaluate(js, kw)
    def nextDue(bid): return pg.evaluate("id => Bills.get(id).nextDue", bid)

    # 27. Paying a bill: spending + due date moves; late and early payments handled; undo restores
    reset(20000)
    bid = bill(name='Meralco', amount=2800, nextDue='2026-11-25', variable=True)
    note('Meralco 2,950')
    check('bill auto-matched', {**state(), 'linked': 1 if pg.evaluate("!!Store.state.transactions.at(-1).billId") else 0}, spent=2950, linked=1)
    check('next due moved', {'d': 1 if nextDue(bid) == '2026-12-25' else 0}, d=1)
    pg.evaluate("id => Bills.pay(Bills.get(id), {amount: 2800, date: '2027-01-02'})", bid)   # paid late (was due Dec 25)
    check('late payment → next month', {'d': 1 if nextDue(bid) == '2027-01-25' else 0}, d=1)
    bid2 = bill(name='Rent', amount=8000, nextDue='2026-11-30', category='Rent', kind='rent', day=30)
    pg.evaluate("id => Bills.pay(Bills.get(id), {date: '2026-11-20'})", bid2)                   # paid early
    check('early payment → next cycle', {'d': 1 if nextDue(bid2) == '2026-12-30' else 0}, d=1)
    bid3 = bill(name='Tuition', amount=15000, nextDue='2027-01-31', freq='month', category='Education')
    pg.evaluate("id => Bills.pay(Bills.get(id), {date: '2027-01-31'})", bid3)
    check('month-end clamps (Feb)', {'d': 1 if nextDue(bid3) == '2027-02-28' else 0}, d=1)
    pg.evaluate("id => Bills.pay(Bills.get(id), {date: '2027-02-28'})", bid3)
    check('…and comes back to the 31st', {'d': 1 if nextDue(bid3) == '2027-03-31' else 0}, d=1)

    # 28. Repeating spending is suggested (not added) and dismissals stick
    reset(20000)
    pg.evaluate("""() => { for (const d of ['2026-08-03','2026-09-03','2026-10-03','2026-11-03']) Store.addTransaction({kind:'expense', amount:549, category:'Entertainment', date:d, description:'Netflix'}); }""")
    sug = pg.evaluate("Bills.detect()")
    check('subscription detected', {'n': len(sug), 'monthly': 1 if sug and sug[0]['freq'] == 'month' else 0, 'bills': pg.evaluate("Bills.list().length")}, n=1, monthly=1, bills=0)
    pg.evaluate("Bills.dismiss(Bills.detect()[0].key)")
    check('dismissed stays dismissed', {'n': len(pg.evaluate("Bills.detect()"))}, n=0)

    # 29. Duplicate subscriptions and double charges are flagged
    reset(20000)
    bill(name='Spotify', amount=149, nextDue='2026-12-01', kind='subscription', category='Entertainment')
    bill(name='Spotify Premium', amount=149, nextDue='2026-12-05', kind='subscription', category='Entertainment')
    pg.evaluate("""() => { Store.addTransaction({kind:'expense', amount:799, category:'Shopping', date:'2026-11-18', description:'Shopee order'}); Store.addTransaction({kind:'expense', amount:799, category:'Shopping', date:'2026-11-19', description:'Shopee order'}); }""")
    d = pg.evaluate("Bills.duplicates().map(x => x.type)")
    check('duplicates flagged', {'bills': d.count('bills'), 'charge': d.count('charge')}, bills=1, charge=1)

    # 30. Insurance premium: spending, linked, next due moves; timeline includes everything
    reset(20000)
    pg.evaluate("""() => { Policies.list().push({id:'p1', type:'health', provider:'Maxicare', name:'Family HMO', premium:2500, freq:'month', nextDue:'2026-11-28', renewal:'2026-12-10', policyNo:'MX-0099123'}); Store.save(); }""")
    note('I paid ₱2,500 for insurance')
    check('premium linked', {**state(), 'p': 1 if pg.evaluate("Store.state.transactions.at(-1).policyId === 'p1'") else 0, 'next': 1 if pg.evaluate("Policies.get('p1').nextDue === '2026-12-28'") else 0}, spent=2500, p=1, next=1)
    check('policy number masked', {'m': 1 if pg.evaluate("Policies.masked(Policies.get('p1')) === '•••• 9123'") else 0, 'csv': 0 if 'MX-0099123' in pg.evaluate("Exporter.build()") else 1}, m=1, csv=1)
    bill(name='PLDT', amount=1699, nextDue='2026-11-27')
    pg.evaluate("() => { const c = Accounts.create('Card','credit'); Object.assign(c,{dueDay:25}); Store.addTransaction({kind:'expense', amount:1000, category:'Shopping', date:'2026-11-10', accountId:c.id, description:'x'}); }")
    types = pg.evaluate("Timeline.items(45).map(i => i.type)")
    check('timeline has bills, cards, premiums, renewals', {'bill': types.count('bill'), 'debt': types.count('debt'), 'renewal': types.count('renewal'), 'premium': types.count('premium')}, bill=1, debt=1, renewal=1, premium=1)

    # 31. Records: government contributions, business vs personal
    reset(20000)
    note('SSS contribution 1,350'); note('PhilHealth 500'); note('Pag-IBIG 200'); note('Sahod 18,000')
    pg.evaluate("() => { const t = Store.addTransaction({kind:'income', amount:5000, category:'Sales', date: toISODate(new Date()), description:'cake orders'}); t.business = true; }")
    r = pg.evaluate("Records.year(String(new Date().getFullYear()))")
    check('records gov contributions', {'sss': r['gov'].get('SSS', 0), 'ph': r['gov'].get('PhilHealth', 0), 'pi': r['gov'].get('Pag-IBIG', 0)}, sss=1350, ph=500, pi=200)
    check('records business vs personal', {'b': r['business']['income'], 'p': r['personal']['income']}, b=5000, p=18000)

    # ---------- Phase F: household, goals, overview ----------
    # 32. You paid a shared expense: your share is spending, the others owe you; cash shows the full payment
    reset(20000)
    pg.evaluate("Household.split({ total: 3000, description: 'Groceries', category: 'Groceries', date: toISODate(new Date()), paidBy: 'me', shares: Household.equalShares(3000, ['Ana']) })")
    check('split: I paid', {**state(), 'ana': pg.evaluate("Loans.owedBy('Ana')")}, cash=17000, spent=1500, theyOwe=1500, ana=1500)
    # three ways, centavos land on me
    pg.evaluate("Household.split({ total: 1000, description: 'Pizza', category: 'Meals', date: toISODate(new Date()), paidBy: 'me', shares: Household.equalShares(1000, ['Ana','Ben']) })")
    check('split three ways', {'me': pg.evaluate("Store.state.transactions.filter(t=>t.description==='Pizza (my share)')[0].amount"), 'ben': pg.evaluate("Loans.owedBy('Ben')")}, me=333.34, ben=333.33)

    # 33. Someone else paid: my share is spending, I owe them, no cash moves today; settle up later
    reset(20000)
    pg.evaluate("Household.split({ total: 3000, description: 'Groceries', category: 'Groceries', date: toISODate(new Date()), paidBy: 'Mom', shares: Household.equalShares(3000, ['Mom']) })")
    check('split: Mom paid', {**state(), 'mom': pg.evaluate("Loans.oweTo('Mom')")}, cash=20000, spent=1500, youOwe=1500, mom=1500)
    form_submit("UI.settleForm('Mom')")
    check('settle up', state(), cash=18500, youOwe=0, spent=1500)

    # 34. Split via a note
    reset(20000)
    note('Split groceries 3,000 with Ana')
    check('split note', state(), spent=1500, theyOwe=1500, cash=17000)

    # 35. Goals with a date: monthly amount needed
    reset(20000)
    pg.evaluate("() => { const p = Pockets.create('House fund', { goal: 12000 }); p.by = Bills.step(toISODate(new Date()), 'month', 6); p.family = true; Pockets.move(3000, null, p.id); }")
    check('goal per month', {'pm': pg.evaluate("Pockets.perMonth(Pockets.find('House fund'))")}, pm=1500)

    # 36. Someone else's account you track isn't counted as yours
    reset(20000)
    pg.evaluate("() => { const a = Accounts.create('Mom GCash','ewallet'); a.notMine = true; a.owner = 'Mom'; Accounts.setOpening(a, 50000); }")
    check('others\' money excluded', {'cash': state()['cash'], 'net': nw()['net']}, cash=20000, net=20000)

    # 37. Overview insights speak plainly and are ordered by importance
    reset(20000)
    pg.evaluate("""() => { const d = new Date(), y = d.getFullYear(), m = d.getMonth(), day = String(Math.min(d.getDate(), 28)).padStart(2,'0');
      const prev = new Date(y, m - 1, 1), pm = `${prev.getFullYear()}-${String(prev.getMonth()+1).padStart(2,'0')}-01`;
      Store.addTransaction({kind:'expense', amount:1000, category:'Groceries', date: pm, description:'g'});
      Store.addTransaction({kind:'expense', amount:2000, category:'Groceries', date: `${y}-${String(m+1).padStart(2,'0')}-01`, description:'g'}); }""")
    ins = pg.evaluate("Insights.list().map(i => i.text)")
    check('insight compares months', {'ok': 1 if any('100% more' in t and 'Groceries' in t for t in ins) else 0}, ok=1)

    # ---------- Phase G: safety & security ----------
    # 38. PIN is stored only as a salted hash; wrong tries slow down; correct PIN works
    reset(10000)
    pg.evaluate("Sec.setPin('482913', 5)")
    st = pg.evaluate("JSON.stringify(Store.state.settings.lock)")
    check('PIN not stored in plain text', {'plain': 1 if '482913' in st else 0, 'hashed': 1 if pg.evaluate("Sec.cfg().hash.length > 20") else 0}, plain=0, hashed=1)
    r = [pg.evaluate("Sec.verify('000000')") for _ in range(3)]
    check('3 wrong tries → wait', {'wait': 1 if r[-1].get('wait', 0) >= 25 else 0, 'ok': 1 if any(x['ok'] for x in r) else 0}, wait=1, ok=0)
    check('locked out even with right PIN during wait', {'ok': 1 if pg.evaluate("Sec.verify('482913')")['ok'] else 0}, ok=0)
    pg.evaluate("Sec.cfg().until = 0")
    check('right PIN after the wait', {'ok': 1 if pg.evaluate("Sec.verify('482913')")['ok'] else 0}, ok=1)

    # 39. Password-protected backup: encrypted, opens with the password, refuses a wrong one
    reset(10000); note('Groceries 1,234 at Puregold')
    enc = pg.evaluate("Sec.encrypt(Backup.build(), 'correct horse 9').then(JSON.stringify)")
    check('backup is encrypted', {'leak': 1 if 'Puregold' in enc or '1234' in enc else 0}, leak=0)
    ok = pg.evaluate("e => Sec.decrypt(JSON.parse(e), 'correct horse 9').then(d => d.data.transactions.length)", enc)
    bad = pg.evaluate("e => Sec.decrypt(JSON.parse(e), 'wrong password').then(() => 'opened').catch(() => 'refused')", enc)
    check('decrypts with password, refuses wrong one', {'n': ok, 'bad': 1 if bad == 'refused' else 0}, n=1, bad=1)

    # 40. A malicious backup can't run code: descriptions are shown as text
    reset(10000)
    evil = {"app": "Tiffo", "format": 1, "data": {"transactions": [{"id": "x1", "date": "2026-11-01", "amount": 5, "kind": "expense", "category": "Meals", "description": "<img src=x onerror=window.__pwned=1>"}]}}
    pg.evaluate("e => { Backup.restore(Backup.validate(e), 'replace'); UI.renderAll(); Nav.go('activity'); }", evil)
    pg.wait_for_timeout(50)
    check('no code injection from imports', {'img': pg.evaluate("document.querySelectorAll('#ledgerList img').length"), 'pwned': 1 if pg.evaluate("!!window.__pwned") else 0}, img=0, pwned=0)

    # 41. Scam Check finds warning signs, never calls something safe
    samples = {'GCash: Your account will be suspended within 24 hours. Verify at gcash-verify.top and enter the 6-digit OTP.': 'high',
               'Congratulations! You won P50,000. To claim pay the processing fee to this GCash number.': 'high',
               'Earn 5% per day guaranteed! No risk.': 'high',
               'Na-wrong send ko po sa inyo 2,000, pakibalik po.': 'some',
               'BDO: Your statement for November is now available in the BDO app.': 'none',
               'Meeting moved to 3pm tomorrow.': 'none'}
    got = {t: pg.evaluate("t => ScamCheck.check(t).verdict", t) for t in samples}
    check('scam check verdicts', {'right': sum(1 for t in samples if got[t] == samples[t])}, right=len(samples))
    pg.evaluate("Nav.go('more')"); pg.evaluate("document.getElementById('scamInput').value='Meeting moved to 3pm tomorrow.'; UI.runScamCheck()")
    check('no "safe" verdict wording', {'notsafe': 1 if 'does NOT mean it’s safe' in pg.inner_text('#scamResult') else 0}, notsafe=1)

    # 42. Unusual amounts ask first; cash shortfall is warned
    reset(5000)
    pg.evaluate("""() => { for (const d of ['2026-10-01','2026-10-15','2026-11-01','2026-11-10']) Store.addTransaction({kind:'expense', amount:300, category:'Meals', date:d, description:'lunch'}); }""")
    pg.evaluate("async t => { document.getElementById('noteInput').value = t; await UI.submitNote(t); }", 'lunch 35,000')
    asked = not pg.evaluate("document.getElementById('formModal').classList.contains('hidden')")
    tip = pg.inner_text('#fmFields') if asked else ''
    pg.evaluate("UI.closeForm()")
    check('unusual amount asks first', {'asked': 1 if asked and 'much more than your usual' in tip else 0, 'saved': pg.evaluate("Store.state.transactions.length")}, asked=1, saved=4)
    bill(name='Rent', amount=8000, nextDue=pg.evaluate("Debts.addPeriods(toISODate(new Date()), 0).slice(0,8) + '28'"), category='Rent', kind='rent')
    check('cash shortfall warned', {'w': 1 if any('more than your cash' in t for t in pg.evaluate("Insights.list().map(i => i.text)")) else 0}, w=1)

    # 43. Foreign currency: detected, rate shown with its source, nothing saved until confirmed, original kept
    reset(10000)
    det = pg.evaluate("""() => ['Dinner $25', 'Lunch 350', 'Taxi ₱200', 'Coffee €4.50', 'Souvenir 1000 yen', 'Hotel USD 120', 'Grab 250 pesos'].map(t => (FX.detect(t) || {}).code || '-').join(',')""")
    check('detects foreign amounts', {'ok': 1 if det == 'USD,-,-,EUR,JPY,USD,-' else 0}, ok=1)
    if det != 'USD,-,-,EUR,JPY,USD,-': fails.append('detected: ' + det)
    pg.evaluate("""() => { window.__fx = []; window.fetch = async (u) => { window.__fx.push(String(u)); return { ok: true, json: async () => ({ date: '2026-11-19', rates: { PHP: 58.5 } }) }; }; }""")
    pg.evaluate("async t => { document.getElementById('noteInput').value = t; await UI.submitNote(t); }", 'Dinner $25')
    pg.wait_for_timeout(60)
    sub = pg.inner_text('#formModal')
    check('rate form shows source, nothing saved yet', {'src': 1 if 'European Central Bank' in sub else 0, 'rate': pg.evaluate("+document.getElementById('fm_rate').value"), 'saved': pg.evaluate("Store.state.transactions.length")}, src=1, rate=58.5, saved=0)
    pg.evaluate("UI.submitForm()"); pg.wait_for_timeout(60)
    card = pg.inner_text('#formModal')
    check('then a check card', {'card': 1 if 'Converted' in card and pg.evaluate("+document.getElementById('fm_amount').value") == 1462.5 else 0, 'saved': pg.evaluate("Store.state.transactions.length")}, card=1, saved=0)
    pg.evaluate("UI.submitForm()"); pg.wait_for_timeout(60)
    t = pg.evaluate("Store.state.transactions[0]")
    check('saved converted, original kept', {'amt': t['amount'], 'orig': t['fx']['amount'], 'usd': 1 if t['fx']['code'] == 'USD' else 0, 'desc': 1 if '$25.00' in t['description'] else 0, 'cash': pg.evaluate("Store.balance()")}, amt=1462.5, orig=25, usd=1, desc=1, cash=10000 - 1462.5)
    # what the bank actually charged wins; offline falls back to the person's own rate
    pg.evaluate("() => { window.fetch = async () => { throw new Error('offline'); }; }")
    pg.evaluate("async t => { document.getElementById('noteInput').value = t; await UI.submitNote(t); }", 'Coffee €4.50 yesterday')
    pg.wait_for_timeout(60)
    offline = 'couldn’t look up' in pg.inner_text('#formModal')
    pg.evaluate("document.getElementById('fm_actual').value = '290'; UI.submitForm()"); pg.wait_for_timeout(60); pg.evaluate("UI.submitForm()"); pg.wait_for_timeout(60)
    t2 = pg.evaluate("Store.state.transactions.find(t => t.fx && t.fx.code === 'EUR')")
    check('offline + amount charged', {'offline': 1 if offline else 0, 'amt': t2['amount'], 'rate': round(t2['fx']['rate'], 4)}, offline=1, amt=290, rate=round(290 / 4.5, 4))
    pg.evaluate("async t => { document.getElementById('noteInput').value = t; await UI.submitNote(t); }", 'Croissant €3')
    pg.wait_for_timeout(60)
    check('remembers your last rate', {'rate': round(pg.evaluate("+document.getElementById('fm_rate').value"), 4)}, rate=round(290 / 4.5, 4))
    pg.evaluate("UI.closeForm()")
    check('multi-entry foreign note refused, nothing saved', {'n': (pg.evaluate("async t => { await UI.submitNote(t); return Store.state.transactions.length; }", 'Lunch $10 and taxi $5'))}, n=2)

    # 44. Household sync: post a split, another member adds their share (fake server, real client code)
    reset(10000)
    pg.evaluate(r"""() => {
      const db = { hh: [], mem: [], items: [] }; window.__db = db; let n = 0;
      const tbl = { tiffo_households: 'hh', tiffo_household_members: 'mem', tiffo_household_items: 'items' };
      const q = (name) => { const rows = () => db[tbl[name]]; let f = [], op = 'select', payload = null, single = false;
        const run = () => { let r = rows().filter(x => f.every(([k, v]) => x[k] === v));
          if (op === 'insert') { const row = { id: 'i' + (++n), author: window.__me, created_at: new Date().toISOString(), ...payload }; rows().push(row); r = [row]; }
          if (op === 'delete') { db[tbl[name]] = rows().filter(x => !r.includes(x)); }
          if (op === 'update') r.forEach(x => Object.assign(x, payload));
          return Promise.resolve({ data: single ? (r[0] || null) : r, error: null }); };
        const o = { select() { return o; }, eq(k, v) { f.push([k, v]); return o; }, order() { return o; }, limit() { return o; },
          insert(p) { op = 'insert'; payload = p; return o; }, delete() { op = 'delete'; return o; }, update(p) { op = 'update'; payload = p; return o; },
          single() { single = true; return run(); }, maybeSingle() { single = true; return run(); }, then(a, b) { return run().then(a, b); } };
        return o; };
      Auth.sb = { from: q, rpc: async (fn, a) => {
        if (fn === 'tiffo_create_household') { const id = 'h1'; db.hh.push({ id, name: a.p_name, owner: window.__me, invite_code: 'ABCDE12345' }); db.mem.push({ household_id: id, user_id: window.__me, display_name: a.p_display, role: 'owner', can_share: true }); return { data: { id, invite_code: 'ABCDE12345' }, error: null }; }
        if (fn === 'tiffo_join_household') { const h = db.hh.find(h => h.invite_code === a.p_code.toUpperCase()); if (!h) return { data: null, error: { message: 'That invite code doesn’t match any household' } }; db.mem.push({ household_id: h.id, user_id: window.__me, display_name: a.p_display, role: 'member', can_share: true }); return { data: h.id, error: null }; }
      } };
      window.__me = 'u-mom'; Auth.user = { id: 'sb:u-mom', uid: 'u-mom', name: 'x', provider: 'cloud' };
    }""")
    pg.evaluate("HHSync.create('Our home', 'Mom')")
    pg.wait_for_timeout(50)
    check('household made', {'ok': 1 if pg.evaluate("HHSync.hh && HHSync.hh.name === 'Our home' && HHSync.ready()") else 0}, ok=1)
    pg.evaluate("UI.closeForm(); UI.splitForm({ total: 3000, with: ['Ana', 'Kuya'], desc: 'Groceries' })"); pg.wait_for_timeout(40)
    pg.evaluate("document.getElementById('fm_hhPost').checked = true; UI.submitForm()"); pg.wait_for_timeout(120)
    item = pg.evaluate("__db.items[0]")
    check('split posted with names, mine marked', {'n': pg.evaluate("__db.items.length"), 'total': item['data']['total'], 'ana': item['data']['shares'].get('Ana', 0), 'mom': item['data']['shares'].get('Mom', 0), 'payerMom': 1 if item['data']['payer'] == 'Mom' else 0, 'tagged': pg.evaluate("Store.state.transactions.filter(t => t.hhItem).length")}, n=1, total=3000, ana=1000, mom=1000, payerMom=1, tagged=3)
    check('nothing private posted', {'keys': len(set(item['data'].keys()) - {'desc', 'total', 'category', 'date', 'payer', 'shares', 'currency', 'by'})}, keys=0)
    # Ana on her own phone (a fresh Tiffo)
    reset(5000)
    pg.evaluate("() => { window.__me = 'u-ana'; Auth.user = { id: 'sb:u-ana', uid: 'u-ana', name: 'y', provider: 'cloud' }; Object.assign(HHSync, { hh: null, members: [], items: [], loadedAt: 0 }); }")
    pg.evaluate("HHSync.join('abcde-12345', 'Ana')")
    pg.evaluate("Nav.go('more'); UI.renderHHSync()"); pg.wait_for_timeout(60)
    panel = pg.inner_text('#hhSync')
    check('member sees the post with her share', {'seen': 1 if 'Groceries' in panel and 'your share' in panel and '1 new' in panel else 0}, seen=1)
    pg.evaluate("document.querySelector('#hhSync [data-hh=\"add\"]').click()"); pg.wait_for_timeout(60)
    s = state()
    check('added: her share is spending, she owes Mom', {**s, 'mom': pg.evaluate("Loans.oweTo('Mom')")}, spent=1000, youOwe=1000, mom=1000, cash=5000)
    pg.evaluate("UI.renderHHSync()")
    check('no double add', {'btn': pg.evaluate("document.querySelectorAll('#hhSync [data-hh=\"add\"]').length"), 'in': 1 if '✓ In your Tiffo' in pg.inner_text('#hhSync') else 0}, btn=0, **{'in': 1})
    # Ana settles up and posts it; Mom adds it
    pg.evaluate("UI.settleForm('Mom')"); pg.wait_for_timeout(40)
    pg.evaluate("document.getElementById('fm_hhPost').checked = true; UI.submitForm()"); pg.wait_for_timeout(120)
    check('Ana settled', {'youOwe': state()['youOwe'], 'posts': pg.evaluate("__db.items.length")}, youOwe=0, posts=2)
    reset(10000)
    pg.evaluate("() => { window.__me = 'u-mom'; Auth.user = { id: 'sb:u-mom', uid: 'u-mom', name: 'x', provider: 'cloud' }; Store.state.settings.hhSync = { id: 'h1', me: 'Mom', done: [], post: true }; Store.save(); Object.assign(HHSync, { hh: null, loadedAt: 0 }); }")
    pg.evaluate("HHSync.load(true)")
    pg.evaluate("HHSync.importItem(HHSync.items.find(i => i.kind === 'settle'))")
    check('Mom gets the repayment', {'cash': state()['cash'], 'income': state()['income']}, cash=11000, income=0)
    pg.evaluate("() => { Auth.user = null; Auth.sb = null; Object.assign(HHSync, { hh: null, members: [], items: [] }); }")

    # 45. Fingerprint/face unlock: a virtual authenticator stands in for the phone's sensor
    ctx = b.new_context(timezone_id='Asia/Manila'); bp = ctx.new_page()
    bp.on('pageerror', lambda e: errs.append(str(e)))
    bp.route('**/chart.umd.min.js', lambda r: r.fulfill(body=stub, content_type='text/javascript'))
    bp.add_init_script(stub)
    for pat in ['**/cdn.tailwindcss.com/**', '**/supabase-js@2**', '**/js.puter.com/**']:
        bp.route(pat, lambda r: r.fulfill(body='', content_type='text/javascript'))
    bp.route('https://tiffo.test/', lambda r: r.fulfill(body=html.read_text(), content_type='text/html'))
    cdp = ctx.new_cdp_session(bp); cdp.send('WebAuthn.enable')
    auth = cdp.send('WebAuthn.addVirtualAuthenticator', {'options': {'protocol': 'ctap2', 'transport': 'internal', 'hasUserVerification': True, 'isUserVerified': True, 'hasResidentKey': False}})
    bp.goto('https://tiffo.test/'); bp.wait_for_timeout(600)
    bp.evaluate("async () => { Store.state = Store.blank(); await Sec.setPin('4831', 5); }")
    on = bp.evaluate("async () => { await Bio.enroll(); return Bio.on() && !!Sec.cfg().bio.pk; }")
    unlocked = bp.evaluate("() => Bio.unlock()")
    bp.evaluate("async () => { await Sec.setPin('7294', 5); }")
    kept = bp.evaluate("Bio.on()")
    cdp.send('WebAuthn.setUserVerified', {'authenticatorId': auth['authenticatorId'], 'isUserVerified': False})
    refused = bp.evaluate("() => Bio.unlock().then(ok => ok ? 'opened' : 'refused').catch(() => 'refused')")
    cdp.send('WebAuthn.setUserVerified', {'authenticatorId': auth['authenticatorId'], 'isUserVerified': True})
    bp.evaluate("() => { const c = Sec.cfg(); c.bio.pk = (() => { const k = Sec.unb64(c.bio.pk); k[k.length - 1] ^= 1; return Sec.b64(k); })(); }")
    wrongkey = bp.evaluate("() => Bio.unlock().then(ok => ok ? 'opened' : 'refused').catch(() => 'refused')")
    check('biometric unlock', {'on': 1 if on else 0, 'unlock': 1 if unlocked else 0, 'kept after PIN change': 1 if kept else 0, 'unverified refused': 1 if refused == 'refused' else 0, 'wrong key refused': 1 if wrongkey == 'refused' else 0},
          on=1, unlock=1, **{'kept after PIN change': 1, 'unverified refused': 1, 'wrong key refused': 1})
    ctx.close()
    b.close()

for f in fails: print('✗', f)
if errs: print('Page errors:', errs[:3])
print(f"\n{passes}/{passes + len(fails)} engine checks passed")
sys.exit(1 if fails or errs else 0)
