from playwright.sync_api import sync_playwright
URL='http://localhost:8765/wearwise.html'
res=[]; errs=[]
def ok(n,c,d=''): res.append(bool(c)); print('PASS' if c else 'FAIL', n, d)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    for W,H,tag in [(1360,900,'d'),(390,844,'m')]:
        pg=b.new_page(viewport={'width':W,'height':H})
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(URL); pg.wait_for_timeout(600); pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(700)
        pg.get_by_role('button', name='Try the demo closet').click(); pg.wait_for_timeout(900)
        # honest verdict on Today's outfit
        ok(f'[{tag}] Today shows an honest verdict', pg.locator('.today-card .verdict-label').count()==1, pg.locator('.today-card .verdict-label').first.inner_text())
        # donut
        ok(f'[{tag}] no donut chart on Home', pg.locator('.donut-card, .donut-svg').count()==0)
        pg.goto(URL+'#/insights'); pg.wait_for_selector('.vtable', timeout=20000)
        ok(f'[{tag}] no donut chart in Insights', pg.locator('.donut-card, .donut-svg').count()==0)
        # save + wardrobe
        pg.goto(URL+'#/create'); pg.wait_for_timeout(300)
        pg.get_by_role('button', name='Get 3 outfits').click(); pg.wait_for_selector('.outfit-card'); pg.wait_for_timeout(900)
        ok(f'[{tag}] verdict on outfit cards', pg.locator('.outfit-card .verdict-label').count()==pg.locator('.outfit-card').count())
        pg.locator('.outfit-card').nth(0).get_by_role('button', name='Save').click(); pg.wait_for_timeout(300)
        pg.locator('.outfit-card').nth(0).get_by_role('button', name='+ Work').click(); pg.wait_for_timeout(300)
        pg.goto(URL+'#/saved'); pg.wait_for_timeout(400)
        pg.locator('.toolbar .chip', has_text='Work').click(); pg.wait_for_timeout(300)
        ok(f'[{tag}] Work wardrobe tab has the outfit', pg.locator('.saved-card').count()==1)
        # calendar: plan a day from saved
        pg.goto(URL+'#/calendar'); pg.wait_for_timeout(500)
        pg.locator('.cal-cell.today').click(); pg.wait_for_timeout(300)
        pg.locator('.pick-outfit').first.click(); pg.wait_for_timeout(400)
        ok(f'[{tag}] today planned', pg.locator('.cal-cell.today.has-plan').count()==1)
        pg.locator('.cal-cell.today').click(); pg.wait_for_timeout(300)
        pg.get_by_role('button', name='I wore it').click(); pg.wait_for_timeout(300)
        pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
        ok(f'[{tag}] worn tick on today', pg.locator('.cal-cell.today .cal-worn').count()==1)
        # trip
        pg.get_by_role('button', name='✈ Plan a trip').click(); pg.wait_for_timeout(300)
        pg.get_by_placeholder('e.g. Baguio weekend').fill('Baguio weekend')
        pg.get_by_role('button', name='Cool').click()
        pg.locator('.trip-form .btn.accent').click(); pg.wait_for_timeout(700)
        days=pg.locator('.trip-result .trip-day').count(); pack=pg.locator('.trip-result .packing li').count()
        ok(f'[{tag}] trip planned day by day with packing list', days==4 and 0<pack<16, f'{days} days, {pack} pieces')
        pg.screenshot(path=f'/tmp/wearwise-e2e/c-{tag}-trip.png')
        pg.get_by_role('button', name='Add to calendar').click(); pg.wait_for_timeout(500)
        ok(f'[{tag}] trip shows on calendar', pg.locator('.cal-trip').count()>=3 and pg.get_by_text('Baguio weekend').count()>=1)
        pg.screenshot(path=f'/tmp/wearwise-e2e/c-{tag}-cal.png', full_page=True)
        pg.reload(); pg.wait_for_timeout(800); pg.goto(URL+'#/calendar'); pg.wait_for_timeout(400)
        ok(f'[{tag}] plans persist after reload', pg.locator('.cal-cell.has-plan').count()>=4)
        # builder honest verdict
        pg.goto(URL+'#/create'); pg.wait_for_timeout(300)
        pg.get_by_role('button', name='Get 3 outfits').click(); pg.wait_for_selector('.outfit-card'); pg.wait_for_timeout(900)
        pg.locator('.outfit-card').nth(2).get_by_role('button', name='Open in builder').click(); pg.wait_for_timeout(600)
        ok(f'[{tag}] builder shows an honest verdict', pg.locator('.critique-head + .verdict .verdict-label').count()==1, pg.locator('.critique-head + .verdict').inner_text().replace('\n',' — ')[:120])
        pg.close()
    ok('no page errors', not errs, '; '.join(errs[:3]))
    b.close()
print('SUMMARY', sum(res), '/', len(res))
