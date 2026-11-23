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
    for pat in ['**/cdn.tailwindcss.com/**', '**/supabase-js@2', '**/js.puter.com/**']:
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

    b.close()

for f in fails: print('✗', f)
if errs: print('Page errors:', errs[:3])
print(f"\n{passes}/{passes + len(fails)} engine checks passed")
sys.exit(1 if fails or errs else 0)
