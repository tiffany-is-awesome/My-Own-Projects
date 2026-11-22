# SIMULATED cloud-sync test: a fake Supabase (auth + PostgREST for wearwise_data) runs inside the browser test.
# It checks the app's sync logic (two devices, conflicts, offline, delete-all). It does NOT test the real Supabase service.
import json, time, base64, re, sys
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1].startswith('http') else 'http://localhost:8765/wearwise.html'
TABLE = 'unique_ava_data' if 'old-table' in sys.argv else 'wearwise_data'   # 'old-table': before the database rename
res = []
def ok(n, c, d=''): res.append(bool(c)); print('PASS' if c else 'FAIL', n, d)

DB = {}            # user_id -> {data, updated_at}
NET = {'up': True}
UID = '11111111-1111-1111-1111-111111111111'
def b64(o): return base64.urlsafe_b64encode(json.dumps(o).encode()).decode().rstrip('=')
exp = int(time.time()) + 3600
TOKEN = b64({'alg': 'HS256', 'typ': 'JWT'}) + '.' + b64({'sub': UID, 'exp': exp, 'role': 'authenticated', 'email': 'test@example.com'}) + '.sig'
USER = {'id': UID, 'email': 'test@example.com', 'aud': 'authenticated', 'role': 'authenticated', 'user_metadata': {'name': 'Test'}, 'app_metadata': {}, 'created_at': '2026-01-01T00:00:00Z'}
SESSION = {'access_token': TOKEN, 'refresh_token': 'r', 'expires_at': exp, 'expires_in': 3600, 'token_type': 'bearer', 'user': USER}

def stamp(): return time.strftime('%Y-%m-%dT%H:%M:%S', time.gmtime()) + '.%06d+00:00' % (int(time.time() * 1e6) % 1000000)

def handle(route, request):
    if not NET['up']: return route.abort('internetdisconnected')
    u = urlparse(request.url); q = parse_qs(u.query)
    if '/auth/v1/' in u.path:
        if u.path.endswith('/logout'): return route.fulfill(status=204, body='')
        return route.fulfill(status=200, content_type='application/json', body=json.dumps(USER if u.path.endswith('/user') else SESSION))
    m = re.search(r'/rest/v1/(\w+)', u.path)
    if not m: return route.fulfill(status=404, body='')
    if m.group(1) != TABLE:
        return route.fulfill(status=404, content_type='application/json', body=json.dumps({'code': 'PGRST205', 'message': 'Could not find the table'}))
    uid = (q.get('user_id', ['eq.'])[0])[3:]
    want_at = q.get('updated_at', [None])[0]
    method = request.method
    if method in ('GET', 'HEAD'):
        rows = [{'user_id': k, **v} for k, v in DB.items() if not uid or k == uid]
        return route.fulfill(status=200, content_type='application/json', headers={'content-range': f'0-0/{len(rows)}'}, body='' if method == 'HEAD' else json.dumps(rows))
    if method == 'PATCH':
        body = json.loads(request.post_data or '{}'); row = DB.get(uid)
        if row and (want_at is None or row['updated_at'] == want_at[3:]):
            row['data'] = body['data']; row['updated_at'] = stamp()
            return route.fulfill(status=200, content_type='application/json', body=json.dumps([{'updated_at': row['updated_at']}]))
        return route.fulfill(status=200, content_type='application/json', body='[]')
    if method == 'POST':
        body = json.loads(request.post_data or '{}'); body = body[0] if isinstance(body, list) else body
        DB[body['user_id']] = {'data': body['data'], 'updated_at': stamp()}
        return route.fulfill(status=201, content_type='application/json', body=json.dumps([{'updated_at': DB[body['user_id']]['updated_at']}]))
    if method == 'DELETE':
        DB.pop(uid, None); return route.fulfill(status=204, body='')
    return route.fulfill(status=405, body='')

def device(b, name):
    ctx = b.new_context(viewport={'width': 1280, 'height': 860})
    ctx.route(re.compile(r'https://[a-z]+\.supabase\.co/.*'), handle)
    pg = ctx.new_page()
    pg.goto(URL); pg.wait_for_timeout(400)
    pg.evaluate("s => { localStorage.clear(); localStorage.setItem('wearwise.auth', s); }", json.dumps(SESSION))
    return ctx, pg

def garments(pg): return pg.evaluate("JSON.parse(localStorage.getItem('wearwise.v1') || '{}').garments?.length || 0")
def cloud_garments(): return len(DB.get(UID, {}).get('data', {}).get('garments', [])) if UID in DB else None

def delete_first_item(pg):
    pg.goto(URL + '#/closet'); pg.wait_for_timeout(400)
    pg.locator('.grid .card-name').first.click(); pg.wait_for_timeout(300)
    pg.get_by_role('button', name='Delete', exact=True).click(); pg.get_by_role('button', name='Click again to delete').click()
    pg.wait_for_timeout(2600)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    # Device A: has the demo closet locally, signs in → closet goes up to the (empty) account
    ca, A = device(b, 'A')
    A.evaluate("() => { const s = { version: 2 }; }")
    A.reload(); A.wait_for_timeout(800)
    A.goto(URL + '#/settings'); A.wait_for_timeout(300)
    A.get_by_role('button', name='Add the demo closet').click(); A.wait_for_timeout(2600)
    n0 = cloud_garments()
    ok('device A: closet saved to the account', n0 and n0 > 15, f'{n0} pieces in cloud')
    # Device B: signs in elsewhere with an empty local closet → loads the account copy
    cb, B = device(b, 'B')
    B.reload(); B.wait_for_timeout(1500)
    ok('device B: loads the closet from the account', garments(B) == n0, f'{garments(B)} pieces')
    # B deletes a piece (saved). A, unaware, deletes a different piece → conflict, nothing overwritten
    delete_first_item(B)
    ok('device B: change saved', cloud_garments() == n0 - 1)
    before = json.dumps(DB[UID]['data']['garments'])
    A.goto(URL + '#/closet'); A.wait_for_timeout(300)
    A.locator('.grid .card-name').nth(5).click(); A.wait_for_timeout(300)
    A.get_by_role('button', name='Delete', exact=True).click(); A.get_by_role('button', name='Click again to delete').click()
    A.wait_for_timeout(2600)
    ok('device A: sees "changed on another device", nothing overwritten', A.locator('.sync-banner').count() == 1 and json.dumps(DB[UID]['data']['garments']) == before)
    A.screenshot(path='/tmp/e2e/sync-conflict.png')
    A.get_by_role('button', name="Use the other device's version").click(); A.wait_for_timeout(800)
    ok('device A: took the other version', garments(A) == n0 - 1 and A.locator('.sync-banner').count() == 0)
    # Offline on A: change kept locally, saved when back online
    NET['up'] = False; ca.set_offline(True)
    delete_first_item(A)
    ok('offline: told plainly, change kept on device', A.locator('.sync-pill').count() == 1 and garments(A) == n0 - 2 and cloud_garments() == n0 - 1)
    NET['up'] = True; ca.set_offline(False); A.wait_for_timeout(2500)
    ok('back online: change saved automatically', cloud_garments() == n0 - 2, f'cloud {cloud_garments()}')
    # B comes back to its tab → picks up A's newer change
    B.evaluate("() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); }")
    B.wait_for_timeout(1500)
    ok('device B: picks up the other device\'s change on return', garments(B) == n0 - 2, f'{garments(B)}')
    # Delete all on A → cloud row gone, signed out, nothing re-uploaded
    A.goto(URL + '#/settings'); A.wait_for_timeout(300)
    A.get_by_role('button', name='Delete all my Wearwise data').click(); A.get_by_role('button', name='Click again: this cannot be undone').click()
    A.wait_for_timeout(4000)
    ok('delete all: account copy deleted and stays deleted', UID not in DB)
    ok('delete all: this device emptied and signed out', garments(A) == 0 and A.get_by_role('button', name='Sign in').count() >= 1)
    b.close()
print('SUMMARY', sum(res), '/', len(res))
