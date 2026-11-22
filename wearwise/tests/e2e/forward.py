from playwright.sync_api import sync_playwright
res=[]
def ok(n,c,d=''): res.append(bool(c)); print('PASS' if c else 'FAIL', n, d)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg=b.new_page()
    pg.goto('http://localhost:8765/wearwise.html'); pg.wait_for_timeout(600); pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(600)
    pg.get_by_role('button', name='Try the demo closet').click(); pg.wait_for_timeout(500)
    pg.goto('http://localhost:8765/unique-ava.html#/closet'); pg.wait_for_timeout(1200)
    ok('old address forwards and keeps the page', pg.url.endswith('/wearwise.html#/closet'), pg.url)
    ok('saved closet still there after forwarding', pg.locator('.grid .card-name').count()>15)
    pg.goto('http://localhost:8765/unique-ava.html?x=1#access_token=abc&type=signup'); pg.wait_for_timeout(800)
    ok('sign-in token in the hash survives the forward', 'wearwise.html?x=1#access_token=abc' in pg.url, pg.url)
    ok('tab title', pg.title().startswith('Wearwise'), pg.title())
    b.close()
print('SUMMARY', sum(res), '/', len(res))
