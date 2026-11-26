// Realistic AI photos, made with the user's own Puter account (Puter's image models; the user covers the cost,
// usually from Puter's free monthly allowance). Every image made here is labelled as AI wherever it is shown, and it
// NEVER replaces a photo the user took: it is stored separately (garment.aiImage, outfit.aiLook).
import { loadPuter, puterError } from './claude.js';
import { CATEGORY_LABEL } from '../data/closet.js';

// Tried in order; only a missing/unsupported model moves on to the next one.
const MODELS = ['google/gemini-2.5-flash-image', 'black-forest-labs/flux-1.1-pro', 'black-forest-labs/flux-schnell'];

const colorWords = (item) => (item.colors || []).map((c) => c.name).filter(Boolean).join(' and ') || '';
const kindOf = (item) => item.art || item.subtype || CATEGORY_LABEL?.[item.category] || item.category || 'garment';

/** Words that describe one piece, from its saved details only. */
export function describePiece(item) {
  const bits = [colorWords(item), item.pattern && item.pattern !== 'solid' ? `${item.pattern} pattern` : '', item.material, kindOf(item)];
  return `${bits.filter(Boolean).join(' ')} ("${item.name}")`;
}

/** Product photo of a single piece, matching the look of the demo closet photos. */
export function piecePrompt(item) {
  const hex = (item.colors || []).map((c) => `${c.name}${c.hex ? ` (${c.hex})` : ''}`).join(' and ');
  return `${item.name}: ${hex || 'neutral'}${item.material ? `, ${item.material.toLowerCase()}` : ''}${item.fit ? `, ${item.fit} fit` : ''}`
    + `${item.pattern && item.pattern !== 'solid' ? `, ${item.pattern} pattern` : ''}, ${kindOf(item)}. `
    + 'Neatly laid flat, front view (or invisible ghost-mannequin style). Professional e-commerce product photograph, centered, '
    + 'seamless light gray (#F4F4F4) studio background, soft diffused lighting from the upper left, subtle natural contact shadow, '
    + 'true-to-life fabric texture and color, no person, no props, no text, no logos, portrait 4:5.';
}

/** A styled photo of a whole outfit. Neck-down, so it never pretends to be the user. */
export function outfitPrompt(pieces, { withReference } = {}) {
  const list = pieces.map(describePiece).join('; ');
  return 'Photorealistic full-length fashion photograph of an outfit worn by a model, framed from the neck down (no face), '
    + `standing naturally, plain warm light-gray studio background, soft daylight. The outfit is exactly: ${list}. `
    + (withReference ? 'The reference image shows these exact pieces: keep their colors, patterns and details as shown. ' : '')
    + 'Do not add other garments, bags or jewelry. No text, no logos.';
}

const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src; });

/** Shrink to a sensible size and save as WebP (a few dozen KB), so it syncs quickly. */
async function compress(src, max = 900) {
  let img;
  try { const b = await (await fetch(src)).blob(); img = await loadImg(URL.createObjectURL(b)); }
  catch { img = await loadImg(src); }
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/webp', 0.86);
}

/** One reference image with the pieces' own photos side by side (so the AI sees the real clothes). */
export async function referenceSheet(photos) {
  const list = photos.filter(Boolean).slice(0, 6);
  if (!list.length) return null;
  const cols = Math.min(3, list.length), rows = Math.ceil(list.length / cols), cw = 320, ch = 400;
  const c = document.createElement('canvas'); c.width = cols * cw; c.height = rows * ch;
  const x = c.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < list.length; i++) {
    try {
      const im = await loadImg(list[i]);
      const k = Math.min((cw - 20) / im.naturalWidth, (ch - 20) / im.naturalHeight);
      const w = im.naturalWidth * k, h = im.naturalHeight * k;
      x.drawImage(im, (i % cols) * cw + (cw - w) / 2, Math.floor(i / cols) * ch + (ch - h) / 2, w, h);
    } catch { /* skip a photo that won't load */ }
  }
  return c.toDataURL('image/jpeg', 0.85);
}

/**
 * Make an image. Returns { image (WebP data URL), model, usedReference }.
 * Errors carry .code: not_signed_in | rate_limited | upstream_error (see claude.js).
 */
export async function makeImage(prompt, { reference } = {}) {
  const puter = await loadPuter();
  if (!puter) throw Object.assign(new Error('Could not load Puter'), { code: 'upstream_error', serverMessage: 'The AI service (Puter) could not be reached.' });
  let signedIn = false;
  try { signedIn = await puter.auth.isSignedIn(); } catch { /* treat as signed out */ }
  if (!signedIn) throw Object.assign(new Error('Not signed in to Puter'), { code: 'not_signed_in' });
  let lastErr = null;
  for (const model of MODELS) {
    for (const ref of reference ? [reference, null] : [null]) { // if a model won't take the reference, try without it
      try {
        const el = await puter.ai.txt2img(prompt, { model, ...(ref ? { input_image: ref } : {}) });
        const src = el?.src || (typeof el === 'string' ? el : null);
        if (!src) throw Object.assign(new Error('No image came back'), { code: 'upstream_error' });
        return { image: await compress(src), model, usedReference: !!ref };
      } catch (e) {
        lastErr = puterError(e);
        if (lastErr.code === 'not_signed_in' || lastErr.code === 'rate_limited') throw lastErr;
        if (lastErr.code === 'bad_model') break; // next model
      }
    }
  }
  throw lastErr;
}
