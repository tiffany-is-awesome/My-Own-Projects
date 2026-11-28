"""Security/integrity: two devices, one cloud row. Nothing is lost when both change data."""
import sys, pathlib, json, datetime
from playwright.sync_api import sync_playwright
here = pathlib.Path(__file__).resolve().parent
html = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else here.parent / 'tiffo.html').resolve()
stub = "window.Chart=class{constructor(){}update(){}destroy(){}};Chart.defaults={font:{},color:''};"
row = {'r': None}           # the one cloud row: {'data':..., 'updated_at':...}
race = {'once': None}       # simulate another device writing between read and write
fails, passes = [], 0
def srv(op, payload):
    if op == 'get':
        r = row['r']; return json.loads(json.dumps(r)) if r else None
    if op == 'insert':
        if row['r']: return {'error': 'duplicate key 23505'}
        row['r'] = {'data': payload['data'], 'updated_at': payload['updated_at']}; return {'n': 1}
    if op == 'update':
        if race['once']: race['once'](); race['once'] = None
        if not row['r'] or row['r']['updated_at'] != payload['expect']: return {'n': 0}
        row['r'] = {'data': payload['data'], 'updated_at': payload['updated_at']}; return {'n': 1}
FAKE = r"""() => {
  const q = () => { let op = 'get', payload = null, expect = null;
    const o = { select() { return o; }, eq(k, v) { if (k === 'updated_at') expect = v; return o; },
      insert(p) { op = 'insert'; payload = p; return o; }, update(p) { op = 'update'; payload = p; return o; },
      maybeSingle() { return window.srv('get', null).then((d) => ({ data: d, error: null })); },
      then(a, b) { const p = op === 'insert' ? window.srv('insert', payload) : window.srv('update', { ...payload, expect });
        return p.then((r) => r.error ? { data: null, error: { message: r.error } } : { data: r.n ? [{ user_id: 'u1' }] : [], error: null }).then(a, b); } };
    return o; };
  Auth.sb = { from: q }; CONFIG.AUTH_PROVIDER = 'supabase';
  Auth.user = { id: 'sb:u1', uid: 'u1', name: 'x', email: 'a@b.co', provider: 'cloud' };
  Cloud.schedule = () => {};   // tests call sync explicitly
}"""
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    def device():
        ctx = b.new_context(timezone_id='Asia/Manila'); pg = ctx.new_page()
        pg.route('**/chart.umd.min.js', lambda r: r.fulfill(body=stub, content_type='text/javascript'))
        pg.add_init_script(stub)
        for pat in ['**/cdn.tailwindcss.com/**', '**/supabase-js@2**', '**/js.puter.com/**']: pg.route(pat, lambda r: r.fulfill(body='', content_type='text/javascript'))
        pg.expose_function('srv', srv)
        pg.goto(html.as_uri()); pg.wait_for_timeout(600); pg.evaluate(FAKE)
        pg.evaluate("() => { CURRENCY = 'PHP'; Store.state = Store.blank(); Store.state.initialBalance = 10000; LS.removeItem(Cloud.baseKey()); }")
        return pg
    A, B = device(), device()
    def add(pg, desc, amt): return pg.evaluate("([d, a]) => Store.addTransaction({ kind: 'expense', amount: a, category: 'Food', date: '2026-11-20', description: d }).id", [desc, amt])
    def descs(pg): return sorted(pg.evaluate("Store.state.transactions.map(t => t.description)"))
    def sync(pg): return pg.evaluate("() => Cloud.sync()")
    def check(name, got, want):
        global passes
        if got == want: passes += 1
        else: fails.append(f'{name}: want {want} got {got}')

    # 1. Both devices start from the same data
    add(A, 'rice', 500); sync(A); sync(B)
    check('B gets A\'s entry', descs(B), ['rice'])
    # 2. A is offline and logs entries; B logs one and syncs first; then A comes back
    add(A, 'jeep', 13); add(A, 'load', 50)
    add(B, 'meralco', 2400); sync(B)
    sync(A); sync(B)
    check('offline entries on A survive', descs(A), ['jeep', 'load', 'meralco', 'rice'])
    check('…and reach B', descs(B), ['jeep', 'load', 'meralco', 'rice'])
    check('cloud has all of them', sorted(t['description'] for t in row['r']['data']['transactions']), ['jeep', 'load', 'meralco', 'rice'])
    # 3. Delete on one device, edit another entry on the other: both changes kept, the deleted one stays deleted
    jeep = A.evaluate("Store.state.transactions.find(t => t.description === 'jeep').id")
    A.evaluate("([id]) => Store.removeTransaction(id)", [jeep])
    B.evaluate("() => { const t = Store.state.transactions.find(t => t.description === 'rice'); Store.updateTransaction(t.id, { amount: 550 }); }")
    sync(A); sync(B); sync(A)
    check('delete on A reaches B', descs(B), ['load', 'meralco', 'rice'])
    check('edit on B reaches A', A.evaluate("Store.state.transactions.find(t => t.description === 'rice').amount"), 550)
    check('deleted entry is in Recently deleted on both', [A.evaluate("Store.state.trash.length"), B.evaluate("Store.state.trash.length")], [1, 1])
    # 4. Another device writes in the split second between reading and writing
    add(A, 'grab', 180)
    def other_device_writes():
        d = json.loads(json.dumps(row['r']['data'])); d['transactions'].append({'id': 'zz', 'kind': 'expense', 'type': 'expense', 'amount': 99, 'category': 'Food', 'date': '2026-11-20', 'description': 'water', 'accountId': 'acc_cash'})
        d['savedAt'] = d.get('savedAt', 0) + 1
        row['r'] = {'data': d, 'updated_at': datetime.datetime.now(datetime.timezone.utc).isoformat() + 'Z'}
    race['once'] = other_device_writes
    sync(A)
    check('write that lost the race merges again: nothing lost', sorted(t['description'] for t in row['r']['data']['transactions']), ['grab', 'load', 'meralco', 'rice', 'water'])
    # 5. A new device with its own entries signs in to an account that already has data
    C = device(); add(C, 'tricycle', 40); sync(C)
    check('new device keeps its own entries and gets the account\'s', descs(C), ['grab', 'load', 'meralco', 'rice', 'tricycle', 'water'])
    # 6. Settings and other records merge too
    A.evaluate("() => { Bills.list().push({ id: 'b1', name: 'PLDT', amount: 1299, freq: 'month', nextDue: '2026-12-05' }); Store.save(); }")
    B.evaluate("() => { Store.state.settings.billDismissed = ['spotify']; Store.save(); }")
    sync(A); sync(B); sync(A)
    check('bill from A and setting from B both kept', [A.evaluate("Bills.list().length"), A.evaluate("(Store.state.settings.billDismissed || []).join()"), B.evaluate("Bills.list().length")], [1, 'spotify', 1])
    check('balances match on every device', len({pg.evaluate("Store.balance()") for pg in (A, B)}), 1)
    b.close()
for f in fails: print('✗', f)
print(f'{passes}/{passes + len(fails)} sync checks passed')
sys.exit(1 if fails else 0)
