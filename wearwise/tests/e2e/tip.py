import sys
from playwright.sync_api import sync_playwright
on = sys.argv[1]=='on'
res=[]
def ok(n,c,d=''): res.append(bool(c)); print('PASS' if c else 'FAIL', n, d)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg=b.new_page()
    pg.goto('http://localhost:8765/wearwise.html'); pg.wait_for_timeout(600); pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(600)
    pg.get_by_role('button', name='Try the demo closet').click(); pg.wait_for_timeout(700)
    if not on:
        ok('tips off: no tip card, no footer link', pg.locator('.tip-card').count()==0 and pg.get_by_text('Treat the developer').count()==0)
    else:
        ok('tip card on Home', pg.locator('.tip-card').count()==1, pg.locator('.tip-card b').inner_text())
        ok('card/PayPal link', pg.get_by_role('link', name='💳 Card / PayPal').get_attribute('href')=='https://ko-fi.com/example')
        pg.get_by_role('button', name='GCash / QR Ph').click(); pg.wait_for_timeout(300)
        ok('GCash QR opens', pg.locator('.tip-qr img').count()==1 and 'Tiffany P.' in pg.locator('.tip-qr').inner_text())
        pg.locator('.tip-card').screenshot(path='/tmp/wearwise-e2e/tip-card.png') if False else None
        pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
        pg.locator('.tip-card').screenshot(path='/tmp/wearwise-e2e/tip-card.png')
        ok('footer link', pg.get_by_role('link', name='🍩 Treat the developer').count()==1)
    b.close()
print('SUMMARY', sum(res), '/', len(res))
