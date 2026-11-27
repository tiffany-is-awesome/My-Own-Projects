// Demo pieces start as drawings. Once the visitor is signed in to AI (Puter), realistic photos are made for them
// automatically in the background, one at a time, with the visitor's own Puter account. Made once per browser:
// each photo is saved with the piece (labelled "AI photo"), so it isn't made again.
import { useEffect, useSyncExternalStore } from 'react';
import { useStore } from '../store.jsx';
import { useClaudeStatus, puterSignIn } from '../ai/claude.js';
import { makeImage, piecePrompt } from '../ai/imagine.js';
import { usePhotos } from '../data/photos.js';

const PREF = 'wearwise.autoDemoPhotos';
export const autoDemoOn = () => { try { return localStorage.getItem(PREF) !== 'off'; } catch { return true; } };
export function setAutoDemo(on) { try { localStorage.setItem(PREF, on ? 'on' : 'off'); } catch { /* private mode */ } emit({ ...st, pref: on, stopped: on ? null : 'off' }); }

// A tiny shared status, so the closet note and the progress pill show the same thing.
let st = { running: false, done: 0, total: 0, stopped: null, pref: autoDemoOn() }; // stopped: null | 'user' | 'limit' | 'off'
const subs = new Set();
function emit(next) { st = next; subs.forEach((f) => f()); }
export const useAutoDemo = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => st);
export const stopAutoDemo = () => emit({ ...st, stopped: 'user' });

const failed = new Set(); // pieces the AI couldn't do this session (not retried until next visit)
const made = new Set();   // pieces already done this session (the closet may not show it yet for a moment)

/** Mounted once in the app. Does the work; renders the small progress pill. */
export default function AutoDemoPhotos() {
  const { state, dispatch } = useStore();
  const ai = useClaudeStatus();
  const photos = usePhotos();
  const s = useAutoDemo();
  const todo = state.garments
    .filter((g) => g.demo && !g.image && !g.aiImage && !photos.garments[g.id] && !failed.has(g.id) && !made.has(g.id))
    .sort((a, b) => (a.ownerId === state.activeProfile ? 0 : 1) - (b.ownerId === state.activeProfile ? 0 : 1));
  const next = todo[0];

  useEffect(() => {
    if (ai.status !== 'ready' || !s.pref || s.stopped || !next || s.running) return;
    emit({ ...st, running: true, total: st.done + todo.length });
    (async () => {
      try {
        const { image } = await makeImage(piecePrompt(next));
        made.add(next.id);
        dispatch({ type: 'UPDATE_GARMENT', garment: { id: next.id, aiImage: image } }); // harmless if the piece was removed meanwhile
        emit({ ...st, running: false, done: st.done + 1 });
      } catch (e) {
        failed.add(next.id);
        emit({ ...st, running: false, stopped: e?.code === 'rate_limited' || e?.code === 'not_signed_in' ? 'limit' : st.stopped });
      }
    })();
  }, [ai.status, s.pref, s.stopped, s.running, next?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!s.running) return null;
  return (
    <div className="auto-pill" role="status">
      <span className="spinner" aria-hidden="true" /> Making realistic demo photos · {Math.min(s.done + 1, s.total)} of {s.total}
      <button onClick={stopAutoDemo}>Stop</button>
    </div>
  );
}

/** The line under the closet's demo note. */
export function DemoPhotoNote() {
  const { state } = useStore();
  const ai = useClaudeStatus();
  const photos = usePhotos();
  const s = useAutoDemo();
  const demo = state.garments.filter((g) => g.demo);
  const drawn = demo.filter((g) => !g.image && !g.aiImage && !photos.garments[g.id]).length;
  if (!demo.length) return null;
  if (!drawn) return <span className="tiny">Demo pieces show AI-made sample photos (labelled "AI photo").</span>;
  if (ai.status !== 'ready') {
    return (
      <span className="tiny">Demo pieces are shown as drawings. Turn on AI (a free Puter sign-in) and realistic photos are made for them automatically.{' '}
        <button className="linklike" onClick={() => puterSignIn().catch(() => {})}>Turn on AI</button>
      </span>
    );
  }
  if (!s.pref) return <span className="tiny">Realistic demo photos are switched off (Settings).</span>;
  if (s.stopped === 'limit') return <span className="tiny">Puter's free AI allowance ran out, so {drawn} demo piece{drawn > 1 ? 's stay drawings' : ' stays a drawing'} for now. They'll be made on a later visit.</span>;
  if (s.stopped === 'user') return <span className="tiny">Stopped. {drawn} demo piece{drawn > 1 ? 's are' : ' is'} still drawings. <button className="linklike" onClick={() => emit({ ...st, stopped: null })}>Continue</button></span>;
  return <span className="tiny">Making realistic photos for the demo pieces with your Puter account… ({drawn} to go)</span>;
}
