import { useEffect, useState } from 'react';
import { useStore } from './store.jsx';
import Welcome from './views/Welcome.jsx';
import Closet from './views/Closet.jsx';
import DressingRoom from './views/DressingRoom.jsx';
import MixMatch from './views/MixMatch.jsx';
import Inspiration from './views/Inspiration.jsx';
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
  const go = (h) => { window.location.hash = h; };
  const [, route, param] = hash.split('/');

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
          <a className="logo" href="#/welcome" aria-label="Atelier home"><span className="logo-mark">A</span>ATELIER</a>
          <nav className="nav" aria-label="Main">
            {NAV.map(([h, l]) => <a key={h} href={h} className={active === h ? 'active' : ''} onClick={() => !state.onboarded && dispatch({ type: 'ONBOARDED' })}>{l}</a>)}
          </nav>
        </div>
      </header>
      <main>{view}</main>
      <footer className="footer">
        Atelier prototype · AI is simulated by a real rules engine · data stays in this browser ·{' '}
        <button onClick={() => { if (window.confirm('Reset the sample closet and lookbooks?')) dispatch({ type: 'RESET' }); }}>Reset demo</button>
      </footer>
    </>
  );
}
