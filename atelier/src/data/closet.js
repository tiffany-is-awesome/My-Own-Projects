// Sample closet + "placeholder basics" catalog.
// Fields mirror the tagging contract in docs/ARCHITECTURE.md §4.1.
//   warmth / water / formality: 1–5 · weight: light|mid|heavy · fit: fitted|regular|relaxed|oversized
//   art: which flat-lay illustration to draw (see components/GarmentArt.jsx)

const ALL = ['spring', 'summer', 'autumn', 'winter'];

const g = (id, name, category, art, color, hex, rest) => ({
  id, name, category, art,
  colors: [{ name: color, hex }],
  pattern: 'solid',
  seasons: ALL,
  fit: 'regular',
  owned: true,
  ...rest,
});

export const SAMPLE_CLOSET = [
  // ── Tops
  g('t-white-tee', 'Supima Cotton Crew Neck T-Shirt', 'top', 'tee', 'white', '#F7F6F2',
    { material: 'Supima cotton jersey', weight: 'light', warmth: 1, water: 1, formality: 1, seasons: ['spring', 'summer', 'autumn'] }),
  g('t-black-turtle', 'Extra Fine Merino Turtleneck', 'top', 'turtleneck', 'black', '#1E1E1E',
    { material: 'Merino wool', weight: 'mid', warmth: 3, water: 1, formality: 3, fit: 'fitted', seasons: ['autumn', 'winter', 'spring'] }),
  g('t-oxford-blue', 'Oxford Button-Down Shirt', 'top', 'shirt', 'light blue', '#A9C3DB',
    { material: 'Cotton oxford', weight: 'light', warmth: 2, water: 1, formality: 3 }),
  g('t-stripe-tee', 'Breton Stripe Long-Sleeve Tee', 'top', 'stripe', 'navy', '#1F2A44',
    { material: 'Cotton jersey', weight: 'light', warmth: 2, water: 1, formality: 2, pattern: 'stripe', colors: [{ name: 'off-white', hex: '#EDE7DA' }, { name: 'navy', hex: '#1F2A44' }], seasons: ['spring', 'summer', 'autumn'] }),
  g('t-cream-knit', 'Chunky Cable-Knit Sweater', 'top', 'knit', 'cream', '#E8DCC2',
    { material: 'Lambswool blend', weight: 'heavy', warmth: 4, water: 1, formality: 2, fit: 'oversized', seasons: ['autumn', 'winter'] }),
  g('t-linen-shirt', 'Premium Linen Shirt', 'top', 'shirt', 'off-white', '#EDE7DA',
    { material: 'Linen', weight: 'light', warmth: 1, water: 1, formality: 2, fit: 'relaxed', seasons: ['spring', 'summer'] }),
  g('t-rust-knit', 'Souffle Yarn Crew Sweater', 'top', 'knit', 'rust', '#A4492A',
    { material: 'Acrylic-wool blend', weight: 'mid', warmth: 3, water: 1, formality: 2, fit: 'relaxed', seasons: ['autumn', 'winter'] }),

  // ── Bottoms
  g('b-olive-chino', 'Wide-Fit Pleated Chino Trousers', 'bottom', 'trousers', 'olive', '#5B5F3A',
    { material: 'Cotton twill', weight: 'mid', warmth: 2, water: 1, formality: 3, fit: 'relaxed' }),
  g('b-dark-denim', 'Selvedge Slim Straight Jeans', 'bottom', 'jeans', 'denim blue', '#2E4566',
    { material: '14oz denim', weight: 'mid', warmth: 2, water: 2, formality: 2, fit: 'fitted' }),
  g('b-black-slacks', 'Smart Ankle Pants', 'bottom', 'trousers', 'black', '#1E1E1E',
    { material: 'Polyester-rayon stretch', weight: 'mid', warmth: 2, water: 2, formality: 4, fit: 'fitted' }),
  g('b-beige-shorts', 'Linen-Blend Easy Shorts', 'bottom', 'shorts', 'beige', '#D4C2A1',
    { material: 'Linen-cotton', weight: 'light', warmth: 1, water: 1, formality: 1, fit: 'relaxed', seasons: ['summer'] }),
  g('b-pleat-skirt', 'Pleated Midi Skirt', 'bottom', 'skirt', 'charcoal', '#3C3D40',
    { material: 'Recycled polyester', weight: 'light', warmth: 1, water: 1, formality: 3, fit: 'relaxed', seasons: ['spring', 'summer', 'autumn'] }),

  // ── Outerwear
  g('o-trench', 'Single-Breasted Trench Coat', 'outer', 'trench', 'beige', '#C8B28C',
    { material: 'Water-repellent cotton gabardine', weight: 'mid', warmth: 2, water: 4, formality: 4, length: 'long', seasons: ['spring', 'autumn'] }),
  g('o-navy-blazer', 'Unstructured Blazer', 'outer', 'blazer', 'navy', '#1F2A44',
    { material: 'Wool-blend hopsack', weight: 'mid', warmth: 2, water: 1, formality: 4, length: 'hip' }),
  g('o-wool-coat', 'Wool-Blend Chester Coat', 'outer', 'coat', 'charcoal', '#3C3D40',
    { material: 'Wool-cashmere blend', weight: 'heavy', warmth: 4, water: 2, formality: 4, length: 'long', seasons: ['autumn', 'winter'] }),
  g('o-puffer', 'Ultra Light Down Jacket', 'outer', 'puffer', 'black', '#1E1E1E',
    { material: 'Nylon / down fill', weight: 'light', warmth: 4, water: 3, formality: 1, length: 'hip', seasons: ['autumn', 'winter'] }),
  g('o-denim-jacket', 'Denim Trucker Jacket', 'outer', 'jacket', 'light blue', '#7C9BBE',
    { material: 'Cotton denim', weight: 'mid', warmth: 2, water: 1, formality: 1, length: 'cropped', seasons: ['spring', 'autumn'] }),

  // ── Shoes
  g('s-white-sneaker', 'Leather Low-Top Sneakers', 'shoes', 'sneaker', 'white', '#F7F6F2',
    { material: 'Smooth leather', weight: 'mid', warmth: 2, water: 2, formality: 2, profile: 'sleek' }),
  g('s-suede-loafer', 'Suede Penny Loafers', 'shoes', 'loafer', 'brown', '#7A5236',
    { material: 'Suede', weight: 'mid', warmth: 2, water: 1, formality: 4, profile: 'sleek', seasons: ['spring', 'summer', 'autumn'] }),
  g('s-black-boot', 'Leather Chelsea Boots', 'shoes', 'boot', 'black', '#1E1E1E',
    { material: 'Waxed leather, rubber sole', weight: 'heavy', warmth: 3, water: 4, formality: 4, profile: 'chunky', seasons: ['autumn', 'winter', 'spring'] }),
  g('s-sandal', 'Strap Sandals', 'shoes', 'sandal', 'brown', '#6B4A33',
    { material: 'Leather', weight: 'light', warmth: 1, water: 2, formality: 1, profile: 'sleek', seasons: ['summer'] }),

  // ── Accessories
  g('a-tote', 'Canvas Tote Bag', 'accessory', 'tote', 'off-white', '#EDE7DA',
    { material: 'Heavy canvas', weight: 'mid', warmth: 0, water: 1, formality: 1 }),
  g('a-scarf', 'Heattech Knit Scarf', 'accessory', 'scarf', 'burgundy', '#6E1F2E',
    { material: 'Knit', weight: 'mid', warmth: 1, water: 1, formality: 2, seasons: ['autumn', 'winter'] }),
];

// Placeholder basics: a built-in catalog used to fill empty slots during onboarding.
export const BASICS = [
  g('basic-white-tee', 'White Crew Tee', 'top', 'tee', 'white', '#F7F6F2',
    { material: 'Cotton', weight: 'light', warmth: 1, water: 1, formality: 1, owned: false, placeholder: true }),
  g('basic-gray-sweat', 'Gray Crew Sweatshirt', 'top', 'knit', 'gray', '#9A9B9E',
    { material: 'Cotton fleece', weight: 'mid', warmth: 3, water: 1, formality: 1, owned: false, placeholder: true, seasons: ['autumn', 'winter', 'spring'] }),
  g('basic-dark-jeans', 'Dark Straight Jeans', 'bottom', 'jeans', 'denim blue', '#26364F',
    { material: 'Denim', weight: 'mid', warmth: 2, water: 2, formality: 2, owned: false, placeholder: true }),
  g('basic-black-trouser', 'Black Tailored Trousers', 'bottom', 'trousers', 'black', '#1E1E1E',
    { material: 'Wool blend', weight: 'mid', warmth: 2, water: 1, formality: 4, owned: false, placeholder: true }),
  g('basic-white-sneaker', 'White Sneakers', 'shoes', 'sneaker', 'white', '#F7F6F2',
    { material: 'Leather', weight: 'mid', warmth: 2, water: 2, formality: 2, owned: false, placeholder: true, profile: 'sleek' }),
  g('basic-black-boot', 'Black Rain Boots', 'shoes', 'boot', 'black', '#1E1E1E',
    { material: 'Rubber', weight: 'heavy', warmth: 2, water: 5, formality: 2, owned: false, placeholder: true, profile: 'chunky' }),
  g('basic-mac', 'Navy Rain Mac', 'outer', 'trench', 'navy', '#1F2A44',
    { material: 'Waterproof nylon', weight: 'light', warmth: 2, water: 5, formality: 2, owned: false, placeholder: true, length: 'long' }),
  g('basic-cardigan', 'Navy Cardigan', 'outer', 'cardigan', 'navy', '#26304A',
    { material: 'Merino', weight: 'mid', warmth: 2, water: 1, formality: 3, owned: false, placeholder: true, length: 'hip' }),
  g('basic-crossbody', 'Black Crossbody Bag', 'accessory', 'crossbody', 'black', '#1E1E1E',
    { material: 'Nylon', weight: 'light', warmth: 0, water: 3, formality: 2, owned: false, placeholder: true }),
];

export const CATEGORIES = [
  { id: 'top', label: 'Tops' },
  { id: 'bottom', label: 'Bottoms' },
  { id: 'outer', label: 'Outerwear' },
  { id: 'shoes', label: 'Shoes' },
  { id: 'accessory', label: 'Accessories' },
];

export const SLOTS = ['top', 'bottom', 'outer', 'shoes', 'accessory'];
export const SLOT_LABEL = { top: 'Top', bottom: 'Bottom', outer: 'Outer', shoes: 'Shoes', accessory: 'Accessory' };
