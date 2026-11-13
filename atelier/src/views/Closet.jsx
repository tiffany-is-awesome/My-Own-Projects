import { useMemo, useState } from 'react';
import { useStore } from '../store.jsx';
import { ProductCard, Modal, Meter, OutfitThumb, useToast } from '../components/common.jsx';
import GarmentArt from '../components/GarmentArt.jsx';
import UploadModal from '../components/UploadModal.jsx';
import { BASICS, CATEGORIES } from '../data/closet.js';

const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function ItemDetail({ item, onClose, go }) {
  const { state, dispatch, resolve } = useStore();
  const toast = useToast();
  const usedIn = state.outfits.filter((o) => Object.values(o.slots).includes(item.id));
  function styleIt() {
    dispatch({ type: 'SET_SLOT', slot: item.category, id: item.id });
    onClose();
    go('#/dressing');
  }
  return (
    <Modal title={item.name} onClose={onClose} wide>
      <div className="drawer-detail">
        <div className="card-stage"><GarmentArt item={item} /></div>
        <div>
          <span className="label">{item.placeholder ? 'Placeholder basic · not in your closet' : item.uploaded ? 'Uploaded by you' : 'In your closet'}</span>
          <div className="rows">
            <div className="row"><span className="label">Category</span><span>{CATEGORIES.find((c) => c.id === item.category)?.label} · {item.art}</span></div>
            <div className="row"><span className="label">Color</span><span><span className="swatch" style={{ background: item.colors[0].hex, verticalAlign: 'middle', marginRight: 8 }} />{item.colors.map((c) => c.name).join(' / ')}</span></div>
            <div className="row"><span className="label">Material</span><span>{item.material} · {item.weight} weight</span></div>
            <div className="row"><span className="label">Fit</span><span>{cap(item.fit || 'regular')}</span></div>
            <div className="row"><span className="label">Warmth</span><span><Meter value={item.warmth} /></span></div>
            <div className="row"><span className="label">Rain-ready</span><span><Meter value={item.water || 1} /></span></div>
            <div className="row"><span className="label">Formality</span><span><Meter value={item.formality} /></span></div>
            <div className="row"><span className="label">Seasons</span><span>{item.seasons.map(cap).join(' / ')}</span></div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button className="btn primary" style={{ flex: 1 }} onClick={styleIt}>Style this</button>
            {!item.placeholder && <button className="btn" onClick={() => { dispatch({ type: 'DELETE_GARMENT', id: item.id }); onClose(); toast('Removed from closet'); }}>Remove</button>}
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

export default function Closet({ go }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [cat, setCat] = useState('all');
  const [season, setSeason] = useState(null);
  const [showBasics, setShowBasics] = useState(false);
  const [detail, setDetail] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [justAdded, setJustAdded] = useState(null);

  const list = useMemo(() => {
    const src = showBasics ? [...state.garments, ...BASICS] : state.garments;
    return src.filter((g) => (cat === 'all' || g.category === cat) && (!season || g.seasons.includes(season)));
  }, [state.garments, cat, season, showBasics]);

  const counts = Object.fromEntries(CATEGORIES.map((c) => [c.id, state.garments.filter((g) => g.category === c.id).length]));

  function saved(g) {
    dispatch({ type: 'ADD_GARMENT', garment: g });
    setUploading(false);
    setJustAdded(g.id);
    toast(`${g.name} added to your closet`);
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="label">Your boutique</div>
          <h1 className="h1">Closet <span className="muted" style={{ fontWeight: 400 }}>· {state.garments.length} pieces</span></h1>
        </div>
        <button className="btn accent" onClick={() => setUploading(true)}>+ Add item</button>
      </div>

      <div className="toolbar">
        <div className="chips" role="group" aria-label="Category">
          <button className={'chip' + (cat === 'all' ? ' on' : '')} onClick={() => setCat('all')}>All</button>
          {CATEGORIES.map((c) => <button key={c.id} className={'chip' + (cat === c.id ? ' on' : '')} onClick={() => setCat(c.id)}>{c.label} {counts[c.id] ? <span style={{ opacity: .6 }}>&nbsp;{counts[c.id]}</span> : null}</button>)}
        </div>
        <div className="chips" role="group" aria-label="Season">
          {SEASONS.map((s) => <button key={s} className={'chip' + (season === s ? ' on' : '')} onClick={() => setSeason(season === s ? null : s)}>{cap(s)}</button>)}
          <button className={'chip' + (showBasics ? ' on' : '')} onClick={() => setShowBasics(!showBasics)}>+ Basics catalog</button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="empty">
          <p className="h2" style={{ marginBottom: 8 }}>Your boutique is empty here.</p>
          <p className="small">Add one piece and Atelier fills the rest with basics.</p>
          <button className="btn primary" onClick={() => setUploading(true)}>+ Add item</button>
        </div>
      ) : (
        <div className="grid">
          {list.map((g) => (
            <ProductCard key={g.id} item={g} flag={g.id === justAdded ? 'New' : null} onClick={() => setDetail(g)}
              action={<button className="btn primary sm block" onClick={() => { dispatch({ type: 'SET_SLOT', slot: g.category, id: g.id }); go('#/dressing'); }}>+ Add to look</button>} />
          ))}
        </div>
      )}

      {detail && <ItemDetail item={detail} onClose={() => setDetail(null)} go={go} />}
      {uploading && <UploadModal onClose={() => setUploading(false)} onSaved={saved} />}
    </div>
  );
}
