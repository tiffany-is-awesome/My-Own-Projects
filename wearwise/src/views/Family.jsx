// Family Looks: coordinated (not identical) outfits, each from that person's own closet.
import { useMemo, useState } from 'react';
import { useStore } from '../store.jsx';
import Stage from '../components/Stage.jsx';
import { PieceList, ScoreBadge, ConfirmButton, Verdict, useToast, useUndoableDelete } from '../components/common.jsx';
import { ContextPicker, DEFAULT_CHOICE, contextOf, toSlots } from '../components/Choose.jsx';
import { familyLook } from '../ai/generator.js';
import { ProfileManager } from './Settings.jsx';

export default function Family({ go }) {
  const undoDelete = useUndoableDelete();
  const { state, dispatch, closetOf, get, resolve } = useStore();
  const toast = useToast();
  const [ids, setIds] = useState(() => state.profiles.map((p) => p.id));
  const [choice, setChoice] = useState({ ...DEFAULT_CHOICE, occasion: 'church' });
  const [res, setRes] = useState(null);
  const [savedKey, setSavedKey] = useState(null);
  const [managing, setManaging] = useState(false);
  const chosen = state.profiles.filter((p) => ids.includes(p.id));

  function run() {
    const ctx = contextOf(choice);
    const r = familyLook(chosen.map((p) => ({ profile: p, pool: closetOf(p.id) })), ctx);
    setRes({ ...r, ctx }); setSavedKey(null);
  }
  function save() {
    const name = `${res.ctx.occasionLabel} · ${res.members.map((m) => m.profile.name).join(', ')}`;
    dispatch({ type: 'SAVE_ENSEMBLE', ensemble: { name, context: res.ctx, why: res.why, members: res.members.map((m) => ({ profileId: m.profile.id, slots: toSlots(m.outfit) })) } });
    setSavedKey(JSON.stringify(res.members.map((m) => toSlots(m.outfit))));
    toast('Family look saved');
  }
  const ensembles = state.ensembles;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="label">Family looks</div>
          <h1 className="h1">Dress the whole family</h1>
          <p className="small muted" style={{ margin: 0 }}>Each person is dressed only from their own closet. The looks are coordinated in color and formality, not matching.</p>
        </div>
        <button className="btn" onClick={() => setManaging(!managing)}>{managing ? 'Done' : 'Manage family members'}</button>
      </div>

      {managing && <div className="create-form"><ProfileManager /></div>}

      <div className="create-form">
        <div className="ctx-row"><span className="label">Who's going?</span>
          <div className="chips">
            {state.profiles.map((p) => (
              <button key={p.id} className={'chip' + (ids.includes(p.id) ? ' on' : '')} onClick={() => setIds(ids.includes(p.id) ? ids.filter((x) => x !== p.id) : [...ids, p.id])}>
                {p.name}{p.kind === 'child' ? ' · child' : ''} <span style={{ opacity: .6 }}>&nbsp;{closetOf(p.id).length}</span>
              </button>
            ))}
          </div>
          {state.profiles.length < 2 && <span className="tiny">Add family members (each with their own closet) with “Manage family members”.</span>}
        </div>
        <ContextPicker value={choice} onChange={setChoice} compact />
        <div className="create-go">
          <button className="btn accent" disabled={chosen.length < 2} onClick={run}>{res ? 'Try again' : 'Create family look'}</button>
          {chosen.length < 2 && <span className="tiny">Choose at least two people.</span>}
        </div>
      </div>

      {res?.missing?.length > 0 && (
        <div className="notice">
          {res.missing.map((m) => <div key={m.name}><b>{m.name}</b> needs {m.missing.join(', ')} before a full outfit can be made.</div>)}
          <div className="tiny" style={{ marginTop: 6 }}>Switch to that person (top right) and add their clothes in My Closet.</div>
        </div>
      )}
      {res?.members?.length > 0 && (
        <section>
          <div className="results-head">
            <p className="small" style={{ margin: 0 }}><b>Why it works together:</b> {res.why}</p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn sm accent" onClick={save} disabled={savedKey === JSON.stringify(res.members.map((m) => toSlots(m.outfit)))}>♡ Save family look</button>
            </div>
          </div>
          <div className="family-grid" style={{ gridTemplateColumns: `repeat(${res.members.length}, minmax(0, 1fr))` }}>
            {res.members.map((m) => (
              <div key={m.profile.id} className="family-col">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 className="h3">{m.profile.name}</h3><ScoreBadge score={m.critique.overall} />
                </div>
                <Verdict critique={m.critique} compact />
                <Stage outfit={m.outfit} mode="mannequin" compact child={m.profile.kind === 'child'} />
                <PieceList outfit={m.outfit} />
              </div>
            ))}
          </div>
        </section>
      )}

      {ensembles.length > 0 && (
        <section style={{ marginTop: 36 }}>
          <h2 className="h2">Saved family looks</h2>
          <div className="ensemble-list">
            {ensembles.map((e) => (
              <div key={e.id} className="ensemble">
                <div className="ensemble-head"><div><b>{e.name}</b><div className="tiny">{e.why}</div></div>
                  <ConfirmButton label="Delete" confirmLabel="Click to delete" onConfirm={() => undoDelete({ type: 'DELETE_ENSEMBLE', id: e.id }, 'Family look deleted')} /></div>
                <div className="ensemble-row">
                  {e.members.map((m) => {
                    const p = state.profiles.find((x) => x.id === m.profileId);
                    const o = resolve(m.slots);
                    return <div key={m.profileId} className="ensemble-member"><Stage outfit={o} mode="flatlay" compact child={p?.kind === 'child'} /><span className="tiny">{p?.name || 'Removed member'}</span></div>;
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
