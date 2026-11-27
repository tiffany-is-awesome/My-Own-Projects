# Synthetic "real-ish" photos: textured backgrounds, off-centre garments, crumbs, garment touching the edge, low contrast.
from playwright.sync_api import sync_playwright
URL='http://localhost:8765/wearwise.html'
JS = r"""
async (kind) => {
  const c = document.createElement('canvas'); c.width = 900; c.height = 1200; const x = c.getContext('2d');
  const bg = kind === 'lowcontrast' ? '#EDEBE6' : kind === 'whiteonbeige' ? '#D9CFBF' : '#C9BBA2';
  x.fillStyle = bg; x.fillRect(0,0,900,1200);
  if (kind === 'gradient') { const gr = x.createLinearGradient(0,0,900,1200); gr.addColorStop(0,'#E4DCCB'); gr.addColorStop(1,'#8E846F'); x.fillStyle = gr; x.fillRect(0,0,900,1200);
    x.fillStyle = '#6F7D86'; x.fillRect(0, 900, 900, 300); /* a second surface: floor under the bed edge */
    x.fillStyle = 'rgba(0,0,0,.18)'; x.beginPath(); x.ellipse(470, 700, 300, 380, 0, 0, 7); x.fill(); /* soft shadow */ }
  for (let i=0;i<9000;i++){ x.fillStyle=`rgba(${120+Math.random()*60},${100+Math.random()*50},${80+Math.random()*40},.10)`; x.fillRect(Math.random()*900,Math.random()*1200,3,3); }
  for (let i=0;i<14;i++){ x.fillStyle='#5a4a3a'; x.beginPath(); x.arc(Math.random()*900, Math.random()*1200, 4+Math.random()*5, 0, 7); x.fill(); } // crumbs / lint
  const col = kind === 'lowcontrast' ? '#F4F3EF' : kind === 'whiteonbeige' ? '#FAFAF8' : kind === 'jeans' ? '#3E5A80' : '#7A1F2B';
  x.save();
  if (kind === 'small') { x.translate(520, 650); x.scale(0.9, 0.9); } else if (kind === 'edge') { x.translate(-60, 200); x.scale(2.6,2.6); } else { x.translate(150, 150); x.scale(2.2, 2.2); }
  x.fillStyle = col;
  if (kind === 'straps') { x.restore(); x.save(); x.translate(250, 150); x.scale(2.2, 2.2); x.fillStyle = col;
    x.fillRect(40, 120, 120, 210); x.fillRect(55, 40, 1.6, 82); x.fillRect(143, 40, 1.6, 82); } // slip dress: thin straps
  const d = kind === 'straps' ? 'M0 0' : kind === 'jeans' ? 'M60 20 L180 20 L190 330 L135 330 L120 120 L105 330 L50 330 Z' : 'M64 46 L86 38 Q100 50 114 38 L136 46 L156 74 L170 186 L150 190 L138 104 L138 260 L62 260 L62 104 L50 190 L30 186 L44 74 Z';
  x.fill(new Path2D(d));
  x.strokeStyle='rgba(0,0,0,.2)'; for(let i=0;i<8;i++){x.beginPath();x.moveTo(70+i*9,70);x.lineTo(72+i*9,250);x.stroke();}
  if (kind === 'lint') { x.fillStyle = '#5a4a3a'; x.beginPath(); x.arc(172.6, 150, 7, 0, 7); x.fill(); } // lint just touching the sleeve edge
  x.restore();
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .9));
  return await new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); });
}
"""
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':1300,'height':900})
    pg.goto(URL); pg.wait_for_timeout(800)
    pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(800)
    files=[]
    KINDS=['normal','small','edge','lowcontrast','jeans','gradient','whiteonbeige','lint','straps']
    for k in KINDS:
        data=pg.evaluate(JS, k)
        import base64; raw=base64.b64decode(data.split(',')[1]); path=f'/tmp/wearwise-e2e/photo-{k}.jpg'; open(path,'wb').write(raw); files.append(path)
    pg.goto(URL+'#/closet'); pg.wait_for_timeout(400)
    pg.get_by_role('button', name='+ Add clothes').first.click()
    pg.locator('input[type=file][multiple]').set_input_files(files)
    pg.wait_for_selector('.review', timeout=60000); pg.wait_for_timeout(500)
    expect = {'normal': ('clean', 'burgundy'), 'small': ('clean', 'burgundy'), 'edge': ('clean', 'burgundy'), 'lowcontrast': ('kept-original', None), 'jeans': ('clean', 'denim blue'), 'gradient': ('clean', 'burgundy'), 'whiteonbeige': ('clean', None), 'lint': ('clean', 'burgundy'), 'straps': ('clean', 'burgundy')}
    res = []
    sizes = {}
    for i in range(len(KINDS)):
        pg.locator('.review-thumb').nth(i).click(); pg.wait_for_timeout(250)
        info = pg.evaluate("""() => { const im = document.querySelector('.confirm .card-stage img'); return im ? new Promise(r => { const t = new Image(); t.onload = () => r([t.width, t.height]); t.src = im.src; }) : null; }""")
        warn = pg.locator('.confirm').inner_text()
        k = KINDS[i]; sizes[k] = info
        state = 'kept-original' if "couldn't be separated" in warn else 'clean'
        color = pg.locator('.item-form select').nth(2).input_value()
        good = state == expect[k][0] and (expect[k][1] is None or color == expect[k][1]) and info and (state != 'clean' or max(info) < 480)
        if k == 'whiteonbeige': good = good and color in ('white', 'off-white', 'cream', 'ivory')
        if k == 'straps': good = good and info[1] / info[0] > 2.0  # body alone is 210/120 = 1.75; the straps must stay
        if k == 'lint': good = good and sizes.get('normal') and abs(info[0] - sizes['normal'][0]) <= 6  # the lint isn't part of the cut-out
        res.append(bool(good)); print('PASS' if good else 'FAIL', k, 'cut-out size', info, 'kept-original' if "couldn't be separated" in warn else 'clean', '| type:', pg.locator('.item-form select').nth(1).input_value(), '| color:', pg.locator('.item-form select').nth(2).input_value())
        pg.screenshot(path=f'/tmp/wearwise-e2e/cut-{i}.png', clip={'x':0,'y':0,'width':1300,'height':900})
    pg.get_by_role('button', name=f'Add all {len(KINDS)} to closet').click(); pg.wait_for_timeout(500)
    pg.screenshot(path='/tmp/wearwise-e2e/cut-closet.png')
    # put shirt + jeans on stage
    b.close()
print('SUMMARY', sum(res), '/', len(res))
