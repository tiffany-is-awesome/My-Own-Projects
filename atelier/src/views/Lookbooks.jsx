import { useState } from 'react';
import { useStore } from '../store.jsx';
import { ConfirmButton, Modal, OutfitThumb, ScoreBadge, useToast } from '../components/common.jsx';
import GarmentArt from '../components/GarmentArt.jsx';
import { SLOTS } from '../data/closet.js';

/** Versatility = 1 − unique items / total item slots (docs/ARCHITECTURE.md §5). */
export function versatility(outfits) {
  const all = outfits.flatMap((o) => SLOTS.map((k) => o.slots[k]).filter(Boolean));
  const unique = new Set(all);
  const pct = all.length ? Math.round((1 - unique.size / all.length) * 100) : 0;
  const counts = {};
  all.forEach((id) => { counts[id] = (counts[id] || 0) + 1; });
  return { pct, unique: unique.size, slots: all.length, counts };
}

// ── share links: the lookbook is encoded in the URL (no server needed for the prototype)
export function encodeShare(catalog, outfits) {
  const payload = {
    t: catalog.title, k: catalog.kind, tr: catalog.trip,
    o: outfits.map((o) => ({ n: o.name, s: o.slots, m: o.stage?.mode, sc: o.stage?.scene, c: o.context?.prompt })),
  };
  const json = JSON.stringify(payload);
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function decodeShare(s) {
  try {
    const json = decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
    return JSON.parse(json);
  } catch { return null; }
}

function NewLookbook({ onClose }) {
  const { dispatch } = useStore();
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('collection');
  const [city, setCity] = useState('');
  const [days, setDays] = useState(3);
  return (
    <Modal title="New lookbook" onClose={onClose}>
      <div className="field"><label className="label">Title</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Autumn Office Rotation" autoFocus /></div>
      <div className="field"><label className="label">Type</label>
        <div className="chips">
          <button className={'chip' + (kind === 'collection' ? ' on' : '')} onClick={() => setKind('collection')}>Collection</button>
          <button className={'chip' + (kind === 'trip' ? ' on' : '')} onClick={() => setKind('trip')}>Trip</button>
        </div></div>
      {kind === 'trip' && (
        <div className="field-row">
          <div className="field"><label className="label">City</label><input className="input" value={city} onChange={(e) => setCity(e.target.value)} /></div>
          <div className="field"><label className="label">Days</label><input className="input" type="number" min="1" max="21" value={days} onChange={(e) => setDays(e.target.value)} /></div>
        </div>
      )}
      <button className="btn primary block" onClick={() => { dispatch({ type: 'CREATE_CATALOG', catalog: { title: title || 'Untitled lookbook', kind, ...(kind === 'trip' ? { trip: { city, days: +days } } : {}) } }); onClose(); }}>Create</button>
    </Modal>
  );
}

function Cover({ outfits, resolve }) {
  const three = outfits.slice(0, 3);
  return (
    <div className="lb-cover">
      {three.map((o) => <OutfitThumb key={o.id} outfit={o} resolve={resolve} />)}
      {Array.from({ length: Math.max(0, 3 - three.length) }, (_, i) => <div key={i} className="filler" />)}
    </div>
  );
}

export function LookbookList({ go }) {
  const { state, resolve } = useStore();
  const [creating, setCreating] = useState(false);
  return (
    <div className="page">
      <div className="page-head">
        <div><div className="label">Saved looks</div><h1 className="h1">Lookbooks</h1></div>
        <button className="btn primary" onClick={() => setCreating(true)}>+ New lookbook</button>
      </div>
      <div className="grid three">
        {state.catalogs.map((c) => {
          const outfits = c.outfitIds.map((id) => state.outfits.find((o) => o.id === id)).filter(Boolean);
          const v = versatility(outfits);
          return (
            <button key={c.id} className="lb-card" onClick={() => go('#/lookbooks/' + c.id)}>
              <Cover outfits={outfits} resolve={resolve} />
              <div className="card-body">
                <div className="tiny">{c.kind === 'trip' ? `TRIP · ${c.trip?.city || ''} · ${c.trip?.days || '?'} DAYS` : 'COLLECTION'}</div>
                <div className="card-name" style={{ fontSize: 16 }}>{c.title}</div>
                <div className="card-meta">{outfits.length} look{outfits.length === 1 ? '' : 's'}{c.kind === 'trip' && outfits.length ? ` · ${v.pct}% versatile` : ''}</div>
              </div>
            </button>
          );
        })}
      </div>
      {creating && <NewLookbook onClose={() => setCreating(false)} />}
    </div>
  );
}

export function LookbookDetail({ id, go }) {
  const { state, dispatch, resolve, get, scoreOf } = useStore();
  const toast = useToast();
  const [sharing, setSharing] = useState(false);
  const c = state.catalogs.find((x) => x.id === id);
  if (!c) return <div className="page"><div className="empty">This lookbook no longer exists. <button className="btn sm" onClick={() => go('#/lookbooks')}>Back</button></div></div>;
  const outfits = c.outfitIds.map((oid) => state.outfits.find((o) => o.id === oid)).filter(Boolean);
  const v = versatility(outfits);
  const isTrip = c.kind === 'trip';

  const packing = Object.entries(v.counts).map(([gid, n]) => ({ g: get(gid), n })).filter((x) => x.g)
    .sort((a, b) => SLOTS.indexOf(a.g.category) - SLOTS.indexOf(b.g.category) || b.n - a.n);

  const hasUploads = outfits.some((o) => Object.values(o.slots).some((sid) => sid && sid.startsWith('u-')));
  const shareUrl = `${location.origin}${location.pathname}#/share/${encodeShare(c, outfits)}`;
  function copy() {
    const ok = () => toast('Read-only link copied');
    try { navigator.clipboard.writeText(shareUrl).then(ok, () => toast('Select the link and copy it')); } catch { toast('Select the link and copy it'); }
  }

  function edit(o) {
    dispatch({ type: 'LOAD_DRAFT', draft: { slots: o.slots, context: o.context, name: o.name, stage: { mode: o.stage?.mode || 'flatlay', scene: o.stage?.scene || 'studio', customBg: null } } });
    go('#/dressing');
  }

  return (
    <div className="page">
      <button className="btn ghost sm" onClick={() => go('#/lookbooks')}>← All lookbooks</button>
      <div className="page-head" style={{ marginTop: 12 }}>
        <div>
          <div className="label">{isTrip ? `Trip · ${c.trip?.city} · ${c.trip?.days} days` : 'Collection'}</div>
          <h1 className="h1">{c.title}</h1>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={() => go('#/share/' + encodeShare(c, outfits))}>Preview shared page</button>
          <button className="btn primary" onClick={() => setSharing(true)} disabled={!outfits.length}>Share</button>
        </div>
      </div>

      <div className="stats">
        <div className="stat"><span className="label">Looks</span><b>{outfits.length}</b></div>
        <div className="stat"><span className="label">Unique pieces</span><b>{v.unique}</b></div>
        <div className="stat"><span className="label">Versatility score</span><b>{v.pct}%</b><span className="tiny">{v.slots} slots filled by {v.unique} pieces</span></div>
        <div className="stat"><span className="label">Avg. critique</span><b>{outfits.length ? Math.round(outfits.reduce((s, o) => s + scoreOf(o), 0) / outfits.length) : '—'}</b></div>
      </div>

      {outfits.length === 0 ? (
        <div className="empty">No looks yet. Build one in the dressing room and save it here.<div style={{ marginTop: 12 }}><button className="btn primary sm" onClick={() => go('#/dressing')}>Open dressing room</button></div></div>
      ) : (
        <div className="grid">
          {outfits.map((o, i) => (
            <div key={o.id}>
              <button className="card" onClick={() => edit(o)} aria-label={`Edit ${o.name}`}><OutfitThumb outfit={o} resolve={resolve} compactStage={false} /></button>
              <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div className="tiny">{isTrip ? `DAY ${i + 1}` : `LOOK ${String(i + 1).padStart(2, '0')}`}</div>
                  <div className="card-name">{o.name}</div>
                  <div className="card-meta">{o.context?.weather} · {o.context?.tempC}°C</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <ScoreBadge score={scoreOf(o)} />
                  <div><button className="btn ghost sm" style={{ padding: 0, height: 24 }} onClick={() => dispatch({ type: 'REMOVE_FROM_CATALOG', catalogId: c.id, outfitId: o.id })}>Remove</button></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isTrip && packing.length > 0 && (
        <div style={{ marginTop: 40 }}>
          <div className="page-head" style={{ marginBottom: 8 }}><h2 className="h2">Packing list</h2><span className="small muted">{packing.length} pieces for {c.trip?.days} days</span></div>
          <div className="pack-list">
            {packing.map(({ g, n }) => (
              <div key={g.id}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span className="mini" style={{ width: 34 }}><GarmentArt item={g} /></span>{g.name}{g.placeholder ? ' (basic, buy or borrow)' : ''}</span>
                <span className="muted">× {n} {n === 1 ? 'look' : 'looks'}</span>
              </div>
            ))}
          </div>
          {(() => {
            const once = packing.filter((p) => p.n === 1);
            if (!once.length) return null;
            return <p className="small muted" style={{ marginTop: 12 }}>{once.length <= 3 ? `Worn once: ${once.map((p) => p.g.name).join(', ')}.` : `${once.length} of ${packing.length} pieces are worn only once.`} Re-wearing them would lighten your bag and raise the versatility score.</p>;
          })()}
        </div>
      )}

      {sharing && (
        <Modal title="Share this lookbook" onClose={() => setSharing(false)}>
          <p className="small muted" style={{ marginTop: 0 }}>Anyone with this link sees a clean, read-only lookbook. No sign-in needed, and critique notes stay private.</p>
          <div className="context-box">
            <input className="input" readOnly value={shareUrl} onFocus={(e) => e.target.select()} aria-label="Share link" />
            <button className="btn primary" onClick={copy}>Copy</button>
          </div>
          {hasUploads && <p className="tiny" style={{ marginTop: 10 }}>Pieces you uploaded appear only on your device until accounts are switched on (Phase 1).</p>}
        </Modal>
      )}

      <div style={{ marginTop: 48, borderTop: '1px solid var(--line)', paddingTop: 16 }}>
        <ConfirmButton label="Delete lookbook" confirmLabel={`Delete “${c.title}”? Click again`} onConfirm={() => { dispatch({ type: 'DELETE_CATALOG', id: c.id }); go('#/lookbooks'); }} />
      </div>
    </div>
  );
}

export function SharedLookbook({ data, go }) {
  const { get } = useStore();
  const p = decodeShare(data);
  if (!p) return <div className="page"><div className="empty">This share link is invalid or incomplete.</div></div>;
  const resolveShared = (slots) => Object.fromEntries(Object.entries(slots || {}).map(([k, v]) => [k, get(v)]));
  return (
    <div>
      <div className="share-hero">
        <div className="label">{p.k === 'trip' ? `Trip lookbook · ${p.tr?.city || ''}` : 'Seasonal lookbook'}</div>
        <h1 className="h1" style={{ marginTop: 8 }}>{p.t}</h1>
        <p className="muted small">{p.o.length} looks · curated with Atelier</p>
      </div>
      <div className="page" style={{ paddingTop: 0 }}>
        <div className="grid">
          {p.o.map((o, i) => (
            <div key={i}>
              <OutfitThumb outfit={{ slots: o.s, stage: { mode: o.m, scene: o.sc } }} resolve={resolveShared} />
              <div className="card-body">
                <div className="tiny">{p.k === 'trip' ? `DAY ${i + 1}` : `LOOK ${String(i + 1).padStart(2, '0')}`}</div>
                <div className="card-name">{o.n}</div>
                <div className="card-meta">{SLOTS.map((k) => get(o.s[k])?.name).filter(Boolean).join(' · ')}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 48 }}><button className="btn" onClick={() => go('#/closet')}>Make your own lookbook</button></div>
      </div>
    </div>
  );
}
