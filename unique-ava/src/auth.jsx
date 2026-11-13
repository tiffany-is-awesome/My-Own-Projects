// Accounts (Supabase Auth) + cloud sync of the whole wardrobe to public.unique_ava_data.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { CONFIG } from './config.js';
import { useStore } from './store.jsx';
import { useToast } from './components/common.jsx';

const configured = !!(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);
export const supabase = configured
  ? createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, { auth: { persistSession: true, storageKey: 'unique-ava.auth' } })
  : null;

/** Inside the claude.ai preview, the page can't reach other servers, so accounts only work on the live site. */
export const inClaudePreview = typeof window !== 'undefined' && !!window.claude && window.top !== window;

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

let currentSession = null;
/** Used by the Claude proxy: the signed-in user's access token, or null. */
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
    const redirect = location.href.split('#')[0];
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

/** Keeps the signed-in user's wardrobe in Supabase. Returns { status, message, lastSaved }. */
export function useCloudSync() {
  const { user } = useAuth();
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [status, setStatus] = useState('off'); // off | loading | synced | saving | error | needs-setup
  const [message, setMessage] = useState('');
  const [lastSaved, setLastSaved] = useState(null);
  const readyFor = useRef(null);
  const timer = useRef(null);
  const prevUser = useRef(null);

  const fail = useCallback((error) => {
    const m = String(error?.message || error?.code || '');
    if (/unique_ava_data|does not exist|PGRST205|42P01|schema cache/i.test(m + (error?.code || ''))) {
      setStatus('needs-setup'); setMessage('Cloud storage isn\'t set up yet. Run supabase/unique-ava.sql once in Supabase.');
    } else { setStatus('error'); setMessage(niceError(error)); }
  }, []);

  // On sign-in: load the cloud copy (cloud wins), or create it from this device.
  useEffect(() => {
    if (!supabase) return;
    if (!user) {
      if (prevUser.current) dispatch({ type: 'RESET' }); // signed out: don't leave this closet for the next person
      prevUser.current = null; readyFor.current = null; setStatus('off');
      return;
    }
    if (prevUser.current === user.id) return;
    prevUser.current = user.id;
    setStatus('loading');
    (async () => {
      const { data, error } = await supabase.from('unique_ava_data').select('data').eq('user_id', user.id).maybeSingle();
      if (error) { fail(error); return; }
      if (data?.data && Object.keys(data.data).length) {
        dispatch({ type: 'HYDRATE', state: data.data });
        toast('Your wardrobe is loaded from your account');
      } else {
        const up = await supabase.from('unique_ava_data').upsert({ user_id: user.id, data: slim(state), updated_at: new Date().toISOString() });
        if (up.error) { fail(up.error); return; }
        toast('Your closet is now saved to your account');
      }
      readyFor.current = user.id;
      setStatus('synced'); setLastSaved(new Date()); setMessage('');
    })();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // After that: save changes (debounced).
  useEffect(() => {
    if (!supabase || !user || readyFor.current !== user.id) return;
    clearTimeout(timer.current);
    setStatus('saving');
    timer.current = setTimeout(async () => {
      const { error } = await supabase.from('unique_ava_data').upsert({ user_id: user.id, data: slim(state), updated_at: new Date().toISOString() });
      if (error) fail(error); else { setStatus('synced'); setLastSaved(new Date()); setMessage(''); }
    }, 1500);
    return () => clearTimeout(timer.current);
  }, [state, user, fail]);

  return { status, message, lastSaved };
}
