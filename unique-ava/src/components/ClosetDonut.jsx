// "Closet at a glance": a donut like Tiffo's "Where the money went".
// Three views: what's in the closet (by category), its colors, and what actually gets worn (This month / 90 days / All).
import { useMemo, useState } from 'react';
import { CATEGORIES } from '../data/closet.js';
import { hexToRgb } from '../ai/color.js';

// Very light slices (white, cream) get a hairline so they don't vanish into the white card.
const isLight = (hex) => { const [r, g, b] = hexToRgb(hex); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.82; };

// Validated categorical slots (light mode; 6 slots pass the CVD/normal-vision checks; low-contrast slots carry text labels).
const CAT_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#6250d6'];
const DAY = 86400000;

function arcPath(cx, cy, r, R, a0, a1) {
  const p = (rad, a) => [cx + rad * Math.cos(a), cy + rad * Math.sin(a)];
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = p(R, a0), [x1, y1] = p(R, a1), [x2, y2] = p(r, a1), [x3, y3] = p(r, a0);
  return `M${x0} ${y0} A${R} ${R} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${r} ${r} 0 ${large} 0 ${x3} ${y3} Z`;
}

export function slicesFor(view, garments, history, period, now = Date.now()) {
  if (view === 'category') {
    return CATEGORIES.map((c, i) => ({ key: c.id, label: c.label, value: garments.filter((g) => g.category === c.id).length, color: CAT_COLORS[i] }));
  }
  if (view === 'color') {
    // The garments' own colors are the data, so slices wear them (each named in the list). Small ones fold into "Other".
    const m = new Map();
    for (const g of garments) {
      const c = g.colors?.[0];
      if (!c) continue;
      const e = m.get(c.name) || { key: c.name, label: c.name, value: 0, color: c.hex };
      e.value++; m.set(c.name, e);
    }
    const all = [...m.values()].sort((a, b) => b.value - a.value);
    const top = all.slice(0, 7);
    const rest = all.slice(7).reduce((a, x) => a + x.value, 0);
    return rest ? [...top, { key: 'other', label: 'Other colors', value: rest, color: '#BDB9B0' }] : top;
  }
  // What gets worn: wears per category in the period, plus pieces never worn in it.
  const since = period === 'month' ? new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime() : period === '90' ? now - 90 * DAY : 0;
  const inPeriod = history.filter((h) => new Date(h.date + 'T12:00:00').getTime() >= since);
  const byId = new Map(garments.map((g) => [g.id, g]));
  const wornIds = new Set();
  const counts = Object.fromEntries(CATEGORIES.map((c) => [c.id, 0]));
  for (const h of inPeriod) for (const id of Object.values(h.slots || {})) { const g = id && byId.get(id); if (g) { counts[g.category]++; wornIds.add(id); } }
  const slices = CATEGORIES.map((c, i) => ({ key: c.id, label: c.label, value: counts[c.id], color: CAT_COLORS[i] }));
  return { slices, worn: wornIds.size, never: garments.filter((g) => !wornIds.has(g.id)).length, outfits: inPeriod.length };
}

export default function ClosetDonut({ garments, history, onPick }) {
  const [view, setView] = useState('category');
  const [period, setPeriod] = useState('month');
  const [hover, setHover] = useState(null);
  const data = useMemo(() => slicesFor(view, garments, history, period), [view, garments, history, period]);
  const slices = (Array.isArray(data) ? data : data.slices).filter((s) => s.value > 0);
  const total = slices.reduce((a, s) => a + s.value, 0);
  const size = 220, cx = 110, cy = 110, R = 100, r = 66;
  const gap = slices.length > 1 ? 0.025 : 0; // 2px-ish surface gap between slices
  let a = -Math.PI / 2;
  const arcs = slices.map((s) => {
    const span = (s.value / total) * Math.PI * 2;
    const arc = { ...s, d: arcPath(cx, cy, r, R, a + gap / 2, a + span - gap / 2), pct: Math.round((s.value / total) * 100) };
    a += span;
    return arc;
  });
  const focus = hover && arcs.find((x) => x.key === hover);
  const unit = view === 'wear' ? 'wears' : 'pieces';
  return (
    <section className="donut-card" aria-label="Closet at a glance">
      <div className="donut-head">
        <h2 className="h2">Closet at a glance</h2>
        <div className="seg" role="tablist" aria-label="Donut view">
          {[['category', 'What’s in it'], ['color', 'Colors'], ['wear', 'What you wear']].map(([id, l]) => <button key={id} role="tab" aria-selected={view === id} className={view === id ? 'on' : ''} onClick={() => { setView(id); setHover(null); }}>{l}</button>)}
        </div>
      </div>
      {view === 'wear' && (
        <div className="seg period" role="tablist" aria-label="Donut period">
          {[['month', 'This month'], ['90', '90 days'], ['all', 'All']].map(([id, l]) => <button key={id} role="tab" aria-selected={period === id} className={period === id ? 'on' : ''} onClick={() => setPeriod(id)}>{l}</button>)}
        </div>
      )}
      {total === 0 ? (
        <p className="small muted donut-empty">{view === 'wear' ? 'Nothing logged as worn in this period yet. Tap "I wore this" on an outfit, or mark a day on the calendar.' : 'No pieces in this closet yet.'}</p>
      ) : (
        <div className="donut-body">
          <div className="donut-wrap">
            <svg viewBox={`0 0 ${size} ${size}`} className="donut-svg" role="img" aria-label={`${total} ${unit}: ` + arcs.map((x) => `${x.label} ${x.value}`).join(', ')}>
              {arcs.map((x, i) => (
                <path key={x.key + view + period} d={x.d} fill={x.color} className={'donut-slice' + (hover && hover !== x.key ? ' dim' : '')} style={{ '--i': i }}
                  stroke={view === 'color' && isLight(x.color) ? '#D9D6CF' : 'none'} strokeWidth="1"
                  onMouseEnter={() => setHover(x.key)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(x.key)} onBlur={() => setHover(null)}
                  tabIndex={0} onClick={() => onPick?.(view, x.key)}>
                  <title>{`${x.label}: ${x.value} ${unit} (${x.pct}%)`}</title>
                </path>
              ))}
            </svg>
            <div className="donut-center" aria-hidden="true">
              <b>{focus ? focus.value : total}</b>
              <span className="tiny">{focus ? `${focus.label} · ${focus.pct}%` : unit}</span>
            </div>
          </div>
          <ul className="donut-legend">
            {arcs.map((x) => (
              <li key={x.key} className={hover === x.key ? 'on' : ''} onMouseEnter={() => setHover(x.key)} onMouseLeave={() => setHover(null)}>
                <button onClick={() => onPick?.(view, x.key)} disabled={!onPick || view === 'wear'}>
                  <span className="sw" style={{ background: x.color, borderColor: view === 'color' && isLight(x.color) ? '#D9D6CF' : x.color }} />
                  <span className="nm">{x.label}</span><span className="vl">{x.value}</span><span className="pc">{x.pct}%</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {view === 'wear' && !Array.isArray(data) && total > 0 && (
        <p className="tiny donut-foot">{data.outfits} outfit{data.outfits === 1 ? '' : 's'} logged · {data.worn} piece{data.worn === 1 ? '' : 's'} worn · <b>{data.never}</b> not worn in this period</p>
      )}
      {view !== 'wear' && onPick && <p className="tiny donut-foot">Tap a slice to see those pieces in your closet.</p>}
    </section>
  );
}
