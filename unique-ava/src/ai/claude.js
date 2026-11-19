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

// The Supabase function (Gemini). Users never need a key: they just sign in.
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

/** Resolves the best available provider, or null (→ rules engine). */
export function getClaude() {
  if (disabledReason) return Promise.resolve(null);
  // Live site: Gemini through Supabase. Inside the claude.ai preview (which can't reach Supabase): Claude.
  if (!providerPromise) providerPromise = (async () => (await fromProxy()) || (await fromClaudeAi()))();
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
    case 'not_granted': return 'AI access was declined, so Unique Ava is using its built-in rules engine.';
    case 'rate_limited': return e.serverMessage || 'The AI is busy or the daily limit was reached. Try again later.';
    case 'session_expired': return 'Please sign in again.';
    case 'image_rejected': return 'The AI could not read that image. Try another photo.';
    case 'invalid_json': return 'The AI answered in an unexpected format. Try again.';
    case 'cancelled': return '';
    case 'not_signed_in': return 'Sign in (top right) to use the AI stylist. Until then, the built-in rules engine answers.';
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
      else setS(p ? { status: 'ready', name: p.name, images: p.images } : { status: notSetUp ? 'notsetup' : 'offline', name: disabledReason ? 'declined' : '' });
    });
    check();
    listeners.add(check);
    return () => { alive = false; listeners.delete(check); };
  }, []);
  return s;
}
