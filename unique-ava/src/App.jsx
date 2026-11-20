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
import History from './views/History.jsx';
import Insights from './views/Insights.jsx';
import Inspiration from './views/Inspiration.jsx';
import { useClaudeStatus, puterUser, puterSignIn, puterSignOut, loadPuter } from './ai/claude.js';
import { useToast } from './components/common.jsx';
import Account from './components/Account.jsx';
import { LookbookList, LookbookDetail, SharedLookbook } from './views/Lookbooks.jsx';

const NAV = [
  ['#/home', 'Home'],
  ['#/closet', 'My Closet'],
  ['#/create', 'Create an Outfit', true],
  ['#/saved', 'Saved'],
  ['#/history', 'History'],
  ['#/family', 'Family'],
];

// Phone: a bottom tab bar (thumb reach) + a "More" page for everything else.
const TABS = [
  ['#/home', 'Home', 'M4 11 12 4l8 7v9h-5v-6H9v6H4z'],
  ['#/closet', 'Closet', 'M12 6a2 2 0 1 1 2-2M12 6 3 14h18z M5 14v5h14v-5'],
  ['#/create', 'Create', 'M12 3l2.2 5.6L20 9l-4.5 3.8L17 19l-5-3.2L7 19l1.5-6.2L4 9l5.8-.4z'],
  ['#/saved', 'Saved', 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z'],
  ['#/more', 'More', 'M5 12h.01M12 12h.01M19 12h.01'],
];

function MorePage() {
  const links = [
    ['#/history', 'Outfit History', 'What you wore, with ratings'],
    ['#/insights', 'Closet insights', 'Rediscover My Closet and versatility'],
    ['#/builder', 'Outfit builder', 'Put a look together piece by piece'],
    ['#/family', 'Family looks', 'Coordinated outfits for everyone'],
    ['#/lookbooks', 'Lookbooks & trips', 'Collections and packing lists'],
    ['#/inspiration', 'Inspiration', 'Recreate a look you saw'],
    ['#/settings', 'Settings', 'Account, AI, places, delete data'],
  ];
  return (
    <div className="page narrow">
      <div className="page-head"><div><div className="label">Wearwise</div><h1 className="h1">More</h1></div></div>
      <ul className="more-list">
        {links.map(([h, t, d]) => <li key={h}><a href={h}><b>{t}</b><span className="tiny">{d}</span><span aria-hidden="true">›</span></a></li>)}
      </ul>
    </div>
  );
}

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
  else if (route === 'create' || route === 'mix') view = <Create key={param || 'c'} go={go} autoRun={param === 'go'} />;
  else if (route === 'style' && param) view = <StyleMe key={param} id={decodeURIComponent(param)} go={go} />;
  else if (route === 'saved') view = <Saved go={go} />;
  else if (route === 'history') view = <History go={go} />;
  else if (route === 'insights') view = <Insights go={go} />;
  else if (route === 'family') view = <Family go={go} />;
  else if (route === 'settings') view = <Settings go={go} />;
  else if (route === 'lookbooks' && param) view = <LookbookDetail id={param} go={go} />;
  else if (route === 'lookbooks') view = <LookbookList go={go} />;
  else if (route === 'inspiration') view = <Inspiration go={go} />;
  else if (route === 'more') view = <MorePage />;
  else view = <Welcome go={go} />;

  const ALIAS = { dressing: 'create', builder: 'create', mix: 'create', welcome: 'home', style: 'closet', lookbooks: 'saved', inspiration: 'saved', insights: 'history' };
  const MOBILE_ALIAS = { history: 'more', family: 'more', settings: 'more', insights: 'more', lookbooks: 'more', inspiration: 'more' };
  const active = route === 'share' ? '' : '#/' + (ALIAS[route] || route || 'home');

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="logo" href="#/home" aria-label="Wearwise home"><span className="logo-mark">W</span><span>WEARWISE</span></a>
          <nav className="nav" aria-label="Main">
            {NAV.map(([h, l, primary]) => <a key={h} href={h} className={(active === h ? 'active' : '') + (primary ? ' primary' : '')}>{l}</a>)}
          </nav>
          <ProfileSwitch />
          <a className={'icon-link' + (active === '#/settings' ? ' active' : '')} href="#/settings" aria-label="Settings" title="Settings">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
          </a>
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
      <main key={route || 'home'} className="view-enter">{view}</main>
      <nav className="tabbar" aria-label="Main (mobile)">
        {TABS.map(([h, l, d]) => {
          const on = h === '#/more' ? (route === 'more' || MOBILE_ALIAS[route] === 'more') : active === h && !MOBILE_ALIAS[route];
          return (
            <a key={h} href={h} className={(on ? 'on' : '') + (h === '#/create' ? ' create' : '')} aria-current={on ? 'page' : undefined}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
              <span>{l}</span>
            </a>
          );
        })}
      </nav>
      <footer className="footer">
        Wearwise · AI stylist: Google Gemini via Puter (free, no key: sign in), checked by a built-in rules engine that also works on its own · saved in this browser, or to your account when you sign in · <a href="#/settings">Settings &amp; delete my data</a>
      </footer>
    </>
  );
}
