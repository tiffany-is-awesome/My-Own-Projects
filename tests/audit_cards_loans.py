"""Audit C: cards, loans and installments. Every number is worked out by hand first."""
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

    # C1. Card purchase = spending + debt; paying it = no new spending
    reset(20000); card = acct('BPI Card', 'credit', limit=20000)
    tx(kind='expense', amount=5000, date='2026-11-02', accountId=card)
    check('C1 purchase on card', {**S(), 'owed': owed(card)}, cash=20000, spent=5000, owed=5000)
    err = pay(card, amount=2000, date='2026-11-10')
    if err: fails.append('C1 pay: ' + err)
    check('C1 paying the card', {**S(), 'owed': owed(card)}, cash=18000, spent=5000, owed=3000)
    check('C1 can\'t pay more than owed', {'refused': 1 if pay(card, amount=9000) else 0, 'owed': owed(card)}, refused=1, owed=3000)

    # C2. Statement, minimum, due date, available credit, overdue
    reset(20000); card = acct('Metrobank Card', 'credit', limit=20000, statementDay=5, dueDay=25)
    tx(kind='expense', amount=3000, date='2026-10-20', accountId=card); tx(kind='expense', amount=1000, date='2026-11-10', accountId=card)
    pay(card, amount=1000, date='2026-11-12')
    st = js("([id]) => Debts.statement(Accounts.get(id))", card)
    check('C2 statement', {**st, 'od': 1 if st['overdue'] else 0}, billed=3000, paidSince=1000, due=2000, minDue=500, od=0)
    check('C2 due date', {'ok': 1 if st['dueDate'] == '2026-11-25' else 0}, ok=1)
    check('C2 available credit', {'avail': js("([id]) => { const a = Accounts.get(id); return a.limit - Accounts.owedOn(a); }", card)}, avail=17000)
    js("([id]) => { Accounts.get(id).dueDay = 15; }", card)
    st = js("([id]) => Debts.statement(Accounts.get(id))", card)
    check('C2 past due date and unpaid = overdue', {'od': 1 if st['overdue'] else 0, 'inUpcoming': js("Debts.upcoming(40).filter(x => x.overdue).length")}, od=1, inUpcoming=1)

    # C3. Installment on a card: full price is spending once; only billed months count on each statement
    reset(50000); card = acct('BDO Card', 'credit', limit=100000, statementDay=5, dueDay=25)
    pg.evaluate("() => UI.installmentForm({})")
    for k, v in {'name': 'Laptop', 'total': 36000, 'count': 12, 'via': card, 'firstDue': '2026-10-05', 'date': '2026-09-20'}.items():
        pg.evaluate("([k, v]) => { const el = document.getElementById('fm_' + k); el.value = v; el.dispatchEvent(new Event('change', {bubbles: true})); }", [k, v])
    pg.evaluate("UI.submitForm()"); pg.wait_for_timeout(30)
    st = js("([id]) => Debts.statement(Accounts.get(id))", card)
    check('C3 card installment', {**S(), 'owed': owed(card), 'billed': st['billed'], 'unbilled': st['unbilled']}, cash=50000, spent=36000, owed=36000, billed=6000, unbilled=30000)

    # C4. Formal loan: amortized payment, interest vs principal, part-payments, early repayment
    reset(100000); loan = acct('Car loan', 'loan', principal=100000, rate=12, term=12, freq='month', dueDay=15, startDate='2026-10-15')
    js("([id]) => Accounts.setOpening(Accounts.get(id), -100000)", loan)
    check('C4 monthly payment', {'pay': js("([id]) => Debts.payment(Accounts.get(id))", loan)}, pay=8884.88)
    err = pay(loan, amount=8884.88, date='2026-11-15')
    if err: fails.append('C4 pay: ' + err)
    check('C4 first payment: ₱1,000 interest, rest off the debt', {**S(), 'owed': owed(loan)}, cash=100000 - 8884.88, spent=1000, owed=100000 - 7884.88)
    reset(100000); loan = acct('Car loan', 'loan', principal=100000, rate=12, term=12, freq='month', dueDay=15, startDate='2026-10-15')
    js("([id]) => Accounts.setOpening(Accounts.get(id), -100000)", loan)
    pay(loan, amount=4000, date='2026-11-05')
    pay(loan, amount=4884.88, date='2026-11-12')
    check('C4 two part-payments in one month: interest charged once', {**S(), 'owed': owed(loan)}, spent=1000, owed=100000 - 7884.88)
    pay(loan, amount=10000, extra=True, date='2026-11-18')
    check('C4 extra payment goes all to the debt', {**S(), 'owed': owed(loan)}, spent=1000, owed=100000 - 7884.88 - 10000)
    sch = js("([id]) => Debts.schedule(Accounts.get(id))", loan)
    check('C4 schedule is shorter after paying early', {'n': len(sch['rows']), 'last': sch['rows'][-1]['left']}, n=10, last=0)

    # C5. Missed loan payments show as overdue
    reset(100000); loan = acct('Salary loan', 'loan', principal=100000, rate=12, term=12, freq='month', dueDay=15, startDate='2026-08-15')
    js("([id]) => Accounts.setOpening(Accounts.get(id), -100000)", loan)
    pay(loan, amount=8884.88, date='2026-09-15')
    b_ = js("([id]) => Debts.behind(Accounts.get(id))", loan) or {}
    check('C5 two missed payments', {'missed': b_.get('missed'), 'amount': b_.get('amount'), 'since': 1 if b_.get('since') == '2026-10-15' else 0, 'up': js("Debts.upcoming(40).filter(x => x.overdue).length")}, missed=2, amount=17769.76, since=1, up=1)
    pay(loan, amount=8884.88, date='2026-10-16'); pay(loan, amount=8884.88, date='2026-11-15')
    check('C5 caught up', {'behind': 0 if js("([id]) => Debts.behind(Accounts.get(id))", loan) is None else 1}, behind=0)

    # C6. Pay-later plan with add-on interest
    reset(20000)
    pg.evaluate("() => UI.installmentForm({})")
    for k, v in {'name': 'Phone', 'total': 12000, 'count': 6, 'perPay': 2300, 'via': 'new', 'lender': 'Home Credit', 'firstDue': '2026-11-15', 'date': '2026-10-15'}.items():
        pg.evaluate("([k, v]) => { const el = document.getElementById('fm_' + k); el.value = v; el.dispatchEvent(new Event('change', {bubbles: true})); }", [k, v])
    pg.evaluate("UI.submitForm()"); pg.wait_for_timeout(30)
    hc = js("Accounts.find('Home Credit').id")
    check('C6 bought on pay-later', {**S(), 'owed': owed(hc)}, cash=20000, spent=12000, owed=12000)
    pay(hc, amount=2300, date='2026-11-15')
    ps = js("([id]) => { const p = Debts.plans().find(p => p.accountId === id); return Debts.planStatus()[p.id]; }", hc)
    check('C6 one installment: ₱300 interest, ₱2,000 off', {**S(), 'owed': owed(hc), 'done': ps['done']}, cash=17700, spent=12300, owed=10000, done=1)

    # C7. Card fees and refunds
    reset(20000); card = acct('RCBC Card', 'credit', limit=30000)
    tx(kind='expense', amount=4000, date='2026-11-01', accountId=card)
    note('RCBC card late fee 1,500')
    check('C7 late fee on the card', {**S(), 'owed': owed(card), 'cat': 1 if js("Store.state.transactions.some(t => t.amount === 1500 && t.category === 'Interest & Fees' && t.accountId === Accounts.find('RCBC Card').id)") else 0}, cash=20000, spent=5500, owed=5500, cat=1)
    tx(kind='refund', amount=6000, date='2026-11-12', accountId=card, category='Shopping')
    check('C7 refund bigger than the balance: the extra is yours', {'owed': owed(card), **nw()}, owed=0, credits=500, net=20500)

    b.close()
for f in fails: print('✗', f)
if errs: print('page errors:', errs[:3])
print(f'{passes}/{passes + len(fails)} card/loan checks passed')
sys.exit(1 if fails or errs else 0)
