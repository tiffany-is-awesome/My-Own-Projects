// Closet onboarding pipeline (prototype).
//  REAL, on-device: resize, simple background removal (border flood-fill), dominant color.
//  MOCK: semantic tags (category, material, warmth…), inferred from filename + shape.
// Production swaps in @imgly/background-removal + the unique-ava-ai "tag" Edge Function.

import { nearestNamedColor, rgbToHex } from './color.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = reject;
    img.src = url;
  });
}

/** Flood-fill from the borders, clearing pixels close to the background color. */
function removeBackground(ctx, w, h, tolerance = 42) {
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  // background reference = average of the border pixels
  let r = 0, g = 0, b = 0, n = 0;
  const sample = (x, y) => { const i = (y * w + x) * 4; r += px[i]; g += px[i + 1]; b += px[i + 2]; n++; };
  for (let x = 0; x < w; x += 2) { sample(x, 0); sample(x, h - 1); }
  for (let y = 0; y < h; y += 2) { sample(0, y); sample(w - 1, y); }
  const bg = [r / n, g / n, b / n];

  const seen = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  const tol2 = tolerance * tolerance * 3;
  while (stack.length) {
    const p = stack.pop();
    if (seen[p]) continue;
    seen[p] = 1;
    const i = p * 4;
    const d = (px[i] - bg[0]) ** 2 + (px[i + 1] - bg[1]) ** 2 + (px[i + 2] - bg[2]) ** 2;
    if (d > tol2) continue;
    px[i + 3] = 0;
    const x = p % w, y = (p / w) | 0;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - w);
    if (y < h - 1) stack.push(p + w);
  }
  ctx.putImageData(data, 0, 0);
  return data;
}

/**
 * Clean up the cut-out without touching the garment's own pixels:
 *  - keep only the largest connected piece (drops crumbs, lint, bits of the background),
 *  - crop to the garment with a small margin, so it fills its box in the flat-lay and mannequin,
 *  - if the cut-out looks wrong (almost nothing or almost everything removed), keep the original photo instead.
 * Returns { canvas, data, cut: 'clean' | 'kept-original', aspect }.
 */
export function refineCutout(canvas, original) {
  const w = canvas.width, h = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const N = w * h;
  const label = new Int32Array(N).fill(-1);
  let best = -1, bestSize = 0, comp = 0;
  const stack = [];
  for (let p0 = 0; p0 < N; p0++) {
    if (label[p0] !== -1 || px[p0 * 4 + 3] === 0) continue;
    let size = 0; stack.push(p0); label[p0] = comp;
    while (stack.length) {
      const p = stack.pop(); size++;
      const x = p % w, y = (p / w) | 0;
      const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (const q of nb) if (q >= 0 && label[q] === -1 && px[q * 4 + 3] !== 0) { label[q] = comp; stack.push(q); }
    }
    if (size > bestSize) { bestSize = size; best = comp; }
    comp++;
  }
  const coverage = bestSize / N;
  if (best < 0 || coverage < 0.015 || coverage > 0.97) {
    // The cut-out failed (garment too close to the background color, or touching every edge). Never lose the garment.
    ctx.putImageData(original, 0, 0);
    return { canvas, data: original, cut: 'kept-original', aspect: h / w };
  }
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let p = 0; p < N; p++) {
    if (label[p] === best) { const x = p % w, y = (p / w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    else px[p * 4 + 3] = 0;
  }
  ctx.putImageData(data, 0, 0);
  const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.03);
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  const out = document.createElement('canvas');
  out.width = cw; out.height = ch;
  const octx = out.getContext('2d', { willReadFrequently: true });
  octx.drawImage(canvas, x0, y0, cw, ch, 0, 0, cw, ch);
  return { canvas: out, data: octx.getImageData(0, 0, cw, ch), cut: 'clean', aspect: ch / cw };
}

/** Dominant color of the opaque pixels (tiny k-means, k=3). */
function dominantColor(data) {
  const px = data.data, pts = [];
  for (let i = 0; i < px.length; i += 16) if (px[i + 3] > 200) pts.push([px[i], px[i + 1], px[i + 2]]);
  if (!pts.length) return [128, 128, 128];
  let centers = [pts[0], pts[(pts.length / 2) | 0], pts[pts.length - 1]].map((c) => [...c]);
  let counts = [0, 0, 0];
  for (let iter = 0; iter < 8; iter++) {
    const sums = centers.map(() => [0, 0, 0]);
    counts = [0, 0, 0];
    for (const p of pts) {
      let bi = 0, bd = Infinity;
      centers.forEach((c, k) => { const d = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2 + (c[2] - p[2]) ** 2; if (d < bd) { bd = d; bi = k; } });
      counts[bi]++; sums[bi][0] += p[0]; sums[bi][1] += p[1]; sums[bi][2] += p[2];
    }
    centers = centers.map((c, k) => (counts[k] ? sums[k].map((v) => v / counts[k]) : c));
  }
  return centers[counts.indexOf(Math.max(...counts))];
}

const KEYWORDS = [
  { re: /tee|t-shirt|tshirt/, category: 'top', art: 'tee', material: 'Cotton jersey', weight: 'light', warmth: 1, formality: 1 },
  { re: /turtle/, category: 'top', art: 'turtleneck', material: 'Knit', weight: 'mid', warmth: 3, formality: 3 },
  { re: /shirt|blouse|oxford/, category: 'top', art: 'shirt', material: 'Cotton', weight: 'light', warmth: 2, formality: 3 },
  { re: /sweater|knit|jumper|cardigan|hoodie|sweat/, category: 'top', art: 'knit', material: 'Knit', weight: 'mid', warmth: 3, formality: 2 },
  { re: /jean|denim/, category: 'bottom', art: 'jeans', material: 'Denim', weight: 'mid', warmth: 2, formality: 2 },
  { re: /short/, category: 'bottom', art: 'shorts', material: 'Cotton', weight: 'light', warmth: 1, formality: 1 },
  { re: /skirt/, category: 'bottom', art: 'skirt', material: 'Woven', weight: 'light', warmth: 1, formality: 3 },
  { re: /pant|trouser|chino|slack/, category: 'bottom', art: 'trousers', material: 'Cotton twill', weight: 'mid', warmth: 2, formality: 3 },
  { re: /trench|mac|raincoat/, category: 'outer', art: 'trench', material: 'Cotton gabardine', weight: 'mid', warmth: 2, formality: 4, water: 4, length: 'long' },
  { re: /blazer|suit/, category: 'outer', art: 'blazer', material: 'Wool blend', weight: 'mid', warmth: 2, formality: 4, length: 'hip' },
  { re: /coat/, category: 'outer', art: 'coat', material: 'Wool blend', weight: 'heavy', warmth: 4, formality: 4, length: 'long' },
  { re: /jacket|puffer|parka/, category: 'outer', art: 'jacket', material: 'Nylon', weight: 'mid', warmth: 3, formality: 2, length: 'hip' },
  { re: /sneaker|trainer|runner/, category: 'shoes', art: 'sneaker', material: 'Leather', weight: 'mid', warmth: 2, formality: 2, profile: 'sleek' },
  { re: /boot/, category: 'shoes', art: 'boot', material: 'Leather', weight: 'heavy', warmth: 3, formality: 3, water: 4, profile: 'chunky' },
  { re: /loafer|oxford shoe|heel|flat/, category: 'shoes', art: 'loafer', material: 'Leather', weight: 'mid', warmth: 2, formality: 4, profile: 'sleek' },
  { re: /sandal|slide/, category: 'shoes', art: 'sandal', material: 'Leather', weight: 'light', warmth: 1, formality: 1, profile: 'sleek' },
  { re: /bag|tote|purse/, category: 'accessory', art: 'tote', material: 'Canvas', weight: 'mid', warmth: 0, formality: 2 },
  { re: /scarf/, category: 'accessory', art: 'scarf', material: 'Knit', weight: 'mid', warmth: 1, formality: 2 },
];

/** Rough silhouette reading of the cut-out: two legs → trousers, wide shoulders/sleeves → top. */
export function shapeHint(data) {
  const { width: w, height: h, data: px } = data;
  const runsAt = (fy) => {
    const y = Math.min(h - 1, Math.round(h * fy));
    let runs = 0, inRun = false, filled = 0;
    for (let x = 0; x < w; x++) {
      const on = px[(y * w + x) * 4 + 3] > 0;
      if (on) filled++;
      if (on && !inRun) runs++;
      inRun = on;
    }
    return { runs, fill: filled / w };
  };
  const low = [0.8, 0.88, 0.94].map(runsAt);
  const high = runsAt(0.22), mid = runsAt(0.5);
  if (low.filter((r) => r.runs >= 2).length >= 2 && high.runs === 1 && high.fill > 0.5) return 'legs';
  if (mid.runs >= 3 || runsAt(0.4).runs >= 3 || (high.fill >= 0.85 && mid.fill < high.fill)) return 'sleeves';
  return null;
}

function guessFromShape(aspect, shape) {
  if (shape === 'legs') return KEYWORDS.find((k) => k.art === (aspect > 1.2 ? 'trousers' : 'shorts'));
  if (shape === 'sleeves') return KEYWORDS.find((k) => k.art === (aspect > 1.15 ? 'knit' : 'tee'));
  // tall & narrow → bottom; wide & short → shoes; otherwise top
  if (aspect > 1.45) return KEYWORDS.find((k) => k.art === 'trousers');
  if (aspect < 0.7) return KEYWORDS.find((k) => k.art === 'sneaker');
  return KEYWORDS.find((k) => k.art === 'tee');
}

/**
 * Processes one photo. Calls onStep(label) as it goes.
 * Returns a draft garment for the user to confirm.
 */
export async function processUpload(file, onStep = () => {}) {
  onStep('Reading photo');
  const img = await loadImage(file);
  const max = 640;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h); // drawing to canvas also drops EXIF/GPS metadata
  await wait(250);

  onStep('Removing background');
  const original = ctx.getImageData(0, 0, w, h);
  removeBackground(ctx, w, h);
  const refined = refineCutout(canvas, original);
  const data = refined.data;
  await wait(350);

  onStep('Reading colors');
  const rgb = dominantColor(data);
  const named = nearestNamedColor(rgb);
  await wait(300);

  onStep('Tagging (category, fabric, season)');
  const fname = file.name.toLowerCase();
  const hint = KEYWORDS.find((k) => k.re.test(fname)) || guessFromShape(refined.aspect, refined.cut === 'clean' ? shapeHint(data) : null);
  await wait(500);

  const { re, ...tags } = hint;
  return {
    id: 'u-' + Date.now().toString(36),
    name: `${named.name.replace(/\b\w/g, (c) => c.toUpperCase())} ${tags.art === 'tee' ? 'T-Shirt' : tags.art.charAt(0).toUpperCase() + tags.art.slice(1)}`,
    colors: [{ name: named.name, hex: rgbToHex(rgb) }],
    pattern: 'solid',
    seasons: ['spring', 'summer', 'autumn', 'winter'],
    fit: 'regular',
    water: 1,
    ...tags,
    owned: true,
    uploaded: true,
    image: refined.canvas.toDataURL('image/webp', 0.86),
    cutout: refined.cut,
    confidence: KEYWORDS.some((k) => k.re.test(fname)) ? 0.82 : 0.48,
  };
}
