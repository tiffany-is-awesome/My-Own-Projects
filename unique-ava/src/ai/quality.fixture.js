// Challenging, realistic closets for outfit-quality testing (NOT shipped to users).
import { NAMED_COLORS } from './color.js';
const hex = (n) => NAMED_COLORS.find((c) => c.name === n)?.hex || '#999';
let n = 0;
export const item = (name, category, art, color, rest = {}) => ({
  id: 'q' + (n++), name, category, art, colors: [{ name: color, hex: hex(color) }, ...(rest.color2 ? [{ name: rest.color2, hex: hex(rest.color2) }] : [])],
  pattern: 'solid', seasons: ['spring', 'summer', 'autumn', 'winter'], fit: 'regular', water: 1, weight: 'mid', warmth: 2, formality: 2, style: 'casual', ...rest,
});

/** A colorful, pattern-heavy closet: the kind real people own. */
export const BOLD = [
  item('Red Floral Blouse', 'top', 'shirt', 'red', { pattern: 'floral', color2: 'pink', formality: 3, style: 'feminine', weight: 'light', warmth: 1 }),
  item('Navy Stripe Tee', 'top', 'stripe', 'navy', { pattern: 'stripe', color2: 'white', style: 'casual', weight: 'light', warmth: 1 }),
  item('Green Check Shirt', 'top', 'shirt', 'green', { pattern: 'check', color2: 'navy', style: 'casual', formality: 2 }),
  item('Mustard Knit', 'top', 'knit', 'mustard', { warmth: 3, style: 'casual' }),
  item('White Silk Blouse', 'top', 'shirt', 'white', { formality: 4, style: 'elegant', weight: 'light', warmth: 1 }),
  item('Black Graphic Tee', 'top', 'tee', 'black', { pattern: 'graphic', style: 'streetwear', formality: 1, weight: 'light', warmth: 1 }),
  item('Lavender Oversized Hoodie', 'top', 'knit', 'lavender', { fit: 'oversized', style: 'sporty', formality: 1, warmth: 3 }),
  item('Pink Pleated Skirt', 'bottom', 'skirt', 'pink', { style: 'feminine', formality: 3 }),
  item('Red Wide Trousers', 'bottom', 'trousers', 'red', { fit: 'relaxed', formality: 3, style: 'edgy' }),
  item('Plaid Mini Skirt', 'bottom', 'skirt', 'burgundy', { pattern: 'check', color2: 'navy', style: 'preppy', formality: 2 }),
  item('Black Tailored Trousers', 'bottom', 'trousers', 'black', { fit: 'regular', formality: 4, style: 'business' }),
  item('Light Wash Wide Jeans', 'bottom', 'jeans', 'light blue', { fit: 'relaxed', style: 'casual', formality: 1 }),
  item('Grey Joggers', 'bottom', 'trousers', 'gray', { fit: 'relaxed', style: 'sporty', formality: 1, material: 'cotton fleece' }),
  item('Floral Maxi Dress', 'dress', 'dress', 'mustard', { pattern: 'floral', color2: 'green', style: 'feminine', formality: 3, weight: 'light', warmth: 1, sleeve: 'short' }),
  item('Black Cocktail Dress', 'dress', 'dress', 'black', { style: 'elegant', formality: 4.5, weight: 'light', warmth: 1, sleeve: 'sleeveless' }),
  item('Oversized Leather Jacket', 'outer', 'jacket', 'black', { fit: 'oversized', style: 'edgy', warmth: 3, water: 3, length: 'hip' }),
  item('Camel Long Coat', 'outer', 'coat', 'camel', { formality: 4, style: 'classic', warmth: 4, weight: 'heavy', length: 'long' }),
  item('Pink Cardigan', 'outer', 'cardigan', 'pink', { style: 'feminine', warmth: 2, length: 'hip' }),
  item('Yellow Rain Jacket', 'outer', 'jacket', 'mustard', { style: 'sporty', water: 5, warmth: 2, length: 'hip' }),
  item('Chunky Platform Sneakers', 'shoes', 'sneaker', 'white', { profile: 'chunky', style: 'streetwear', formality: 1, water: 2 }),
  item('Red Strappy Heels', 'shoes', 'sandal', 'red', { formality: 4.5, style: 'elegant', water: 1 }),
  item('Black Combat Boots', 'shoes', 'boot', 'black', { profile: 'chunky', style: 'edgy', formality: 2, water: 4, warmth: 3 }),
  item('Nude Ballet Flats', 'shoes', 'loafer', 'beige', { formality: 3, style: 'feminine', water: 1 }),
  item('Running Shoes', 'shoes', 'sneaker', 'gray', { style: 'sporty', formality: 1, water: 2 }),
  item('Woven Straw Tote', 'accessory', 'tote', 'camel', { formality: 1, style: 'casual' }),
  item('Black Leather Clutch', 'accessory', 'crossbody', 'black', { formality: 4, style: 'elegant' }),
  item('Gold Hoop Necklace', 'accessory', 'necklace', 'mustard', { formality: 3 }),
  item('Leopard Scarf', 'accessory', 'scarf', 'camel', { pattern: 'other', color2: 'black', warmth: 2 }),
  item('Brown Leather Belt', 'accessory', 'belt', 'brown', { formality: 3 }),
  item('Baseball Cap', 'accessory', 'hat', 'navy', { formality: 1, style: 'sporty' }),
];

/** A tiny, awkward closet: few choices, some bad matches forced. */
export const SMALL = [
  item('Orange Graphic Tee', 'top', 'tee', 'rust', { pattern: 'graphic', formality: 1, style: 'streetwear', weight: 'light', warmth: 1 }),
  item('Black Turtleneck', 'top', 'turtleneck', 'black', { formality: 3, style: 'minimalist', warmth: 3 }),
  item('Khaki Shorts', 'bottom', 'shorts', 'khaki', { formality: 1, weight: 'light', warmth: 0 }),
  item('Navy Chinos', 'bottom', 'trousers', 'navy', { formality: 3, style: 'classic' }),
  item('Flip Flops', 'shoes', 'sandal', 'black', { formality: 1, water: 2 }),
  item('Brown Loafers', 'shoes', 'loafer', 'brown', { formality: 3.5, style: 'classic', water: 2 }),
];
