import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import GarmentArt from './GarmentArt.jsx';
import Stage from './Stage.jsx';
import { CATEGORY_LABEL } from '../data/closet.js';

const STATUS_FLAG = { laundry: 'In laundry', repair: 'Needs repair', stored: 'Stored' };

export function ProductCard({ item, onClick, action, flag }) {
  const meta = [item.material, item.weight && `${item.weight[0].toUpperCase()}${item.weight.slice(1)} weight`].filter(Boolean).join(' · ');
  return (
    <div className="card">
      <button className="card" onClick={onClick} aria-label={`Open ${item.name}`}>
        <div className="card-stage">
          <GarmentArt item={item} />
          {item.demo && <span className="card-flag basic">Demo</span>}
          {item.status && item.status !== 'available' && <span className="card-flag status">{STATUS_FLAG[item.status]}</span>}
          {flag && <span className="card-flag new">{flag}</span>}
        </div>
        <div className="card-body">
          <div className="tiny">{(CATEGORY_LABEL[item.category] || item.category).toUpperCase()}</div>
          <div className="card-name">{item.name}</div>
          <div className="card-meta">{meta}</div>
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

export function ScoreBadge({ score }) {
  return <span className="score-ring"><b>{score}</b><span className="tiny">/100</span></span>;
}
