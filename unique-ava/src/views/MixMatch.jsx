import { useEffect, useState } from 'react';
import { useStore } from '../store.jsx';
import Stage from '../components/Stage.jsx';
import SaveModal from '../components/SaveModal.jsx';
import { ScoreBadge, useToast } from '../components/common.jsx';
import { parseContext, EXAMPLE_PROMPTS } from '../ai/context.js';
import { generateOutfits } from '../ai/generator.js';
import { critique } from '../ai/critic.js';
import { styleWithClaude } from '../ai/stylist.js';
import { useClaudeStatus } from '../ai/claude.js';
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
  const [by, setBy] = useState('rules');
  const [note, setNote] = useState('');
  const ai = useClaudeStatus();

  function rulesRun(p, c) {
    setResults(generateOutfits(pool, c, anchorId ? get(anchorId) : null).map((r) => ({ ...r, why: '' })));
    setBy('rules');
  }

  async function run(p = prompt, { useClaude = true } = {}) {
    setPrompt(p);
    setBusy(true); setNote('');
    let c = parseContext(p);
    setCtx(c);
    if (useClaude && ai.status === 'ready') {
      const r = await styleWithClaude(p, pool, anchorId ? get(anchorId) : null);
      if (r?.outfits) {
        if (r.context) c = { ...c, ...r.context, occasionLabel: r.context.occasionLabel || c.occasionLabel };
        setCtx(c);
        setResults(r.outfits.map((o, i) => ({
          persona: { id: 'claude-' + i, name: o.name, blurb: o.blurb },
          outfit: o.outfit,
          critique: critique(o.outfit, c),
          why: o.why,
        })));
        setBy('claude');
        setBusy(false);
        return;
      }
      if (r?.error) setNote(r.error);
    }
    rulesRun(p, c);
    setBusy(false);
  }
  // First paint: instant rules-engine results (Claude runs when you press "Style me").
  useEffect(() => { run(prompt, { useClaude: false }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
          <button className="btn primary" onClick={() => run()} disabled={busy}>{busy ? (ai.status === 'ready' ? 'Claude is styling…' : 'Styling…') : ai.status === 'ready' ? '✦ Style me with Claude' : 'Style me'}</button>
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
        <div>
          <h2 className="h2">Three ways to wear it</h2>
          <span className={by === 'claude' ? 'ai-badge' : 'tiny'}>{by === 'claude' ? 'Styled by Claude from your closet · scored by the rules engine' : ai.status === 'ready' ? 'Instant picks from the rules engine. Press “Style me with Claude” for AI picks.' : 'Picks from the built-in rules engine (Claude not connected here)'}</span>
          {note && <div className="small" style={{ color: 'var(--warn)' }}>{note}</div>}
        </div>
        <div className="seg">
          <button className={view === 'flatlay' ? 'on' : ''} onClick={() => setView('flatlay')}>Flat-lay</button>
          <button className={view === 'scene' ? 'on' : ''} onClick={() => setView('scene')}>In scene</button>
        </div>
      </div>

      {busy && <div className="loading-bar"><i /></div>}
      {busy && ai.status === 'ready' && <p className="small muted">Claude is reading your closet and the forecast. This usually takes 10–40 seconds.</p>}
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
                  {r.why && <p className="why">{r.why}</p>}
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
