import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import GarmentArt from './GarmentArt.jsx';
import Stage from './Stage.jsx';
import { CATEGORY_LABEL } from '../data/closet.js';
import { verdictOf } from '../ai/critic.js';
import { useStore } from '../store.jsx';

const STATUS_FLAG = { laundry: 'In laundry', repair: 'Needs repair', stored: 'Stored' };

export function ProductCard({ item, onClick, action, flag, place }) {
  const meta = [item.material, item.weight && `${item.weight[0].toUpperCase()}${item.weight.slice(1)} weight`].filter(Boolean).join(' · ');
  return (
    <div className="card">
      <button className="card" onClick={onClick} aria-label={`Open ${item.name}`}>
        <div className="card-stage">
          <GarmentArt item={item} />
          {item.demo && <span className="card-flag basic">Demo</span>}
          {item.status && item.status !== 'available' && <span className="card-flag status">{STATUS_FLAG[item.status]}</span>}
          {item.unverified?.length > 0 && <span className="card-flag check" title="Some details are guesses">Check details</span>}
          {flag && <span className="card-flag new">{flag}</span>}
        </div>
        <div className="card-body">
          <div className="tiny">{(CATEGORY_LABEL[item.category] || item.category).toUpperCase()}</div>
          <div className="card-name">{item.name}</div>
          <div className="card-meta">{meta}</div>
          {place && <div className="card-place">⌂ {place}</div>}
          <div className="swatches">{item.colors.map((c) => <span key={c.name} className="swatch" style={{ background: c.hex }} title={c.name} />)}</div>
        </div>
      </button>
      {action && <div className="card-hover">{action}</div>}
    </div>
  );
}

export function Meter({ value, max = 5 }) {
  return <span className="meter" aria-label={`${value} of ${max}`}>{Array.from({ length: max }, (_, i) => <i key={i} className={i < value ? 'on' : ''} />)}</span>;
}

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head"><h2 className="h2">{title}</h2><button className="close" onClick={onClose} aria-label="Close">×</button></div>
        {children}
      </div>
    </div>
  );
}

export function OutfitThumb({ outfit, resolve, compactStage = true, child = false }) {
  const o = resolve(outfit.slots);
  return <Stage outfit={o} mode={outfit.stage?.mode || 'flatlay'} sceneId={outfit.stage?.scene} compact={compactStage} child={child} />;
}

/** Plain list of an outfit's pieces. */
export function PieceList({ outfit }) {
  const rows = [['top', outfit.top?.category === 'dress' ? 'Dress' : 'Top'], ['bottom', 'Bottom'], ['outer', 'Outerwear'], ['shoes', 'Shoes'], ['bag', 'Bag'], ['accessory', 'Accessory']];
  return (
    <ul className="piece-list">
      {rows.filter(([k]) => outfit[k]).map(([k, l]) => <li key={k}><span>{l}</span><span>{outfit[k].name}</span></li>)}
    </ul>
  );
}

const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null);
  const show = useCallback((m) => { setMsg(m); clearTimeout(window.__toastT); window.__toastT = setTimeout(() => setMsg(null), 2600); }, []);
  return <ToastCtx.Provider value={show}>{children}{msg && <div className="toast" role="status">{msg}</div>}</ToastCtx.Provider>;
}
export const useToast = () => useContext(ToastCtx);

/** Click once to arm, again to confirm (no browser dialogs). */
export function ConfirmButton({ label, confirmLabel = 'Click again to confirm', onConfirm, className = 'btn ghost sm', style }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 3500); return () => clearTimeout(t); }, [armed]);
  return <button className={className} style={{ ...style, ...(armed ? { color: 'var(--accent)' } : {}) }} onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}>{armed ? confirmLabel : label}</button>;
}

/** Score that counts up when it first appears (instantly if the user prefers reduced motion). */
export function ScoreBadge({ score }) {
  const [shown, setShown] = useState(score);
  const first = useRef(true);
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof score !== 'number') { setShown(score); return; }
    const from = first.current ? Math.max(0, score - 40) : shown;
    first.current = false;
    const t0 = performance.now(), dur = 700;
    let raf;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      setShown(Math.round(from + (score - from) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [score]); // eslint-disable-line react-hooks/exhaustive-deps
  const tier = score >= 85 ? 'great' : score >= 72 ? 'good' : 'fair';
  return (
    <span className={'score-ring ' + tier} aria-label={`Score ${score} out of 100`}>
      <svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15.5" className="track" /><circle cx="18" cy="18" r="15.5" className="arc" style={{ strokeDasharray: `${(shown / 100) * 97.4} 97.4` }} /></svg>
      <b>{shown}</b>
    </span>
  );
}

/** The honest verdict: a plain label and the one reason that matters most. */
export function Verdict({ critique, compact = false }) {
  if (!critique) return null;
  const v = verdictOf(critique);
  return (
    <div className={'verdict ' + v.tone}>
      <span className="verdict-label">{v.label}</span>
      {!compact && <span className="verdict-line">{v.line}</span>}
    </div>
  );
}

export const WARDROBE_IDEAS = ['Work', 'Home', 'Going out', 'Church', 'Weekend'];

/** Put a saved outfit into one of this person's wardrobes (Work, Home…), or start one. */
export function WardrobePicker({ outfitId, compact = false }) {
  const { state, dispatch, profile } = useStore();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const mine = state.wardrobes.filter((w) => w.profileId === profile.id);
  const outfit = state.outfits.find((o) => o.id === outfitId);
  if (!outfit) return null;
  const set = (id) => dispatch({ type: 'SET_OUTFIT_WARDROBE', id: outfitId, wardrobe: outfit.wardrobe === id ? null : id });
  const create = (n) => {
    const clean = n.trim(); if (!clean) return;
    const existing = mine.find((w) => w.name.toLowerCase() === clean.toLowerCase());
    const id = existing?.id || 'wr-' + Date.now().toString(36);
    if (!existing) dispatch({ type: 'ADD_WARDROBE', wardrobe: { id, name: clean, profileId: profile.id } });
    dispatch({ type: 'SET_OUTFIT_WARDROBE', id: outfitId, wardrobe: id });
    setAdding(false); setName('');
  };
  const ideas = WARDROBE_IDEAS.filter((n) => !mine.some((w) => w.name.toLowerCase() === n.toLowerCase())).slice(0, mine.length ? 0 : 3);
  return (
    <div className={'wardrobe-picker' + (compact ? ' compact' : '')}>
      <span className="tiny">Wardrobe:</span>
      {mine.map((w) => <button key={w.id} className={'chip sm' + (outfit.wardrobe === w.id ? ' on' : '')} onClick={() => set(w.id)} aria-pressed={outfit.wardrobe === w.id}>{w.name}</button>)}
      {ideas.map((n) => <button key={n} className="chip sm ghost-chip" onClick={() => create(n)}>+ {n}</button>)}
      {adding ? (
        <form className="wardrobe-new" onSubmit={(e) => { e.preventDefault(); create(name); }}>
          <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Office" aria-label="New wardrobe name" />
          <button className="btn sm primary" type="submit">Add</button>
        </form>
      ) : <button className="chip sm ghost-chip" onClick={() => setAdding(true)}>+ New</button>}
    </div>
  );
}

/** A heart button that bursts when it saves. */
export function HeartButton({ saved, onSave, label = 'Save', savedLabel = 'Saved', className = 'btn sm accent' }) {
  const [burst, setBurst] = useState(0);
  return (
    <button className={className + ' heart-btn' + (saved ? ' is-saved' : '')} disabled={saved} onClick={() => { onSave(); setBurst((b) => b + 1); }}>
      <span className="heart" aria-hidden="true">{saved ? '♥' : '♡'}</span> {saved ? savedLabel : label}
      {burst > 0 && <span key={burst} className="burst" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ '--a': `${i * 45}deg` }} />)}</span>}
    </button>
  );
}
