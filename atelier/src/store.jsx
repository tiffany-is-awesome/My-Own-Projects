// App state: one reducer, persisted to localStorage (wrapped in try/catch).
// In Phase 1 this becomes Supabase tables (see docs/ARCHITECTURE.md §5).
import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { SAMPLE_CLOSET, BASICS } from './data/closet.js';
import { SAMPLE_INSPIRATION } from './ai/inspiration.js';
import { parseContext, DEFAULT_CONTEXT } from './ai/context.js';
import { critique } from './ai/critic.js';

const KEY = 'atelier.v1';
const uid = (p) => p + '-' + Math.random().toString(36).slice(2, 9);

const seedOutfit = (id, name, slots, prompt, stage = { mode: 'flatlay', scene: 'studio' }) => ({
  id, name, slots, context: parseContext(prompt), stage, createdAt: Date.now(),
});

function initialState() {
  const outfits = [
    seedOutfit('o-spring-1', 'Weekend Oxford', { top: 't-oxford-blue', bottom: 'b-olive-chino', outer: 'o-denim-jacket', shoes: 's-white-sneaker', accessory: 'a-tote' }, 'Weekend market, 19°C'),
    seedOutfit('o-spring-2', 'Breton & Trench', { top: 't-stripe-tee', bottom: 'b-dark-denim', outer: 'o-trench', shoes: 's-white-sneaker', accessory: 'a-tote' }, 'Brunch in Paris, 17°C', { mode: 'scene', scene: 'paris-street' }),
    seedOutfit('o-spring-3', 'Linen Lunch', { top: 't-linen-shirt', bottom: 'b-beige-shorts', shoes: 's-sandal', accessory: 'a-tote' }, 'Sunny beach café, 29°C', { mode: 'scene', scene: 'beach-cafe' }),
    seedOutfit('o-kyoto-1', 'Day 1 · Temples', { top: 't-black-turtle', bottom: 'b-olive-chino', outer: 'o-wool-coat', shoes: 's-black-boot', accessory: 'a-scarf' }, 'Kyoto temples in autumn, 11°C', { mode: 'scene', scene: 'kyoto-autumn' }),
    seedOutfit('o-kyoto-2', 'Day 2 · Gion walk', { top: 't-cream-knit', bottom: 'b-dark-denim', outer: 'o-trench', shoes: 's-black-boot' }, 'Kyoto sightseeing, 13°C'),
    seedOutfit('o-kyoto-3', 'Day 3 · Dinner', { top: 't-black-turtle', bottom: 'b-black-slacks', outer: 'o-wool-coat', shoes: 's-black-boot', accessory: 'a-scarf' }, 'Dinner in Kyoto, 10°C'),
    seedOutfit('o-kyoto-4', 'Day 4 · Train home', { top: 't-rust-knit', bottom: 'b-dark-denim', outer: 'o-puffer', shoes: 's-white-sneaker' }, 'Travel day, 12°C'),
  ];
  return {
    onboarded: false,
    garments: SAMPLE_CLOSET,
    outfits,
    catalogs: [
      { id: 'c-spring', title: 'Spring Rotation', kind: 'collection', outfitIds: ['o-spring-1', 'o-spring-2', 'o-spring-3'], createdAt: Date.now() },
      { id: 'c-kyoto', title: '4-Day Kyoto Trip', kind: 'trip', trip: { city: 'Kyoto', days: 4 }, outfitIds: ['o-kyoto-1', 'o-kyoto-2', 'o-kyoto-3', 'o-kyoto-4'], createdAt: Date.now() },
    ],
    inspirations: SAMPLE_INSPIRATION,
    draft: {
      name: '',
      slots: { top: 't-oxford-blue', bottom: 'b-olive-chino', outer: 'o-trench', shoes: 's-suede-loafer', accessory: null },
      context: DEFAULT_CONTEXT,
      stage: { mode: 'flatlay', scene: 'tokyo-rain', customBg: null },
    },
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...initialState(), ...JSON.parse(raw) };
  } catch { /* storage unavailable: start fresh */ }
  return initialState();
}

function reducer(state, a) {
  switch (a.type) {
    case 'ONBOARDED': return { ...state, onboarded: true };
    case 'ADD_GARMENT': return { ...state, garments: [a.garment, ...state.garments] };
    case 'UPDATE_GARMENT': return { ...state, garments: state.garments.map((g) => (g.id === a.garment.id ? a.garment : g)) };
    case 'DELETE_GARMENT': {
      const slots = Object.fromEntries(Object.entries(state.draft.slots).map(([k, v]) => [k, v === a.id ? null : v]));
      return { ...state, garments: state.garments.filter((g) => g.id !== a.id), draft: { ...state.draft, slots } };
    }
    case 'SET_SLOT': return { ...state, draft: { ...state.draft, slots: { ...state.draft.slots, [a.slot]: a.id } } };
    case 'LOAD_DRAFT': return { ...state, draft: { ...state.draft, ...a.draft } };
    case 'SET_CONTEXT': return { ...state, draft: { ...state.draft, context: a.context } };
    case 'SET_STAGE': return { ...state, draft: { ...state.draft, stage: { ...state.draft.stage, ...a.stage } } };
    case 'SET_NAME': return { ...state, draft: { ...state.draft, name: a.name } };
    case 'SAVE_OUTFIT': {
      const outfit = { id: uid('o'), name: a.name || 'Untitled look', slots: { ...state.draft.slots }, context: state.draft.context, stage: { ...state.draft.stage, customBg: null }, createdAt: Date.now() };
      let catalogs = state.catalogs;
      if (a.newCatalog) catalogs = [{ id: uid('c'), outfitIds: [outfit.id], createdAt: Date.now(), ...a.newCatalog }, ...catalogs];
      else if (a.catalogId) catalogs = catalogs.map((c) => (c.id === a.catalogId ? { ...c, outfitIds: [...c.outfitIds, outfit.id] } : c));
      return { ...state, outfits: [outfit, ...state.outfits], catalogs };
    }
    case 'CREATE_CATALOG': return { ...state, catalogs: [{ id: uid('c'), outfitIds: [], createdAt: Date.now(), ...a.catalog }, ...state.catalogs] };
    case 'DELETE_CATALOG': return { ...state, catalogs: state.catalogs.filter((c) => c.id !== a.id) };
    case 'REMOVE_FROM_CATALOG': return { ...state, catalogs: state.catalogs.map((c) => (c.id === a.catalogId ? { ...c, outfitIds: c.outfitIds.filter((x) => x !== a.outfitId) } : c)) };
    case 'ADD_INSPIRATION': return { ...state, inspirations: [a.inspiration, ...state.inspirations] };
    case 'RESET': return { ...initialState(), onboarded: true };
    default: return state;
  }
}

const Ctx = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* quota or private mode: keep in memory */ }
  }, [state]);

  const api = useMemo(() => {
    const index = new Map([...BASICS, ...state.garments].map((g) => [g.id, g]));
    const get = (id) => (id ? index.get(id) || null : null);
    const resolve = (slots) => Object.fromEntries(Object.entries(slots || {}).map(([k, v]) => [k, get(v)]));
    const owned = state.garments;
    const pool = [...state.garments, ...BASICS];
    const scoreOf = (outfit) => critique(resolve(outfit.slots), outfit.context).overall;
    return { state, dispatch, get, resolve, owned, pool, scoreOf };
  }, [state]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);
