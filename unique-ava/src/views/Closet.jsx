import { useMemo, useState } from 'react';
import { useStore } from '../store.jsx';
import { ProductCard, Modal, Meter, OutfitThumb, ConfirmButton, useToast } from '../components/common.jsx';
import GarmentArt from '../components/GarmentArt.jsx';
import UploadModal from '../components/UploadModal.jsx';
import ItemForm, { STATUSES, LocationPicker } from '../components/ItemForm.jsx';
import { CATEGORIES, STYLES, OCCASIONS, slotOf } from '../data/closet.js';
import { NAMED_COLORS } from '../ai/color.js';
import { wearStats } from '../ai/insights.js';

const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function ItemDetail({ item, onClose, go }) {
  const { state, dispatch, resolve } = useStore();
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const usedIn = state.outfits.filter((o) => Object.values(o.slots).includes(item.id));
  const status = STATUSES.find((s) => s.id === (item.status || 'available'));
  if (editing) {
    return (
      <Modal title={`Edit · ${item.name}`} onClose={onClose} wide>
        <div className="drawer-detail">
          <div className="card-stage"><GarmentArt item={editing} /></div>
          <div>
            <ItemForm item={editing} onChange={setEditing} />
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button className="btn primary" style={{ flex: 1 }} disabled={!editing.name.trim()} onClick={() => { dispatch({ type: 'UPDATE_GARMENT', garment: { ...editing, name: editing.name.trim() } }); setEditing(null); onClose(); toast('Changes saved'); }}>Save changes</button>
              <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </div>
        </div>
      </Modal>
    );
  }
  return (
    <Modal title={item.name} onClose={onClose} wide>
      <div className="drawer-detail">
        <div className="card-stage"><GarmentArt item={item} /></div>
        <div>
          <span className="label">{item.demo ? 'Demo item · sample data' : item.uploaded ? 'Added from your photo' : item.manual ? 'Added by hand' : 'In the closet'} · {status.label}</span>
          <div className="rows">
            <div className="row"><span className="label">Category</span><span>{CATEGORIES.find((c) => c.id === item.category)?.label} · {item.art}</span></div>
            <div className="row"><span className="label">Color</span><span><span className="swatch" style={{ background: item.colors[0].hex, verticalAlign: 'middle', marginRight: 8 }} />{item.colors.map((c) => c.name).join(' / ')}</span></div>
            <div className="row"><span className="label">Material</span><span>{item.material} · {item.weight} weight</span></div>
            <div className="row"><span className="label">Fit</span><span>{cap(item.fit || 'regular')}</span></div>
            <div className="row"><span className="label">Warmth</span><span><Meter value={item.warmth} /></span></div>
            <div className="row"><span className="label">Rain-ready</span><span><Meter value={item.water || 1} /></span></div>
            <div className="row"><span className="label">Formality</span><span><Meter value={item.formality} /></span></div>
            <div className="row"><span className="label">Seasons</span><span>{(item.seasons || []).map(cap).join(' / ')}</span></div>
            <div className="row"><span className="label">Kept in</span><span className="loc-row"><LocationPicker value={item.location} onChange={(v) => { dispatch({ type: 'UPDATE_GARMENT', garment: { id: item.id, location: v } }); toast(v ? `Kept in ${state.locations.find((l) => l.id === v)?.name || 'the new place'}` : 'Location cleared'); }} /></span></div>
            {item.pattern && item.pattern !== 'solid' && <div className="row"><span className="label">Pattern</span><span>{cap(item.pattern)}</span></div>}
            {item.style && <div className="row"><span className="label">Style</span><span>{STYLES.find((s) => s.id === item.style)?.label || item.style}</span></div>}
            {item.occasions?.length > 0 && <div className="row"><span className="label">Good for</span><span>{item.occasions.map((o) => OCCASIONS.find((x) => x.id === o)?.label || o).join(', ')}</span></div>}
          </div>
          <div className="chips" style={{ marginTop: 14 }} role="group" aria-label="Status">
            {STATUSES.map((s) => <button key={s.id} className={'chip' + ((item.status || 'available') === s.id ? ' on' : '')} onClick={() => { dispatch({ type: 'UPDATE_GARMENT', garment: { id: item.id, status: s.id } }); onClose(); toast(`Marked: ${s.label.toLowerCase()}`); }}>{s.label}</button>)}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <button className="btn accent" style={{ flex: 1 }} onClick={() => { onClose(); go('#/style/' + encodeURIComponent(item.id)); }}>Style me with this</button>
            <button className="btn" onClick={() => setEditing({ ...item })}>Edit details</button>
            <ConfirmButton className="btn" label="Delete" confirmLabel="Click again to delete" onConfirm={() => { dispatch({ type: 'DELETE_GARMENT', id: item.id }); onClose(); toast('Deleted from the closet'); }} />
          </div>
          {usedIn.length > 0 && (
            <>
              <div className="label" style={{ marginTop: 22 }}>In {usedIn.length} saved look{usedIn.length > 1 ? 's' : ''}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 8 }}>
                {usedIn.slice(0, 4).map((o) => <div key={o.id} title={o.name}><OutfitThumb outfit={o} resolve={resolve} /></div>)}
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default function Closet({ go, initial = '' }) {
  const [initKind, initVal] = initial.split(':');
  const { state, dispatch, owned, profile, hasDemo } = useStore();
  const toast = useToast();
  const [cat, setCat] = useState(initKind === 'category' ? initVal : 'all');
  const [season, setSeason] = useState(null);
  const [color, setColor] = useState(initKind === 'color' ? initVal : '');
  const [style, setStyle] = useState('');
  const [occasion, setOccasion] = useState('');
  const [status, setStatus] = useState('');
  const [place, setPlace] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('newest');
  const stats = useMemo(() => wearStats(state.history.filter((h) => h.profileId === profile.id)), [state.history, profile.id]);
  const [detail, setDetail] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [justAdded, setJustAdded] = useState([]);
  const who = profile.name === 'Me' ? 'My' : `${profile.name}'s`;

  const list = useMemo(() => owned.filter((g) =>
    (cat === 'all' || g.category === cat)
    && (!season || (g.seasons || []).includes(season))
    && (!color || g.colors.some((c) => c.name === color))
    && (!style || g.style === style)
    && (!occasion || (g.occasions || []).includes(occasion))
    && (!status || (g.status || 'available') === status)
    && (!place || (place === 'none' ? !g.location : g.location === place))
    && (!q.trim() || q.toLowerCase().trim().split(/\s+/).every((w) => [g.name, g.material, g.art, g.category, g.style, g.pattern, ...(g.colors || []).map((c) => c.name), state.locations.find((l) => l.id === g.location)?.name].filter(Boolean).join(' ').toLowerCase().includes(w))))
    .sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name)
      : sort === 'most' ? (stats[b.id]?.wears || 0) - (stats[a.id]?.wears || 0)
      : sort === 'least' ? (stats[a.id]?.wears || 0) - (stats[b.id]?.wears || 0)
      : 0), [owned, cat, season, color, style, occasion, status, place, q, sort, stats, state.locations]);

  const counts = Object.fromEntries(CATEGORIES.map((c) => [c.id, owned.filter((g) => g.category === c.id).length]));
  const colorsHere = NAMED_COLORS.filter((c) => owned.some((g) => g.colors.some((x) => x.name === c.name)));
  const filtered = season || color || style || occasion || status || place || q;

  function saved(items) {
    dispatch({ type: 'ADD_GARMENTS', garments: items });
    setUploading(false);
    setJustAdded(items.map((g) => g.id));
    toast(items.length > 1 ? `${items.length} pieces added` : `${items[0].name} added`);
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="label">{profile.kind === 'child' ? 'Child\'s wardrobe' : 'Wardrobe'}</div>
          <h1 className="h1">{who} Closet <span className="muted" style={{ fontWeight: 400 }}>· {owned.length} pieces</span></h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {owned.length > 0 && <button className="btn ghost" onClick={() => go('#/insights')}>Insights</button>}
          {owned.length > 0 && <button className="btn" onClick={() => go('#/create')}>Create an Outfit</button>}
          <button className="btn accent" onClick={() => setUploading(true)}>+ Add clothes</button>
        </div>
      </div>

      {hasDemo && owned.some((g) => g.demo) && (
        <div className="notice demo-banner">
          <span>Demo items (labelled “Demo”) are sample data for trying the app. They're not your clothes.</span>
          <ConfirmButton className="btn sm" label="Remove demo items" confirmLabel="Click again to remove" onConfirm={() => { dispatch({ type: 'REMOVE_DEMO' }); toast('Demo items removed'); }} />
        </div>
      )}

      {owned.length > 0 && (
        <div className="toolbar">
          <div className="search-row">
            <div className="search-box">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: “navy linen”, “boots”, “under-bed”…" aria-label="Search the closet" />
            </div>
            <select className="select sm" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
              <option value="newest">Newest first</option><option value="name">A–Z</option><option value="most">Most worn</option><option value="least">Least worn</option>
            </select>
          </div>
          <div className="chips" role="group" aria-label="Category">
            <button className={'chip' + (cat === 'all' ? ' on' : '')} onClick={() => setCat('all')}>All</button>
            {CATEGORIES.map((c) => <button key={c.id} className={'chip' + (cat === c.id ? ' on' : '')} onClick={() => setCat(c.id)}>{c.label} {counts[c.id] ? <span style={{ opacity: .6 }}>&nbsp;{counts[c.id]}</span> : null}</button>)}
          </div>
          <div className="filters" role="group" aria-label="Filters">
            <select className="select sm" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Color"><option value="">Any color</option>{colorsHere.map((c) => <option key={c.name}>{c.name}</option>)}</select>
            <select className="select sm" value={style} onChange={(e) => setStyle(e.target.value)} aria-label="Style"><option value="">Any style</option>{STYLES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
            <select className="select sm" value={occasion} onChange={(e) => setOccasion(e.target.value)} aria-label="Occasion"><option value="">Any occasion</option>{OCCASIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>
            <select className="select sm" value={season || ''} onChange={(e) => setSeason(e.target.value || null)} aria-label="Season"><option value="">Any season</option>{SEASONS.map((x) => <option key={x} value={x}>{cap(x)}</option>)}</select>
            <select className="select sm" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"><option value="">Any status</option>{STATUSES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select>
            {state.locations.length > 0 && <select className="select sm" value={place} onChange={(e) => setPlace(e.target.value)} aria-label="Where it's kept"><option value="">Anywhere</option>{state.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}<option value="none">No place set</option></select>}
            {filtered && <button className="btn ghost sm" onClick={() => { setSeason(null); setColor(''); setStyle(''); setOccasion(''); setStatus(''); setPlace(''); setQ(''); }}>Clear</button>}
          </div>
        </div>
      )}

      {owned.length === 0 ? (
        <div className="empty">
          <p className="h2" style={{ marginBottom: 8 }}>{who === 'My' ? 'Your' : who} closet is empty.</p>
          <p className="small">Add photos (several at once is fine) or add pieces by hand. Outfit suggestions only use what's in here.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn primary" onClick={() => setUploading(true)}>+ Add clothes</button>
            {!hasDemo && <button className="btn" onClick={() => { dispatch({ type: 'LOAD_DEMO' }); toast('Demo closet added'); }}>Try the demo closet</button>}
          </div>
        </div>
      ) : list.length === 0 ? (
        <div className="empty"><p className="small">Nothing matches{q ? ` “${q}”` : ' these filters'}.</p><button className="btn sm" onClick={() => { setSeason(null); setColor(''); setStyle(''); setOccasion(''); setStatus(''); setPlace(''); setQ(''); setCat('all'); }}>Show everything</button></div>
      ) : (
        <div className="grid">
          {list.map((g) => (
            <ProductCard key={g.id} item={g} place={state.locations.find((l) => l.id === g.location)?.name} flag={justAdded.includes(g.id) ? 'New' : null} onClick={() => setDetail(g)}
              action={<button className="btn primary sm block" onClick={() => go('#/style/' + encodeURIComponent(g.id))}>Style me with this</button>} />
          ))}
        </div>
      )}

      {detail && <ItemDetail item={detail} onClose={() => setDetail(null)} go={go} />}
      {uploading && <UploadModal onClose={() => setUploading(false)} onSaved={saved} ownerName={profile.name} />}
    </div>
  );
}
