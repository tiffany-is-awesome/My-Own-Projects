// Accounts (Supabase Auth) + cloud sync of the whole wardrobe to public.wearwise_data (formerly unique_ava_data)
// (the database table keeps its original name; renaming it would break signed-in users mid-session).

// Keep people signed in across the rename: move the old sign-in key once.
function authKey() {
  const NEW = 'wearwise.auth', OLD = 'unique-ava.auth';
  try { if (!localStorage.getItem(NEW) && localStorage.getItem(OLD)) { localStorage.setItem(NEW, localStorage.getItem(OLD)); localStorage.removeItem(OLD); } } catch { /* ignore */ }
  return NEW;
}
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { CONFIG } from './config.js';
import { useStore } from './store.jsx';
import { useToast } from './components/common.jsx';

const configured = !!(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);
export const supabase = configured
  ? createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, { auth: { persistSession: true, storageKey: authKey() } })
  : null;

/** Inside the claude.ai preview, the page can't reach other servers, so accounts only work on the live site. */
export const inClaudePreview = typeof window !== 'undefined' && !!window.claude && window.top !== window;

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

let currentSession = null;
/** Used by the AI function: the signed-in user's access token, or null. */
export const getAccessToken = () => currentSession?.access_token || null;
const authListeners = new Set();
export const onAuthChange = (f) => { authListeners.add(f); return () => authListeners.delete(f); };

function niceError(e) {
  const m = String(e?.message || e || '');
  if (/failed to fetch|networkerror|load failed/i.test(m)) return inClaudePreview
    ? 'Accounts work on the live site (GitHub Pages). The claude.ai preview can\'t reach Supabase.'
    : 'Couldn\'t reach the server. Check your connection and try again.';
  if (/invalid login credentials/i.test(m)) return 'That email and password don\'t match.';
  if (/email not confirmed/i.test(m)) return 'Please confirm your email first (check your inbox).';
  if (/already registered/i.test(m)) return 'That email already has an account. Try signing in.';
  if (/password should be at least/i.test(m)) return 'Use a password with at least 6 characters.';
  return m || 'Something went wrong.';
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(!configured);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); }).catch(() => setReady(true));
    const { data } = supabase.auth.onAuthStateChange((event, s) => { setSession(s); if (event === 'PASSWORD_RECOVERY') setRecovery(true); });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => { currentSession = session; authListeners.forEach((f) => f(session)); }, [session]);

  const api = useMemo(() => {
    // Email links return to the address already approved in Supabase (unique-ava.html), which forwards
    // to wearwise.html keeping the sign-in token in the URL hash.
    const redirect = location.href.split('#')[0].split('?')[0].replace(/wearwise\.html$/, 'unique-ava.html');
    const wrap = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { throw new Error(niceError(e)); } };
    return {
      configured,
      ready,
      recovery,
      endRecovery: () => setRecovery(false),
      user: session?.user || null,
      signIn: wrap(async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
        if (error) throw error;
      }),
      signUp: wrap(async (name, email, password) => {
        const { data, error } = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password, options: { data: { name }, emailRedirectTo: redirect } });
        if (error) throw error;
        return { needsConfirm: !data.session };
      }),
      resetPassword: wrap(async (email) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: redirect });
        if (error) throw error;
      }),
      updatePassword: wrap(async (password) => {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
      }),
      signOut: wrap(async () => { await supabase.auth.signOut(); }),
    };
  }, [session, ready, recovery]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

// ─────────────────────────────────────────── cloud sync
const slim = (state) => ({
  ...state,
  draft: { ...state.draft, stage: { ...state.draft.stage, customBg: null, personPhoto: null } },
});

// The table was renamed unique_ava_data → wearwise_data. Use whichever exists, so the site works before and after
// the database change.
let tableName = null;
export async function cloudTable() {
  if (tableName) return tableName;
  const probe = await supabase.from('wearwise_data').select('user_id', { head: true, count: 'exact' }).limit(1);
  const missing = probe.error && /PGRST205|42P01|does not exist|schema cache|Could not find/i.test(`${probe.error.code} ${probe.error.message}`);
  tableName = missing ? 'unique_ava_data' : 'wearwise_data';
  return tableName;
}

// Set while "Delete all my data" runs, so nothing is re-uploaded in the meantime.
export const syncControl = { paused: false };

/**
 * Keeps the signed-in user's wardrobe in Supabase.
 * - On sign-in the account copy wins (or is created from this device).
 * - Saves are debounced and CONDITIONAL: a save only goes through if the account copy is still the version this
 *   device last saw. If another device saved in between, nothing is overwritten: she chooses which version to keep.
 * - When this tab comes back into view, newer changes from another device are loaded (if this device has none pending).
 * - A failed save (e.g. no connection) is retried when the connection returns, and leaving with unsaved changes warns.
 * Returns { status, message, lastSaved, conflict, useCloudVersion, keepThisVersion }.
 */
export function useCloudSync() {
  const { user } = useAuth();
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [status, setStatus] = useState('off'); // off | loading | synced | saving | error | offline | conflict | needs-setup
  const [message, setMessage] = useState('');
  const [lastSaved, setLastSaved] = useState(null);
  const [conflict, setConflict] = useState(null); // { data, at }
  const readyFor = useRef(null);
  const timer = useRef(null);
  const prevUser = useRef(null);
  const seen = useRef(null);       // updated_at of the account copy this device last loaded or saved
  const dirty = useRef(false);     // local changes not yet saved
  const skipNext = useRef(false);  // don't echo a just-loaded cloud copy straight back
  const latest = useRef(state);
  latest.current = state;

  const fail = useCallback((error) => {
    const m = String(error?.message || error?.code || '');
    if (/does not exist|PGRST205|42P01|schema cache/i.test(m + (error?.code || ''))) {
      setStatus('needs-setup'); setMessage('Cloud storage isn\'t set up yet. Run supabase/wearwise.sql once in Supabase.');
    } else if (typeof navigator !== 'undefined' && navigator.onLine === false || /Failed to fetch|NetworkError|network/i.test(m)) {
      setStatus('offline'); setMessage('No connection. Your changes are kept on this device and will be saved when you\'re back online.');
    } else { setStatus('error'); setMessage(niceError(error)); }
  }, []);

  const save = useCallback(async () => {
    if (!supabase || !user || readyFor.current !== user.id || syncControl.paused) return;
    const T = await cloudTable();
    setStatus('saving');
    const payload = { data: slim(latest.current), updated_at: new Date().toISOString() };
    let res = seen.current
      ? await supabase.from(T).update(payload).eq('user_id', user.id).eq('updated_at', seen.current).select('updated_at')
      : await supabase.from(T).upsert({ user_id: user.id, ...payload }).select('updated_at');
    if (res.error) { fail(res.error); return; }
    if (!res.data?.length) {
      // Nothing matched: the account copy changed on another device, or was deleted.
      const cur = await supabase.from(T).select('data, updated_at').eq('user_id', user.id).maybeSingle();
      if (cur.error) { fail(cur.error); return; }
      if (!cur.data) {
        res = await supabase.from(T).upsert({ user_id: user.id, ...payload }).select('updated_at');
        if (res.error) { fail(res.error); return; }
      } else {
        setConflict({ data: cur.data.data, at: cur.data.updated_at });
        setStatus('conflict'); setMessage('Your closet was changed on another device.');
        return;
      }
    }
    seen.current = res.data[0].updated_at;
    dirty.current = false;
    setStatus('synced'); setLastSaved(new Date()); setMessage('');
  }, [user, fail]);

  // On sign-in: load the account copy (it wins), or create it from this device.
  useEffect(() => {
    if (!supabase) return;
    if (!user) {
      if (prevUser.current) dispatch({ type: 'RESET' }); // signed out: don't leave this closet for the next person
      prevUser.current = null; readyFor.current = null; seen.current = null; dirty.current = false; setConflict(null); setStatus('off');
      return;
    }
    if (prevUser.current === user.id) return;
    prevUser.current = user.id;
    setStatus('loading');
    (async () => {
      const T = await cloudTable();
      const { data, error } = await supabase.from(T).select('data, updated_at').eq('user_id', user.id).maybeSingle();
      if (error) { fail(error); return; }
      if (data?.data && Object.keys(data.data).length) {
        skipNext.current = true;
        dispatch({ type: 'HYDRATE', state: data.data });
        seen.current = data.updated_at;
        toast('Your wardrobe is loaded from your account');
        readyFor.current = user.id;
        setStatus('synced'); setLastSaved(new Date()); setMessage('');
      } else {
        readyFor.current = user.id;
        seen.current = data?.updated_at || null;
        await save();
        toast('Your closet is now saved to your account');
      }
    })();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // After that: save changes (debounced).
  useEffect(() => {
    if (!supabase || !user || readyFor.current !== user.id) return;
    if (skipNext.current) { skipNext.current = false; return; }
    if (conflict) return; // wait for her choice
    dirty.current = true;
    clearTimeout(timer.current);
    setStatus('saving');
    timer.current = setTimeout(save, 1500);
    return () => clearTimeout(timer.current);
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  // Back online → retry. Back to this tab → pick up changes made on another device.
  useEffect(() => {
    if (!supabase || !user) return undefined;
    const online = () => { if (dirty.current) save(); };
    const visible = async () => {
      if (document.visibilityState !== 'visible' || readyFor.current !== user.id || conflict || syncControl.paused) return;
      const T = await cloudTable();
      const cur = await supabase.from(T).select('data, updated_at').eq('user_id', user.id).maybeSingle();
      if (cur.error || !cur.data || cur.data.updated_at === seen.current) return;
      if (dirty.current) { setConflict({ data: cur.data.data, at: cur.data.updated_at }); setStatus('conflict'); setMessage('Your closet was changed on another device.'); return; }
      skipNext.current = true;
      dispatch({ type: 'HYDRATE', state: cur.data.data });
      seen.current = cur.data.updated_at;
      setLastSaved(new Date());
      toast('Updated with changes from your other device');
    };
    const leaving = (e) => { if (dirty.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('online', online);
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('beforeunload', leaving);
    return () => { window.removeEventListener('online', online); document.removeEventListener('visibilitychange', visible); window.removeEventListener('beforeunload', leaving); };
  }, [user, conflict, save]); // eslint-disable-line react-hooks/exhaustive-deps

  const useCloudVersion = () => {
    if (!conflict) return;
    skipNext.current = true;
    dispatch({ type: 'HYDRATE', state: conflict.data });
    seen.current = conflict.at; dirty.current = false;
    setConflict(null); setStatus('synced'); setMessage(''); setLastSaved(new Date());
    toast('Loaded the version from your other device');
  };
  const keepThisVersion = async () => {
    if (!conflict) return;
    seen.current = conflict.at;
    setConflict(null);
    await save();
    toast('Kept this device\'s version');
  };

  return { status, message, lastSaved, conflict, useCloudVersion, keepThisVersion };
}
