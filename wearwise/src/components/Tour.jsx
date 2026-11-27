// "How to use Wearwise": a short tour that points at the real buttons, one at a time (like Tiffo's).
// Opened from Home ("New here?"), More, Settings and the footer. Esc / ← → work; nothing is changed by the tour.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useStore } from '../store.jsx';

const SEEN = 'wearwise.tourSeen';
export const tourSeen = () => { try { return localStorage.getItem(SEEN) === '1'; } catch { return true; } };
export const startTour = () => window.dispatchEvent(new Event('wearwise:tour'));

const nav = (h) => `.nav a[href="${h}"], .tabbar a[href="${h}"]`;
function steps(hasClothes) {
  return [
    { route: 'home', el: null, title: 'Welcome to Wearwise', text: 'A one-minute tour of the real buttons. You can leave any time with Skip (or Esc), and find this tour again under Settings.' },
    { route: 'home', el: nav('#/closet'), title: 'My Closet: all your clothes in one place', text: 'Every piece you own, with photos. Pieces with details you haven\'t checked yet are marked "Check details".' },
    { route: 'closet', el: '[data-tour="add-clothes"]', title: 'Add clothes', text: 'Add one photo or many at once. The background is removed on your device, and you check the type, color and fabric before anything is saved. Just want to look around? Settings → "Add the demo closet".' },
    { route: 'closet', el: '.search-row', title: 'Find anything', text: 'Search by color, fabric, type or where it\'s kept ("navy linen", "under-bed"), and sort by most or least worn.' },
    { route: 'create', el: '.create-form .ctx-row, .ctx-summary', title: 'Create an Outfit: tell it the plan', text: 'Pick the occasion and the weather (or use today\'s). Optional: a piece you want to wear.' },
    { route: 'create', el: '[data-tour="create-go"]', title: 'Get your outfits', text: 'Wearwise only shows outfits that really work, each with an honest verdict and score. "Improve or change" swaps a piece; the heart saves it.' },
    { route: 'create', el: nav('#/saved'), title: 'Saved', text: 'Your saved outfits. Sort them into wardrobes like "Work", "Home" or "Church".' },
    { route: 'create', el: `.nav a[href="#/calendar"], .tabbar a[href="#/more"]`, title: 'Calendar, trips and more', text: 'Plan what to wear each day, or plan a trip and get a packing list. On a phone it\'s under More, together with History, Insights, the outfit builder, Family and Inspiration.' },
    { route: 'create', el: '.profile-switch', title: 'Family', text: 'Switch between family members. Each person has their own closet and outfits.' },
    { route: 'create', el: '.ai-status', title: 'Turn on AI (optional and free)', text: 'Sign in with a free Puter account to switch on the Gemini stylist and realistic photos. Without it, the built-in rules engine still styles everything.' },
    { route: 'create', el: '[data-tour="account"]', title: 'Sign in to keep it safe', text: 'A free account backs up your closet and lets you use it on your phone and computer. Without one, everything stays in this browser.' },
    { route: 'create', el: '.icon-link[href="#/settings"]', title: 'Settings', text: 'What stays on your device and what\'s sent to AI, your storage places, deleting your data, and this tour.' },
    hasClothes
      ? { route: 'create', el: '[data-tour="create-go"]', title: 'Your turn!', text: 'Get your first outfits now.', last: 'Get my outfits' }
      : { route: 'closet', el: '[data-tour="add-clothes"]', title: 'Your turn!', text: 'Add your first piece of clothing.', last: 'Add my first piece' },
  ];
}

const visible = (sel) => (sel ? [...document.querySelectorAll(sel)].find((x) => x.getClientRects().length && getComputedStyle(x).visibility !== 'hidden') || null : null);
const routeNow = () => (window.location.hash.split('/')[1] || 'home');

export default function Tour() {
  const { owned } = useStore();
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [box, setBox] = useState(null); // highlighted element's rectangle, or null (centered card)
  const [, force] = useState(0);
  const tipRef = useRef(null), nextRef = useRef(null), elRef = useRef(null);
  const list = steps(owned.length > 0);
  const st = list[i];

  useEffect(() => {
    const onStart = () => { setI(0); setOpen(true); };
    window.addEventListener('wearwise:tour', onStart);
    return () => window.removeEventListener('wearwise:tour', onStart);
  }, []);

  const close = useCallback(() => {
    setOpen(false); setBox(null);
    try { localStorage.setItem(SEEN, '1'); } catch { /* private mode */ }
    window.dispatchEvent(new Event('wearwise:tourseen'));
  }, []);

  const place = useCallback(() => {
    const el = elRef.current;
    if (!el || !el.isConnected) { setBox(null); return; }
    const r = el.getBoundingClientRect(), maxH = window.innerHeight * 0.45; // a very tall element: highlight its top part
    setBox(r.height > maxH ? { left: r.left, top: r.top, width: r.width, height: maxH, right: r.right, bottom: r.top + maxH } : r);
  }, []);

  // Show a step: go to its page, wait for the button to appear, scroll it into view, highlight it.
  useEffect(() => {
    if (!open) return;
    let tries = 0, cancelled = false;
    if (routeNow() !== st.route && !(st.route === 'home' && routeNow() === '')) window.location.hash = '#/' + st.route;
    const find = () => {
      if (cancelled) return;
      const el = visible(st.el);
      if (!el && st.el && tries++ < 25) { setTimeout(find, 40); return; }
      elRef.current = el;
      if (el) el.scrollIntoView({ block: el.getBoundingClientRect().height > window.innerHeight * 0.5 ? 'start' : 'center', behavior: 'auto' });
      place();
      setTimeout(place, 90); // again once the card has its final size
      nextRef.current?.focus({ preventScroll: true });
    };
    find();
    return () => { cancelled = true; };
  }, [open, i]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') move(1);
      if (e.key === 'ArrowLeft') move(-1);
    };
    const onPos = () => place();
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onPos);
    window.addEventListener('scroll', onPos, true);
    document.body.classList.add('touring');
    return () => { document.removeEventListener('keydown', onKey); window.removeEventListener('resize', onPos); window.removeEventListener('scroll', onPos, true); document.body.classList.remove('touring'); };
  }); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => { if (open) force((n) => n + 1); }, [box, open]); // measure the card after it renders

  function move(d) {
    if (i + d >= list.length) { // the last step: do the thing
      close();
      const el = elRef.current;
      setTimeout(() => el?.isConnected && el.click(), 60);
      return;
    }
    setI(Math.max(0, i + d));
  }

  if (!open) return null;
  // Card position: below the button if there's room, otherwise above; centered when there's nothing to point at.
  const W = window.innerWidth, H = window.innerHeight, pad = 6, gap = 12;
  const tw = tipRef.current?.offsetWidth || Math.min(352, W - 32), th = tipRef.current?.offsetHeight || 170;
  let spot = null, tip;
  if (box) {
    spot = { left: box.left - pad, top: box.top - pad, width: box.width + pad * 2, height: box.height + pad * 2 };
    let top = box.bottom + pad + gap;
    if (top + th > H - 8) top = box.top - pad - gap - th;
    if (top < 8) top = Math.min(H - th - 8, Math.max(8, box.bottom + pad + gap));
    tip = { left: Math.min(Math.max(8, box.left + box.width / 2 - tw / 2), W - tw - 8), top };
  } else {
    tip = { left: (W - tw) / 2, top: Math.max(8, (H - th) / 2) };
  }
  return (
    <div className="tour" aria-live="polite">
      <div className="tour-block" onClick={(e) => e.stopPropagation()} />
      <div className={'tour-spot' + (spot ? '' : ' none')} style={spot || { left: W / 2, top: H / 2, width: 0, height: 0 }} />
      <div className="tour-tip" ref={tipRef} role="dialog" aria-modal="true" aria-labelledby="tour-title" style={tip}>
        <div className="tour-count">{i + 1} of {list.length}</div>
        <h3 id="tour-title" className="tour-title">{st.title}</h3>
        <p className="tour-text">{st.text}</p>
        <div className="tour-actions">
          <button type="button" className="tour-skip" onClick={close}>Skip tour</button>
          <span>
            {i > 0 && <button type="button" className="btn sm ghost" onClick={() => move(-1)}>Back</button>}
            <button type="button" ref={nextRef} className="btn sm accent" onClick={() => move(1)}>{st.last || 'Next'}</button>
          </span>
        </div>
      </div>
    </div>
  );
}

/** "New here? Take the 1-minute tour": shown until the tour has been opened once. */
export function NewHereLink({ className = '' }) {
  const [seen, setSeen] = useState(tourSeen());
  useEffect(() => { const f = () => setSeen(true); window.addEventListener('wearwise:tourseen', f); return () => window.removeEventListener('wearwise:tourseen', f); }, []);
  if (seen) return null;
  return <button type="button" className={'linklike new-here ' + className} onClick={startTour}>New here? Take the 1-minute tour →</button>;
}
