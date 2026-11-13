import { useMemo, useRef, useState } from 'react';
import { useStore } from '../store.jsx';
import Stage from '../components/Stage.jsx';
import GarmentArt from '../components/GarmentArt.jsx';
import SaveModal from '../components/SaveModal.jsx';
import { Meter, ScoreBadge, useToast } from '../components/common.jsx';
import { critique, suggestSwap, short } from '../ai/critic.js';
import { critiqueWithClaude } from '../ai/stylist.js';
import { useClaudeStatus } from '../ai/claude.js';
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

  const rules = useMemo(() => critique(outfit, ctx), [outfit, ctx]);
  const ai = useClaudeStatus();
  const lookKey = JSON.stringify([draft.slots, ctx.prompt]);
  const [aiCrit, setAiCrit] = useState(() => (state.aiCritiques?.[lookKey] ? { key: lookKey, critique: state.aiCritiques[lookKey] } : null));
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState('');
  const [source, setSource] = useState('claude');
  const cached = aiCrit?.key === lookKey ? aiCrit.critique : state.aiCritiques?.[lookKey] || null;
  const result = cached && source === 'claude' ? cached : rules;
  async function askClaude() {
    setAiBusy(true); setAiErr('');
    const r = await critiqueWithClaude(outfit, ctx, rules);
    setAiBusy(false);
    if (r?.critique) { setAiCrit({ key: lookKey, critique: r.critique }); setSource('claude'); dispatch({ type: 'CACHE_CRITIQUE', key: lookKey, critique: r.critique }); }
    else setAiErr(r?.error || 'Claude is not available here, so the rules engine critique is shown.');
  }
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
              {[['flatlay', 'Flat-lay'], ['mannequin', 'Mannequin'], ['scene', 'Scene'], ['person', 'On you']].map(([m, l]) => (
                <button key={m} role="tab" aria-selected={stage.mode === m} className={stage.mode === m ? 'on' : ''} onClick={() => dispatch({ type: 'SET_STAGE', stage: { mode: m } })}>{l}</button>
              ))}
            </div>
            <span className="tiny">4:5 · {stage.mode === 'scene' ? sceneName : stage.mode === 'mannequin' ? 'Studio mannequin' : stage.mode === 'person' ? 'Real photo' : 'Studio flat-lay'}</span>
          </div>

          <Stage outfit={outfit} mode={stage.mode} sceneId={stage.scene} customBg={stage.customBg} personPhoto={stage.personPhoto}
            caption={stage.mode === 'scene' && !stage.customBg ? 'Scene preview' : stage.mode === 'mannequin' ? 'Studio mannequin' : null} />

          {stage.mode === 'person' && (
            <div className="context-box" style={{ marginTop: 12, alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="small muted">Use a full-length photo of yourself, or a model you'd like to dress like. It stays on this device.</span>
              <label className="btn sm primary" style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>{stage.personPhoto ? 'Change photo' : 'Add a photo'}
                <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => dispatch({ type: 'SET_STAGE', stage: { personPhoto: r.result } }); r.readAsDataURL(f); }} />
              </label>
            </div>
          )}

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
            <div>
              <span className="ai-badge">{result.by === 'claude' ? 'Claude · AI stylist' : 'Rules engine'}</span>
              <h3 className="h2" style={{ marginTop: 4 }}>Critique</h3>
            </div>
            <ScoreBadge score={result.overall} />
          </div>
          <div className="ai-bar">
            {ai.status === 'ready' ? (
              <>
                <button className="btn sm primary" onClick={askClaude} disabled={aiBusy}>{aiBusy ? 'Claude is styling…' : cached ? '↻ Ask Claude again' : '✦ Ask Claude for a critique'}</button>
                {cached && (
                  <div className="seg">
                    <button className={source === 'claude' ? 'on' : ''} onClick={() => setSource('claude')}>Claude</button>
                    <button className={source === 'rules' ? 'on' : ''} onClick={() => setSource('rules')}>Rules</button>
                  </div>
                )}
              </>
            ) : (
              <span className="tiny">{ai.status === 'checking' ? 'Connecting to Claude…' : 'Claude is not connected here, so the built-in rules engine is critiquing. See SETUP-CLAUDE.md.'}</span>
            )}
          </div>
          {aiBusy && <div className="loading-bar"><i /></div>}
          {aiErr && <p className="small" style={{ color: 'var(--warn)' }}>{aiErr}</p>}
          {result.verdict && <p className="verdict">“{result.verdict}”</p>}
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

          {result.tip && (
            <div className="swap">
              <div style={{ flex: 1 }}><span className="label">Claude's styling tip</span><p>{result.tip}</p></div>
            </div>
          )}

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
          <p className="tiny" style={{ marginTop: 12 }}>Claude's critique is grounded in Ava’s Choices’ measured facts (warmth, water resistance, formality), so it can add taste and nuance but not contradict the weather math. The swap tip and live score come from the rules engine.</p>
        </div>
      </div>
      {saving && <SaveModal defaultName={draft.name} onClose={() => setSaving(false)} onDone={(t) => { setSaving(false); toast(`Saved to “${t}”`); }} />}
    </div>
  );
}
