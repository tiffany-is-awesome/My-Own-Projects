import { useMemo, useRef, useState } from 'react';
import { useStore } from '../store.jsx';
import Stage from '../components/Stage.jsx';
import GarmentArt from '../components/GarmentArt.jsx';
import SaveModal from '../components/SaveModal.jsx';
import { Meter, ScoreBadge, Verdict, useToast } from '../components/common.jsx';
import { critique, isDress } from '../ai/critic.js';
import { critiqueWithClaude } from '../ai/stylist.js';
import { useClaudeStatus } from '../ai/claude.js';
import { alternatives, isAvailable } from '../ai/generator.js';
import { SCENES } from '../data/scenes.jsx';
import { SLOTS, SLOT_LABEL, slotOf } from '../data/closet.js';
import { ContextPicker, DEFAULT_CHOICE, contextOf, toSlots } from '../components/Choose.jsx';

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export default function DressingRoom({ go }) {
  const { state, dispatch, resolve, pool, profile } = useStore();
  const child = profile.kind === 'child';
  const toast = useToast();
  const { draft } = state;
  const outfit = useMemo(() => resolve(draft.slots), [draft.slots, resolve]);
  const ctx = draft.context;
  const [openSlot, setOpenSlot] = useState(null);
  const [open, setOpen] = useState({ proportions: true, fabric: true, color: true, occasion: true, finish: true });
  const [choice, setChoice] = useState(draft.choice || DEFAULT_CHOICE);
  const [saving, setSaving] = useState(false);
  const [showCtx, setShowCtx] = useState(false);
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
    else setAiErr(r?.error || 'The AI stylist is not available here, so the rules engine critique is shown.');
  }
  const complete = !!(outfit.top && (outfit.bottom || isDress(outfit.top)) && outfit.shoes);
  const alts = useMemo(() => (complete ? alternatives(outfit, ctx, pool).slice(0, 5) : []), [complete, outfit, ctx, pool]);
  const stage = draft.stage;

  const choices = openSlot ? pool.filter((g) => slotOf(g) === openSlot) : [];
  const pick = (slot, g) => dispatch({ type: 'SET_SLOT', slot, id: g?.id || null, isDress: isDress(g), topIsDress: isDress(outfit.top) });

  function applyChoice(c) {
    setChoice(c);
    dispatch({ type: 'SET_CONTEXT', context: contextOf(c), choice: c });
  }
  function saveOutfit() {
    dispatch({ type: 'SAVE_OUTFIT', name: draft.name || 'Untitled look' });
    toast('Saved to Saved Outfits');
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
            child={child}
            caption={stage.mode === 'scene' && !stage.customBg ? 'Illustrated backdrop · not a photo' : stage.mode === 'mannequin' ? (child ? "Child's mannequin" : 'Studio mannequin') : null} />
          {(stage.mode === 'mannequin' || stage.mode === 'scene') && <p className="tiny" style={{ marginTop: 6 }}>Illustrated preview. Colors are taken from each item; uploaded photos are shown as they are, never recolored.</p>}

          {stage.mode === 'person' && (
            <div className="context-box" style={{ marginTop: 12, alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="small muted">Use a full-length photo of yourself, or a model you'd like to dress like. It stays on this device.{!stage.personPhoto ? ' Until then, the default model photo (if one is set) is shown.' : ''}</span>
              <label className="btn sm primary" style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>{stage.personPhoto ? 'Change photo' : 'Add a photo'}
                <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => dispatch({ type: 'SET_STAGE', stage: { personPhoto: r.result } }); r.readAsDataURL(f); }} />
              </label>
            </div>
          )}

          {stage.mode === 'scene' && (
            <>
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
                <span className="label">{s === 'top' && isDress(outfit.top) ? 'Dress' : SLOT_LABEL[s]}</span>
              </button>
            ))}
          </div>

          {openSlot && (
            <div className="picker">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 10 }}>
                <span className="label">Choose {SLOT_LABEL[openSlot].toLowerCase()}</span>
                <span className="tiny">{choices.length} in this closet</span>
              </div>
              <div className="picker-grid">
                <button className={'pick' + (!outfit[openSlot] ? ' on' : '')} onClick={() => pick(openSlot, null)}>
                  <div className="pick-art"><span className="slot-empty">∅</span></div><span>None</span>
                </button>
                {choices.map((g) => (
                  <button key={g.id} className={'pick' + (outfit[openSlot]?.id === g.id ? ' on' : '') + (isAvailable(g) ? '' : ' unavailable')} onClick={() => pick(openSlot, g)}>
                    <div className="pick-art"><GarmentArt item={g} /></div>
                    {!isAvailable(g) && <span className="basic-tag">{g.status}</span>}
                    <span>{g.name}</span>
                  </button>
                ))}
              </div>
              {choices.length === 0 && <p className="tiny">Nothing in this closet for this slot yet. <a href="#/closet">Add some</a>.</p>}
            </div>
          )}
        </div>

        {/* ───────── RIGHT: stylist spec sheet ───────── */}
        <div>
          <div className="label">Outfit builder{profile.name !== 'Me' ? ` · ${profile.name}` : ''}</div>
          <div className="spec-title">
            <input value={draft.name} placeholder="Untitled look" onChange={(e) => dispatch({ type: 'SET_NAME', name: e.target.value })} aria-label="Look name" />
          </div>

          <div className="rows">
            <div className="row"><span className="label">For</span>
              <div>
                <button className="btn sm" onClick={() => setShowCtx(!showCtx)} aria-expanded={showCtx}>{ctx.prompt} · change</button>
                {showCtx && <div style={{ marginTop: 10 }}><ContextPicker value={choice} onChange={applyChoice} compact /></div>}
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
              <span className="ai-badge">{result.by === 'claude' ? `AI stylist · ${result.provider || ai.name || 'AI'}` : 'Rules engine'}</span>
              <h3 className="h2" style={{ marginTop: 4 }}>Critique</h3>
            </div>
            <ScoreBadge score={result.overall} />
          </div>
          {complete ? <Verdict critique={result} /> : <p className="small muted">Add a top and bottom (or a dress) and shoes for an honest verdict.</p>}
          <div className="ai-bar">
            {ai.status === 'ready' ? (
              <>
                <button className="btn sm primary" onClick={askClaude} disabled={aiBusy}>{aiBusy ? 'The AI stylist is thinking…' : cached ? '↻ Ask the AI stylist again' : '✦ Ask the AI stylist'}</button>
                {cached && (
                  <div className="seg">
                    <button className={source === 'claude' ? 'on' : ''} onClick={() => setSource('claude')}>AI stylist</button>
                    <button className={source === 'rules' ? 'on' : ''} onClick={() => setSource('rules')}>Rules</button>
                  </div>
                )}
              </>
            ) : (
              <span className="tiny">{ai.status === 'checking' ? 'Connecting to the AI stylist…' : ai.status === 'signin' ? 'Sign in (top right) to get the AI stylist\'s critique. Until then, the rules engine is critiquing.' : (ai.status === 'notsetup' ? 'The AI stylist isn\'t switched on yet, so the built-in rules engine is critiquing.' : 'The AI stylist is not connected here, so the built-in rules engine is critiquing.')}</span>
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
              <div style={{ flex: 1 }}><span className="label">Stylist's tip</span><p>{result.tip}</p></div>
            </div>
          )}

          {!complete && <p className="small muted" style={{ marginTop: 14 }}>Add a top and bottom (or a dress) and shoes to get alternatives.</p>}
          {complete && (() => {
            const best = alts.filter((a) => a.delta > 0).sort((a, b) => b.delta - a.delta)[0];
            return best ? (
              <button className="improve-btn" onClick={() => { dispatch({ type: 'LOAD_DRAFT', draft: { slots: toSlots(best.outfit) } }); toast(`Improved: ${best.label.toLowerCase()} (+${best.delta})`); }}>
                <span className="spark" aria-hidden="true">✦</span>
                <span><b>Improve this outfit</b><span className="tiny">{best.label} · +{best.delta} points</span></span>
              </button>
            ) : <p className="tiny improve-done">✓ This is already the strongest version of this outfit from your closet. The ideas below change the mood instead.</p>;
          })()}
          {alts.length > 0 && (
            <div className="alts builder-alts">
              <span className="label">Other ideas (from this closet)</span>
              {alts.map((a) => (
                <button key={a.id} className="alt" onClick={() => { dispatch({ type: 'LOAD_DRAFT', draft: { slots: toSlots(a.outfit) } }); toast(a.label); }}>
                  <span>{a.label}</span>
                  <span className={'tiny ' + (a.delta >= 0 ? 'up' : 'down')}>{a.score} ({a.delta >= 0 ? '+' : ''}{a.delta})</span>
                </button>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 24, flexWrap: 'wrap' }}>
            <button className="btn accent" style={{ flex: 1 }} onClick={saveOutfit} disabled={!complete}>♡ Save outfit</button>
            <button className="btn" onClick={() => setSaving(true)} disabled={!complete}>Add to lookbook</button>
            <button className="btn" disabled={!complete} onClick={() => { dispatch({ type: 'LOG_WEAR', entry: { slots: draft.slots, context: ctx } }); toast('Added to Outfit History'); }}>I wore this</button>
            <button className="btn ghost" onClick={() => go('#/create')}>Create an Outfit</button>
          </div>
          <p className="tiny" style={{ marginTop: 12 }}>The AI stylist's critique is grounded in Wearwise’s measured facts (warmth, water resistance, formality), so it can add taste and nuance but not contradict the weather math. The alternatives and live score come from the rules engine. AI requests go to Google Gemini through Puter, only after you sign in with the Gemini button at the top (free, no key).</p>
        </div>
      </div>
      {saving && <SaveModal defaultName={draft.name} onClose={() => setSaving(false)} onDone={(t) => { setSaving(false); toast(`Saved to “${t}”`); }} />}
    </div>
  );
}
