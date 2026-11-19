// App state: one reducer, persisted to localStorage (and synced to Supabase when signed in, see auth.jsx).
//
// v2 model:
//   profiles   family members, each with her/his own closet ({ id, name, kind: 'adult' | 'child' })
//   garments   every piece carries ownerId (a profile id); demo pieces carry demo: true
//   outfits    saved looks: { id, name, profileId, slots, context, stage, favorite, createdAt }
//   catalogs   lookbooks & trips (per profile)
//   ensembles  saved family looks: { id, name, context, members: [{ profileId, slots }] }
import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { DEMO_CLOSET, DEMO_OUTFITS, DEMO_CATALOGS, BAG_ARTS } from './data/closet.js';
import { DEMO_FAMILY } from './data/family.js';
import { SAMPLE_INSPIRATION } from './ai/inspiration.js';
import { parseContext, DEFAULT_CONTEXT } from './ai/context.js';
import { preferenceProfile } from './ai/insights.js';
import { critique } from './ai/critic.js';

const KEY = 'unique-ava.v1';
const VERSION = 2;
const uid = (p) => p + '-' + Math.random().toString(36).slice(2, 9);
const ME = 'p-me';
const emptySlots = () => ({ top: null, bottom: null, outer: null, shoes: null, bag: null, accessory: null });

export function initialState() {
  return {
    version: VERSION,
    onboarded: false,
    profiles: [{ id: ME, name: 'Me', kind: 'adult' }],
    activeProfile: ME,
    garments: [],
    outfits: [],
    catalogs: [],
    ensembles: [],
    inspirations: [],
    locations: [],   // where clothes are kept: [{ id, name }] (shared by the household)
    history: [],     // outfits actually worn: [{ id, profileId, date, slots, context, outfitId?, rating?, tags? }]
    draft: { name: '', slots: emptySlots(), context: DEFAULT_CONTEXT, stage: { mode: 'flatlay', scene: 'tokyo-rain', customBg: null } },
  };
}

// ── Migration from the first version (one person, hardcoded sample closet, bags in "accessory").
const DEMO_IDS = new Set([...DEMO_CLOSET.map((g) => g.id), 't-white-tee', 'a-tote']);
const DEMO_OUTFIT_IDS = new Set(['o-spring-1', 'o-spring-2', 'o-spring-3', 'o-kyoto-1', 'o-kyoto-2', 'o-kyoto-3', 'o-kyoto-4']);
const DEMO_CATALOG_IDS = new Set(['c-spring', 'c-kyoto']);
function fixSlots(slots, byId) {
  const s = { ...emptySlots(), ...(slots || {}) };
  for (const k of Object.keys(s)) if (s[k] && String(s[k]).startsWith('basic-')) s[k] = null; // old "basics" she never owned
  const acc = s.accessory && byId.get(s.accessory);
  if (acc && BAG_ARTS.includes(acc.art) && !s.bag) { s.bag = s.accessory; s.accessory = null; }
  return s;
}
export function migrate(raw) {
  if (!raw || typeof raw !== 'object') return initialState();
  if (raw.version === VERSION) return { ...initialState(), ...raw };
  const base = initialState();
  const garments = (raw.garments || []).filter((g) => !g.placeholder).map((g) => ({
    ...g, ownerId: g.ownerId || ME, demo: g.demo ?? (DEMO_IDS.has(g.id) && !g.uploaded),
  }));
  const byId = new Map(garments.map((g) => [g.id, g]));
  return {
    ...base,
    onboarded: !!raw.onboarded,
    garments,
    outfits: (raw.outfits || []).map((o) => ({ ...o, profileId: o.profileId || ME, slots: fixSlots(o.slots, byId), demo: o.demo ?? DEMO_OUTFIT_IDS.has(o.id) })),
    catalogs: (raw.catalogs || []).map((c) => ({ ...c, profileId: c.profileId || ME, demo: c.demo ?? DEMO_CATALOG_IDS.has(c.id) })),
    inspirations: (raw.inspirations || []).map((i) => ({ ...i, profileId: i.profileId || ME, demo: i.demo ?? /^insp-\d$/.test(i.id) })),
    draft: { ...base.draft, ...(raw.draft || {}), slots: fixSlots(raw.draft?.slots, byId) },
    aiCritiques: raw.aiCritiques,
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch { /* storage unavailable: start fresh */ }
  return initialState();
}

function demoBundle(state) {
  const owner = state.activeProfile;
  const now = Date.now();
  const garments = DEMO_CLOSET.map((g) => ({ ...g, ownerId: owner }));
  const outfits = DEMO_OUTFITS.map((o) => ({
    id: o.id, name: o.name, profileId: owner, demo: true, favorite: o.id === 'o-kyoto-3',
    slots: { ...emptySlots(), ...o.slots }, context: parseContext(o.prompt), stage: o.stage || { mode: 'flatlay', scene: 'studio' }, createdAt: now,
  }));
  const catalogs = DEMO_CATALOGS.map((c) => ({ ...c, profileId: owner, demo: true, createdAt: now }));
  const inspirations = SAMPLE_INSPIRATION.map((i) => ({ ...i, profileId: owner, demo: true }));
  // Demo family members (so family looks can be tried right away)
  const profiles = DEMO_FAMILY.profiles.filter((p) => !state.profiles.some((x) => x.id === p.id)).map((p) => ({ ...p, demo: true }));
  const familyGarments = DEMO_FAMILY.garments;
  return { garments: [...garments, ...familyGarments], outfits, catalogs, inspirations, profiles };
}

function reducer(state, a) {
  const me = state.activeProfile;
  switch (a.type) {
    case 'ONBOARDED': return { ...state, onboarded: true };

    // ── family members
    case 'ADD_PROFILE': {
      const p = { id: uid('p'), name: a.name || 'New member', kind: a.kind || 'adult' };
      return { ...state, profiles: [...state.profiles, p], activeProfile: p.id, draft: { ...state.draft, name: '', slots: emptySlots() } };
    }
    case 'UPDATE_PROFILE': return { ...state, profiles: state.profiles.map((p) => (p.id === a.profile.id ? { ...p, ...a.profile } : p)) };
    case 'DELETE_PROFILE': {
      if (a.id === ME || state.profiles.length <= 1) return state;
      return {
        ...state,
        profiles: state.profiles.filter((p) => p.id !== a.id),
        garments: state.garments.filter((g) => g.ownerId !== a.id),
        outfits: state.outfits.filter((o) => o.profileId !== a.id),
        catalogs: state.catalogs.filter((c) => c.profileId !== a.id),
        ensembles: state.ensembles.map((e) => ({ ...e, members: e.members.filter((m) => m.profileId !== a.id) })).filter((e) => e.members.length),
        activeProfile: state.activeProfile === a.id ? ME : state.activeProfile,
        history: state.history.filter((h) => h.profileId !== a.id),
      };
    }
    case 'SWITCH_PROFILE':
      if (a.id === state.activeProfile) return state;
      return { ...state, activeProfile: a.id, draft: { ...state.draft, name: '', slots: emptySlots() } };

    // ── closet
    case 'ADD_GARMENTS': return { ...state, garments: [...a.garments.map((g) => ({ ...g, ownerId: g.ownerId || me, demo: false, addedAt: g.addedAt || new Date().toISOString().slice(0, 10) })), ...state.garments] };
    case 'ADD_GARMENT': return { ...state, garments: [{ ...a.garment, ownerId: a.garment.ownerId || me, demo: false, addedAt: a.garment.addedAt || new Date().toISOString().slice(0, 10) }, ...state.garments] };
    case 'UPDATE_GARMENT': return { ...state, garments: state.garments.map((g) => (g.id === a.garment.id ? { ...g, ...a.garment } : g)) };
    case 'DELETE_GARMENT': {
      const clear = (slots) => Object.fromEntries(Object.entries(slots).map(([k, v]) => [k, v === a.id ? null : v]));
      return { ...state, garments: state.garments.filter((g) => g.id !== a.id), draft: { ...state.draft, slots: clear(state.draft.slots) } };
    }
    case 'LOAD_DEMO': {
      const b = demoBundle(state);
      const have = new Set(state.garments.map((g) => g.id));
      return {
        ...state,
        onboarded: true,
        profiles: [...state.profiles, ...b.profiles],
        garments: [...state.garments, ...b.garments.filter((g) => !have.has(g.id))],
        outfits: [...b.outfits.filter((o) => !state.outfits.some((x) => x.id === o.id)), ...state.outfits],
        catalogs: [...b.catalogs.filter((c) => !state.catalogs.some((x) => x.id === c.id)), ...state.catalogs],
        inspirations: [...b.inspirations.filter((i) => !state.inspirations.some((x) => x.id === i.id)), ...state.inspirations],
      };
    }
    case 'REMOVE_DEMO': {
      const demoProfiles = new Set(state.profiles.filter((p) => p.demo).map((p) => p.id));
      const garments = state.garments.filter((g) => !g.demo && !demoProfiles.has(g.ownerId));
      const keep = new Set(garments.map((g) => g.id));
      const clean = (slots) => Object.fromEntries(Object.entries(slots || {}).map(([k, v]) => [k, keep.has(v) ? v : null]));
      const outfits = state.outfits.filter((o) => !o.demo && !demoProfiles.has(o.profileId));
      const outfitIds = new Set(outfits.map((o) => o.id));
      return {
        ...state,
        profiles: state.profiles.filter((p) => !p.demo),
        activeProfile: demoProfiles.has(state.activeProfile) ? ME : state.activeProfile,
        garments,
        outfits,
        catalogs: state.catalogs.filter((c) => !c.demo).map((c) => ({ ...c, outfitIds: c.outfitIds.filter((x) => outfitIds.has(x)) })),
        ensembles: state.ensembles.filter((e) => !e.demo).map((e) => ({ ...e, members: e.members.filter((m) => !demoProfiles.has(m.profileId)) })).filter((e) => e.members.length),
        inspirations: state.inspirations.filter((i) => !i.demo),
        history: state.history.filter((h) => !demoProfiles.has(h.profileId) && Object.values(h.slots || {}).every((v) => !v || keep.has(v))),
        draft: { ...state.draft, slots: clean(state.draft.slots) },
      };
    }

    // ── builder draft
    case 'SET_SLOT': {
      const slots = { ...state.draft.slots, [a.slot]: a.id };
      if (a.slot === 'top' && a.isDress) slots.bottom = null;           // a dress replaces the bottom
      if (a.slot === 'bottom' && a.id && a.topIsDress) slots.top = null; // choosing a bottom drops the dress
      return { ...state, draft: { ...state.draft, slots } };
    }
    case 'LOAD_DRAFT': return { ...state, draft: { ...state.draft, ...a.draft, slots: { ...emptySlots(), ...(a.draft.slots || state.draft.slots) } } };
    case 'SET_CONTEXT': return { ...state, draft: { ...state.draft, context: a.context, choice: a.choice || state.draft.choice } };
    case 'SET_STAGE': return { ...state, draft: { ...state.draft, stage: { ...state.draft.stage, ...a.stage } } };
    case 'SET_NAME': return { ...state, draft: { ...state.draft, name: a.name } };

    // ── saved outfits
    case 'SAVE_OUTFIT': {
      const src = a.outfit || { slots: state.draft.slots, context: state.draft.context, stage: state.draft.stage };
      const outfit = {
        id: uid('o'), name: a.name || src.name || 'Untitled look', profileId: a.profileId || me, favorite: !!(a.favorite || src.favorite),
        ...(src.why ? { why: src.why } : {}), ...(src.source ? { source: src.source } : {}),
        slots: { ...emptySlots(), ...src.slots }, context: src.context || state.draft.context,
        stage: { ...(src.stage || { mode: 'flatlay' }), mode: src.stage?.mode === 'person' ? 'flatlay' : (src.stage?.mode || 'flatlay'), customBg: null, personPhoto: null },
        createdAt: Date.now(),
      };
      let catalogs = state.catalogs;
      if (a.newCatalog) catalogs = [{ id: uid('c'), outfitIds: [outfit.id], profileId: me, createdAt: Date.now(), ...a.newCatalog }, ...catalogs];
      else if (a.catalogId) catalogs = catalogs.map((c) => (c.id === a.catalogId ? { ...c, outfitIds: [...c.outfitIds, outfit.id] } : c));
      return { ...state, outfits: [outfit, ...state.outfits], catalogs, lastSavedId: outfit.id };
    }
    case 'TOGGLE_FAVORITE': return { ...state, outfits: state.outfits.map((o) => (o.id === a.id ? { ...o, favorite: !o.favorite } : o)) };
    case 'RENAME_OUTFIT': return { ...state, outfits: state.outfits.map((o) => (o.id === a.id ? { ...o, name: a.name } : o)) };
    case 'DELETE_OUTFIT': return {
      ...state,
      outfits: state.outfits.filter((o) => o.id !== a.id),
      catalogs: state.catalogs.map((c) => ({ ...c, outfitIds: c.outfitIds.filter((x) => x !== a.id) })),
    };
    case 'CREATE_CATALOG': return { ...state, catalogs: [{ id: uid('c'), outfitIds: [], profileId: me, createdAt: Date.now(), ...a.catalog }, ...state.catalogs] };
    case 'DELETE_CATALOG': return { ...state, catalogs: state.catalogs.filter((c) => c.id !== a.id) };
    case 'ADD_TO_CATALOG': return { ...state, catalogs: state.catalogs.map((c) => (c.id === a.catalogId && !c.outfitIds.includes(a.outfitId) ? { ...c, outfitIds: [...c.outfitIds, a.outfitId] } : c)) };
    case 'REMOVE_FROM_CATALOG': return { ...state, catalogs: state.catalogs.map((c) => (c.id === a.catalogId ? { ...c, outfitIds: c.outfitIds.filter((x) => x !== a.outfitId) } : c)) };

    // ── family looks
    case 'SAVE_ENSEMBLE': return { ...state, ensembles: [{ id: uid('e'), createdAt: Date.now(), ...a.ensemble }, ...state.ensembles] };
    case 'DELETE_ENSEMBLE': return { ...state, ensembles: state.ensembles.filter((e) => e.id !== a.id) };

    case 'CACHE_CRITIQUE': {
      const entries = Object.entries({ ...(state.aiCritiques || {}), [a.key]: a.critique }).slice(-30);
      return { ...state, aiCritiques: Object.fromEntries(entries) };
    }
    case 'ADD_INSPIRATION': return { ...state, inspirations: [{ profileId: me, ...a.inspiration }, ...state.inspirations] };
    case 'DELETE_INSPIRATION': return { ...state, inspirations: state.inspirations.filter((i) => i.id !== a.id) };
    // ── where clothes are kept
    case 'ADD_LOCATION': return state.locations.some((l) => l.name.toLowerCase() === a.location.name.toLowerCase()) ? state : { ...state, locations: [...state.locations, a.location] };
    case 'RENAME_LOCATION': return { ...state, locations: state.locations.map((l) => (l.id === a.id ? { ...l, name: a.name } : l)) };
    case 'DELETE_LOCATION': return { ...state, locations: state.locations.filter((l) => l.id !== a.id), garments: state.garments.map((g) => (g.location === a.id ? { ...g, location: null } : g)) };

    // ── outfit history & feedback
    case 'LOG_WEAR': return { ...state, history: [{ id: uid('w'), profileId: a.entry.profileId || me, date: a.entry.date || new Date().toISOString().slice(0, 10), slots: { ...emptySlots(), ...a.entry.slots }, context: a.entry.context || null, outfitId: a.entry.outfitId || null, createdAt: Date.now() }, ...state.history] };
    case 'RATE_WEAR': return { ...state, history: state.history.map((h) => (h.id === a.id ? { ...h, rating: a.rating ?? h.rating, tags: a.tags ?? h.tags, note: a.note ?? h.note } : h)) };
    case 'UPDATE_WEAR_DATE': return { ...state, history: state.history.map((h) => (h.id === a.id ? { ...h, date: a.date } : h)).sort((x, y) => (y.date || '').localeCompare(x.date || '')) };
    case 'DELETE_WEAR': return { ...state, history: state.history.filter((h) => h.id !== a.id) };

    case 'DELETE_ALL': return { ...initialState(), onboarded: true };
    case 'RESET': return { ...initialState(), onboarded: true };
    case 'HYDRATE': return { ...migrate(a.state), onboarded: true };
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
    const index = new Map(state.garments.map((g) => [g.id, g]));
    const get = (id) => (id ? index.get(id) || null : null);
    const resolve = (slots) => Object.fromEntries(Object.entries(slots || {}).map(([k, v]) => [k, get(v)]));
    const profile = state.profiles.find((p) => p.id === state.activeProfile) || state.profiles[0];
    const closetOf = (pid) => state.garments.filter((g) => g.ownerId === pid);
    const owned = closetOf(profile.id);           // the active member's closet
    const pool = owned;                           // recommendations only ever use what she owns
    const outfitsOf = (pid) => state.outfits.filter((o) => o.profileId === pid);
    const scoreOf = (outfit) => critique(resolve(outfit.slots), outfit.context).overall;
    const hasDemo = state.garments.some((g) => g.demo) || state.profiles.some((p) => p.demo);
    const historyOf = (pid) => state.history.filter((h) => h.profileId === pid);
    const personal = preferenceProfile(historyOf(profile.id), get);
    return { state, dispatch, get, resolve, owned, pool, profile, closetOf, outfitsOf, scoreOf, hasDemo, historyOf, personal };
  }, [state]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);
