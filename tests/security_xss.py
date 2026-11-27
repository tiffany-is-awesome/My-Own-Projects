"""Security: does any stored text run as code when Tiffo shows it? Payloads go into every user/AI/backup-controlled field."""
import sys, pathlib, json
from playwright.sync_api import sync_playwright
here = pathlib.Path(__file__).resolve().parent
html = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else here.parent / 'tiffo.html').resolve()
stub = "window.Chart=class{constructor(){}update(){}destroy(){}};Chart.defaults={font:{},color:''};"
P = '<img src=x onerror="window.__xss=(window.__xss||[]).concat(FIELD)">'
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = b.new_context(timezone_id='Asia/Manila').new_page()
    pg.clock.set_fixed_time('2026-11-20T10:00:00+08:00')
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route('**/chart.umd.min.js', lambda r: r.fulfill(body=stub, content_type='text/javascript'))
    pg.add_init_script(stub)
    for pat in ['**/cdn.tailwindcss.com/**', '**/supabase-js@2**', '**/js.puter.com/**']: pg.route(pat, lambda r: r.fulfill(body='', content_type='text/javascript'))
    pg.goto(html.as_uri()); pg.wait_for_timeout(700)
    pg.evaluate("P => { window.__P = P; }", P)
    pg.evaluate("""() => {
      const x = (f) => window.__P.replace('FIELD', JSON.stringify(f));
      CURRENCY = 'PHP'; Store.state = Store.blank(); Store.state.initialBalance = 50000;
      const card = Accounts.create(x('acct'), 'credit'); card.statementDay = 5; card.dueDay = 25; card.limit = 10000;
      const g = Accounts.create(x('acct2'), 'ewallet'); g.notMine = true; g.owner = x('owner');
      Store.addTransaction({ kind: 'expense', amount: 100, category: 'Food', date: '2026-11-19', description: x('desc'), accountId: card.id });
      Store.addTransaction({ kind: 'lend', amount: 500, person: x('person'), category: 'Loans', date: '2026-11-18', description: x('loandesc') });
      Store.state.customCategories.push({ name: x('cat'), type: 'expense', icon: '🧪' });
      Store.addTransaction({ kind: 'expense', amount: 50, category: x('cat'), date: '2026-11-17', description: 'ok' });
      const pk = Pockets.create(x('pocket')); Pockets.move(1000, null, pk.id, x('pocketnote'));
      Store.state.budgets.push({ id: 'b1', name: x('budget'), category: 'Food', amount: 5000 });
      Store.addReminder({ title: x('reminder'), remindAt: Date.now() + 864e5, eventDate: '2026-11-21', note: x('remnote') });
      Invest.list().push({ id: 'h1', name: x('holding'), type: 'stock', platform: x('platform') });
      Store.addTransaction({ kind: 'invest', amount: 1000, category: 'Investments', date: '2026-11-10', description: x('invdesc'), holdingId: 'h1' });
      Assets.list().push({ id: 'a1', name: x('asset'), type: 'vehicle', since: '2026-01-01', note: x('assetnote'), history: [{ date: '2026-01-01', value: 1000, at: 1 }] });
      Bills.list().push({ id: 'bl1', name: x('bill'), kind: 'bill', amount: 100, freq: 'month', nextDue: '2026-11-22', category: 'Utilities' });
      Policies.list().push({ id: 'p1', type: 'health', provider: x('provider'), name: x('policy'), premium: 100, freq: 'year', nextDue: '2026-11-30', beneficiaries: x('benef'), note: x('polnote') });
      Debts.plans().push({ id: 'pl1', name: x('plan'), total: 1200, count: 6, perPay: 200, accountId: card.id, via: 'card', date: '2026-10-01', firstDue: '2026-11-05', freq: 'month' });
      Store.state.documents.push({ id: 'd1', name: x('docname'), createdAt: Date.now(), result: { title: x('doctitle'), summary: [x('docsum')], redFlags: [{ severity: 'high', title: x('flagtitle'), detail: x('flagdetail'), quote: x('flagquote') }], plainEnglish: [{ heading: x('peh'), plain: x('pep'), note: x('pen') }], amounts: [{ label: x('amtlabel'), value: x('amtvalue') }], dates: [{ label: x('datelabel'), value: x('datevalue') }], parties: [x('party')] } });
      Store.state.settings.household = { members: [x('member')] };
      Auth.user = { id: 'local:t', name: x('username'), email: 'a@b.co', provider: 'this device' };
      Store.save();
    }""")
    shown = []
    for page in ['home', 'activity', 'plan', 'money', 'more']:
        pg.evaluate(f"() => {{ Nav.go('{page}'); UI.renderAll(); }}"); pg.wait_for_timeout(150)
        shown.append(pg.evaluate("() => (document.body.innerText.match(/onerror=/g) || []).length"))
    # views and forms that show stored text
    for js in ["UI.renderDocResult(Store.state.documents[0].result, { name: Store.state.documents[0].name })", "UI.holdingView(Invest.get('h1'))", "UI.assetView(Assets.get('a1'))",
               "UI.billForm(Bills.get('bl1'))", "UI.policyForm(Policies.get('p1'))", "UI.payDebtForm(Accounts.list()[1])", "UI.trashView()", "UI.renderAccount && UI.renderAccount()",
               "UI.reviewEntries([{ kind: 'expense', amount: 5, category: 'Food', description: window.__P.replace('FIELD', '\"review\"'), date: '2026-11-20', needs: ['amount'], why: [] }], 'x')"]:
        try:
            pg.evaluate(f"() => {{ {js}; }}"); pg.wait_for_timeout(120)
            shown.append(pg.evaluate("() => (document.body.innerText.match(/onerror=/g) || []).length"))
        except Exception as e: errs.append(f'{js[:40]}: {e}')
        pg.evaluate("() => UI.closeForm && UI.closeForm()")
    # a whole backup restored from a file someone sent you
    pg.evaluate("() => { const f = JSON.stringify(Backup.build()); Store.state = Store.blank(); Backup.restore(Backup.validate(JSON.parse(f)), 'replace'); UI.renderAll(); UI.restoreForm(Backup.validate(JSON.parse(f)), window.__P.replace('FIELD', '\"filename\"')); }")
    pg.wait_for_timeout(300)
    ran = pg.evaluate("window.__xss || []")
    b.close()
print('payload shown as plain text per view:', shown)
print('ran as code:', sorted(set(ran)) if ran else 'nothing')
if errs: print('page errors:', errs[:5])
sys.exit(1 if ran else 0)
