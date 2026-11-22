"""Runs tests/parser-cases.json against tiffo.html in headless Chrome.
Usage: python3 tests/run_parser_tests.py [path/to/tiffo.html] [--chrome /usr/bin/google-chrome]
The clock is frozen at 2026-11-20 10:00 (Asia/Manila) so date cases are stable."""
import json, sys, os, pathlib
from playwright.sync_api import sync_playwright
here = pathlib.Path(__file__).resolve().parent
html = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else here.parent / 'tiffo.html').resolve()
chrome = sys.argv[sys.argv.index('--chrome') + 1] if '--chrome' in sys.argv else None
cases = json.load(open(here / 'parser-cases.json'))
stub = "window.Chart=class{constructor(){}update(){}destroy(){}};Chart.defaults={font:{},color:''};"
ROUTE = """(t) => {
  const di = Parser.debtIntent(t); if (di) return { route: di.type };
  const ai = Parser.assetIntent(t); if (ai) return { route: ai.type };
  if (Reminders.isReminder(t) || Parser.isBillDue?.(t)) return { route: 'reminder' };
  if (Pockets.isPocketNote(t)) return { route: 'pocket' };
  if (Budgets.isBudget(t)) return { route: 'budget' };
  return { route: 'money', items: Parser.parseMany(t) };
}"""
fails = 0
with sync_playwright() as p:
    b = p.chromium.launch(**({'executable_path': chrome} if chrome else {}), args=['--no-sandbox'])
    ctx = b.new_context(timezone_id='Asia/Manila')
    pg = ctx.new_page()
    pg.clock.set_fixed_time('2026-11-20T10:00:00+08:00')
    pg.route('**/chart.umd.min.js', lambda r: r.fulfill(body=stub, content_type='text/javascript'))
    for pat in ['**/cdn.tailwindcss.com/**', '**/supabase-js@2', '**/js.puter.com/**']:
        pg.route(pat, lambda r: r.fulfill(body='', content_type='text/javascript'))
    pg.goto(html.as_uri()); pg.wait_for_timeout(600)
    pg.evaluate("""() => { CURRENCY = 'PHP'; Store.state = Store.blank(); Store.state.currency='PHP';
      ['GCash','Maya','BDO','BPI'].forEach(n => Accounts.create(n, n==='GCash'||n==='Maya'?'ewallet':'bank')); }""")
    def check(exp, got, label):
        errs = []
        for k in ('kind', 'amount', 'category', 'person', 'repeat', 'date'):
            if k in exp and exp[k] != got.get(k): errs.append(f"{k}: want {exp[k]!r} got {got.get(k)!r}")
        if 'days' in exp:
            want = pg.evaluate(f"toISODate(daysAgo({-exp['days']}))")
            if got.get('date') != want: errs.append(f"date: want {want} got {got.get('date')}")
        if 'fast' in exp:
            fast = got['confidence'] >= 0.75 and not got['needs']
            if fast != exp['fast']: errs.append(f"fast: want {exp['fast']} got {fast} (conf {got['confidence']}, needs {got['needs']})")
        if 'needs' in exp and exp['needs'] not in got['needs']: errs.append(f"needs: want {exp['needs']} got {got['needs']}")
        if 'account' in exp and (got.get('account') or {}).get('name') != exp['account']: errs.append(f"account: want {exp['account']} got {got.get('account')}")
        return errs
    for c in cases:
        r = pg.evaluate(ROUTE, c['t'])
        errs = []
        want_route = c.get('route', 'money')
        if r['route'] != want_route: errs.append(f"route: want {want_route} got {r['route']}")
        elif want_route == 'money':
            items = r['items']
            if 'multi' in c:
                if len(items) != len(c['multi']): errs.append(f"count: want {len(c['multi'])} got {len(items)} {[ (i['kind'], i['amount']) for i in items]}")
                else:
                    for i, (e, g) in enumerate(zip(c['multi'], items)): errs += [f"#{i+1} {x}" for x in check(e, g, c['t'])]
            else:
                if len(items) != 1: errs.append(f"count: want 1 got {len(items)}")
                else: errs += check(c, items[0], c['t'])
        if errs:
            fails += 1
            print(f"✗ {c['t']}\n    " + "\n    ".join(errs))
    b.close()
print(f"\n{len(cases) - fails}/{len(cases)} passed")
sys.exit(1 if fails else 0)
