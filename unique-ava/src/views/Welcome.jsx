// Home: an honest start (empty closet → add clothes or try the demo), then quick actions.
import { useState } from 'react';
import { useStore } from '../store.jsx';
import Stage from '../components/Stage.jsx';
import UploadModal from '../components/UploadModal.jsx';
import { OutfitThumb, useToast } from '../components/common.jsx';
import { usePhotos } from '../data/photos.js';
import { DEMO_CLOSET } from '../data/closet.js';
import { missingForOutfit } from '../ai/generator.js';

const byId = (id) => DEMO_CLOSET.find((g) => g.id === id);
const EXAMPLE = { top: byId('t-black-turtle'), bottom: byId('b-olive-chino'), outer: byId('o-trench'), shoes: byId('s-black-boot'), bag: byId('a-crossbody') };

export default function Welcome({ go }) {
  const { dispatch, owned, profile, outfitsOf, hasDemo, resolve } = useStore();
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

  return (
    <div className="welcome">
      <div className="welcome-art">
        <div style={{ width: 'min(420px, 100%)' }}>
          {photos.hero
            ? <img src={photos.hero} alt="Unique Ava look" style={{ width: '100%', aspectRatio: '4 / 5', objectFit: 'cover', display: 'block' }} />
            : <Stage outfit={EXAMPLE} mode="mannequin" caption="Example outfit (illustration)" />}
        </div>
      </div>
      <div className="welcome-copy">
        <span className="ai-badge">AI personal stylist</span>
        {empty ? (
          <>
            <h1 className="h1">Your wardrobe, styled.</h1>
            <p className="muted" style={{ margin: 0 }}>Add photos of {who} clothes, however messy. Unique Ava catalogs them, then builds complete outfits from what you really own, for the occasion and the weather, and explains why each one works.</p>
            <ol className="feature-list">
              <li><b>01</b><span>Add {who} clothes: several photos at once, or by hand</span></li>
              <li><b>02</b><span>Choose the occasion, style and weather</span></li>
              <li><b>03</b><span>Get 3 outfits, compare them side by side, save the favorite</span></li>
            </ol>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn accent" onClick={() => setUploading(true)}>Add {who} clothes</button>
              {!hasDemo && <button className="btn" onClick={() => { dispatch({ type: 'LOAD_DEMO' }); toast('Demo closet added. Remove it any time in Settings.'); go('#/closet'); }}>Try the demo closet</button>}
            </div>
            <p className="tiny">The demo closet is sample data, clearly labelled, and removable in one click.</p>
          </>
        ) : (
          <>
            <h1 className="h1">{profile.name === 'Me' ? 'What are you dressing for?' : `What is ${profile.name} dressing for?`}</h1>
            <p className="muted" style={{ margin: 0 }}>{owned.length} pieces in {who} closet.{missing.length ? ` To build full outfits, add: ${missing.join(', ')}.` : ''}</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn accent" onClick={() => go('#/create')}>Create an Outfit</button>
              <button className="btn" onClick={() => setUploading(true)}>Add clothes</button>
              <button className="btn ghost" onClick={() => go('#/family')}>Family look</button>
            </div>
            {recent.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <span className="label">Recently saved</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 8 }}>
                  {recent.map((o) => <button key={o.id} className="card" title={o.name} onClick={() => go('#/saved')}><OutfitThumb outfit={o} resolve={resolve} child={profile.kind === 'child'} /></button>)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
      {uploading && <UploadModal onClose={() => setUploading(false)} onSaved={added} ownerName={profile.name} />}
    </div>
  );
}
