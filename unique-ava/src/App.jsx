import { useEffect, useState } from 'react';
import { useStore } from './store.jsx';
import Welcome from './views/Welcome.jsx';
import Closet from './views/Closet.jsx';
import DressingRoom from './views/DressingRoom.jsx';
import MixMatch from './views/MixMatch.jsx';
import Inspiration from './views/Inspiration.jsx';
import { ConfirmButton } from './components/common.jsx';
import { useClaudeStatus, puterUser, puterSignIn, puterSignOut, loadPuter } from './ai/claude.js';
import { useToast } from './components/common.jsx';
import Account from './components/Account.jsx';
import { LookbookList, LookbookDetail, SharedLookbook } from './views/Lookbooks.jsx';

const NAV = [
  ['#/closet', 'Closet'],
  ['#/dressing', 'Dressing Room'],
  ['#/mix', 'Mix & Match'],
  ['#/lookbooks', 'Lookbooks'],
  ['#/inspiration', 'Inspiration'],
];

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
  const { state, dispatch } = useStore();
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
  const [, route, param] = hash.includes('access_token=') || hash.includes('error=') ? ['', 'closet'] : hash.split('/');

  let view;
  if (route === 'share' && param) view = <SharedLookbook data={param} go={go} />;
  else if (!state.onboarded && !route) view = <Welcome go={go} />;
  else if (route === 'dressing') view = <DressingRoom go={go} />;
  else if (route === 'mix') view = <MixMatch go={go} />;
  else if (route === 'lookbooks' && param) view = <LookbookDetail id={param} go={go} />;
  else if (route === 'lookbooks') view = <LookbookList go={go} />;
  else if (route === 'inspiration') view = <Inspiration go={go} />;
  else if (route === 'welcome') view = <Welcome go={go} />;
  else view = <Closet go={go} />;

  const active = route === 'share' ? '' : '#/' + (route || (state.onboarded ? 'closet' : ''));

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="logo" href="#/welcome" aria-label="Unique Ava home"><span className="logo-mark">U</span><span>UNIQUE AVA</span></a>
          <nav className="nav" aria-label="Main">
            {NAV.map(([h, l]) => <a key={h} href={h} className={active === h ? 'active' : ''} onClick={() => !state.onboarded && dispatch({ type: 'ONBOARDED' })}>{l}</a>)}
          </nav>
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
        Unique Ava prototype · AI stylist by Google Gemini (via Puter: free, no key, just sign in), with a built-in rules engine as backup · saved in this browser, or to your account when you sign in ·{' '}
        <ConfirmButton className="" label="Reset demo" confirmLabel="Click again to reset everything" onConfirm={() => { dispatch({ type: 'RESET' }); window.location.hash = '#/closet'; }} />
      </footer>
    </>
  );
}
