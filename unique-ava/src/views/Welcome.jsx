// Home: an honest start (empty closet → add clothes or try the demo), then quick actions.
import { useMemo, useState } from 'react';
import { HeroShowcase } from '../components/Motion.jsx';
import { ScoreBadge, PieceList, HeartButton, Verdict } from '../components/common.jsx';
import { contextOf, toSlots, DEFAULT_CHOICE } from '../components/Choose.jsx';
import { generateOutfits } from '../ai/generator.js';
import { WEATHER_CHOICES } from '../ai/context.js';
import { useStore } from '../store.jsx';
import Stage from '../components/Stage.jsx';
import TipJar from '../components/TipJar.jsx';
import UploadModal from '../components/UploadModal.jsx';
import { OutfitThumb, useToast } from '../components/common.jsx';

/** Today's outfit: a real suggestion from her own available clothes, one tap away. */
function TodayCard({ go }) {
  const { owned, dispatch, personal, profile } = useStore();
  const toast = useToast();
  const [weather, setWeather] = useState('warm');
  const [n, setN] = useState(0);
  const [saved, setSaved] = useState({});
  const ctx = useMemo(() => ({ ...contextOf({ ...DEFAULT_CHOICE, weather }), personal: personal.rated ? personal : null }), [weather, personal]);
  const list = useMemo(() => generateOutfits(owned, ctx).outfits, [owned, ctx]);
  if (!list.length) return null;
  const r = list[n % list.length];
  const key = weather + (n % list.length);
  return (
    <section className="today-card" aria-label="Today's outfit">
      <div className="today-stage"><Stage key={key} outfit={r.outfit} mode="flatlay" child={profile.kind === 'child'} /></div>
      <div className="today-body">
        <div className="label">Today's outfit · from {profile.name === 'Me' ? 'your' : `${profile.name}'s`} closet</div>
        <div className="chips" role="group" aria-label="Today's weather">
          {WEATHER_CHOICES.map((w) => <button key={w.id} className={'chip sm' + (weather === w.id ? ' on' : '')} onClick={() => { setWeather(w.id); setN(0); }}>{w.label}</button>)}
        </div>
        <div className="outfit-card-head"><h2 className="h2">{r.name}</h2><ScoreBadge score={r.critique.overall} /></div>
        <Verdict critique={r.critique} compact />
        <p className="small why">{r.why}</p>
        <PieceList outfit={r.outfit} />
        <div className="outfit-card-actions">
          <HeartButton saved={!!saved[key]} onSave={() => { dispatch({ type: 'SAVE_OUTFIT', outfit: { name: r.name, slots: toSlots(r.outfit), context: ctx, stage: { mode: 'flatlay' }, why: r.why, source: 'rules' } }); setSaved((x) => ({ ...x, [key]: true })); toast('Saved'); }} />
          <button className="btn sm" onClick={() => setN(n + 1)}>Another idea</button>
          <button className="btn sm ghost" onClick={() => { dispatch({ type: 'LOG_WEAR', entry: { slots: toSlots(r.outfit), context: ctx } }); toast('Logged in Outfit History'); }}>I'll wear this</button>
        </div>
      </div>
    </section>
  );
}

const QUICK = [['work', 'Work'], ['date', 'Date night'], ['church', 'Church'], ['party', 'Party'], ['vacation', 'Vacation']];
import { usePhotos } from '../data/photos.js';
import { missingForOutfit } from '../ai/generator.js';


export default function Welcome({ go }) {
  const { dispatch, owned, profile, outfitsOf, hasDemo, resolve, historyOf } = useStore();
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const photos = usePhotos();
  const empty = owned.length === 0;
  const missing = missingForOutfit(owned);
  const recent = outfitsOf(profile.id).slice(0, 3);
  const who = profile.name === 'Me' ? 'your' : `${profile.name}'s`;

  function added(items) {
    dispatch({ type: 'ADD_GARMENTS', garments: items });
    dispatch({ type: 'ONBOARDED' });
    setUploading(false);
    toast(`${items.length} piece${items.length > 1 ? 's' : ''} added to ${who} closet`);
    go('#/closet');
  }

  if (!empty) {
    return (
      <div className="page home">
        <div className="home-head">
          <div>
            <span className="ai-badge">Your personal stylist</span>
            <h1 className="h1">{profile.name === 'Me' ? 'What are you dressing for?' : `What is ${profile.name} dressing for?`}</h1>
            <p className="muted small" style={{ margin: '4px 0 0' }}>{owned.length} pieces in {who} closet.{missing.length ? ` To build full outfits, add: ${missing.join(', ')}.` : ''}</p>
          </div>
          <div className="quick-row" role="group" aria-label="Quick outfit for">
            {QUICK.map(([id, l]) => <button key={id} className="chip" onClick={() => { dispatch({ type: 'SET_CONTEXT', context: contextOf({ ...DEFAULT_CHOICE, occasion: id }), choice: { ...DEFAULT_CHOICE, occasion: id } }); go('#/create/go'); }}>{l}</button>)}
            <button className="chip accent-chip" onClick={() => go('#/create')}>Something else…</button>
          </div>
        </div>
        {missing.length === 0 ? <TodayCard go={go} /> : (
          <div className="empty"><p className="small">Add {missing.join(', ')} and Wearwise can suggest complete outfits.</p><button className="btn primary" onClick={() => setUploading(true)}>Add clothes</button></div>
        )}
        <div className="home-actions">
          <button className="home-tile" onClick={() => setUploading(true)}><b>Add clothes</b><span className="tiny">Photos or by hand</span></button>
          <button className="home-tile" onClick={() => go('#/insights')}><b>Rediscover my closet</b><span className="tiny">Forgotten pieces, new ideas</span></button>
          <button className="home-tile" onClick={() => go('#/family')}><b>Family look</b><span className="tiny">Coordinated, not matching</span></button>
          <button className="home-tile" onClick={() => go('#/history')}><b>Outfit history</b><span className="tiny">Rate what you wore</span></button>
        </div>
        {recent.length > 0 && (
          <section style={{ marginTop: 28 }}>
            <div className="results-head" style={{ marginTop: 0 }}><h2 className="h2">Recently saved</h2><a className="small" href="#/saved">See all</a></div>
            <div className="recent-row">
              {recent.map((o) => <button key={o.id} className="card" title={o.name} onClick={() => go('#/saved')}><OutfitThumb outfit={o} resolve={resolve} child={profile.kind === 'child'} /><span className="tiny recent-name">{o.name}</span></button>)}
            </div>
          </section>
        )}
        <div style={{ marginTop: 28 }}><TipJar /></div>
        {uploading && <UploadModal onClose={() => setUploading(false)} onSaved={added} ownerName={profile.name} />}
      </div>
    );
  }

  return (
    <div className="welcome">
      <div className="welcome-art">
        <div style={{ width: 'min(440px, 100%)' }}>
          {photos.hero
            ? <img src={photos.hero} alt="Wearwise look" style={{ width: '100%', aspectRatio: '4 / 5', objectFit: 'cover', display: 'block' }} />
            : <HeroShowcase />}
        </div>
      </div>
      <div className="welcome-copy">
        <span className="ai-badge">AI personal stylist</span>
        <h1 className="h1 hero-title"><span>Look your best.</span><span>Make the most of what you own.</span><span className="accent-line">Never turn your closet upside down again.</span></h1>
        <p className="muted" style={{ margin: 0 }}>Add photos of {who} clothes, however messy. Wearwise catalogs them, then builds complete outfits from what you really own, for the occasion and the weather, and explains why each one works.</p>
        <ol className="feature-list">
          <li><b>01</b><span>Add {who} clothes: several photos at once, or by hand</span></li>
          <li><b>02</b><span>Choose the occasion, style and weather</span></li>
          <li><b>03</b><span>Get 3 outfits, compare them side by side, save the favorite</span></li>
        </ol>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn accent" onClick={() => setUploading(true)}>Add {who} clothes</button>
          {!hasDemo && <button className="btn" onClick={() => { dispatch({ type: 'LOAD_DEMO' }); toast('Demo closet added. Remove it any time in Settings.'); go('#/home'); }}>Try the demo closet</button>}
        </div>
        <p className="tiny">The demo closet is sample data, clearly labelled, and removable in one click.</p>
      </div>
      {uploading && <UploadModal onClose={() => setUploading(false)} onSaved={added} ownerName={profile.name} />}
    </div>
  );
}
