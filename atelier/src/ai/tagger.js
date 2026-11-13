// Closet onboarding pipeline (prototype).
//  REAL, on-device: resize, simple background removal (border flood-fill), dominant color.
//  MOCK: semantic tags (category, material, warmth…), inferred from filename + shape.
// Production swaps in @imgly/background-removal + the atelier-ai "tag" Edge Function.

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

function guessFromShape(aspect) {
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
  const data = removeBackground(ctx, w, h);
  await wait(350);

  onStep('Reading colors');
  const rgb = dominantColor(data);
  const named = nearestNamedColor(rgb);
  await wait(300);

  onStep('Tagging (category, fabric, season)');
  const fname = file.name.toLowerCase();
  const hint = KEYWORDS.find((k) => k.re.test(fname)) || guessFromShape(h / w);
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
    image: canvas.toDataURL('image/png'),
    confidence: KEYWORDS.some((k) => k.re.test(fname)) ? 0.82 : 0.48,
  };
}
