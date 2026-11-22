from playwright.sync_api import sync_playwright
import json
URL='http://localhost:8765/wearwise.html'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':1300,'height':900})
    pg.goto(URL); pg.wait_for_timeout(800)
    pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(600)
    pg.goto(URL+'#/closet'); pg.wait_for_timeout(300)
    pg.get_by_role('button', name='+ Add clothes').first.click()
    pg.locator('input[type=file][multiple]').set_input_files(['/tmp/wearwise-e2e/photo-normal.jpg','/tmp/wearwise-e2e/photo-jeans.jpg'])
    pg.wait_for_selector('.review', timeout=60000); pg.wait_for_timeout(300)
    pg.get_by_role('button', name='Add all 2 to closet').click(); pg.wait_for_timeout(400)
    pg.evaluate("""() => { const s = JSON.parse(localStorage.getItem('unique-ava.v1')); const g = s.garments; const top = g.find(x => x.category==='top'), bot = g.find(x => x.category==='bottom');
      s.draft.slots = { ...s.draft.slots, top: top.id, bottom: bot.id }; s.draft.stage = { mode: 'mannequin' }; localStorage.setItem('unique-ava.v1', JSON.stringify(s)); }""")
    pg.goto(URL+'#/builder'); pg.reload(); pg.wait_for_timeout(800)
    pg.screenshot(path='/tmp/wearwise-e2e/mq-photo.png', clip={'x':0,'y':60,'width':700,'height':840})
    pg.get_by_role('tab', name='Flat-lay').click(); pg.wait_for_timeout(300)
    pg.screenshot(path='/tmp/wearwise-e2e/fl-photo.png', clip={'x':0,'y':60,'width':700,'height':840})
    b.close()
