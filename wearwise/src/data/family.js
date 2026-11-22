// Demo family members (only loaded with "Try the demo closet"; all flagged demo and removable in one tap).
const ALL = ['spring', 'summer', 'autumn', 'winter'];
const g = (ownerId, id, name, category, art, color, hex, rest) => ({
  id, ownerId, name, category, art, colors: [{ name: color, hex }], pattern: 'solid', seasons: ALL, fit: 'regular',
  water: 1, owned: true, demo: true, ...rest,
});
const DAD = 'p-demo-dad';
const KID = 'p-demo-kid';

export const DEMO_FAMILY = {
  profiles: [
    { id: DAD, name: 'Dad', kind: 'adult' },
    { id: KID, name: 'Mia', kind: 'child' },
  ],
  garments: [
    // Dad
    g(DAD, 'dad-white-oxford', 'White Oxford Shirt', 'top', 'shirt', 'white', '#F5F4EF', { material: 'Cotton oxford', weight: 'light', warmth: 2, formality: 3, style: 'classic', sleeve: 'long', occasions: ['work', 'church', 'date'] }),
    g(DAD, 'dad-navy-polo', 'Knit Polo Shirt', 'top', 'tee', 'navy', '#1F2A44', { material: 'Cotton piqué', weight: 'light', warmth: 1, formality: 2, style: 'preppy', sleeve: 'short', occasions: ['everyday', 'vacation', 'church'] }),
    g(DAD, 'dad-grey-knit', 'Merino Crew Sweater', 'top', 'knit', 'gray', '#8E8F92', { material: 'Merino wool', weight: 'mid', warmth: 3, formality: 3, style: 'classic', sleeve: 'long', occasions: ['work', 'everyday', 'church'], seasons: ['autumn', 'winter', 'spring'] }),
    g(DAD, 'dad-khaki-chino', 'Slim Chino Trousers', 'bottom', 'trousers', 'khaki', '#A79B6E', { material: 'Cotton twill', weight: 'mid', warmth: 2, formality: 3, fit: 'fitted', style: 'classic', occasions: ['work', 'church', 'everyday', 'date'] }),
    g(DAD, 'dad-jeans', 'Dark Straight Jeans', 'bottom', 'jeans', 'denim blue', '#26364F', { material: 'Denim', weight: 'mid', warmth: 2, water: 2, formality: 2, style: 'casual', occasions: ['everyday', 'vacation', 'date'] }),
    g(DAD, 'dad-navy-blazer', 'Navy Wool Blazer', 'outer', 'blazer', 'navy', '#22304D', { material: 'Wool', weight: 'mid', warmth: 2, formality: 4, length: 'hip', style: 'business', occasions: ['work', 'church', 'wedding', 'special'] }),
    g(DAD, 'dad-brown-loafer', 'Leather Loafers', 'shoes', 'loafer', 'brown', '#6B4A33', { material: 'Leather', weight: 'mid', warmth: 2, water: 2, formality: 4, profile: 'sleek', style: 'classic', occasions: ['work', 'church', 'date', 'wedding'] }),
    g(DAD, 'dad-white-sneaker', 'White Leather Sneakers', 'shoes', 'sneaker', 'white', '#F5F4EF', { material: 'Leather', weight: 'mid', warmth: 2, water: 2, formality: 2, profile: 'sleek', style: 'minimalist', occasions: ['everyday', 'vacation'] }),
    // Mia (child)
    g(KID, 'kid-cream-tee', 'Cotton Tee', 'top', 'tee', 'cream', '#E8DCC2', { material: 'Cotton jersey', weight: 'light', warmth: 1, formality: 1, style: 'casual', sleeve: 'short', occasions: ['everyday', 'school', 'vacation'] }),
    g(KID, 'kid-navy-cardi', 'Navy Knit Cardigan', 'outer', 'cardigan', 'navy', '#26304A', { material: 'Cotton knit', weight: 'mid', warmth: 2, formality: 3, length: 'hip', style: 'preppy', occasions: ['school', 'church', 'everyday'] }),
    g(KID, 'kid-floral-dress', 'Floral Cotton Dress', 'dress', 'dress', 'pink', '#E3A7B3', { material: 'Cotton poplin', weight: 'light', warmth: 1, formality: 3, pattern: 'floral', style: 'feminine', sleeve: 'short', occasions: ['church', 'party', 'wedding', 'special'], seasons: ['spring', 'summer', 'autumn'] }),
    g(KID, 'kid-denim-skirt', 'Denim Skirt', 'bottom', 'skirt', 'denim blue', '#3E5C82', { material: 'Denim', weight: 'mid', warmth: 1, formality: 2, style: 'casual', occasions: ['everyday', 'school'] }),
    g(KID, 'kid-khaki-shorts', 'Play Shorts', 'bottom', 'shorts', 'khaki', '#A79B6E', { material: 'Cotton twill', weight: 'light', warmth: 1, formality: 1, style: 'casual', occasions: ['everyday', 'vacation', 'sports'], seasons: ['summer', 'spring'] }),
    g(KID, 'kid-white-sneaker', 'Canvas Sneakers', 'shoes', 'sneaker', 'white', '#F5F4EF', { material: 'Canvas', weight: 'light', warmth: 1, formality: 1, profile: 'sleek', style: 'casual', occasions: ['everyday', 'school', 'vacation', 'sports'] }),
    g(KID, 'kid-mary-jane', 'Patent Mary Janes', 'shoes', 'loafer', 'navy', '#1F2A44', { material: 'Patent leather', weight: 'light', warmth: 1, water: 2, formality: 4, profile: 'sleek', style: 'feminine', occasions: ['church', 'party', 'wedding', 'special'] }),
  ],
};
