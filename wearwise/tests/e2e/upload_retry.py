# One photo, several photos, a broken file, and trying again.
from playwright.sync_api import sync_playwright
import os
URL='http://localhost:8765/wearwise.html'
res=[]
def ok(n,c,d=''): res.append(bool(c)); print('PASS' if c else 'FAIL', n, d)
os.makedirs('/tmp/wearwise-e2e', exist_ok=True)
open('/tmp/wearwise-e2e/broken.jpg','wb').write(b'not really a jpeg')
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':1280,'height':900})
    pg.goto(URL); pg.wait_for_timeout(500); pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(600)
    pg.goto(URL+'#/closet'); pg.wait_for_timeout(300)
    pg.get_by_role('button', name='+ Add clothes').first.click()
    pg.locator('input[type=file][multiple]').set_input_files(['/tmp/wearwise-e2e/broken.jpg'])
    pg.wait_for_timeout(2500)
    txt=pg.locator('.modal').inner_text()
    ok('broken file: says it could not be read, nothing added', 'could not be read' in txt.lower() or "couldn't be read" in txt.lower(), txt.replace('\n',' ')[:140])
    pg.get_by_role('button', name='Start over').click(); pg.wait_for_timeout(300)
    pg.locator('input[type=file][multiple]').set_input_files(['/tmp/wearwise-e2e/photo-normal.jpg'])
    pg.wait_for_selector('.review, .confirm', timeout=60000); pg.wait_for_timeout(400)
    pg.get_by_role('button', name='Add to closet').click(); pg.wait_for_timeout(500)
    ok('retry with a good photo: one piece added', pg.locator('.grid .card-name').count()==1)
    pg.get_by_role('button', name='+ Add clothes').first.click()
    pg.locator('input[type=file][multiple]').set_input_files(['/tmp/wearwise-e2e/photo-jeans.jpg','/tmp/wearwise-e2e/broken.jpg','/tmp/wearwise-e2e/photo-small.jpg'])
    pg.wait_for_selector('.review', timeout=90000); pg.wait_for_timeout(500)
    addbtn=pg.locator('.modal button', has_text='Add all')
    label=addbtn.first.inner_text() if addbtn.count() else ''
    ok('mixed batch: good photos ready, broken one marked', 'add all 2' in label.lower(), label)
    addbtn.first.click(); pg.wait_for_timeout(600)
    ok('mixed batch: 2 more pieces added (3 total)', pg.locator('.grid .card-name').count()==3)
    # edit + delete
    pg.locator('.grid .card-name').first.click(); pg.wait_for_timeout(300)
    pg.get_by_role('button', name='Edit details').click(); pg.wait_for_timeout(200)
    pg.locator('.item-form input.input').first.fill('My Favourite Jeans')
    pg.get_by_role('button', name='Save changes').click(); pg.wait_for_timeout(400)
    ok('edit: new name shown', pg.get_by_text('My Favourite Jeans').count()==1)
    pg.get_by_text('My Favourite Jeans').click(); pg.wait_for_timeout(300)
    pg.get_by_role('button', name='Delete', exact=True).click(); pg.get_by_role('button', name='Click again to delete').click(); pg.wait_for_timeout(400)
    ok('delete: piece removed', pg.get_by_text('My Favourite Jeans').count()==0 and pg.locator('.grid .card-name').count()==2)
    pg.reload(); pg.wait_for_timeout(800); pg.goto(URL+'#/closet'); pg.wait_for_timeout(400)
    ok('after reload: still 2 pieces', pg.locator('.grid .card-name').count()==2)
    b.close()
print('SUMMARY', sum(res), '/', len(res))
