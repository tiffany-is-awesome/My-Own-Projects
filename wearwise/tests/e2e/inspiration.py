# Inspiration: typed look → keyword matching (labelled as such) → exact / close / approximate / missing → recreate.
from playwright.sync_api import sync_playwright
URL='http://localhost:8765/wearwise.html'
res=[]
def ok(n,c,d=''): res.append(bool(c)); print('PASS' if c else 'FAIL', n, d)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':1280,'height':900})
    pg.goto(URL); pg.wait_for_timeout(500); pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(600)
    pg.get_by_role('button', name='Try the demo closet').click(); pg.wait_for_timeout(600)
    pg.goto(URL+'#/inspiration'); pg.wait_for_timeout(500)
    pg.get_by_role('button', name='+ Add inspiration').click(); pg.wait_for_timeout(400)
    txt=pg.locator('.modal').inner_text()
    ok('explains keyword matching vs AI photo reading', 'keyword' in txt.lower() and 'gemini' in txt.lower())
    area=pg.locator('.modal textarea, .modal input[type=text]').first
    area.fill('cream cable knit sweater, wide olive trousers, white sneakers, red beret')
    pg.wait_for_timeout(300)
    hint=pg.locator('.modal').inner_text()
    ok('says keyword matching found the pieces', 'keyword matching found 4' in hint.lower(), [l for l in hint.split('\n') if 'Keyword' in l][:1])
    pg.get_by_role('button', name='Match to my closet').click(); pg.wait_for_timeout(800)
    page=pg.locator('main').inner_text().lower()
    ok('matches are graded (exact / close / approximate)', any(w in page for w in ['exact match', 'close match', 'approximate']))
    ok('missing piece is named plainly', 'beret' in page and ('not in your closet' in page or 'missing' in page))
    pg.screenshot(path='/tmp/wearwise-e2e/inspiration.png', full_page=True)
    pg.get_by_role('button', name='Recreate with my clothes').click(); pg.wait_for_timeout(700)
    ok('recreate opens the builder with her own pieces', '#/builder' in pg.url or 'builder' in pg.locator('main').inner_text().lower(), pg.url)
    b.close()
print('SUMMARY', sum(res), '/', len(res))
