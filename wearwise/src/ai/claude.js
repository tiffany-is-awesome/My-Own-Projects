// Claude connection layer. One interface, two transports, graceful fallback.
//   provider.json(prompt, { images?: Blob[], tier?: 'quick'|'default'|'complex' }) → parsed JSON
// See src/config.js for how each transport is switched on.
import { useEffect, useState } from 'react';
import { CONFIG } from '../config.js';
import { getAccessToken, onAuthChange } from '../auth.jsx';

let providerPromise = null;
let disabledReason = null; // set when the viewer declines, so we stop asking
let notSetUp = false;      // the Supabase function answered "no AI key yet"

/** Tolerant JSON parse: whole text, a ```fence```, or first {/[ … last }/]. */
export function parseJsonLoose(text) {
  const t = String(text || '').trim();
  try { return JSON.parse(t); } catch { /* keep trying */ }
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) { try { return JSON.parse(fence[1]); } catch { /* keep trying */ } }
  const start = t.search(/[[{]/);
  const end = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  if (start >= 0 && end > start) return JSON.parse(t.slice(start, end + 1));
  throw Object.assign(new Error('Claude did not return JSON'), { code: 'invalid_json' });
}

async function blobToBase64(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

async function fromClaudeAi() {
  if (typeof window === 'undefined' || !window.claude?.use) return null;
  const sample = await window.claude.use('sample').catch(() => null);
  if (!sample) return null;
  const limits = await sample.limits().catch(() => null);
  return {
    name: 'Claude (your claude.ai account)',
    images: !!limits?.images,
    async json(prompt, { images, tier = 'default', signal } = {}) {
      const opts = { modelTier: tier };
      if (signal) opts.signal = signal;
      if (images?.length && limits?.images) opts.images = images;
      return sample.json(prompt, opts);
    },
  };
}

// ── Gemini through Puter.js: no API key anywhere. The user signs in to a free Puter
// account (a popup the first time) and her AI use runs on her own Puter allowance.
const PUTER_SRC = 'https://js.puter.com/v2/';
const PUTER_MODELS = {
  default: ['google/gemini-3.5-flash', 'google/gemini-2.5-flash'],
  quick: ['google/gemini-3.5-flash-lite', 'google/gemini-3.5-flash', 'google/gemini-2.5-flash'],
};
let puterPromise = null;
export function loadPuter() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.puter) return Promise.resolve(window.puter);
  if (!puterPromise) {
    puterPromise = new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = PUTER_SRC;
      s.async = true;
      s.onload = () => resolve(window.puter || null);
      s.onerror = () => resolve(null);
      document.head.appendChild(s);
      setTimeout(() => resolve(window.puter || null), 15000);
    }).then((p) => { if (!p) puterPromise = null; return p; });
  }
  return puterPromise;
}

const blobToDataUrl = (b) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });

function textOf(r) {
  if (r == null) return '';
  if (typeof r === 'string') return r;
  const c = r.message?.content ?? r.content ?? r.text;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.map((p) => (typeof p === 'string' ? p : p?.text || '')).join('');
  return String(r);
}

export function puterError(e) {
  const msg = String(e?.error?.message || e?.message || e?.error || e || '');
  const code = String(e?.error?.code || e?.code || '');
  if (/insufficient|funds|credit|allowance|quota|limit/i.test(msg + code)) return Object.assign(new Error(msg), { code: 'rate_limited', serverMessage: 'Your free AI allowance on Puter is used up for now. It refreshes monthly, or you can top up on puter.com.' });
  if (/auth|sign.?in|log.?in|cancel|closed|denied|401/i.test(msg + code)) return Object.assign(new Error(msg), { code: 'not_signed_in' });
  if (/model/i.test(msg) && /not|unknown|unsupported|invalid/i.test(msg)) return Object.assign(new Error(msg), { code: 'bad_model' });
  return Object.assign(new Error(msg || 'Puter error'), { code: 'upstream_error' });
}

function fromPuter() {
  if (typeof window === 'undefined') return null;
  return {
    name: 'Gemini',
    via: 'puter',
    images: true,
    async json(prompt, { images, tier = 'default' } = {}) {
      const puter = await loadPuter();
      if (!puter) throw Object.assign(new Error('Could not load Puter'), { code: 'upstream_error', serverMessage: 'The AI service (Puter) could not be reached.' });
      // Never let a background request pop up Puter's dialog: sign-in only happens when she clicks "Sign in".
      let signedIn = false;
      try { signedIn = await puter.auth.isSignedIn(); } catch { /* treat as signed out */ }
      if (!signedIn) throw Object.assign(new Error('Not signed in to Puter'), { code: 'not_signed_in' });
      const img = images?.[0] || null;
      const dataUrl = img ? await blobToDataUrl(img) : null;
      let lastErr = null;
      for (const model of PUTER_MODELS[tier] || PUTER_MODELS.default) {
        try {
          let r;
          if (!img) r = await puter.ai.chat(prompt, { model });
          else {
            try { r = await puter.ai.chat(prompt, dataUrl, { model }); }
            catch (e) {
              const pe = puterError(e);
              if (pe.code === 'not_signed_in' || pe.code === 'rate_limited' || pe.code === 'bad_model') throw e;
              // Fallback: put the cut-out in the user's own Puter storage and send it from there.
              const ext = (img.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
              const file = await puter.fs.write(`wearwise/ai-${Date.now()}.${ext}`, img, { createMissingParents: true });
              r = await puter.ai.chat([{ role: 'user', content: [{ type: 'file', puter_path: file.path }, { type: 'text', text: prompt }] }], { model });
              puter.fs.delete(file.path).catch(() => {});
            }
          }
          if (r && r.success === false) throw r;
          const text = textOf(r);
          if (!text.trim()) throw Object.assign(new Error('Empty answer'), { code: 'upstream_error' });
          return parseJsonLoose(text);
        } catch (e) {
          lastErr = e?.code === 'invalid_json' ? e : puterError(e);
          if (lastErr.code !== 'bad_model') throw lastErr; // only a missing model is worth trying the next one
        }
      }
      throw lastErr;
    },
  };
}

/** Puter sign-in state, for the header badge. */
export async function puterUser() {
  if (!window.puter) return null;
  try { return (await window.puter.auth.isSignedIn()) ? await window.puter.auth.getUser() : null; } catch { return null; }
}
/** Must be called straight from a click (it opens Puter's sign-in pop-up). */
export function puterSignIn() {
  if (!window.puter?.auth?.signIn) return Promise.reject(new Error('Puter is still loading'));
  return window.puter.auth.signIn().then((u) => { notify(); return u; });
}
export function puterSignOut() { try { window.puter?.auth?.signOut(); } catch { /* ignore */ } notify(); }

// Optional backup: the unique-ava-ai Supabase function (needs a key on the server; off by default).
async function fromProxy() {
  if (!CONFIG.AI_PROXY_URL) return null;
  let status = null;
  try {
    const r = await fetch(CONFIG.AI_PROXY_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CONFIG.SUPABASE_ANON_KEY }, body: JSON.stringify({ task: 'status' }) });
    status = r.ok ? await r.json() : null;
  } catch { status = null; }
  if (!status) return null;                       // unreachable (e.g. inside the claude.ai preview)
  if (!status.ready) { notSetUp = true; return null; } // reachable, but no AI key added yet
  return {
    name: status.provider || 'Gemini',
    images: true,
    needsLogin: true,
    async json(prompt, { images, tier = 'default', signal } = {}) {
      const token = getAccessToken();
      if (!token) throw Object.assign(new Error('Sign in to use the AI stylist'), { code: 'not_signed_in' });
      const imgs = [];
      for (const b of images || []) imgs.push({ media_type: b.type || 'image/png', data: await blobToBase64(b) });
      const res = await fetch(CONFIG.AI_PROXY_URL, {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          apikey: CONFIG.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt, images: imgs, tier }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(body.error || `AI error ${res.status}`), { code: res.status === 429 ? 'rate_limited' : res.status === 401 ? 'not_signed_in' : 'upstream_error', serverMessage: body.error });
      return parseJsonLoose(body.text);
    },
  };
}

/** Tests only: force a provider (undefined = back to normal detection). */
export function __setProviderForTests(p) { providerPromise = p === undefined ? null : Promise.resolve(p); }

/** Resolves the best available provider, or null (→ rules engine). */
export function getClaude() {
  if (disabledReason) return Promise.resolve(null);
  // Live site: Gemini through Puter (no key). Inside the claude.ai preview, which blocks outside
  // scripts, Claude stands in.
  const inClaudeFrame = typeof window !== 'undefined' && !!window.claude && window.top !== window;
  if (!providerPromise) providerPromise = (async () => (inClaudeFrame ? await fromClaudeAi() : null) || (await fromProxy()) || fromPuter())();
  return providerPromise;
}

/** Call when a request fails, so the UI can fall back and stop asking if it's permanent. */
export function noteFailure(e) {
  const permanent = ['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'];
  if (permanent.includes(e?.code)) { disabledReason = e.code; providerPromise = Promise.resolve(null); notify(); }
  return friendlyError(e);
}

export function friendlyError(e) {
  switch (e?.code) {
    case 'not_granted': return 'AI access was declined, so Wearwise is using its built-in rules engine.';
    case 'rate_limited': return e.serverMessage || 'The AI is busy or the daily limit was reached. Try again later.';
    case 'session_expired': return 'Please sign in again.';
    case 'image_rejected': return 'The AI could not read that image. Try another photo.';
    case 'invalid_json': return 'The AI answered in an unexpected format. Try again.';
    case 'cancelled': return '';
    case 'not_signed_in': return 'Gemini is off because you\'re not signed in to Puter (free). These outfits come from the built-in rules engine.';
    default: return (e?.serverMessage ? e.serverMessage + ' ' : '') + 'Showing the built-in rules engine instead.';
  }
}

// ── tiny subscription so the header badge updates
const listeners = new Set();
const notify = () => listeners.forEach((f) => f());
onAuthChange(() => notify()); // proxy availability depends on being signed in

/** React hook: { status: 'checking'|'ready'|'offline', name } */
export function useClaudeStatus() {
  const [s, setS] = useState({ status: 'checking', name: '' });
  useEffect(() => {
    let alive = true;
    const check = () => getClaude().then((p) => {
      if (!alive) return;
      if (p && p.needsLogin && !getAccessToken()) setS({ status: 'signin', name: p.name });
      else if (p?.via === 'puter') {
        setS({ status: 'checking', name: p.name, via: 'puter', images: true });
        loadPuter().then(async (pt) => {
          let ok = false;
          try { ok = !!pt && (await pt.auth.isSignedIn()); } catch { /* signed out */ }
          if (alive) setS(pt ? { status: ok ? 'ready' : 'signin', name: p.name, images: true, via: 'puter' } : { status: 'offline', name: '' });
        });
      } else setS(p ? { status: 'ready', name: p.name, images: p.images, via: p.via } : { status: notSetUp ? 'notsetup' : 'offline', name: disabledReason ? 'declined' : '' });
      if (p?.via === 'puter') loadPuter(); // warm up in the background so sign-in is instant
    });
    check();
    listeners.add(check);
    return () => { alive = false; listeners.delete(check); };
  }, []);
  return s;
}
