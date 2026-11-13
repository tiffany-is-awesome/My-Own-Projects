import { useState } from 'react';
import { useStore } from '../store.jsx';
import Stage from '../components/Stage.jsx';
import UploadModal from '../components/UploadModal.jsx';
import { generateOutfits } from '../ai/generator.js';
import { DEFAULT_CONTEXT } from '../ai/context.js';
import { critique } from '../ai/critic.js';
import { SLOTS } from '../data/closet.js';

export default function Welcome({ go }) {
  const { dispatch, get, pool } = useStore();
  const [uploading, setUploading] = useState(false);
  const hero = { top: get('t-black-turtle'), bottom: get('b-olive-chino'), outer: get('o-trench'), shoes: get('s-black-boot'), accessory: get('basic-crossbody') };

  function explore() { dispatch({ type: 'ONBOARDED' }); go('#/closet'); }

  // First upload → build a full look around it, using placeholder basics for empty slots.
  function firstPiece(g) {
    dispatch({ type: 'ADD_GARMENT', garment: g });
    const [best] = generateOutfits([g, ...pool.filter((p) => p.placeholder)], DEFAULT_CONTEXT, g);
    const slots = Object.fromEntries(SLOTS.map((k) => [k, best.outfit[k]?.id || null]));
    dispatch({ type: 'LOAD_DRAFT', draft: { slots, name: 'My first look', context: DEFAULT_CONTEXT } });
    dispatch({ type: 'ONBOARDED' });
    setUploading(false);
    go('#/dressing');
  }

  return (
    <div className="welcome">
      <div className="welcome-art">
        <div style={{ width: 'min(420px, 100%)' }}>
          <Stage outfit={hero} mode="scene" sceneId="tokyo-rain" caption={`Rainy Tuesday · 16°C · Score ${critique(hero, DEFAULT_CONTEXT).overall}`} />
        </div>
      </div>
      <div className="welcome-copy">
        <span className="ai-badge">AI personal stylist</span>
        <h1 className="h1">Your wardrobe, curated.</h1>
        <p className="muted" style={{ margin: 0 }}>Photograph your clothes, however messy. Atelier turns them into a clean boutique catalog, dresses you for the real weather and place, and tells you honestly what works and what doesn't.</p>
        <ul className="feature-list">
          <li><b>01</b><span>Clean product cards from messy photos: cut out, color-read and auto-tagged</span></li>
          <li><b>02</b><span>Three outfit options for any situation: “Rainy coffee meeting, 16°C”</span></li>
          <li><b>03</b><span>An honest four-pillar critique: proportions, fabric & weather, color, occasion</span></li>
          <li><b>04</b><span>Shareable lookbooks and trip packing with a versatility score</span></li>
        </ul>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn accent" onClick={() => setUploading(true)}>Start with 1 photo</button>
          <button className="btn" onClick={explore}>Explore the sample closet</button>
        </div>
        <p className="tiny">Prototype: everything stays in this browser. AI features are simulated by a real rules engine.</p>
      </div>
      {uploading && <UploadModal onClose={() => setUploading(false)} onSaved={firstPiece} />}
    </div>
  );
}
