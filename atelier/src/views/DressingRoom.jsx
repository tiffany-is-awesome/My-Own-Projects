import { useMemo, useRef, useState } from 'react';
import { useStore } from '../store.jsx';
import Stage from '../components/Stage.jsx';
import GarmentArt from '../components/GarmentArt.jsx';
import SaveModal from '../components/SaveModal.jsx';
import { Meter, ScoreBadge, useToast } from '../components/common.jsx';
import { critique, suggestSwap, short } from '../ai/critic.js';
import { parseContext, EXAMPLE_PROMPTS } from '../ai/context.js';
import { SCENES, sceneForPrompt } from '../data/scenes.jsx';
import { SLOTS, SLOT_LABEL } from '../data/closet.js';

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export default function DressingRoom({ go }) {
  const { state, dispatch, resolve, pool } = useStore();
  const toast = useToast();
  const { draft } = state;
  const outfit = useMemo(() => resolve(draft.slots), [draft.slots, resolve]);
  const ctx = draft.context;
  const [openSlot, setOpenSlot] = useState(null);
  const [open, setOpen] = useState({ proportions: true, fabric: true, color: true, occasion: true });
  const [prompt, setPrompt] = useState(ctx.prompt);
  const [scenePrompt, setScenePrompt] = useState('');
  const [saving, setSaving] = useState(false);
  const [showBasics, setShowBasics] = useState(true);
  const bgRef = useRef();

  const result = useMemo(() => critique(outfit, ctx), [outfit, ctx]);
  const swap = useMemo(() => suggestSwap(outfit, ctx, pool), [outfit, ctx, pool]);
  const stage = draft.stage;

  const choices = openSlot ? pool.filter((g) => g.category === openSlot && (showBasics || !g.placeholder)) : [];

  function applyContext(p) {
    setPrompt(p);
    dispatch({ type: 'SET_CONTEXT', context: parseContext(p) });
  }

  function generateScene() {
    const s = sceneForPrompt(scenePrompt || ctx.prompt);
    dispatch({ type: 'SET_STAGE', stage: { mode: 'scene', scene: s.id, customBg: null } });
    toast(`Scene ready: ${s.name}`);
  }

  function uploadBg(file) {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => dispatch({ type: 'SET_STAGE', stage: { mode: 'scene', customBg: r.result } });
    r.readAsDataURL(file);
  }

  const sceneName = stage.customBg ? 'Your background' : SCENES.find((s) => s.id === stage.scene)?.name;

  return (
    <div className="page">
      <div className="dressing">
        {/* ───────── LEFT: visual stage ───────── */}
        <div className="dressing-left">
          <div className="stage-tools">
            <div className="seg" role="tablist" aria-label="Stage mode">
              {[['flatlay', 'Flat-lay'], ['mannequin', 'Mannequin'], ['scene', 'Scene']].map(([m, l]) => (
                <button key={m} role="tab" aria-selected={stage.mode === m} className={stage.mode === m ? 'on' : ''} onClick={() => dispatch({ type: 'SET_STAGE', stage: { mode: m } })}>{l}</button>
              ))}
            </div>
            <span className="tiny">4:5 · {stage.mode === 'scene' ? sceneName : stage.mode === 'mannequin' ? 'Basic mannequin' : 'Studio flat-lay'}</span>
          </div>

          <Stage outfit={outfit} mode={stage.mode} sceneId={stage.scene} customBg={stage.customBg}
            caption={stage.mode === 'scene' && !stage.customBg ? 'AI scene · preview' : stage.mode === 'mannequin' ? 'Mannequin · try-on in Phase 2' : null} />

          {stage.mode === 'scene' && (
            <>
              <div className="context-box" style={{ marginTop: 12 }}>
                <input className="input" value={scenePrompt} onChange={(e) => setScenePrompt(e.target.value)} placeholder="Describe a scene: rainy Tokyo street, sunny beach café…" onKeyDown={(e) => e.key === 'Enter' && generateScene()} />
                <button className="btn primary" onClick={generateScene}>Generate</button>
              </div>
              <div className="scene-row">
                {SCENES.filter((s) => s.id !== 'studio').map((s) => (
                  <button key={s.id} className={'scene-thumb' + (stage.scene === s.id && !stage.customBg ? ' on' : '')} onClick={() => dispatch({ type: 'SET_STAGE', stage: { scene: s.id, customBg: null } })}>
                    <svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice">{s.render()}</svg><span>{s.name}</span>
                  </button>
                ))}
                <button className={'scene-thumb' + (stage.customBg ? ' on' : '')} onClick={() => bgRef.current.click()}>
                  <div className="thumb-box">+</div><span>Upload your own</span>
                </button>
                <input ref={bgRef} type="file" accept="image/*" hidden onChange={(e) => uploadBg(e.target.files[0])} />
              </div>
            </>
          )}

          <div className="slots">
            {SLOTS.map((s) => (
              <button key={s} className={'slot' + (openSlot === s ? ' on' : '')} onClick={() => setOpenSlot(openSlot === s ? null : s)} aria-expanded={openSlot === s}>
                <div className="slot-art">{outfit[s] ? <GarmentArt item={outfit[s]} /> : <span className="slot-empty">+</span>}</div>
                <span className="label">{SLOT_LABEL[s]}{outfit[s]?.placeholder ? ' · basic' : ''}</span>
              </button>
            ))}
          </div>

          {openSlot && (
            <div className="picker">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 10 }}>
                <span className="label">Choose {SLOT_LABEL[openSlot].toLowerCase()}</span>
                <label className="tiny" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="checkbox" checked={showBasics} onChange={(e) => setShowBasics(e.target.checked)} /> include basics
                </label>
              </div>
              <div className="picker-grid">
                <button className={'pick' + (!outfit[openSlot] ? ' on' : '')} onClick={() => dispatch({ type: 'SET_SLOT', slot: openSlot, id: null })}>
                  <div className="pick-art"><span className="slot-empty">∅</span></div><span>None</span>
                </button>
                {choices.map((g) => (
                  <button key={g.id} className={'pick' + (outfit[openSlot]?.id === g.id ? ' on' : '')} onClick={() => dispatch({ type: 'SET_SLOT', slot: openSlot, id: g.id })}>
                    <div className="pick-art"><GarmentArt item={g} /></div>
                    {g.placeholder && <span className="basic-tag">Basic</span>}
                    <span>{g.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ───────── RIGHT: stylist spec sheet ───────── */}
        <div>
          <div className="label">Dressing room</div>
          <div className="spec-title">
            <input value={draft.name} placeholder="Untitled look" onChange={(e) => dispatch({ type: 'SET_NAME', name: e.target.value })} aria-label="Look name" />
          </div>

          <div className="rows">
            <div className="row"><span className="label">Context</span>
              <div>
                <div className="context-box">
                  <input className="input" value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && applyContext(prompt)} aria-label="Situation" />
                  <button className="btn sm" style={{ height: 44 }} onClick={() => applyContext(prompt)}>Update</button>
                </div>
                <div className="chips" style={{ marginTop: 8 }}>
                  {EXAMPLE_PROMPTS.slice(0, 3).map((p) => <button key={p} className="chip" onClick={() => applyContext(p)}>{p}</button>)}
                </div>
              </div>
            </div>
            <div className="row"><span className="label">Reading</span><span className="small">{ctx.weather} · {ctx.tempC}°C{ctx.rain >= 0.6 ? ' · rain likely' : ''} · {ctx.occasionLabel}{ctx.city ? ` · ${ctx.city}` : ''}</span></div>
            <div className="row"><span className="label">Season</span><span>{result.seasons.length ? result.seasons.map(cap).join(' / ') : <span className="muted">Mixed-season pieces</span>}</span></div>
            <div className="row"><span className="label">Weather</span>
              <span><Meter value={result.weatherMeter} /><span className="small">{['', 'Poor', 'Weak', 'Fair', 'Good', 'Excellent'][result.weatherMeter]} · warmth {result.warmth.have} / ~{result.warmth.need} needed</span></span></div>
            <div className="row"><span className="label">Formality</span>
              <span><Meter value={result.formalityMeter} /><span className="small">{result.formalityLabel} (target: {ctx.occasionLabel.toLowerCase()})</span></span></div>
          </div>

          <div className="critique-head">
            <div><span className="ai-badge">AI Stylist</span><h3 className="h2" style={{ marginTop: 4 }}>Critique</h3></div>
            <ScoreBadge score={result.overall} />
          </div>
          <div style={{ borderTop: '1px solid var(--ink)' }}>
            {result.pillars.map((p) => (
              <div className="pillar" key={p.id}>
                <button onClick={() => setOpen((o) => ({ ...o, [p.id]: !o[p.id] }))} aria-expanded={open[p.id]}>
                  <span>{p.label}</span>
                  <span className={'bar' + (p.score < 65 ? ' low' : '')}><i style={{ width: p.score + '%' }} /></span>
                  <span className="small" style={{ textAlign: 'right' }}>{p.score}</span>
                  <span className="muted">{open[p.id] ? '−' : '+'}</span>
                </button>
                {open[p.id] && (
                  <div className="pillar-body">
                    {p.pros.map((t, i) => <div key={'p' + i} className="finding pro"><span className="mark">✓</span><span>{t}</span></div>)}
                    {p.cons.map((t, i) => <div key={'c' + i} className="finding con"><span className="mark">△</span><span>{t}</span></div>)}
                    {!p.pros.length && !p.cons.length && <div className="small muted">Nothing to flag.</div>}
                  </div>
                )}
              </div>
            ))}
          </div>

          {swap && (
            <div className="swap">
              <div className="swap-art">{swap.to ? <GarmentArt item={swap.to} /> : <span className="muted">−</span>}</div>
              <div style={{ flex: 1 }}>
                <span className="label">Swap tip · +{swap.gain} pts</span>
                <p>{swap.text}</p>
              </div>
              <button className="btn sm" onClick={() => { dispatch({ type: 'SET_SLOT', slot: swap.slot, id: swap.to?.id || null }); toast(swap.to ? `Swapped in the ${short(swap.to)}` : 'Layer removed'); }}>Apply</button>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            <button className="btn accent" style={{ flex: 1 }} onClick={() => setSaving(true)}>Save to lookbook</button>
            <button className="btn" onClick={() => go('#/mix')}>Mix & match</button>
          </div>
          <p className="tiny" style={{ marginTop: 12 }}>The critique comes from Atelier's rules engine (fabric, weather, color and proportion logic). In the full app, an AI stylist rewrites these findings in plain language without adding new claims.</p>
        </div>
      </div>
      {saving && <SaveModal defaultName={draft.name} onClose={() => setSaving(false)} onDone={(t) => { setSaving(false); toast(`Saved to “${t}”`); }} />}
    </div>
  );
}
