from playwright.sync_api import sync_playwright
res=[]
def ok(n,c,d=''): res.append(bool(c)); print('PASS' if c else 'FAIL', n, d)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    a=b.new_context().new_page()
    a.goto('http://localhost:8765/wearwise.html'); a.wait_for_timeout(500); a.evaluate("localStorage.clear()"); a.reload(); a.wait_for_timeout(500)
    a.get_by_role('button', name='Try the demo closet').click(); a.wait_for_timeout(500)
    a.goto('http://localhost:8765/wearwise.html#/lookbooks'); a.wait_for_timeout(500)
    a.get_by_text('Spring Rotation').first.click(); a.wait_for_timeout(500)
    btn=a.get_by_role('button', name='Share', exact=True)
    if btn.count(): btn.first.click(); a.wait_for_timeout(300)
    link=a.locator('input[aria-label="Share link"]').input_value()
    ok('share link made', '#/share/' in link, f'{len(link)} chars')
    # another device: a fresh browser profile with an EMPTY closet
    other=b.new_context().new_page()
    other.goto(link); other.wait_for_timeout(1500)
    names=other.locator('.card-meta').all_inner_texts()
    ok('recipient on another device sees every look with its pieces', len(names)>=2 and all(n.strip() for n in names), names[:2])
    ok('pieces are drawn (no photos in the link)', other.locator('.stage-item, .stage-layer').count()>0 and 'data:image' not in link)
    other.screenshot(path='/tmp/wearwise-e2e/share-other.png')
    b.close()
print('SUMMARY', sum(res), '/', len(res))
