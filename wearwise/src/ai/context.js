// Turns a free-text situation ("Rainy Tuesday coffee meeting, 16°C") into structured context.
// In production, vague prompts fall back to an optional AI Edge Function (task: "parse-context").

const OCCASIONS = [
  { id: 'wedding', label: 'Wedding', formality: 4.5, re: /wedding|gala|black tie|ceremony|formal/ },
  { id: 'church', label: 'Church', formality: 3.5, re: /church|mass|service|sunday worship/ },
  { id: 'school', label: 'School', formality: 2, re: /school|class|campus|university|college/ },
  { id: 'party', label: 'Party', formality: 3, re: /party|birthday|celebration|club/ },
  { id: 'sports', label: 'Sports', formality: 1, re: /gym|sport|run|jog|workout|tennis|game/ },
  { id: 'special', label: 'Interview', formality: 4, re: /interview|pitch|client|board/ },
  { id: 'work', label: 'Work', formality: 3.5, re: /office|work|meeting|presentation|conference|business/ },
  { id: 'date', label: 'Date', formality: 3, re: /dinner|date|restaurant|theatre|theater|bar|drinks/ },
  { id: 'coffee', label: 'Coffee / brunch', formality: 2.5, re: /coffee|caf[eé]|brunch|lunch/ },
  { id: 'vacation', label: 'Vacation', formality: 1.5, re: /vacation|holiday|trip|travel|sightseeing|temple|museum|tour|airport|flight/ },
  { id: 'weekend', label: 'Weekend errands', formality: 1.5, re: /weekend|errand|market|grocer|casual|home|lazy/ },
  { id: 'outdoor', label: 'Beach / outdoors', formality: 1, re: /beach|park|hike|picnic|pool|festival|garden/ },
];

const CITIES = ['tokyo', 'kyoto', 'osaka', 'seoul', 'manila', 'paris', 'london', 'new york', 'milan', 'copenhagen', 'singapore', 'bangkok', 'sydney', 'berlin', 'lisbon'];

export function seasonForTemp(t) {
  if (t >= 25) return 'summer';
  if (t >= 16) return 'spring';
  if (t >= 8) return 'autumn';
  return 'winter';
}

export function parseContext(prompt = '') {
  const text = prompt.toLowerCase();

  // Temperature
  let tempC = null;
  const m = text.match(/(-?\d{1,3}(?:\.\d)?)\s*°?\s*(c|f)\b/) || text.match(/(-?\d{1,3})\s*°/);
  if (m) {
    tempC = parseFloat(m[1]);
    if (m[2] === 'f') tempC = Math.round(((tempC - 32) * 5) / 9);
  }
  if (tempC === null) {
    if (/snow|freezing|winter/.test(text)) tempC = 3;
    else if (/beach|tropical|summer|heat|hot|humid/.test(text)) tempC = 30;
    else if (/autumn|fall|crisp/.test(text)) tempC = 14;
    else if (/spring/.test(text)) tempC = 18;
    else if (/cold|chilly/.test(text)) tempC = 9;
    else tempC = 21;
  }

  // Rain
  const rain = /rain|drizzle|shower|wet|storm|monsoon|typhoon/.test(text) ? 0.8 : /cloud|overcast|grey|gray/.test(text) ? 0.3 : 0.05;
  const wind = /wind|breezy|gust/.test(text);

  // Occasion
  const occ = OCCASIONS.find((o) => o.re.test(text)) || { id: 'everyday', label: 'Everyday', formality: 2 };
  const style = STYLE_WORDS.find(([, re]) => re.test(text))?.[0] || null;

  // Place
  const city = CITIES.find((c) => text.includes(c));

  const weather = rain >= 0.6 ? 'Rainy' : tempC >= 27 ? 'Hot' : tempC >= 20 ? 'Mild' : tempC >= 12 ? 'Cool' : 'Cold';

  return {
    prompt,
    tempC,
    rain,
    wind,
    occasion: occ.id,
    occasionLabel: occ.label,
    formality: occ.formality,
    city: city ? city.replace(/\b\w/g, (c) => c.toUpperCase()) : null,
    season: seasonForTemp(tempC),
    weather,
    style,
    prefs: [],
  };
}

const STYLE_WORDS = [
  ['elegant', /elegant|chic|glam/], ['minimalist', /minimal/], ['streetwear', /street/], ['preppy', /preppy/],
  ['sporty', /sporty|athleisure/], ['feminine', /feminine|girly|romantic/], ['edgy', /edgy|rock|grunge/],
  ['business', /business casual|smart casual/], ['classic', /classic|timeless/],
];

// ── Quick choices (Create an Outfit chips) → context
export const WEATHER_CHOICES = [
  { id: 'hot', label: 'Hot', tempC: 31, rain: 0.05 },
  { id: 'warm', label: 'Warm', tempC: 25, rain: 0.05 },
  { id: 'cool', label: 'Cool', tempC: 15, rain: 0.1 },
  { id: 'cold', label: 'Cold', tempC: 5, rain: 0.1 },
  { id: 'rainy', label: 'Rainy', tempC: 17, rain: 0.8 },
];
export const PREF_CHOICES = [
  { id: 'comfortable', label: 'Comfortable' },
  { id: 'formal', label: 'More formal' },
  { id: 'colorful', label: 'More colorful' },
  { id: 'simple', label: 'Simple' },
  { id: 'standout', label: 'Stand out' },
];

/**
 * Build a context from the quick choices. Free text (optional) can add details like a
 * city or an exact temperature; chips always win for the fields they set.
 */
export function buildContext({ occasion = 'everyday', style = null, weather = 'warm', prefs = [], text = '' }, occasions) {
  const base = parseContext(text || '');
  const occ = occasions.find((o) => o.id === occasion) || occasions[0];
  const w = WEATHER_CHOICES.find((x) => x.id === weather) || WEATHER_CHOICES[1];
  const exactTemp = /-?\d+\s*°?\s*[cf]\b|\d+\s*°/i.test(text || '');
  const tempC = exactTemp ? base.tempC : w.tempC;
  const rain = weather === 'rainy' ? 0.8 : exactTemp && base.rain >= 0.6 ? base.rain : w.rain;
  const formality = Math.min(5, occ.formality + (prefs.includes('formal') ? 1 : 0));
  const label = [occ.label, w.label.toLowerCase(), style ? STYLE_LABEL[style] : null].filter(Boolean).join(' · ');
  return {
    ...base,
    prompt: text?.trim() ? `${label} · ${text.trim()}` : label,
    tempC, rain,
    occasion: occ.id, occasionLabel: occ.label, formality,
    season: seasonForTemp(tempC),
    weather: rain >= 0.6 ? 'Rainy' : tempC >= 27 ? 'Hot' : tempC >= 20 ? 'Warm' : tempC >= 12 ? 'Cool' : 'Cold',
    style: style || base.style, prefs,
  };
}
const STYLE_LABEL = { casual: 'casual', minimalist: 'minimalist', elegant: 'elegant', classic: 'classic', streetwear: 'streetwear', preppy: 'preppy', sporty: 'sporty', feminine: 'feminine', edgy: 'edgy', business: 'business casual' };

export const DEFAULT_CONTEXT = parseContext('Rainy Tuesday coffee meeting, 16°C');
export const EXAMPLE_PROMPTS_OLD = [
  'Rainy Tuesday coffee meeting, 16°C',
  'Sunny beach café, 30°C',
  'Office presentation, 22°C',
  'Kyoto temples in autumn, 12°C',
  'Winter dinner date in Seoul, 2°C',
];

export const EXAMPLE_PROMPTS = [
  'Rainy Tuesday coffee meeting, 16°C',
  'Sunday church, warm',
  'Office presentation, 22°C',
  'Dinner date, 18°C',
  'Beach vacation, 30°C',
];
