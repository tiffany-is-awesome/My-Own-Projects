from playwright.sync_api import sync_playwright
import json
res=[]
def ok(n,c,d=''): res.append(bool(c)); print('PASS' if c else 'FAIL', n, d)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg=b.new_page()
    pg.goto('http://localhost:8765/wearwise.html'); pg.wait_for_timeout(500)
    pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(500)
    pg.get_by_role('button', name='Try the demo closet').click(); pg.wait_for_timeout(500)
    data=pg.evaluate("localStorage.getItem('wearwise.v1')")
    # simulate an existing Unique Ava user: data only under the old key
    pg.evaluate("(d) => { localStorage.clear(); localStorage.setItem('unique-ava.v1', d); localStorage.setItem('unique-ava.auth', '{\"x\":1}'); }", data)
    pg.goto('http://localhost:8765/unique-ava.html#/closet'); pg.wait_for_timeout(1200)
    ok('old user lands on wearwise.html with closet intact', pg.url.endswith('wearwise.html#/closet') and pg.locator('.grid .card-name').count()>15, pg.url)
    keys=pg.evaluate("Object.keys(localStorage)")
    ok('data moved to the new key, old key gone', 'wearwise.v1' in keys and 'unique-ava.v1' not in keys, str(keys))
    ok('old sign-in key moved (Supabase then validates it; the fake test session is discarded)', 'unique-ava.auth' not in keys)
    b.close()
print('SUMMARY', sum(res), '/', len(res))
