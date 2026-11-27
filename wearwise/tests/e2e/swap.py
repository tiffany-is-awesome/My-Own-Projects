# Swapping a piece on an outfit card: the picture comes back into view, says what changed, and Undo works.
import sys
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1].startswith('http') else 'http://localhost:8765/wearwise.html'
res = []
def ok(n, c, d=''): res.append(bool(c)); print('PASS' if c else 'FAIL', n, d)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    c = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True); pg = c.new_page()
    pg.goto(URL); pg.wait_for_timeout(400); pg.evaluate("() => localStorage.clear()"); pg.reload(); pg.wait_for_timeout(500)
    pg.goto(URL + '#/settings'); pg.wait_for_timeout(300); pg.get_by_role('button', name='Add the demo closet').click(); pg.wait_for_timeout(500)
    pg.goto(URL + '#/create/go'); pg.wait_for_timeout(2500)
    card = pg.locator('.outfit-card').first
    score = lambda: card.locator('.score-ring').first.get_attribute('aria-label')
    before = score()
    card.get_by_role('button', name='Improve or change').click(); pg.wait_for_timeout(400)
    card.locator('.alt').first.click(); pg.wait_for_timeout(1200)
    note = card.locator('.swap-note')
    ok('a note says what was swapped, with the score change', note.count() == 1 and ('Swapped in' in note.inner_text() or 'Removed' in note.inner_text()) and '→' in note.inner_text(), note.inner_text() if note.count() else '')
    box = card.locator('.outfit-card-stage').bounding_box()
    ok('the outfit picture is back in view', box and box['y'] < 844 and box['y'] + box['height'] > 0, str(box))
    after = score()
    note.get_by_role('button', name='Undo').click(); pg.wait_for_timeout(500)
    back = score()
    ok('Undo puts the original outfit back', back == before and after != before and card.locator('.swap-note').count() == 0, f'{before} → {after} → {back}')
    pg.screenshot(path='/tmp/wearwise-e2e/swap.png')
    b.close()
print('SUMMARY', sum(res), '/', len(res))
