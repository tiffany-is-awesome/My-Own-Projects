// "Style Me With This": several styling directions around one piece she owns.
import { useMemo, useState } from 'react';
import { useStore } from '../store.jsx';
import { useToast } from '../components/common.jsx';
import GarmentArt from '../components/GarmentArt.jsx';
import { ContextPicker, OutfitCard, Compare, DEFAULT_CHOICE, contextOf, toSlots } from '../components/Choose.jsx';
import { styleWithThis, describe } from '../ai/generator.js';
import { MissingNotice } from './Create.jsx';

export default function StyleMe({ id, go }) {
  const { state, dispatch, owned, get, profile, personal } = useStore();
  const toast = useToast();
  const item = get(id);
  const [choice, setChoice] = useState(() => ({ ...(state.draft.choice || DEFAULT_CHOICE), style: null }));
  const ctx = useMemo(() => ({ ...contextOf(choice), personal: personal.rated ? personal : null }), [choice, personal]);
  const mine = item && owned.some((g) => g.id === item.id);
  const res = useMemo(() => (mine ? styleWithThis(owned, item, ctx) : null), [mine, owned, item, ctx]);
  const [edits, setEdits] = useState({});
  const [comparing, setComparing] = useState(false);
  const [saved, setSaved] = useState({});
  const child = profile.kind === 'child';

  if (!item || !mine) {
    return <div className="page"><div className="empty"><p className="small">That piece isn't in {profile.name === 'Me' ? 'your' : `${profile.name}'s`} closet.</p><button className="btn" onClick={() => go('#/closet')}>Back to the closet</button></div></div>;
  }
  const outfits = (res?.outfits || []).map((r, i) => { const cur = edits[i] || r; return { ...cur, label: r.name, name: describe(cur.outfit), ctx: r.ctx }; });

  function save(i, favorite = false) {
    const r = outfits[i];
    const id = 'o-' + Date.now().toString(36) + i;
    dispatch({ type: 'SAVE_OUTFIT', outfit: { id, name: `${item.name} · ${r.label}`, slots: toSlots(r.outfit), context: r.ctx || ctx, stage: { mode: 'flatlay' }, favorite, why: r.why, source: 'rules' } });
    setSaved((s) => ({ ...s, [i]: id }));
    toast(favorite ? 'Saved as a favorite' : 'Saved to Saved Outfits');
  }

  return (
    <div className="page">
      <div className="page-head">
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <span className="mini" style={{ width: 72 }}><GarmentArt item={item} /></span>
          <div>
            <div className="label">Style me with this</div>
            <h1 className="h1">{item.name}</h1>
            <p className="small muted" style={{ margin: 0 }}>Different directions, each one built around this piece, using only available clothes in this closet.</p>
          </div>
        </div>
      </div>
      <div className="create-form"><ContextPicker value={choice} onChange={(c) => { setChoice(c); setEdits({}); setSaved({}); }} compact /></div>

      {res?.missing?.length > 0 && <MissingNotice missing={res.missing} go={go} />}
      {res?.unavailable && <div className="notice">This piece is marked “{item.status}”, so it can't be styled right now. Mark it available in the closet first.</div>}
      {outfits.length > 0 && (
        <>
          <div className="results-head">
            <div className="small">{outfits.length} directions · {ctx.prompt} · styled by the rules engine</div>
            {!comparing && <button className="btn sm" onClick={() => setComparing(true)}>Compare side by side</button>}
          </div>
          {comparing ? (
            <Compare results={outfits.slice(0, 3)} ctx={ctx} child={child} onClose={() => setComparing(false)} savedIdx={Object.keys(saved).map(Number)} onPick={(i) => save(i, true)} />
          ) : (
            <div className="outfit-grid">
              {outfits.map((r, i) => (
                <OutfitCard key={i} index={i} result={r} ctx={r.ctx || ctx} pool={owned} child={child} saved={!!saved[i]} savedId={saved[i]}
                  onReplace={(n) => { if (Object.values(n.outfit).some((g) => g?.id === item.id)) setEdits((e) => ({ ...e, [i]: n })); else toast('That change would drop this piece, so it was skipped.'); }}
                  onSave={() => save(i)}
                  onWore={() => { dispatch({ type: 'LOG_WEAR', entry: { slots: toSlots(r.outfit), context: r.ctx || ctx } }); toast('Added to Outfit History'); }}
                  onOpen={() => { dispatch({ type: 'LOAD_DRAFT', draft: { slots: toSlots(r.outfit), name: `${item.name} · ${r.label}`, context: r.ctx || ctx, choice } }); go('#/builder'); }} />
              ))}
            </div>
          )}
          {comparing && outfits.length > 3 && <p className="tiny">Comparing the first 3 directions.</p>}
        </>
      )}
    </div>
  );
}
