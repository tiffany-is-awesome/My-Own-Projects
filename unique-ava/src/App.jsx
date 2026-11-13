import { useEffect, useState } from 'react';
import { useStore } from './store.jsx';
import Welcome from './views/Welcome.jsx';
import Closet from './views/Closet.jsx';
import DressingRoom from './views/DressingRoom.jsx';
import MixMatch from './views/MixMatch.jsx';
import Inspiration from './views/Inspiration.jsx';
import { ConfirmButton } from './components/common.jsx';
import { useClaudeStatus } from './ai/claude.js';
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
          <span className={'ai-status ' + ai.status} title={ai.status === 'ready' ? `AI: ${ai.name}` : 'Claude is not connected here, so the built-in rules engine is used'}>
            <i />{ai.status === 'ready' ? 'Claude on' : ai.status === 'checking' ? 'Connecting…' : ai.status === 'signin' ? 'Sign in for Claude' : 'Rules engine'}
          </span>
          <Account />
        </div>
      </header>
      <main>{view}</main>
      <footer className="footer">
        Unique Ava prototype · AI by Claude, with a built-in rules engine as backup · saved in this browser, or to your account when you sign in ·{' '}
        <ConfirmButton className="" label="Reset demo" confirmLabel="Click again to reset everything" onConfirm={() => { dispatch({ type: 'RESET' }); window.location.hash = '#/closet'; }} />
      </footer>
    </>
  );
}
