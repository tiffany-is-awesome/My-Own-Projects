// Realistic AI photos (Puter). Always labelled as AI, never replace the user's own photos.
import { useEffect, useRef, useState } from 'react';
import { useClaudeStatus, puterSignIn } from '../ai/claude.js';
import { makeImage, piecePrompt, outfitPrompt, referenceSheet } from '../ai/imagine.js';
import { usePhotos } from '../data/photos.js';
import { useStore } from '../store.jsx';
import { useToast } from './common.jsx';

const SLOT_KEYS = ['outer', 'top', 'bottom', 'shoes', 'bag', 'accessory'];
export const lookKey = (pieces) => pieces.map((p) => p.id).sort().join('|');

function errorText(e) {
  if (e?.code === 'not_signed_in') return 'Sign in to Puter (free) to make AI photos.';
  if (e?.code === 'rate_limited') return e.serverMessage || 'Your free Puter allowance for AI images is used up for now.';
  return 'The AI couldn\'t make a photo just now. Try again in a moment.';
}

/** Handles Puter sign-in (from the click itself, so the pop-up is allowed) and errors. */
export function useAiMaker() {
  const ai = useClaudeStatus();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = async (job) => {
    if (busy) return null;
    try { if (ai.status !== 'ready') await puterSignIn(); }
    catch { toast('Sign in to Puter (free) to make AI photos.'); return null; }
    setBusy(true);
    try { return await job(); }
    catch (e) { toast(errorText(e)); return null; }
    finally { setBusy(false); }
  };
  return { busy, run, status: ai.status };
}

/** For one piece without a photo of its own: make / replace / remove its AI sample photo. */
export function PieceAiPhoto({ item }) {
  const { dispatch } = useStore();
  const photos = usePhotos();
  const { busy, run } = useAiMaker();
  if (item.image) return null; // her own photo always wins; nothing to make
  const slot = photos.garments[item.id];
  const make = () => run(async () => {
    const { image } = await makeImage(piecePrompt(item));
    dispatch({ type: 'UPDATE_GARMENT', garment: { id: item.id, aiImage: image } });
  });
  return (
    <div className="ai-piece">
      {busy ? <div className="ai-making" style={{ maxWidth: 220 }}>Making a realistic photo from this piece's details…</div> : null}
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
        <button className="btn sm" disabled={busy} onClick={make}>✦ {item.aiImage || slot ? 'Make a new AI photo' : 'Make a realistic AI photo'}</button>
        {item.aiImage && <button className="btn sm ghost" disabled={busy} onClick={() => dispatch({ type: 'UPDATE_GARMENT', garment: { id: item.id, aiImage: null } })}>Remove AI photo</button>}
      </div>
      <p className="tiny" style={{ marginTop: 6 }}>AI photos are made from this piece's details (name, colors, fabric) with Puter, so they show <i>a</i> piece like it, not your actual one. They're labelled "AI photo". Adding your own photo replaces it.</p>
    </div>
  );
}

/** "Make AI photos for the N pieces without a photo" (one at a time, can be stopped). */
export function BulkAiPhotos({ items }) {
  const { dispatch } = useStore();
  const photos = usePhotos();
  const { busy, run } = useAiMaker();
  const [done, setDone] = useState(0);
  const stop = useRef(false);
  const todo = items.filter((g) => !g.image && !g.aiImage && !photos.garments[g.id]);
  if (!todo.length && !busy) return null;
  const go = () => run(async () => {
    stop.current = false; setDone(0);
    for (const g of todo) {
      if (stop.current) break;
      const { image } = await makeImage(piecePrompt(g));
      dispatch({ type: 'UPDATE_GARMENT', garment: { id: g.id, aiImage: image } });
      setDone((n) => n + 1);
    }
  });
  return (
    <div className="ai-bulk tiny">
      {busy
        ? <>Making AI photos… {done} of {todo.length + done} <button className="btn sm ghost" onClick={() => { stop.current = true; }}>Stop</button></>
        : <><button className="btn sm" onClick={go}>✦ Make AI photos for {todo.length} piece{todo.length > 1 ? 's' : ''} without a photo</button> <span>Realistic sample photos from each piece's details, labelled "AI photo". Uses your Puter account.</span></>}
    </div>
  );
}

/** A realistic AI photo of a whole outfit. `pieces` = the outfit's garments; `outfitId` = saved outfit (keeps the photo). */
export function OutfitAiLook({ pieces, outfitId, saved }) {
  const { dispatch } = useStore();
  const photos = usePhotos();
  const { busy, run } = useAiMaker();
  const key = lookKey(pieces);
  const [local, setLocal] = useState(null);
  const look = (saved?.key === key && saved) || (local?.key === key && local) || null;
  // Made before she saved the outfit? Keep it with the saved outfit.
  useEffect(() => { if (outfitId && local?.key === key && !saved) dispatch({ type: 'SET_OUTFIT_LOOK', id: outfitId, look: local }); }, [outfitId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!pieces.length) return null;
  const make = () => run(async () => {
    const own = pieces.map((p) => p.image || null);
    const anyOwn = own.some(Boolean);
    const reference = anyOwn ? await referenceSheet(pieces.map((p) => p.image || photos.garments[p.id] || p.aiImage)) : null;
    const r = await makeImage(outfitPrompt(pieces, { withReference: !!reference }), { reference });
    const next = { key, image: r.image, usedReference: r.usedReference, at: Date.now() };
    setLocal(next);
    if (outfitId) dispatch({ type: 'SET_OUTFIT_LOOK', id: outfitId, look: next });
  });
  return (
    <div className="ai-look-wrap">
      {busy && <div className="ai-making">Making a realistic photo of this outfit… (about 10–30 seconds)</div>}
      {!busy && look && (
        <figure className="ai-look">
          <img src={look.image} alt="AI-made photo of this outfit" />
          <span className="ai-tag">✦ AI impression</span>
          <figcaption className="ai-look-note">
            Made by AI from {look.usedReference ? 'your photos and details' : 'the details'} of these pieces. Colors, patterns and fit can differ from your real clothes, and it isn't you.
          </figcaption>
        </figure>
      )}
      <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <button className="btn sm" disabled={busy} onClick={make}>✦ {look ? 'Another AI photo' : 'Realistic photo (AI)'}</button>
        {look && <button className="btn sm ghost" disabled={busy} onClick={() => { setLocal(null); if (outfitId) dispatch({ type: 'SET_OUTFIT_LOOK', id: outfitId, look: null }); }}>Remove</button>}
      </div>
    </div>
  );
}

export const outfitPieces = (resolved) => SLOT_KEYS.map((k) => resolved?.[k]).filter(Boolean);
