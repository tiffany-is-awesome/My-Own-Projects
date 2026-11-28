"""Line icons: no app emoji left as text on any screen; text boxes and dropdowns untouched; saved data unchanged."""
import sys, pathlib, re
from playwright.sync_api import sync_playwright
here = pathlib.Path(__file__).resolve().parent
html = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else here.parent / 'tiffo.html').resolve()
stub = "window.Chart=class{constructor(){}update(){}destroy(){}};Chart.defaults={font:{},color:''};"
fails, passes = [], 0
def ok(name, cond, extra=''):
    global passes
    if cond: passes += 1
    else: fails.append(name + (': ' + str(extra) if extra else ''))
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = b.new_context(timezone_id='Asia/Manila').new_page(); pg.add_init_script(stub)
    for pat in ['**/chart.umd.min.js', '**/cdn.tailwindcss.com/**', '**/supabase-js@2**', '**/js.puter.com/**']: pg.route(pat, lambda r: r.fulfill(body='', content_type='text/javascript'))
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(html.as_uri()); pg.wait_for_timeout(800)
    left = """() => { const re = Icons.re(), out = new Set(); const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (w.nextNode()) { const n = w.currentNode; let skip = false; for (let p = n.parentNode; p; p = p.parentNode) if (p.nodeType === 1 && Icons.SKIP.has(p.nodeName) && p.nodeName !== 'OPTION' && p.nodeName !== 'SELECT') skip = true;
        if (skip) continue; re.lastIndex = 0; let m; while ((m = re.exec(n.nodeValue))) out.add(m[0]); }
      for (const el of document.querySelectorAll('[title],[placeholder],[aria-label]')) for (const a of ['title','placeholder','aria-label']) { const v = el.getAttribute(a); re.lastIndex = 0; if (v && re.test(v)) out.add(a + ':' + v.slice(0, 20)); }
      return [...out]; }"""
    ok('icons drawn on start', js := pg.evaluate("document.querySelectorAll('svg.ti').length") > 20, pg.evaluate("document.querySelectorAll('svg.ti').length"))
    ok('no emoji on the start screen', not pg.evaluate(left), pg.evaluate(left))
    # demo data + every page
    pg.evaluate("""() => { document.querySelectorAll('#authScreen,#onboarding').forEach(e => e && e.classList.add('hidden')); Store.state = Store.blank(); Store.state.initialBalance = 5000;
      Pockets.create('Emergency fund', { goal: 20000 }); Pockets.create('Dog fund', { emoji: '🐶' });
      Biz.create({ name: 'Sunny Side Bakery', cash: 1000, taxMode: 'none' }); Store.save(); UI.renderAll(); }""")
    pg.wait_for_timeout(200)
    for page in pg.evaluate("Object.keys(Nav.PAGES)"):
        pg.evaluate("(p) => { Nav.go(p); UI.renderAll(); }", page); pg.wait_for_timeout(120)
        ok(f'no app emoji left on {page}', not pg.evaluate(left), pg.evaluate(left))
    for tab in ['overview', 'sell', 'invoices', 'orders', 'customers', 'products', 'stock', 'suppliers', 'expenses', 'reports', 'settings']:
        pg.evaluate("(t) => { Nav.go('business'); UI.bizTab = t; UI.renderBiz(); }", tab); pg.wait_for_timeout(40)
        ok(f'no app emoji on business {tab}', not pg.evaluate(left), pg.evaluate(left))
    pg.evaluate("() => toast('💸 Expense saved.')"); pg.wait_for_timeout(100)
    ok('toasts get icons', not pg.evaluate(left), pg.evaluate(left))
    ok('a pocket the person named with their own emoji keeps it', pg.evaluate("() => Pockets.list().find(p => /dog/i.test(p.name))?.emoji || JSON.stringify(Pockets.list().map(p => [p.name, p.emoji]))") == '🐶')
    ok('saved data unchanged (pocket icons stay emoji)', pg.evaluate("() => Pockets.list()[0].emoji").strip() != '')
    pg.evaluate("() => UI.form({ title: 'x', fields: [{ id: 'a', label: 'Pick', type: 'select', value: '1', options: [['1', '💵 Free money'], ['2', '🇵🇭 PHP']] }, { id: 'b', label: 'Note', type: 'textarea', value: '🎉 party' }], onSave: () => {} })"); pg.wait_for_timeout(80)
    ok('dropdown options: emoji left out, text kept', pg.evaluate("[...document.querySelectorAll('#fm_a option')].map(o => o.textContent).join('|')") == 'Free money|PHP', pg.evaluate("[...document.querySelectorAll('#fm_a option')].map(o => o.textContent).join('|')"))
    ok('text box keeps what was typed', pg.evaluate("document.getElementById('fm_b').value") == '🎉 party')
    pg.evaluate("() => { document.title = '⏰ Reminder!'; }")
    ok('tab title has no emoji', pg.title() == 'Reminder!', pg.title())
    ok('icons follow the text colour', pg.evaluate("getComputedStyle(document.querySelector('svg.ti path')).stroke") != 'none')
    pg.evaluate("() => document.documentElement.classList.add('dark')")
    ok('white in dark mode', pg.evaluate("getComputedStyle(document.querySelector('svg.ti')).color") == 'rgb(255, 255, 255)', pg.evaluate("getComputedStyle(document.querySelector('svg.ti')).color"))
    X = '<img src=x onerror="window.__x=1">🎉'
    pg.evaluate("(X) => { toast(escapeHTML(X)); Pockets.create(X); UI.renderAll(); }", X); pg.wait_for_timeout(200)
    ok('no code runs through the icon swap', not pg.evaluate("window.__x"))
    if errs: fails.append('page errors: ' + '; '.join(errs[:3]))
    b.close()
print('\n'.join('FAIL ' + f for f in fails))
print(f"{passes}/{passes + len(fails)} icon checks passed")
sys.exit(1 if fails else 0)
