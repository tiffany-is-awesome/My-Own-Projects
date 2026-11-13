// Photo slots: real photos (e.g. generated with Gemini) replace the built-in renders.
//
// How it works:
//   1. Put image files in the repo-root folder  unique-ava-photos/  (next to unique-ava.html).
//   2. List them in  unique-ava-photos/manifest.json , e.g.
//        { "garments": { "t-white-tee": "t-white-tee.webp" },
//          "scenes":   { "tokyo-rain": "scene-tokyo-rain.webp" },
//          "model": "model.webp", "hero": "hero.webp" }
//   3. Commit. No rebuild needed: the app reads the manifest when it loads.
// Anything not listed (or that fails to load) falls back to the built-in render.
// Prompts for every slot: unique-ava/GEMINI-PHOTO-PROMPTS.md
import { useSyncExternalStore } from 'react';

const BASE = 'unique-ava-photos/';
let state = { garments: {}, scenes: {}, model: null, hero: null, loaded: false };
const subs = new Set();
const set = (s) => { state = s; subs.forEach((f) => f()); };

const url = (file) => (file ? (/^(https?:|data:|\/)/.test(file) ? file : BASE + file) : null);

let started = false;
function load() {
  if (started || typeof window === 'undefined') return;
  started = true;
  if (location.protocol === 'file:') return; // local file preview: no manifest to fetch
  fetch(BASE + 'manifest.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then((m) => {
      if (!m) return;
      const map = (o) => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [k, url(v)]));
      set({ garments: map(m.garments), scenes: map(m.scenes), model: url(m.model), hero: url(m.hero), loaded: true });
    })
    .catch(() => { /* no manifest (or blocked, as in the claude.ai preview): keep renders */ });
}

// Remember images that failed, so we fall back to the render instead of a broken image.
export function markBroken(src) {
  const drop = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== src));
  set({ ...state, garments: drop(state.garments), scenes: drop(state.scenes), model: state.model === src ? null : state.model, hero: state.hero === src ? null : state.hero });
}

export function usePhotos() {
  load();
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state, () => state);
}
