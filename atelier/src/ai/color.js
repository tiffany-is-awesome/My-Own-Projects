// Color helpers used by the critic, the tagger and the UI.

export const NAMED_COLORS = [
  { name: 'black', hex: '#1E1E1E' },
  { name: 'charcoal', hex: '#3C3D40' },
  { name: 'gray', hex: '#8E8F92' },
  { name: 'light gray', hex: '#C9C9C9' },
  { name: 'white', hex: '#F7F6F2' },
  { name: 'off-white', hex: '#EDE7DA' },
  { name: 'cream', hex: '#E8DCC2' },
  { name: 'beige', hex: '#D4C2A1' },
  { name: 'camel', hex: '#B88A55' },
  { name: 'brown', hex: '#6B4A33' },
  { name: 'navy', hex: '#1F2A44' },
  { name: 'denim blue', hex: '#3E5C82' },
  { name: 'light blue', hex: '#A9C3DB' },
  { name: 'olive', hex: '#5B5F3A' },
  { name: 'khaki', hex: '#A79B6E' },
  { name: 'green', hex: '#2F6B4A' },
  { name: 'burgundy', hex: '#6E1F2E' },
  { name: 'red', hex: '#C2272D' },
  { name: 'rust', hex: '#A4492A' },
  { name: 'mustard', hex: '#C9A13B' },
  { name: 'pink', hex: '#E3A7B3' },
  { name: 'lavender', hex: '#B5A8CF' },
];

// Colors that behave as neutrals (light blue = the classic oxford-shirt neutral) when styling (they pair with almost anything).
export const NEUTRALS = new Set([
  'black', 'charcoal', 'gray', 'light gray', 'white', 'off-white', 'cream', 'beige', 'camel',
  'brown', 'navy', 'denim blue', 'light blue', 'khaki',
]);

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

export function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}

export const hexToHsl = (hex) => rgbToHsl(hexToRgb(hex));

/** Lighten (amt > 0) or darken (amt < 0) a hex color. amt in -1..1 */
export function shade(hex, amt) {
  const rgb = hexToRgb(hex);
  return rgbToHex(rgb.map((v) => (amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
}

export function nearestNamedColor(rgb) {
  let best = NAMED_COLORS[0], bestD = Infinity;
  for (const c of NAMED_COLORS) {
    const [r, g, b] = hexToRgb(c.hex);
    // weighted RGB distance (rough perceptual)
    const d = 2 * (r - rgb[0]) ** 2 + 4 * (g - rgb[1]) ** 2 + 3 * (b - rgb[2]) ** 2;
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

export const isNeutral = (colorName) => NEUTRALS.has(colorName);

/** Smallest angle between two hues (0–180). */
export function hueDistance(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** 'warm' | 'cool' | 'neutral' for an accent color. */
export function temperature(hex) {
  const [h, s] = hexToHsl(hex);
  if (s < 0.15) return 'neutral';
  if (h < 70 || h >= 330) return 'warm';
  if (h >= 160 && h < 300) return 'cool';
  return 'neutral';
}
