// Motion & graphic pieces: the "stylist at work" loader and the Home hero showcase.
// Everything respects prefers-reduced-motion (see styles.css).
import { useEffect, useState } from 'react';
import Stage from './Stage.jsx';
import { DEMO_CLOSET } from '../data/closet.js';

const STEPS = ['Reading your closet', 'Matching colors', 'Balancing proportions', 'Checking the weather', 'Choosing shoes', 'Finishing touches'];

/** Shown while outfits are being put together. Real progress text, not a fake percentage. */
export function StylistLoader({ count }) {
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((x) => (x + 1) % STEPS.length), 900); return () => clearInterval(t); }, []);
  return (
    <div className="stylist-loader" role="status" aria-live="polite">
      <div className="loader-rack" aria-hidden="true">
        {['M30 12 L42 8 Q50 14 58 8 L70 12 L80 28 L72 32 L68 26 L68 70 L32 70 L32 26 L28 32 L20 28 Z',
          'M34 8 L66 8 L70 72 L54 72 L50 30 L46 72 L30 72 Z',
          'M28 40 Q40 24 60 30 L76 36 Q82 44 76 50 L30 52 Q22 48 28 40 Z'].map((d, k) => (
          <svg key={k} viewBox="0 0 100 80" className={'loader-piece p' + k}><path d={d} /></svg>
        ))}
      </div>
      <div className="loader-text"><b key={i}>{STEPS[i]}…</b><span className="tiny">Looking through {count} available pieces</span></div>
    </div>
  );
}

const byId = (id) => DEMO_CLOSET.find((g) => g.id === id);
const EXAMPLES = [
  { name: 'Trench & olive', o: { top: byId('t-black-turtle'), bottom: byId('b-olive-chino'), outer: byId('o-trench'), shoes: byId('s-black-boot'), bag: byId('a-crossbody') } },
  { name: 'Weekend stripes', o: { top: byId('t-stripe-tee'), bottom: byId('b-dark-denim'), shoes: byId('s-white-sneaker'), bag: byId('a-tote') } },
  { name: 'Evening navy', o: { top: byId('d-navy-dress'), outer: byId('o-wool-coat'), shoes: byId('s-suede-loafer'), accessory: byId('a-necklace') } },
].map((e) => ({ ...e, o: Object.fromEntries(Object.entries(e.o).filter(([, v]) => v)) }));

/** Cycling example looks for the Home hero (clearly labelled as illustrations). */
export function HeroShowcase() {
  const [i, setI] = useState(0);
  const [mode, setMode] = useState('flatlay');
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return undefined;
    const t = setInterval(() => setI((x) => { const n = (x + 1) % EXAMPLES.length; if (n === 0) setMode((m) => (m === 'flatlay' ? 'mannequin' : 'flatlay')); return n; }), 3600);
    return () => clearInterval(t);
  }, []);
  const ex = EXAMPLES[i];
  return (
    <div className="hero-showcase">
      <div className="hero-blob b1" aria-hidden="true" /><div className="hero-blob b2" aria-hidden="true" />
      <div className="hero-frame">
        <Stage key={i + mode} outfit={ex.o} mode={mode} />
        <div className="hero-tag"><span className="tiny">Example look · illustration</span><b>{ex.name}</b></div>
      </div>
      <div className="hero-dots" role="tablist" aria-label="Example looks">
        {EXAMPLES.map((e, k) => <button key={k} role="tab" aria-selected={k === i} aria-label={e.name} className={k === i ? 'on' : ''} onClick={() => setI(k)} />)}
      </div>
    </div>
  );
}
