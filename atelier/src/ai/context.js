// Turns a free-text situation ("Rainy Tuesday coffee meeting, 16°C") into structured context.
// In production, vague prompts fall back to the atelier-ai Edge Function (task: "parse-context").

const OCCASIONS = [
  { id: 'wedding', label: 'Wedding / formal event', formality: 5, re: /wedding|gala|black tie|ceremony|formal/ },
  { id: 'interview', label: 'Interview', formality: 4, re: /interview|pitch|client|board/ },
  { id: 'office', label: 'Office / work', formality: 3.5, re: /office|work|meeting|presentation|conference|business/ },
  { id: 'dinner', label: 'Dinner / date', formality: 3, re: /dinner|date|restaurant|theatre|theater|bar|drinks/ },
  { id: 'coffee', label: 'Coffee / brunch', formality: 2.5, re: /coffee|caf[eé]|brunch|lunch/ },
  { id: 'travel', label: 'Sightseeing / travel', formality: 2, re: /trip|travel|sightseeing|temple|museum|walk|tour|airport|flight/ },
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
  };
}

export const DEFAULT_CONTEXT = parseContext('Rainy Tuesday coffee meeting, 16°C');
export const EXAMPLE_PROMPTS = [
  'Rainy Tuesday coffee meeting, 16°C',
  'Sunny beach café, 30°C',
  'Office presentation, 22°C',
  'Kyoto temples in autumn, 12°C',
  'Winter dinner date in Seoul, 2°C',
];
