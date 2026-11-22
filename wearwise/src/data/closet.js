// Wardrobe vocabulary + the optional DEMO closet.
//
// A new user starts with an EMPTY closet. The demo closet is only loaded when she
// explicitly asks for it ("Try the demo closet"); every demo item is flagged `demo: true`,
// badged in the UI, and removable in one tap. Recommendations only ever use items
// that are in her closet.
//
// Item fields (see docs/ARCHITECTURE.md §4.1):
//   category: top | bottom | dress | outer | shoes | accessory
//   art: which render to draw (see components/GarmentArt.jsx)
//   style: one of STYLES · sleeve: one of SLEEVES · occasions: OCCASIONS ids
//   warmth / water / formality: 0–5 · weight: light|mid|heavy · fit: fitted|regular|relaxed|oversized

export const CATEGORIES = [
  { id: 'top', label: 'Tops' },
  { id: 'bottom', label: 'Bottoms' },
  { id: 'dress', label: 'Dresses' },
  { id: 'outer', label: 'Outerwear' },
  { id: 'shoes', label: 'Shoes' },
  { id: 'accessory', label: 'Accessories' },
];
export const CATEGORY_LABEL = { top: 'Top', bottom: 'Bottom', dress: 'Dress', outer: 'Outerwear', shoes: 'Shoes', accessory: 'Accessory' };

/** Shapes the renderer can draw, per category. */
export const ARTS = {
  top: ['tee', 'shirt', 'turtleneck', 'knit', 'stripe'],
  bottom: ['trousers', 'jeans', 'shorts', 'skirt'],
  dress: ['dress'],
  outer: ['coat', 'trench', 'blazer', 'jacket', 'puffer', 'cardigan'],
  shoes: ['sneaker', 'loafer', 'boot', 'sandal'],
  accessory: ['tote', 'crossbody', 'scarf', 'hat', 'necklace', 'belt'],
};
export const BAG_ARTS = ['tote', 'crossbody'];

export const STYLES = [
  { id: 'casual', label: 'Casual' }, { id: 'minimalist', label: 'Minimalist' }, { id: 'elegant', label: 'Elegant' },
  { id: 'classic', label: 'Classic' }, { id: 'streetwear', label: 'Streetwear' }, { id: 'preppy', label: 'Preppy' },
  { id: 'sporty', label: 'Sporty' }, { id: 'feminine', label: 'Feminine' }, { id: 'edgy', label: 'Edgy' },
  { id: 'business', label: 'Business casual' },
];
export const SLEEVES = ['sleeveless', 'short', 'three-quarter', 'long'];

// formality: the level the occasion expects (1 lounge … 5 black tie)
export const OCCASIONS = [
  { id: 'everyday', label: 'Everyday', formality: 2 },
  { id: 'school', label: 'School', formality: 2 },
  { id: 'work', label: 'Work', formality: 3.5 },
  { id: 'church', label: 'Church', formality: 3.5 },
  { id: 'date', label: 'Date', formality: 3 },
  { id: 'party', label: 'Party', formality: 3 },
  { id: 'wedding', label: 'Wedding', formality: 4.5 },
  { id: 'vacation', label: 'Vacation', formality: 1.5 },
  { id: 'sports', label: 'Sports', formality: 1 },
  { id: 'special', label: 'Special occasion', formality: 4 },
];

// Outfit slots. A dress goes in the "top" slot and replaces the bottom.
export const SLOTS = ['top', 'bottom', 'outer', 'shoes', 'bag', 'accessory'];
export const SLOT_LABEL = { top: 'Top / Dress', bottom: 'Bottom', outer: 'Outerwear', shoes: 'Shoes', bag: 'Bag', accessory: 'Accessory' };

/** Which outfit slot a piece belongs in. */
export function slotOf(item) {
  if (!item) return null;
  if (item.category === 'dress') return 'top';
  if (item.category === 'accessory') return BAG_ARTS.includes(item.art) ? 'bag' : 'accessory';
  return item.category;
}
export const fitsSlot = (item, slot) => slotOf(item) === slot;

const ALL = ['spring', 'summer', 'autumn', 'winter'];
const g = (id, name, category, art, color, hex, rest) => ({
  id, name, category, art,
  colors: [{ name: color, hex }],
  pattern: 'solid',
  seasons: ALL,
  fit: 'regular',
  water: 1,
  owned: true,
  demo: true,
  ...rest,
});

/** The optional demo closet (only loaded on request). */
export const DEMO_CLOSET = [
  // ── Tops
  g('t-white-tee', 'Supima Cotton Crew Neck T-Shirt', 'top', 'tee', 'white', '#F7F6F2',
    { material: 'Supima cotton jersey', weight: 'light', warmth: 1, formality: 1, style: 'casual', sleeve: 'short', occasions: ['everyday', 'school', 'vacation'], seasons: ['spring', 'summer', 'autumn'] }),
  g('t-black-turtle', 'Extra Fine Merino Turtleneck', 'top', 'turtleneck', 'black', '#1E1E1E',
    { material: 'Merino wool', weight: 'mid', warmth: 3, formality: 3, fit: 'fitted', style: 'minimalist', sleeve: 'long', occasions: ['work', 'date', 'church', 'everyday'], seasons: ['autumn', 'winter', 'spring'] }),
  g('t-oxford-blue', 'Oxford Button-Down Shirt', 'top', 'shirt', 'light blue', '#A9C3DB',
    { material: 'Cotton oxford', weight: 'light', warmth: 2, formality: 3, style: 'preppy', sleeve: 'long', occasions: ['work', 'church', 'school', 'everyday'] }),
  g('t-stripe-tee', 'Breton Stripe Long-Sleeve Tee', 'top', 'stripe', 'off-white', '#EDE7DA',
    { material: 'Cotton jersey', weight: 'light', warmth: 2, formality: 2, pattern: 'stripe', colors: [{ name: 'off-white', hex: '#EDE7DA' }, { name: 'navy', hex: '#1F2A44' }], style: 'classic', sleeve: 'long', occasions: ['everyday', 'vacation', 'school'], seasons: ['spring', 'summer', 'autumn'] }),
  g('t-cream-knit', 'Chunky Cable-Knit Sweater', 'top', 'knit', 'cream', '#E8DCC2',
    { material: 'Lambswool blend', weight: 'heavy', warmth: 4, formality: 2, fit: 'oversized', style: 'casual', sleeve: 'long', occasions: ['everyday', 'school'], seasons: ['autumn', 'winter'] }),
  g('t-linen-shirt', 'Premium Linen Shirt', 'top', 'shirt', 'off-white', '#EDE7DA',
    { material: 'Linen', weight: 'light', warmth: 1, formality: 2, fit: 'relaxed', style: 'minimalist', sleeve: 'long', occasions: ['vacation', 'everyday', 'date'], seasons: ['spring', 'summer'] }),
  g('t-rust-knit', 'Souffle Yarn Crew Sweater', 'top', 'knit', 'rust', '#A4492A',
    { material: 'Acrylic-wool blend', weight: 'mid', warmth: 3, formality: 2, fit: 'relaxed', style: 'casual', sleeve: 'long', occasions: ['everyday', 'school'], seasons: ['autumn', 'winter'] }),

  // ── Bottoms
  g('b-olive-chino', 'Wide-Fit Pleated Chino Trousers', 'bottom', 'trousers', 'olive', '#5B5F3A',
    { material: 'Cotton twill', weight: 'mid', warmth: 2, formality: 3, fit: 'relaxed', style: 'classic', occasions: ['work', 'everyday', 'date'] }),
  g('b-dark-denim', 'Selvedge Slim Straight Jeans', 'bottom', 'jeans', 'denim blue', '#2E4566',
    { material: '14oz denim', weight: 'mid', warmth: 2, water: 2, formality: 2, fit: 'fitted', style: 'casual', occasions: ['everyday', 'school', 'date', 'party'] }),
  g('b-black-slacks', 'Smart Ankle Pants', 'bottom', 'trousers', 'black', '#1E1E1E',
    { material: 'Polyester-rayon stretch', weight: 'mid', warmth: 2, water: 2, formality: 4, fit: 'fitted', style: 'business', occasions: ['work', 'church', 'special'] }),
  g('b-beige-shorts', 'Linen-Blend Easy Shorts', 'bottom', 'shorts', 'beige', '#D4C2A1',
    { material: 'Linen-cotton', weight: 'light', warmth: 1, formality: 1, fit: 'relaxed', style: 'casual', occasions: ['vacation', 'everyday'], seasons: ['summer'] }),
  g('b-pleat-skirt', 'Pleated Midi Skirt', 'bottom', 'skirt', 'charcoal', '#3C3D40',
    { material: 'Recycled polyester', weight: 'light', warmth: 1, formality: 3, fit: 'relaxed', style: 'feminine', occasions: ['church', 'work', 'date'], seasons: ['spring', 'summer', 'autumn'] }),

  // ── Dresses
  g('d-navy-dress', 'Satin Midi Slip Dress', 'dress', 'dress', 'navy', '#22304D',
    { material: 'Satin', weight: 'light', warmth: 1, formality: 4, fit: 'regular', style: 'elegant', sleeve: 'sleeveless', occasions: ['wedding', 'date', 'party', 'special'], seasons: ['spring', 'summer', 'autumn'] }),

  // ── Outerwear
  g('o-trench', 'Single-Breasted Trench Coat', 'outer', 'trench', 'beige', '#C8B28C',
    { material: 'Water-repellent cotton gabardine', weight: 'mid', warmth: 2, water: 4, formality: 4, length: 'long', style: 'classic', occasions: ['work', 'church', 'everyday', 'date'], seasons: ['spring', 'autumn'] }),
  g('o-navy-blazer', 'Unstructured Blazer', 'outer', 'blazer', 'navy', '#1F2A44',
    { material: 'Wool-blend hopsack', weight: 'mid', warmth: 2, formality: 4, length: 'hip', style: 'business', occasions: ['work', 'church', 'special'] }),
  g('o-wool-coat', 'Wool-Blend Chester Coat', 'outer', 'coat', 'charcoal', '#3C3D40',
    { material: 'Wool-cashmere blend', weight: 'heavy', warmth: 4, water: 2, formality: 4, length: 'long', style: 'classic', occasions: ['work', 'church', 'date', 'special'], seasons: ['autumn', 'winter'] }),
  g('o-puffer', 'Ultra Light Down Jacket', 'outer', 'puffer', 'black', '#1E1E1E',
    { material: 'Nylon / down fill', weight: 'light', warmth: 4, water: 3, formality: 1, length: 'hip', style: 'sporty', occasions: ['everyday', 'school', 'vacation'], seasons: ['autumn', 'winter'] }),
  g('o-denim-jacket', 'Denim Trucker Jacket', 'outer', 'jacket', 'light blue', '#7C9BBE',
    { material: 'Cotton denim', weight: 'mid', warmth: 2, formality: 1, length: 'cropped', style: 'casual', occasions: ['everyday', 'school', 'vacation'], seasons: ['spring', 'autumn'] }),

  // ── Shoes
  g('s-white-sneaker', 'Leather Low-Top Sneakers', 'shoes', 'sneaker', 'white', '#F7F6F2',
    { material: 'Smooth leather', weight: 'mid', warmth: 2, water: 2, formality: 2, profile: 'sleek', style: 'minimalist', occasions: ['everyday', 'school', 'vacation', 'date'] }),
  g('s-suede-loafer', 'Suede Penny Loafers', 'shoes', 'loafer', 'brown', '#7A5236',
    { material: 'Suede', weight: 'mid', warmth: 2, water: 1, formality: 4, profile: 'sleek', style: 'preppy', occasions: ['work', 'church', 'date'], seasons: ['spring', 'summer', 'autumn'] }),
  g('s-black-boot', 'Leather Chelsea Boots', 'shoes', 'boot', 'black', '#1E1E1E',
    { material: 'Waxed leather, rubber sole', weight: 'heavy', warmth: 3, water: 4, formality: 4, profile: 'chunky', style: 'classic', occasions: ['work', 'everyday', 'date', 'church'], seasons: ['autumn', 'winter', 'spring'] }),
  g('s-sandal', 'Strap Sandals', 'shoes', 'sandal', 'brown', '#6B4A33',
    { material: 'Leather', weight: 'light', warmth: 1, water: 2, formality: 1, profile: 'sleek', style: 'casual', occasions: ['vacation', 'everyday'], seasons: ['summer'] }),

  // ── Accessories
  g('a-tote', 'Canvas Tote Bag', 'accessory', 'tote', 'off-white', '#EDE7DA',
    { material: 'Heavy canvas', weight: 'mid', warmth: 0, formality: 1, style: 'casual', occasions: ['everyday', 'school', 'vacation'] }),
  g('a-crossbody', 'Leather Crossbody Bag', 'accessory', 'crossbody', 'black', '#1E1E1E',
    { material: 'Smooth leather', weight: 'light', warmth: 0, water: 2, formality: 3, style: 'minimalist', occasions: ['date', 'work', 'party', 'everyday'] }),
  g('a-scarf', 'Heattech Knit Scarf', 'accessory', 'scarf', 'burgundy', '#6E1F2E',
    { material: 'Knit', weight: 'mid', warmth: 1, formality: 2, style: 'classic', occasions: ['everyday', 'work'], seasons: ['autumn', 'winter'] }),
  g('a-necklace', 'Fine Gold Chain Necklace', 'accessory', 'necklace', 'mustard', '#C9A13B',
    { material: 'Gold-plated brass', weight: 'light', warmth: 0, formality: 3, style: 'elegant', occasions: ['date', 'party', 'wedding', 'church', 'work'] }),
];

/** Demo outfits & lookbooks that come with the demo closet. */
export const DEMO_OUTFITS = [
  { id: 'o-spring-1', name: 'Weekend Oxford', slots: { top: 't-oxford-blue', bottom: 'b-olive-chino', outer: 'o-denim-jacket', shoes: 's-white-sneaker', bag: 'a-tote' }, prompt: 'Weekend market, 19°C' },
  { id: 'o-spring-2', name: 'Breton & Trench', slots: { top: 't-stripe-tee', bottom: 'b-dark-denim', outer: 'o-trench', shoes: 's-white-sneaker', bag: 'a-tote' }, prompt: 'Brunch in Paris, 17°C', stage: { mode: 'scene', scene: 'paris-street' } },
  { id: 'o-kyoto-1', name: 'Day 1 · Temples', slots: { top: 't-black-turtle', bottom: 'b-olive-chino', outer: 'o-wool-coat', shoes: 's-black-boot', accessory: 'a-scarf' }, prompt: 'Kyoto temples in autumn, 11°C', stage: { mode: 'scene', scene: 'kyoto-autumn' } },
  { id: 'o-kyoto-2', name: 'Day 2 · Gion walk', slots: { top: 't-cream-knit', bottom: 'b-dark-denim', outer: 'o-trench', shoes: 's-black-boot' }, prompt: 'Kyoto sightseeing, 13°C' },
  { id: 'o-kyoto-3', name: 'Day 3 · Dinner', slots: { top: 'd-navy-dress', outer: 'o-wool-coat', shoes: 's-black-boot', bag: 'a-crossbody', accessory: 'a-necklace' }, prompt: 'Dinner date in Kyoto, 10°C' },
];
export const DEMO_CATALOGS = [
  { id: 'c-spring', title: 'Spring Rotation', kind: 'collection', outfitIds: ['o-spring-1', 'o-spring-2'] },
  { id: 'c-kyoto', title: '3-Day Kyoto Trip', kind: 'trip', trip: { city: 'Kyoto', days: 3 }, outfitIds: ['o-kyoto-1', 'o-kyoto-2', 'o-kyoto-3'] },
];
