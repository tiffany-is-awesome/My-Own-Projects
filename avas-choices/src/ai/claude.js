// Claude connection layer. One interface, two transports, graceful fallback.
//   provider.json(prompt, { images?: Blob[], tier?: 'quick'|'default'|'complex' }) → parsed JSON
// See src/config.js for how each transport is switched on.
import { useEffect, useState } from 'react';
import { CONFIG } from '../config.js';

let providerPromise = null;
let disabledReason = null; // set when the viewer declines, so we stop asking

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

function fromProxy() {
  if (!CONFIG.AI_PROXY_URL) return null;
  return {
    name: 'Claude (Anthropic API)',
    images: true,
    async json(prompt, { images, tier = 'default', signal } = {}) {
      const imgs = [];
      for (const b of images || []) imgs.push({ media_type: b.type || 'image/png', data: await blobToBase64(b) });
      const res = await fetch(CONFIG.AI_PROXY_URL, {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          ...(CONFIG.SUPABASE_ANON_KEY ? { apikey: CONFIG.SUPABASE_ANON_KEY, Authorization: `Bearer ${CONFIG.SUPABASE_ANON_KEY}` } : {}),
        },
        body: JSON.stringify({ prompt, images: imgs, tier }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(body.error || `AI error ${res.status}`), { code: res.status === 429 ? 'rate_limited' : 'upstream_error' });
      return parseJsonLoose(body.text);
    },
  };
}

/** Resolves the best available provider, or null (→ rules engine). */
export function getClaude() {
  if (disabledReason) return Promise.resolve(null);
  if (!providerPromise) providerPromise = (async () => (await fromClaudeAi()) || fromProxy())();
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
    case 'not_granted': return 'Claude access was declined, so Ava’s Choices is using its built-in rules engine.';
    case 'rate_limited': return 'Claude is busy or your usage limit was reached. Try again in a moment.';
    case 'session_expired': return 'Please sign in to Claude again.';
    case 'image_rejected': return 'Claude could not read that image. Try another photo.';
    case 'invalid_json': return 'Claude answered in an unexpected format. Try again.';
    case 'cancelled': return '';
    default: return 'Claude could not be reached. Showing the built-in rules engine instead.';
  }
}

// ── tiny subscription so the header badge updates
const listeners = new Set();
const notify = () => listeners.forEach((f) => f());

/** React hook: { status: 'checking'|'ready'|'offline', name } */
export function useClaudeStatus() {
  const [s, setS] = useState({ status: 'checking', name: '' });
  useEffect(() => {
    let alive = true;
    const check = () => getClaude().then((p) => alive && setS(p ? { status: 'ready', name: p.name, images: p.images } : { status: 'offline', name: disabledReason ? 'declined' : '' }));
    check();
    listeners.add(check);
    return () => { alive = false; listeners.delete(check); };
  }, []);
  return s;
}
