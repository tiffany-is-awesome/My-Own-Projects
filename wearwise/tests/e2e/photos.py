# Photo storage test.
# Part 1 (real browser storage): a closet with more photos than browser storage (localStorage, ~5 MB) holds
#   still saves and survives a reload, because photos now go to IndexedDB. Old saves with photos inline are moved over.
# Part 2 (SIMULATED account): a fake Supabase (auth + table + Storage) checks that photos are uploaded as separate
#   files, load on a second device, and are removed by "Delete all my data". It does NOT test the real Supabase service.
import json, time, base64, re, sys
from urllib.parse import urlparse, parse_qs, unquote
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1].startswith('http') else 'http://localhost:8765/wearwise.html'
res = []
def ok(n, c, d=''): res.append(bool(c)); print('PASS' if c else 'FAIL', n, d)

# Make N real, hard-to-compress photos in the page and add them to the saved closet (inline, the old format).
ADD = """async (n) => {
  const s = JSON.parse(localStorage.getItem('wearwise.v1'));
  const me = s.activeProfile;
  for (let i = 0; i < n; i++) {
    const c = document.createElement('canvas'); c.width = c.height = 150; const x = c.getContext('2d');
    const d = x.createImageData(150, 150); for (let k = 0; k < d.data.length; k++) d.data[k] = (Math.random() * 256) | 0; x.putImageData(d, 0, 0);
    const id = 'big-' + Date.now() + '-' + i;
    const base = s.garments.find(g => g.category === 'top') || s.garments[0];   // copy a real piece's shape
    s.garments.push({ ...base, id, ownerId: me, demo: false, name: 'Test tee ' + i, image: c.toDataURL('image/webp', 0.95), createdAt: Date.now() });
  }
  localStorage.setItem('wearwise.v1', JSON.stringify(s));
  return JSON.stringify(s).length;
}"""
SAVED = "() => { const s = JSON.parse(localStorage.getItem('wearwise.v1') || '{}'); const g = s.garments || []; return { n: g.length, refs: g.filter(x => (x.image||'').startsWith('wwphoto:')).length, inline: g.filter(x => (x.image||'').startsWith('data:')).length, bytes: localStorage.getItem('wearwise.v1')?.length || 0 }; }"
IDB = "() => new Promise(r => { const q = indexedDB.open('wearwise'); q.onsuccess = () => { const t = q.result.transaction('photos').objectStore('photos').count(); t.onsuccess = () => r(t.result); }; q.onerror = () => r(-1); })"
SHOWN = "() => [...document.querySelectorAll('img')].filter(i => i.src.startsWith('data:image/webp') && i.complete && i.naturalWidth === 150).length"
BROKEN = "() => [...document.querySelectorAll('img')].filter(i => i.getAttribute('src')?.startsWith('wwphoto:')).length"

# ─── fake Supabase with Storage
DB, FILES = {}, {}
UID = '22222222-2222-2222-2222-222222222222'
def b64(o): return base64.urlsafe_b64encode(json.dumps(o).encode()).decode().rstrip('=')
exp = int(time.time()) + 3600
TOKEN = b64({'alg': 'HS256', 'typ': 'JWT'}) + '.' + b64({'sub': UID, 'exp': exp, 'role': 'authenticated', 'email': 't@example.com'}) + '.sig'
USER = {'id': UID, 'email': 't@example.com', 'aud': 'authenticated', 'role': 'authenticated', 'user_metadata': {'name': 'T'}, 'app_metadata': {}, 'created_at': '2026-01-01T00:00:00Z'}
SESSION = {'access_token': TOKEN, 'refresh_token': 'r', 'expires_at': exp, 'expires_in': 3600, 'token_type': 'bearer', 'user': USER}
def stamp(): return time.strftime('%Y-%m-%dT%H:%M:%S', time.gmtime()) + '.%06d+00:00' % (int(time.time() * 1e6) % 1000000)

def file_part(request):
    ct = request.headers.get('content-type', ''); body = request.post_data_buffer
    if 'multipart/form-data' not in ct: return body, ct
    bnd = ('--' + ct.split('boundary=')[1]).encode()
    for part in body.split(bnd):
        head, _, data = part.partition(b'\r\n\r\n')
        if b'filename=' in head:
            t = re.search(rb'Content-Type: ([^\r\n]+)', head)
            return data[:-2], (t.group(1).decode() if t else 'application/octet-stream')
    return body, ct

def handle(route, request):
    u = urlparse(request.url); q = parse_qs(u.query); m = request.method
    if '/auth/v1/' in u.path:
        if u.path.endswith('/logout'): return route.fulfill(status=204, body='')
        return route.fulfill(status=200, content_type='application/json', body=json.dumps(USER if u.path.endswith('/user') else SESSION))
    if '/storage/v1/object/list/' in u.path:
        prefix = json.loads(request.post_data or '{}').get('prefix', '').strip('/')
        items = [{'name': k.split('/', 2)[2], 'id': k, 'created_at': '2020-01-01T00:00:00Z'} for k in FILES if k.startswith('wearwise-photos/' + prefix + '/')]
        return route.fulfill(status=200, content_type='application/json', body=json.dumps(items))
    sm = re.search(r'/storage/v1/object/(?:authenticated/)?(.+)$', u.path)
    if sm:
        key = unquote(sm.group(1))
        if m == 'DELETE':
            for p in json.loads(request.post_data or '{}').get('prefixes', []): FILES.pop(key.rstrip('/') + '/' + p, None)
            return route.fulfill(status=200, content_type='application/json', body='[]')
        if m == 'POST':
            if key in FILES: return route.fulfill(status=400, content_type='application/json', body=json.dumps({'statusCode': '409', 'error': 'Duplicate', 'message': 'The resource already exists'}))
            FILES[key] = file_part(request)
            return route.fulfill(status=200, content_type='application/json', body=json.dumps({'Key': key}))
        if m == 'GET':
            if key not in FILES: return route.fulfill(status=400, content_type='application/json', body=json.dumps({'statusCode': '404', 'error': 'not_found', 'message': 'Object not found'}))
            body, ct = FILES[key]; return route.fulfill(status=200, content_type=ct, body=body)
    if '/rest/v1/wearwise_data' in u.path:
        uid = (q.get('user_id', ['eq.'])[0])[3:]; want = q.get('updated_at', [None])[0]
        if m in ('GET', 'HEAD'):
            rows = [{'user_id': k, **v} for k, v in DB.items() if not uid or k == uid]
            return route.fulfill(status=200, content_type='application/json', body='' if m == 'HEAD' else json.dumps(rows))
        if m == 'PATCH':
            body = json.loads(request.post_data); row = DB.get(uid)
            if row and (want is None or row['updated_at'] == want[3:]):
                row['data'] = body['data']; row['updated_at'] = stamp()
                return route.fulfill(status=200, content_type='application/json', body=json.dumps([{'updated_at': row['updated_at']}]))
            return route.fulfill(status=200, content_type='application/json', body='[]')
        if m == 'POST':
            body = json.loads(request.post_data); body = body[0] if isinstance(body, list) else body
            DB[body['user_id']] = {'data': body['data'], 'updated_at': stamp()}
            return route.fulfill(status=201, content_type='application/json', body=json.dumps([{'updated_at': DB[body['user_id']]['updated_at']}]))
        if m == 'DELETE': DB.pop(uid, None); return route.fulfill(status=204, body='')
    return route.fulfill(status=404, body='')

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    # ─── Part 1: this device only
    ctx = b.new_context(viewport={'width': 1280, 'height': 860}); pg = ctx.new_page()
    pg.goto(URL); pg.wait_for_timeout(500)
    pg.evaluate("() => localStorage.clear()"); pg.reload(); pg.wait_for_timeout(500)
    pg.goto(URL + '#/settings'); pg.wait_for_timeout(300)
    pg.get_by_role('button', name='Add the demo closet').click(); pg.wait_for_timeout(800)
    size1 = pg.evaluate(ADD, 50)                       # old format: 50 photos inline (fits in ~5 MB)
    pg.reload(); pg.wait_for_timeout(2500)
    s = pg.evaluate(SAVED)
    ok('old save with photos inline is moved to photo storage', s['refs'] == 50 and s['inline'] == 0 and s['bytes'] < size1 / 5, f"{s} (was {size1} chars)")
    pg.evaluate(ADD, 50); pg.reload(); pg.wait_for_timeout(2500)  # 50 more: now more photos than localStorage could hold
    pg.evaluate(ADD, 30); pg.reload(); pg.wait_for_timeout(2500)
    s = pg.evaluate(SAVED); n_idb = pg.evaluate(IDB)
    total_mb = pg.evaluate("() => 0")
    ok('130 photos (more than browser storage holds) are all saved', s['refs'] == 130 and n_idb == 130, f"{s}, {n_idb} in photo storage")
    pg.reload(); pg.wait_for_timeout(2500)
    pg.goto(URL + '#/closet'); pg.wait_for_timeout(1500)
    shown = pg.evaluate(SHOWN); broken = pg.evaluate(BROKEN)
    ok('after reloading, the photos show in the closet', shown >= 20 and broken == 0, f'{shown} shown, {broken} broken')
    pg.screenshot(path='/tmp/wearwise-e2e/photos-closet.png')
    # Delete a photo piece → after pruning (photos older than an hour), its photo goes; here just check the save is right
    pg.goto(URL + '#/settings'); pg.wait_for_timeout(500)
    meter = pg.locator('text=Your Wearwise data').inner_text()
    ok('Settings explains photos are stored separately', 'stored separately' in meter, meter[:120])
    pg.get_by_role('button', name='Delete all my Wearwise data').click(); pg.get_by_role('button', name='Click again: this cannot be undone').click()
    pg.wait_for_timeout(1500)
    ok('delete all: photos removed from this device too', pg.evaluate(IDB) == 0 and pg.evaluate(SAVED)['n'] == 0)
    ctx.close()

    # ─── Part 2: SIMULATED account
    def device():
        c = b.new_context(viewport={'width': 1280, 'height': 860})
        c.route(re.compile(r'https://[a-z]+\.supabase\.co/.*'), handle)
        g = c.new_page(); g.goto(URL); g.wait_for_timeout(400)
        g.evaluate("s => { localStorage.clear(); localStorage.setItem('wearwise.auth', s); }", json.dumps(SESSION))
        return c, g
    # Device A builds a photo closet while signed out, then signs in → it goes up to the (empty) account
    ca = b.new_context(viewport={'width': 1280, 'height': 860}); ca.route(re.compile(r'https://[a-z]+\.supabase\.co/.*'), handle)
    A = ca.new_page(); A.goto(URL); A.wait_for_timeout(400); A.evaluate("() => localStorage.clear()"); A.reload(); A.wait_for_timeout(400)
    A.goto(URL + '#/settings'); A.wait_for_timeout(300)
    A.get_by_role('button', name='Add the demo closet').click(); A.wait_for_timeout(800)
    A.evaluate(ADD, 40); A.reload(); A.wait_for_timeout(2500)
    A.evaluate("s => localStorage.setItem('wearwise.auth', s)", json.dumps(SESSION)); A.reload(); A.wait_for_timeout(6000)
    row = DB.get(UID, {}).get('data', {}); gs = row.get('garments', [])
    refs = [g['image'] for g in gs if str(g.get('image', '')).startswith('wwphoto:')]
    inline = [g for g in gs if str(g.get('image', '')).startswith('data:')]
    rowsize = len(json.dumps(row))
    ok('account: photos uploaded as separate files, row stays small', len(refs) == 40 and not inline and len(FILES) == 40 and rowsize < 200000, f'{len(refs)} refs, {len(FILES)} files, row {rowsize} chars')
    ok('account: files are in this user\'s own folder', all(k.startswith(f'wearwise-photos/{UID}/') for k in FILES))
    cb, B = device()
    B.reload(); B.wait_for_timeout(5000)
    B.goto(URL + '#/closet'); B.wait_for_timeout(1500)
    shown = B.evaluate(SHOWN); broken = B.evaluate(BROKEN)
    ok('second device: photos download and show', shown >= 20 and broken == 0, f'{shown} shown, {broken} broken')
    ok('second device: photos also kept on that device', B.evaluate(IDB) == 40)
    B.goto(URL + '#/settings'); B.wait_for_timeout(300)
    B.get_by_role('button', name='Delete all my Wearwise data').click(); B.get_by_role('button', name='Click again: this cannot be undone').click()
    B.wait_for_timeout(3000)
    ok('delete all: account row and every account photo deleted', UID not in DB and len(FILES) == 0, f'{len(FILES)} files left')
    b.close()
print('SUMMARY', sum(res), '/', len(res))
