/* ---------- Realistic AI photos, made automatically once you're signed in ----------
   Dishes without a real photo show a drawing (a "demo picture"). When you're signed in with
   Puter, a realistic photo is generated for each such dish as you look at it, one at a time.
   Each photo is made once, then kept on this device (IndexedDB) and in your own Puter storage,
   so it isn't made again and follows you to other devices. A daily cap protects your free
   AI allowance. Real photos always take priority. */
const AIPhoto = (() => {
  const DB = "p2p-photos", STORE = "photos", DAILY_CAP = 24, W = 640, H = 800;
  const mem = new Map();        // id -> object URL
  const pending = new Map();    // id -> Promise<url|null>
  const failed = new Set();     // ids that failed this session (no retry loop)
  const queue = []; let running = false;
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((res) => { try { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => res(r.result); r.onerror = () => res(null); } catch (e) { res(null); } });
    return dbp;
  }
  async function idb(mode, fn) { const d = await db(); if (!d) return null; return new Promise(res => { try { const t = d.transaction(STORE, mode), s = t.objectStore(STORE), q = fn(s); q.onsuccess = () => res(q.result ?? null); q.onerror = () => res(null); } catch (e) { res(null); } }); }
  const key = r => (r.ai ? "ai:" : "") + r.id + ":v1";
  const fsPath = r => "dish-photos/" + key(r).replace(/[^a-z0-9:-]/gi, "-").replace(/:/g, "_") + ".webp";
  function signedIn() { return !!(S.puterConnected && window.puter && window.puter.ai && window.puter.ai.txt2img); }
  function wanted(r) { return r && !PHOTOS[r.id]; }
  function todayCount() { try { const d = JSON.parse(localStorage.getItem("p2p.photoday") || "{}"); return d.day === E.todayISO() ? d.n : 0; } catch (e) { return 0; } }
  function bump() { try { localStorage.setItem("p2p.photoday", JSON.stringify({ day: E.todayISO(), n: todayCount() + 1 })); } catch (e) {} }
  async function cached(r) {
    const k = key(r); if (mem.has(k)) return mem.get(k);
    let blob = await idb("readonly", s => s.get(k));
    if (!blob && signedIn() && window.puter.fs) { try { blob = await window.puter.fs.read(fsPath(r)); if (blob) idb("readwrite", s => s.put(blob, k)); } catch (e) { blob = null; } }
    if (!blob) return null;
    const url = URL.createObjectURL(blob); mem.set(k, url); return url;
  }
  function prompt(r) {
    const ings = (r.ingredients || []).filter(i => !i.opt && i.k !== "water" && !S.staples.includes(i.k)).slice(0, 6).map(i => i.label || i.name || E.ingName(i.k)).join(", ");
    const vessel = { glass: "in a tall clear glass", bowl: "in a simple white bowl", board: "on a wooden board", skillet: "in a black cast-iron pan" }[r.plating] || "on a simple white plate";
    return `A realistic, appetizing food photograph of ${r.title}, ${r.cuisine} home cooking. ${r.desc || ""} Main ingredients: ${ings}. Served ${vessel} on a light warm-gray kitchen table, soft natural daylight, shot from about 45 degrees, shallow depth of field. Only this dish: no text, no labels, no people, no hands, no logos.`;
  }
  async function generate(r) {
    const img = await window.puter.ai.txt2img(prompt(r));
    if (!img || !img.src) throw new Error("no image");
    if (!img.complete || !img.naturalWidth) await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error("image failed")); });
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const c = cv.getContext("2d");
    const s = Math.max(W / img.naturalWidth, H / img.naturalHeight), w = img.naturalWidth * s, h = img.naturalHeight * s;
    c.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
    const blob = await new Promise(res => cv.toBlob(res, "image/webp", .8)) || await new Promise(res => cv.toBlob(res, "image/jpeg", .82));
    if (!blob) throw new Error("couldn't save image");
    await idb("readwrite", s => s.put(blob, key(r)));
    if (window.puter.fs) { try { await window.puter.fs.write(fsPath(r), blob, { createMissingParents: true, overwrite: true }); } catch (e) {} }
    bump();
    const url = URL.createObjectURL(blob); mem.set(key(r), url); return url;
  }
  async function pump() {
    if (running) return; running = true;
    while (queue.length) {
      const { r, resolve } = queue.shift();
      if (!signedIn() || todayCount() >= DAILY_CAP) { resolve(null); continue; }
      try { resolve(await generate(r)); } catch (e) { console.warn("AI photo failed for", r.id, e); failed.add(key(r)); resolve(null); }
    }
    running = false;
  }
  /* Get a photo URL for this recipe: cached if we have one, otherwise (when signed in) make one. */
  function get(r) {
    const k = key(r);
    if (pending.has(k)) return pending.get(k);
    const p = (async () => {
      const hit = await cached(r); if (hit) return hit;
      if (!signedIn() || failed.has(k) || todayCount() >= DAILY_CAP) return null;
      return new Promise(resolve => { queue.push({ r, resolve }); pump(); });
    })();
    pending.set(k, p); p.then(u => { if (!u) pending.delete(k); });
    return p;
  }
  /* Swap a drawing for the photo when it's ready. */
  function attach(cv, r) {
    if (!wanted(r)) return;
    const k = key(r), busy = signedIn() && !mem.has(k) && !failed.has(k) && todayCount() < DAILY_CAP;
    if (busy) cv.classList.add("making-photo");
    get(r).then(url => {
      cv.classList.remove("making-photo");
      if (!url || !cv.isConnected) return;
      const img = new Image(); img.alt = r.title + " (AI-generated photo)"; img.decoding = "async";
      img.className = cv.className + " dish-photo ai-photo";
      img.onload = () => { if (cv.isConnected) { cv.replaceWith(img); requestAnimationFrame(() => img.classList.add("in")); } };
      img.src = url;
      if (cv.id === "plate") updateCaption(r);
    });
  }
  function state(r) {
    if (!wanted(r)) return "real";
    if (mem.has(key(r))) return "ai";
    if (!signedIn()) return "demo";
    if (failed.has(key(r))) return "failed";
    if (todayCount() >= DAILY_CAP) return "capped";
    return "making";
  }
  function caption(r) {
    switch (state(r)) {
      case "ai": return `<p class="photo-credit">AI-generated photo · made for you by Puter. It shows the idea of the dish, not a tested result.</p>`;
      case "demo": return `<p class="photo-credit demo-note">${icon("spark")}<span><b>Demo picture.</b> Realistic photos appear when you sign in to the free AI.</span>${CLOUD_OK ? `<button class="linkbtn" data-act="account">Sign in</button>` : ""}</p>`;
      case "making": return `<p class="photo-credit">${icon("spark")} Making a realistic photo of this dish…</p>`;
      case "capped": return `<p class="photo-credit">Demo picture. Today's free photo limit is reached; more photos tomorrow.</p>`;
      default: return `<p class="photo-credit">Demo picture. A realistic photo couldn't be made right now.</p>`;
    }
  }
  function updateCaption(r) { const el = document.querySelector("#detail .photo-credit"); if (el && S.ui.currentId === r.id) el.outerHTML = caption(r); }
  return { attach, caption, state, key, _todayCount: todayCount };
})();
