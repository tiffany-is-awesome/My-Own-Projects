import { useEffect, useState } from 'react';
import { useStore } from './store.jsx';
import Welcome from './views/Welcome.jsx';
import Closet from './views/Closet.jsx';
import DressingRoom from './views/DressingRoom.jsx';
import Create from './views/Create.jsx';
import StyleMe from './views/StyleMe.jsx';
import Saved from './views/Saved.jsx';
import Family from './views/Family.jsx';
import Settings from './views/Settings.jsx';
import Inspiration from './views/Inspiration.jsx';
import { useClaudeStatus, puterUser, puterSignIn, puterSignOut, loadPuter } from './ai/claude.js';
import { useToast } from './components/common.jsx';
import Account from './components/Account.jsx';
import { LookbookList, LookbookDetail, SharedLookbook } from './views/Lookbooks.jsx';

const NAV = [
  ['#/home', 'Home'],
  ['#/closet', 'My Closet'],
  ['#/create', 'Create an Outfit', true],
  ['#/builder', 'Builder'],
  ['#/saved', 'Saved Outfits'],
  ['#/family', 'Family'],
  ['#/settings', 'Settings'],
];

function ProfileSwitch() {
  const { state, dispatch, profile } = useStore();
  if (state.profiles.length < 2) return null;
  return (
    <label className="profile-switch" title="Whose closet you're looking at">
      <span className="tiny">Closet</span>
      <select value={profile.id} onChange={(e) => dispatch({ type: 'SWITCH_PROFILE', id: e.target.value })} aria-label="Switch family member">
        {state.profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </label>
  );
}

function useHash() {
  const [hash, setHash] = useState(window.location.hash || '');
  useEffect(() => {
    const on = () => { setHash(window.location.hash); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
}

export default function App() {
  useStore();
  const hash = useHash();
  const ai = useClaudeStatus();
  const toast = useToast();
  const [gemUser, setGemUser] = useState(undefined); // undefined = checking, null = signed out
  useEffect(() => {
    if (ai.via !== 'puter') return;
    let alive = true;
    const check = () => loadPuter().then(() => puterUser()).then((u) => alive && setGemUser(u || null));
    check();
    const t = setInterval(check, 20000); // picks up a sign-in that happened in Puter's pop-up during an AI request
    return () => { alive = false; clearInterval(t); };
  }, [ai.via]);
  async function gemClick() {
    if (gemUser) {
      puterSignOut(); setGemUser(null); toast('Signed out of the AI stylist (Puter)');
      return;
    }
    try { await puterSignIn(); const u = await puterUser(); setGemUser(u || null); if (u) toast(`AI stylist on · signed in to Puter as ${u.username}`); }
    catch { toast('Sign-in was closed. The rules engine keeps styling until you sign in.'); }
  }
  const go = (h) => { window.location.hash = h; };
  const [, route, param] = hash.includes('access_token=') || hash.includes('error=') ? ['', 'home'] : hash.split('/');

  let view;
  if (route === 'share' && param) view = <SharedLookbook data={param} go={go} />;
  else if (route === 'closet') view = <Closet go={go} />;
  else if (route === 'builder' || route === 'dressing') view = <DressingRoom go={go} />;
  else if (route === 'create' || route === 'mix') view = <Create go={go} />;
  else if (route === 'style' && param) view = <StyleMe key={param} id={decodeURIComponent(param)} go={go} />;
  else if (route === 'saved') view = <Saved go={go} />;
  else if (route === 'family') view = <Family go={go} />;
  else if (route === 'settings') view = <Settings go={go} />;
  else if (route === 'lookbooks' && param) view = <LookbookDetail id={param} go={go} />;
  else if (route === 'lookbooks') view = <LookbookList go={go} />;
  else if (route === 'inspiration') view = <Inspiration go={go} />;
  else view = <Welcome go={go} />;

  const ALIAS = { dressing: 'builder', mix: 'create', welcome: 'home', style: 'closet', lookbooks: 'saved', inspiration: 'saved' };
  const active = route === 'share' ? '' : '#/' + (ALIAS[route] || route || 'home');

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="logo" href="#/home" aria-label="Unique Ava home"><span className="logo-mark">U</span><span>UNIQUE AVA</span></a>
          <nav className="nav" aria-label="Main">
            {NAV.map(([h, l, primary]) => <a key={h} href={h} className={(active === h ? 'active' : '') + (primary ? ' primary' : '')}>{l}</a>)}
          </nav>
          <ProfileSwitch />
          {ai.via === 'puter' ? (
            <button className={'ai-status as-button ' + (gemUser ? 'ready' : '')} onClick={gemClick}
              title={gemUser ? `AI stylist: Gemini, signed in to Puter as ${gemUser.username}. Click to sign out.` : 'AI stylist: Gemini. Free, no key: sign in with a Puter account to switch it on.'}>
              <i />{gemUser ? 'Gemini on' : gemUser === undefined ? 'Gemini' : 'Gemini · Sign in'}
            </button>
          ) : (
            <span className={'ai-status ' + ai.status} title={ai.status === 'ready' ? `AI stylist: ${ai.name}` : 'The AI stylist is not connected here, so the built-in rules engine is used'}>
              <i />{ai.status === 'ready' ? `${ai.name} on` : ai.status === 'checking' ? 'Connecting…' : ai.status === 'signin' ? 'Sign in for AI' : 'Rules engine'}
            </span>
          )}
          <Account />
        </div>
      </header>
      <main>{view}</main>
      <footer className="footer">
        Unique Ava · AI stylist: Google Gemini via Puter (free, no key: sign in), checked by a built-in rules engine that also works on its own · saved in this browser, or to your account when you sign in · <a href="#/settings">Settings &amp; delete my data</a>
      </footer>
    </>
  );
}
