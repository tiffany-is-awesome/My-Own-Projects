// Photos are kept OUT of the main save data, because browser storage (localStorage) only holds about 5 MB and
// one account row shouldn't carry every photo either.
//  - In the app, photos stay as normal image data (data:image/… URLs), so nothing else has to change.
//  - When saving, each photo is replaced by a short reference, "wwphoto:<fingerprint>", and the photo itself is kept
//      · on this device in IndexedDB (the browser's larger storage for files), and
//      · in the account, as a private file in Supabase Storage: wearwise-photos/<user id>/<fingerprint>.<ext>.
//  - When loading, references are turned back into photos.
// The fingerprint is a SHA-256 of the photo, so the same photo is only ever stored once.

export const REF = 'wwphoto:';
export const BUCKET = 'wearwise-photos';
const MIN_LEN = 2000; // tiny images stay inline

export const isPhoto = (v) => typeof v === 'string' && v.length >= MIN_LEN && v.startsWith('data:image/');
export const isRef = (v) => typeof v === 'string' && v.startsWith(REF);

/** Returns a copy of `value` where every string `fn` changes is replaced. `fn` may be async. */
async function mapStrings(value, fn) {
  if (typeof value === 'string') return fn(value);
  if (Array.isArray(value)) return Promise.all(value.map((v) => mapStrings(v, fn)));
  if (value && typeof value === 'object') {
    const out = {};
    await Promise.all(Object.keys(value).map(async (k) => { out[k] = await mapStrings(value[k], fn); }));
    return out;
  }
  return value;
}

/** Every photo reference in a saved state. */
export function refsIn(value, acc = new Set()) {
  if (isRef(value)) acc.add(value.slice(REF.length));
  else if (Array.isArray(value)) value.forEach((v) => refsIn(v, acc));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => refsIn(v, acc));
  return acc;
}

// ───────────── fingerprints (cached, so a 300-photo closet isn't re-hashed on every save)
const idOf = new Map();   // photo data → fingerprint
const dataOf = new Map(); // fingerprint → photo data

const EXT = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif' };
const mimeOf = (dataUrl) => dataUrl.slice(5, dataUrl.indexOf(';'));

export async function fingerprint(dataUrl) {
  const known = idOf.get(dataUrl);
  if (known) return known;
  const bytes = new TextEncoder().encode(dataUrl);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const hex = [...new Uint8Array(hash)].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
  const id = `${hex}.${EXT[mimeOf(dataUrl)] || 'img'}`;
  remember(id, dataUrl);
  return id;
}
function remember(id, dataUrl) {
  idOf.set(dataUrl, id); dataOf.set(id, dataUrl);
  if (idOf.size > 2000) { const [k] = idOf.keys(); dataOf.delete(idOf.get(k)); idOf.delete(k); } // bound memory
}

/** State → savable copy with references. `keep(id, data)` is awaited for each photo (store it somewhere first). */
export async function withRefs(state, keep) {
  return mapStrings(state, async (s) => {
    if (!isPhoto(s)) return s;
    const id = await fingerprint(s);
    await keep(id, s);
    return REF + id;
  });
}

/** Saved copy → state with photos. `fetchPhoto(id)` returns the photo data, or null if it no longer exists. */
export async function withPhotos(saved, fetchPhoto) {
  return mapStrings(saved, async (s) => {
    if (!isRef(s)) return s;
    const id = s.slice(REF.length);
    const cached = dataOf.get(id);
    if (cached) return cached;
    const data = await fetchPhoto(id);
    if (data) remember(id, data);
    return data || null;
  });
}

// ───────────── this device: IndexedDB
const DB = 'wearwise', STORE = 'photos';
let dbp = null;
function db() {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('no IndexedDB'));
  dbp ??= new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => { dbp = null; rej(r.error); };
  });
  return dbp;
}
function tx(mode, run) {
  return db().then((d) => new Promise((res, rej) => {
    const t = d.transaction(STORE, mode);
    const out = run(t.objectStore(STORE));
    t.oncomplete = () => res(out?.result);
    t.onerror = t.onabort = () => rej(t.error || new Error('IndexedDB write failed'));
  }));
}

export const local = {
  async has(id) { return (await tx('readonly', (s) => s.count(id))) > 0; },
  async get(id) { const v = await tx('readonly', (s) => s.get(id)); return v?.data || null; },
  async putMany(entries) { if (entries.length) await tx('readwrite', (s) => entries.forEach(([id, data]) => s.put({ data, at: Date.now() }, id))); },
  async keys() { return tx('readonly', (s) => s.getAllKeys()); },
  /** Delete photos no saved state refers to. Only ones older than an hour: another open tab may be mid-save. */
  async prune(used) {
    const d = await db();
    const cutoff = Date.now() - 3600e3;
    await new Promise((res, rej) => {
      const t = d.transaction(STORE, 'readwrite');
      const req = t.objectStore(STORE).openCursor();
      req.onsuccess = () => { const c = req.result; if (!c) return; if (!used.has(c.key) && (c.value?.at || 0) < cutoff) c.delete(); c.continue(); };
      t.oncomplete = res; t.onerror = () => rej(t.error);
    });
  },
  async clear() { await tx('readwrite', (s) => s.clear()); },
};

/**
 * Savable copy for this device. Photos are written to IndexedDB BEFORE the reference is returned, so a saved
 * reference always has its photo. If IndexedDB isn't available (some private modes), photos stay inline as before.
 */
const onDevice = new Set();
export async function forDevice(state) {
  try {
    const pending = [];
    const saved = await withRefs(state, async (id, data) => { if (!onDevice.has(id)) pending.push([id, data]); });
    await local.putMany(pending);
    pending.forEach(([id]) => onDevice.add(id));
    return saved;
  } catch { return state; }
}
export async function fromDevice(saved) {
  try { return await withPhotos(saved, (id) => local.get(id).then((d) => { if (d) onDevice.add(id); return d; })); }
  catch { return saved; }
}

// ───────────── the account: Supabase Storage (private bucket, one folder per user)
const blobToDataUrl = (b) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });
const inCloud = new Set(); // `${userId}/${id}` known to exist
// At most 4 uploads/downloads at a time, so a big first upload doesn't choke a phone connection.
let active = 0; const waiting = [];
function limit(job) {
  return new Promise((res, rej) => {
    const run = () => { active++; job().then(res, rej).finally(() => { active--; waiting.shift()?.(); }); };
    active < 4 ? run() : waiting.push(run);
  });
}

/** Upload any photos the account doesn't have yet, and return the copy to save in the account row. */
export async function forCloud(supabase, userId, state) {
  const uploads = [];
  const saved = await withRefs(state, async (id, data) => {
    const path = `${userId}/${id}`;
    if (inCloud.has(path)) return;
    uploads.push(limit(async () => {
      const blob = await (await fetch(data)).blob();
      const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || mimeOf(data), upsert: false, cacheControl: '31536000' });
      if (error && !/exists|duplicate|409/i.test(`${error.message} ${error.statusCode || ''}`)) throw error;
      inCloud.add(path);
    }));
  });
  await Promise.all(uploads); // the row is only saved once every photo it mentions is safely uploaded
  return saved;
}

/** Turn an account copy back into a state with photos. Throws on a connection problem (so nothing is lost). */
export async function fromCloud(supabase, userId, saved) {
  return withPhotos(saved, async (id) => {
    const local1 = await local.get(id).catch(() => null);       // already on this device: no download needed
    if (local1) { inCloud.add(`${userId}/${id}`); return local1; }
    const { data, error } = await limit(() => supabase.storage.from(BUCKET).download(`${userId}/${id}`));
    if (error) {
      if (/not found|404|Object not found/i.test(`${error.message} ${error.statusCode || ''} ${error.originalError?.status || ''}`)) return null;
      throw error;
    }
    inCloud.add(`${userId}/${id}`);
    return blobToDataUrl(data);
  });
}

async function listCloud(supabase, userId) {
  const all = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(BUCKET).list(userId, { limit: 1000, offset });
    if (error) throw error;
    all.push(...data);
    if (data.length < 1000) return all;
  }
}

/** Remove account photos the saved closet no longer uses (older than an hour, in case another device is mid-save). */
export async function pruneCloud(supabase, userId, saved) {
  const used = refsIn(saved);
  const cutoff = Date.now() - 3600e3;
  const old = (await listCloud(supabase, userId))
    .filter((f) => f.id && !used.has(f.name) && new Date(f.created_at || 0).getTime() < cutoff)
    .map((f) => `${userId}/${f.name}`);
  for (let i = 0; i < old.length; i += 100) await supabase.storage.from(BUCKET).remove(old.slice(i, i + 100));
  old.forEach((p) => inCloud.delete(p));
  return old.length;
}

/** "Delete all my data": every photo in the account. */
export async function deleteCloudPhotos(supabase, userId) {
  const files = (await listCloud(supabase, userId)).filter((f) => f.id).map((f) => `${userId}/${f.name}`);
  for (let i = 0; i < files.length; i += 100) {
    const { error } = await supabase.storage.from(BUCKET).remove(files.slice(i, i + 100));
    if (error) throw error;
  }
  [...inCloud].filter((p) => p.startsWith(userId + '/')).forEach((p) => inCloud.delete(p));
  return files.length;
}

export function forgetCaches() { idOf.clear(); dataOf.clear(); inCloud.clear(); onDevice.clear(); }
