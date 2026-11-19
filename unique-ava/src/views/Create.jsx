// Create an Outfit: choose → get 3 outfits → compare → save.
import { useState } from 'react';
import { useStore } from '../store.jsx';
import { useToast } from '../components/common.jsx';
import GarmentArt from '../components/GarmentArt.jsx';
import { ContextPicker, OutfitCard, Compare, DEFAULT_CHOICE, contextOf, toSlots } from '../components/Choose.jsx';
import { styleWithAI } from '../ai/stylist.js';
import { isAvailable } from '../ai/generator.js';
import { useClaudeStatus } from '../ai/claude.js';
import { CATEGORY_LABEL } from '../data/closet.js';

export function MissingNotice({ missing, go, name }) {
  const { dispatch, hasDemo } = useStore();
  return (
    <div className="empty">
      <p className="h2" style={{ marginBottom: 8 }}>{name ? `${name}'s closet` : 'Your closet'} needs a few more pieces first.</p>
      <p className="small">To build a complete outfit, add at least: <b>{missing.join(', ')}</b>. Suggestions only ever use clothes that are really in the closet.</p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button className="btn primary" onClick={() => go('#/closet')}>Add clothes</button>
        {!hasDemo && <button className="btn" onClick={() => dispatch({ type: 'LOAD_DEMO' })}>Try the demo closet</button>}
      </div>
    </div>
  );
}

export default function Create({ go }) {
  const { state, dispatch, owned, profile } = useStore();
  const toast = useToast();
  const ai = useClaudeStatus();
  const [choice, setChoice] = useState(() => state.draft.choice || DEFAULT_CHOICE);
  const [anchorId, setAnchorId] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);       // { ctx, outfits, note, error, missing, unavailable }
  const [comparing, setComparing] = useState(false);
  const [saved, setSaved] = useState({});     // index → outfit id
  const child = profile.kind === 'child';

  const anchorChoices = owned.filter(isAvailable);
  const anchor = anchorChoices.find((g) => g.id === anchorId) || null;

  async function run() {
    const ctx = contextOf(choice);
    setBusy(true); setRes(null); setComparing(false); setSaved({});
    try {
      const r = await styleWithAI({ ctx, pool: owned, anchor });
      setRes({ ctx, ...r });
    } catch (e) {
      setRes({ ctx, outfits: [], error: 'Something went wrong while building outfits. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  function save(i, favorite = false) {
    const r = res.outfits[i];
    dispatch({ type: 'SAVE_OUTFIT', outfit: { name: r.name, slots: toSlots(r.outfit), context: res.ctx, stage: { mode: 'flatlay' }, favorite, why: r.why, source: r.source || 'rules' } });
    setSaved((s) => ({ ...s, [i]: true }));
    toast(favorite ? 'Saved as a favorite' : 'Saved to Saved Outfits');
  }

  function open(i) {
    const r = res.outfits[i];
    dispatch({ type: 'LOAD_DRAFT', draft: { slots: toSlots(r.outfit), name: r.name, context: res.ctx, choice } });
    go('#/builder');
  }

  const replace = (i, next) => setRes((x) => ({ ...x, outfits: x.outfits.map((o, k) => (k === i ? next : o)) }));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="label">{profile.name === 'Me' ? 'Your closet' : `${profile.name}'s closet`} · {owned.length} pieces</div>
          <h1 className="h1">Create an Outfit</h1>
        </div>
      </div>

      <div className="create-form">
        <ContextPicker value={choice} onChange={setChoice} />
        <div className="ctx-row"><span className="label">Wear this piece <span className="muted">(optional)</span></span>
          <div className="anchor-row">
            {anchor && <span className="mini" style={{ width: 40 }}><GarmentArt item={anchor} /></span>}
            <select className="select" value={anchorId} onChange={(e) => setAnchorId(e.target.value)} aria-label="Piece to include">
              <option value="">No, surprise me</option>
              {anchorChoices.map((g) => <option key={g.id} value={g.id}>{CATEGORY_LABEL[g.category]} · {g.name}</option>)}
            </select>
          </div></div>
        <div className="create-go">
          <button className="btn accent" onClick={run} disabled={busy}>{busy ? 'Styling…' : res ? 'Get 3 new outfits' : 'Get 3 outfits'}</button>
          <span className="tiny">
            {ai.status === 'ready' ? `${ai.name} picks the outfits; the rules engine checks every one (weather, formality, colors, fit) before you see it.`
              : ai.status === 'signin' ? 'Gemini is off until you sign in (top right). The rules engine builds the outfits meanwhile.'
              : 'The AI stylist is not connected here, so the rules engine builds the outfits.'}
          </span>
        </div>
      </div>

      {busy && <div className="loading-block"><div className="loading-bar"><i /></div><p className="small muted">Looking through {owned.filter(isAvailable).length} available pieces…</p></div>}

      {res && !busy && (
        <>
          {res.missing?.length > 0 && <MissingNotice missing={res.missing} go={go} name={profile.name === 'Me' ? '' : profile.name} />}
          {res.unavailable && <div className="notice">The {res.unavailable.name} isn't available right now (marked as {res.unavailable.status}). Pick another piece, or mark it available in the closet.</div>}
          {res.error && <div className="notice warn">{res.error}</div>}
          {res.note && <div className="notice">{res.note}</div>}
          {res.outfits.length > 0 && (
            <>
              <div className="results-head">
                <div className="small">{res.ctx.prompt} · {res.ctx.tempC}°C{res.ctx.rain >= 0.6 ? ' · rain' : ''}</div>
                {res.outfits.length > 1 && !comparing && <button className="btn sm" onClick={() => setComparing(!comparing)}>{comparing ? 'Back to cards' : `Compare ${res.outfits.length} side by side`}</button>}
              </div>
              {comparing ? (
                <Compare results={res.outfits} ctx={res.ctx} child={child} onClose={() => setComparing(false)}
                  savedIdx={Object.keys(saved).map(Number)} onPick={(i) => save(i, true)} />
              ) : (
                <div className="outfit-grid">
                  {res.outfits.map((r, i) => (
                    <OutfitCard key={i} index={i} result={r} ctx={res.ctx} pool={owned} child={child} saved={!!saved[i]}
                      onReplace={(n) => { replace(i, n); setSaved((s) => { const x = { ...s }; delete x[i]; return x; }); }}
                      onSave={() => save(i)} onOpen={() => open(i)} />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
