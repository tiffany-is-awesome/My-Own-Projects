import { useEffect, useState } from 'react';
import { useStore } from '../store.jsx';
import Stage from '../components/Stage.jsx';
import SaveModal from '../components/SaveModal.jsx';
import { ScoreBadge, useToast } from '../components/common.jsx';
import { parseContext, EXAMPLE_PROMPTS } from '../ai/context.js';
import { generateOutfits } from '../ai/generator.js';
import { sceneForPrompt } from '../data/scenes.jsx';
import { SLOTS, SLOT_LABEL } from '../data/closet.js';

const toSlots = (o) => Object.fromEntries(SLOTS.map((k) => [k, o[k]?.id || null]));

export default function MixMatch({ go }) {
  const { state, dispatch, pool, owned, get } = useStore();
  const toast = useToast();
  const [prompt, setPrompt] = useState(state.draft.context.prompt);
  const [anchorId, setAnchorId] = useState('');
  const [ctx, setCtx] = useState(null);
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState('flatlay');
  const [saving, setSaving] = useState(null);

  function run(p = prompt) {
    setPrompt(p);
    setBusy(true);
    const c = parseContext(p);
    setCtx(c);
    // small delay so it feels like a stylist is thinking (the real search takes milliseconds)
    setTimeout(() => {
      setResults(generateOutfits(pool, c, anchorId ? get(anchorId) : null));
      setBusy(false);
    }, 700);
  }
  useEffect(() => { run(); /* first render */ }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function open(r) {
    dispatch({ type: 'LOAD_DRAFT', draft: { slots: toSlots(r.outfit), context: ctx, name: r.persona.name, stage: { ...state.draft.stage, mode: view === 'scene' ? 'scene' : 'flatlay', scene: sceneForPrompt(ctx.prompt).id, customBg: null } } });
    go('#/dressing');
  }

  const scene = ctx ? sceneForPrompt(ctx.prompt) : null;

  return (
    <div className="page">
      <div className="hero-prompt">
        <span className="ai-badge">Context-aware mix & match</span>
        <h1 className="h1" style={{ marginTop: 6 }}>Where are you going?</h1>
        <div className="prompt-row">
          <input className="input" value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} placeholder="Vibe, destination or weather, e.g. Rainy Tuesday coffee meeting, 16°C" aria-label="Situation" />
          <select className="select" value={anchorId} onChange={(e) => setAnchorId(e.target.value)} aria-label="Anchor item">
            <option value="">No anchor: surprise me</option>
            {owned.map((g) => <option key={g.id} value={g.id}>Build around: {g.name}</option>)}
          </select>
          <button className="btn primary" onClick={() => run()} disabled={busy}>{busy ? 'Styling…' : 'Style me'}</button>
        </div>
        <div className="chips" style={{ marginTop: 12 }}>
          {EXAMPLE_PROMPTS.map((p) => <button key={p} className="chip" onClick={() => run(p)}>{p}</button>)}
        </div>
        {ctx && (
          <div className="parsed">
            <span className="label">AI read it as</span>
            <span>Temp<b>{ctx.tempC}°C</b></span>
            <span>Rain<b>{ctx.rain >= 0.6 ? 'Likely' : ctx.rain >= 0.3 ? 'Possible' : 'Unlikely'}</b></span>
            <span>Occasion<b>{ctx.occasionLabel}</b></span>
            <span>Season<b>{ctx.season}</b></span>
            {ctx.city && <span>City<b>{ctx.city}</b></span>}
          </div>
        )}
      </div>

      <div className="page-head" style={{ marginBottom: 16 }}>
        <h2 className="h2">Three ways to wear it</h2>
        <div className="seg">
          <button className={view === 'flatlay' ? 'on' : ''} onClick={() => setView('flatlay')}>Flat-lay</button>
          <button className={view === 'scene' ? 'on' : ''} onClick={() => setView('scene')}>In scene</button>
        </div>
      </div>

      {busy && <div className="loading-bar"><i /></div>}
      {results && (
        <div className="grid three" style={{ opacity: busy ? 0.4 : 1, transition: 'opacity .2s' }}>
          {results.map((r) => {
            const pros = r.critique.pillars.flatMap((p) => p.pros);
            const cons = r.critique.pillars.flatMap((p) => p.cons);
            return (
              <div className="variant" key={r.persona.id}>
                <div className="variant-head">
                  <div><div className="h2" style={{ fontSize: 17 }}>{r.persona.name}</div><div className="tiny">{r.persona.blurb}</div></div>
                  <ScoreBadge score={r.critique.overall} />
                </div>
                <Stage outfit={r.outfit} mode={view === 'scene' ? 'scene' : 'flatlay'} sceneId={scene?.id} />
                <div className="variant-body">
                  <ul className="item-list">
                    {SLOTS.filter((k) => r.outfit[k]).map((k) => (
                      <li key={k}><span>{SLOT_LABEL[k]}</span><span style={{ color: 'var(--ink)', textAlign: 'right' }}>{r.outfit[k].name}{r.outfit[k].placeholder ? ' (basic)' : ''}</span></li>
                    ))}
                  </ul>
                  {pros[0] && <div className="finding pro small"><span className="mark">✓</span><span>{pros[0]}</span></div>}
                  {cons[0] && <div className="finding con small"><span className="mark">△</span><span>{cons[0]}</span></div>}
                </div>
                <div className="variant-actions">
                  <button className="btn primary sm" style={{ flex: 1 }} onClick={() => open(r)}>Open in dressing room</button>
                  <button className="btn sm" onClick={() => { dispatch({ type: 'LOAD_DRAFT', draft: { slots: toSlots(r.outfit), context: ctx } }); setSaving(r); }}>Save</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {saving && <SaveModal defaultName={`${saving.persona.name}: ${ctx.prompt}`} onClose={() => setSaving(null)} onDone={(t) => { setSaving(null); toast(`Saved to “${t}”`); }} />}
    </div>
  );
}
