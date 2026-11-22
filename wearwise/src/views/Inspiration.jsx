import { useMemo, useState } from 'react';
import { useStore } from '../store.jsx';
import Stage from '../components/Stage.jsx';
import GarmentArt from '../components/GarmentArt.jsx';
import { Modal, useToast } from '../components/common.jsx';
import { decomposeLook, matchLook } from '../ai/inspiration.js';
import { SLOTS, slotOf } from '../data/closet.js';
import { decomposeWithClaude } from '../ai/stylist.js';
import { useClaudeStatus } from '../ai/claude.js';

// Render a decomposed look as an "inspiration board" using generic illustrations.
function lookAsOutfit(items) {
  const o = {};
  for (const it of items) {
    const k = slotOf(it);
    if (o[k]) continue;
    o[k] = { id: 'look-' + it.label, name: it.label, category: it.category, art: it.art, colors: [it.color || { name: 'gray', hex: '#9A9B9E' }], fit: 'regular' };
  }
  return o;
}

function AddInspiration({ onClose, onAdded }) {
  const { dispatch } = useStore();
  const ai = useClaudeStatus();
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState(null); // { blob, dataUrl }
  const [aiItems, setAiItems] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const items = aiItems || decomposeLook(text);

  async function pickPhoto(file) {
    if (!file) return;
    const dataUrl = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(file); });
    setPhoto({ blob: file, dataUrl }); setAiItems(null); setErr(''); // nothing is sent until she asks
  }
  async function identify() {
    setBusy(true); setErr('');
    const r = await decomposeWithClaude(photo.blob);
    setBusy(false);
    if (r?.items) { setAiItems(r.items); if (!title && r.title) setTitle(r.title); }
    else setErr(r?.offline ? 'Gemini is off (sign in to Puter at the top to use it). You can type the pieces below instead.' : (r?.error || 'Gemini could not read this photo. Please type the pieces below.'));
  }
  return (
    <Modal title="Add inspiration" onClose={onClose}>
      <p className="small muted" style={{ marginTop: 0 }}>Type the pieces of a look you love, or add a photo of it. Typed looks are matched on this device by keywords (no AI). A photo is only sent to Google Gemini if you tap "Identify the pieces", and the photo is saved with your Wearwise data (this browser, and your account if you're signed in).</p>
      <div className="field"><label className="label">Inspiration photo (optional)</label>
        <div className="context-box" style={{ alignItems: 'center' }}>
          {photo && <img src={photo.dataUrl} alt="" style={{ width: 56, height: 70, objectFit: 'cover' }} />}
          <label className="btn sm" style={{ cursor: 'pointer' }}>{photo ? 'Change photo' : 'Choose photo'}<input type="file" accept="image/*" hidden onChange={(e) => pickPhoto(e.target.files[0])} /></label>
          {busy && <span className="small">Gemini is looking at the outfit…</span>}
        </div>
        {photo && !aiItems && !busy && (
          <div className="consent" style={{ marginTop: 8 }}>
            <p className="tiny">To list the pieces automatically, this photo is <b>sent to Google Gemini</b> through your Puter account. Nothing has been sent yet.</p>
            <button type="button" className="btn sm" onClick={identify} disabled={ai.status !== 'ready'}>{ai.status === 'ready' ? 'Identify the pieces with Gemini' : 'Gemini is off: sign in to Puter to use it'}</button>
          </div>
        )}
        {err && <span className="tiny" style={{ color: 'var(--warn)' }}>{err}</span>}
      </div>
      <div className="field"><label className="label">Title</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Copenhagen street style" /></div>
      <div className="field"><label className="label">Source link (optional)</label><input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /></div>
      <div className="field"><label className="label">What's in the look</label>
        <textarea className="textarea" rows="3" value={text} onChange={(e) => setText(e.target.value)} placeholder="black turtleneck, olive trousers, white sneakers, black crossbody bag" />
        <span className="tiny">{aiItems ? 'Gemini identified' : 'Keyword matching found'} {items.length} item{items.length === 1 ? '' : 's'}{items.length ? ': ' + items.map((i) => i.label).join(' · ') : ''}</span>
      </div>
      <button className="btn primary block" disabled={!items.length || busy} onClick={() => {
        const id = 'insp-' + Date.now().toString(36);
        dispatch({ type: 'ADD_INSPIRATION', inspiration: { id, title: title || 'Saved look', source: url ? 'Your reference' : photo ? 'Your photo' : 'Your reference', url, text: aiItems ? '' : text, items: aiItems || undefined, image: photo?.dataUrl, mood: '#CFCAC2', by: aiItems ? 'claude' : 'text' } });
        onAdded?.(id);
        onClose();
      }}>Match to my closet</button>
    </Modal>
  );
}

export default function Inspiration({ go }) {
  const { state, dispatch, owned } = useStore();
  const toast = useToast();
  const [sel, setSel] = useState(state.inspirations[0]?.id);
  const [adding, setAdding] = useState(false);
  const current = state.inspirations.find((i) => i.id === sel) || state.inspirations[0];

  const scored = useMemo(() => state.inspirations.map((i) => {
    const items = i.items || decomposeLook(i.text || '');
    return { ...i, items, match: matchLook(items, owned) };
  }), [state.inspirations, owned]);
  const cur = scored.find((s) => s.id === current?.id);

  function recreate() {
    const slots = Object.fromEntries(SLOTS.map((k) => [k, null]));
    for (const m of cur.match.matches) { const k = slotOf(m.garment); if (!slots[k]) slots[k] = m.garment.id; }
    if (slots.top && owned.find((g) => g.id === slots.top)?.category === 'dress') slots.bottom = null;
    dispatch({ type: 'LOAD_DRAFT', draft: { slots, name: cur.title } });
    toast(cur.match.missing.length ? `Recreated with your pieces. ${cur.match.missing.length} piece${cur.match.missing.length > 1 ? 's are' : ' is'} missing from your closet.` : 'Recreated with your pieces.');
    go('#/builder');
  }

  return (
    <div className="page">
      <div className="page-head">
        <div><div className="label">Inspiration bridge</div><h1 className="h1">How close are you to this look?</h1></div>
        <button className="btn primary" onClick={() => setAdding(true)}>+ Add inspiration</button>
      </div>

      <div className="grid" style={{ marginBottom: 36 }}>
        {scored.map((s) => (
          <button key={s.id} className="card" onClick={() => setSel(s.id)} style={{ outline: s.id === cur?.id ? '2px solid var(--ink)' : 'none', outlineOffset: 3 }}>
            <div className="insp-board" style={{ background: s.mood }}>
              {s.image ? <img src={s.image} alt={s.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Stage outfit={lookAsOutfit(s.items)} compact />}
            </div>
            <div className="card-body">
              <div className="tiny">{s.source}</div>
              <div className="card-name">{s.title}</div>
              <div className="card-meta">You own {s.match.coverage}%</div>
            </div>
          </button>
        ))}
      </div>

      {cur && (
        <div className="insp-split" style={{ borderTop: '1px solid var(--ink)', paddingTop: 28 }}>
          <div>
            <div className="label">Inspiration · {cur.source}{cur.url ? <> · <a href={cur.url} target="_blank" rel="noreferrer">source</a></> : null}</div>
            <div className="insp-board" style={{ background: cur.mood, marginTop: 8 }}>{cur.image ? <img src={cur.image} alt={cur.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Stage outfit={lookAsOutfit(cur.items)} />}</div>
            <span className={cur.by === 'claude' ? 'ai-badge' : 'tiny'} style={{ marginTop: 8, display: 'inline-block' }}>{cur.by === 'claude' ? 'Pieces identified by Gemini from the photo' : 'Pieces read from the text by keyword matching (no AI)'}</span>
          </div>
          <div>
            <div className="label">{cur.title}</div>
            <div className="coverage" style={{ marginTop: 6 }}>You own {cur.match.coverage}% of this look</div>
            <div className="tiny">{['exact', 'close', 'approximate'].map((l) => { const n = cur.match.matches.filter((m) => m.level === l).length; return n ? `${n} ${l}` : null; }).filter(Boolean).concat(cur.match.missing.length ? [`${cur.match.missing.length} missing`] : []).join(' · ')}</div>
            <p className="muted" style={{ marginTop: 8 }}>
              {cur.match.matches.length ? <>Pair your {cur.match.matches.map((m) => m.garment.name.toLowerCase()).join(' + ')}.</> : 'Nothing in your closet matches yet.'}
              {cur.match.missing.length ? <> Missing: {cur.match.missing.map((m) => m.label).join(', ')}.</> : ' You have every piece!'}
            </p>
            <div style={{ marginTop: 16 }}>
              {cur.match.matches.map((m) => (
                <div className="match-row" key={m.want.label}>
                  <div className="mini" style={{ background: cur.mood }}><GarmentArt item={Object.values(lookAsOutfit([m.want]))[0]} /></div>
                  <span className="muted" style={{ textAlign: 'center' }}>→</span>
                  <div className="mini"><GarmentArt item={m.garment} /></div>
                  <div><div className="small" style={{ fontWeight: 600 }}>{m.garment.name}</div><div className="tiny"><span className={'match-level ' + m.level}>{m.level === 'exact' ? 'Exact match' : m.level === 'close' ? 'Close match' : 'Approximate'}</span> for “{m.want.label}”{m.level !== 'exact' && m.why ? ` · ${m.why}` : ''}</div></div>
                </div>
              ))}
              {cur.match.missing.map((m) => (
                <div className="match-row" key={m.label}>
                  <div className="mini" style={{ background: cur.mood }}><GarmentArt item={Object.values(lookAsOutfit([m]))[0]} /></div>
                  <span className="muted" style={{ textAlign: 'center' }}>→</span>
                  <div className="mini missing"><span className="tiny">missing</span></div>
                  <div><div className="small" style={{ fontWeight: 600 }}>{m.label}</div><div className="tiny">{m.reason || 'Not in your closet'}</div></div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn primary" style={{ flex: 1 }} onClick={recreate}>Recreate with my clothes</button>
            </div>
            <p className="tiny" style={{ marginTop: 10 }}>Recreating uses your exact, close and approximate matches; missing pieces stay empty so you can choose what to wear instead.</p>
          </div>
        </div>
      )}
      {adding && <AddInspiration onClose={() => setAdding(false)} onAdded={(id) => setSel(id)} />}
    </div>
  );
}
