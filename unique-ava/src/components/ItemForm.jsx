// One form for every way an item is described: after an upload, when adding by hand, and when editing later.
import { NAMED_COLORS } from '../ai/color.js';
import { CATEGORIES, ARTS, STYLES, SLEEVES, OCCASIONS } from '../data/closet.js';

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const PATTERNS = ['solid', 'stripe', 'check', 'floral', 'dots', 'graphic', 'other'];
export const STATUSES = [
  { id: 'available', label: 'Available' },
  { id: 'laundry', label: 'In the laundry' },
  { id: 'repair', label: 'Needs repair' },
  { id: 'stored', label: 'Stored away' },
];
const toggle = (list = [], v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/** A sensible blank item for manual entry (no photo). */
export function blankItem(category = 'top') {
  const c = NAMED_COLORS.find((x) => x.name === 'black') || NAMED_COLORS[0];
  return {
    id: 'm-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: '', category, art: ARTS[category][0], colors: [{ name: c.name, hex: c.hex }], pattern: 'solid',
    material: '', weight: 'mid', fit: 'regular', warmth: 2, water: 1, formality: 2, style: 'casual', sleeve: null,
    seasons: [...SEASONS], occasions: [], status: 'available', manual: true,
  };
}

export default function ItemForm({ item, onChange }) {
  const set = (k, v) => onChange({ ...item, [k]: v });
  const setColor = (i, name) => {
    const c = NAMED_COLORS.find((x) => x.name === name);
    const colors = [...item.colors];
    // Keep the measured hex of a photographed item when only the name is corrected; manual items take the named color.
    if (name === '') colors.splice(i, 1);
    else colors[i] = { name, hex: item.image && i === 0 && colors[0] ? colors[0].hex : c.hex };
    onChange({ ...item, colors: colors.length ? colors : item.colors });
  };
  const hasSleeve = ['top', 'dress', 'outer'].includes(item.category);
  return (
    <div className="item-form">
      <div className="field"><label className="label">Name</label>
        <input className="input" value={item.name} placeholder="e.g. Navy Linen Shirt" onChange={(e) => set('name', e.target.value)} /></div>
      <div className="field-row">
        <div className="field"><label className="label">Category</label>
          <select className="select" value={item.category} onChange={(e) => onChange({ ...item, category: e.target.value, art: ARTS[e.target.value][0] })}>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select></div>
        <div className="field"><label className="label">Type</label>
          <select className="select" value={item.art} onChange={(e) => set('art', e.target.value)}>
            {ARTS[item.category].map((a) => <option key={a} value={a}>{a}</option>)}
          </select></div>
      </div>
      <div className="field-row">
        <div className="field"><label className="label">Main color</label>
          <select className="select" value={item.colors[0]?.name} onChange={(e) => setColor(0, e.target.value)}>
            {NAMED_COLORS.map((c) => <option key={c.name}>{c.name}</option>)}
          </select></div>
        <div className="field"><label className="label">Second color</label>
          <select className="select" value={item.colors[1]?.name || ''} onChange={(e) => setColor(1, e.target.value)}>
            <option value="">none</option>
            {NAMED_COLORS.map((c) => <option key={c.name}>{c.name}</option>)}
          </select></div>
      </div>
      <div className="field-row">
        <div className="field"><label className="label">Pattern</label>
          <select className="select" value={item.pattern || 'solid'} onChange={(e) => set('pattern', e.target.value)}>{PATTERNS.map((p) => <option key={p}>{p}</option>)}</select></div>
        <div className="field"><label className="label">Material</label>
          <input className="input" value={item.material || ''} placeholder="cotton, wool, denim…" onChange={(e) => set('material', e.target.value)} /></div>
      </div>
      <div className="field-row">
        <div className="field"><label className="label">Style</label>
          <select className="select" value={item.style || 'casual'} onChange={(e) => set('style', e.target.value)}>{STYLES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
        <div className="field"><label className="label">Fit</label>
          <select className="select" value={item.fit || 'regular'} onChange={(e) => set('fit', e.target.value)}>{['fitted', 'regular', 'relaxed', 'oversized'].map((f) => <option key={f}>{f}</option>)}</select></div>
      </div>
      <div className="field-row">
        {hasSleeve ? (
          <div className="field"><label className="label">Sleeve</label>
            <select className="select" value={item.sleeve || ''} onChange={(e) => set('sleeve', e.target.value || null)}><option value="">not sure</option>{SLEEVES.map((s) => <option key={s}>{s}</option>)}</select></div>
        ) : <div className="field" />}
        <div className="field"><label className="label">Weight</label>
          <select className="select" value={item.weight || 'mid'} onChange={(e) => set('weight', e.target.value)}>{['light', 'mid', 'heavy'].map((f) => <option key={f}>{f}</option>)}</select></div>
      </div>
      <div className="field-row three">
        <div className="field"><label className="label">Warmth · {item.warmth}/5</label><input type="range" min="0" max="5" value={item.warmth} onChange={(e) => set('warmth', +e.target.value)} /></div>
        <div className="field"><label className="label">Rain-ready · {item.water || 1}/5</label><input type="range" min="1" max="5" value={item.water || 1} onChange={(e) => set('water', +e.target.value)} /></div>
        <div className="field"><label className="label">Formality · {item.formality}/5</label><input type="range" min="1" max="5" value={item.formality} onChange={(e) => set('formality', +e.target.value)} /></div>
      </div>
      <div className="field"><label className="label">Seasons</label>
        <div className="chips">{SEASONS.map((s) => <button type="button" key={s} className={'chip' + ((item.seasons || []).includes(s) ? ' on' : '')} onClick={() => set('seasons', toggle(item.seasons, s))}>{s}</button>)}</div></div>
      <div className="field"><label className="label">Good for</label>
        <div className="chips">{OCCASIONS.map((o) => <button type="button" key={o.id} className={'chip' + ((item.occasions || []).includes(o.id) ? ' on' : '')} onClick={() => set('occasions', toggle(item.occasions, o.id))}>{o.label}</button>)}</div></div>
      <div className="field"><label className="label">Status</label>
        <div className="chips">{STATUSES.map((s) => <button type="button" key={s.id} className={'chip' + ((item.status || 'available') === s.id ? ' on' : '')} onClick={() => set('status', s.id)}>{s.label}</button>)}</div>
        <span className="tiny">Only available pieces are used in outfit suggestions.</span></div>
    </div>
  );
}
