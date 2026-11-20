// The 4:5 visual stage: flat-lay, mannequin, or scene.
import GarmentArt from './GarmentArt.jsx';
import { SCENES } from '../data/scenes.jsx';
import { usePhotos, markBroken } from '../data/photos.js';
import Worn from './Worn.jsx';

// Box positions in % of the 4:5 stage: [left, top, width, height]
const FLATLAY_WITH_OUTER = {
  outer: [2, 4, 50, 56], top: [46, 2, 44, 44], bottom: [50, 40, 38, 56], shoes: [4, 60, 40, 34], bag: [78, 66, 22, 26], accessory: [36, 60, 20, 20],
};
const FLATLAY = {
  top: [4, 4, 52, 50], bottom: [50, 14, 42, 60], shoes: [8, 56, 40, 36], bag: [68, 72, 28, 26], accessory: [52, 2, 20, 20],
};
// A dress takes the whole left/centre column
const DRESS = { top: [10, 2, 50, 72], outer: [54, 2, 44, 52], shoes: [12, 72, 40, 26], bag: [66, 66, 28, 28], accessory: [60, 46, 22, 20] };

// Soft-focus "photographic" treatment: background out of focus, film grain, vignette.
function PhotoFinish({ children }) {
  return (
    <svg className="stage-layer" viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <filter id="ph-blur" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="7" /></filter>
        <filter id="ph-grain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3" /><feColorMatrix type="saturate" values="0" /><feComponentTransfer><feFuncA type="linear" slope=".09" /></feComponentTransfer></filter>
        <radialGradient id="ph-vig" cx=".5" cy=".45" r=".75"><stop offset=".55" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".42" /></radialGradient>
      </defs>
      <g filter="url(#ph-blur)">{children}</g>
      <rect width="400" height="500" fill="url(#ph-vig)" />
      <rect width="400" height="500" filter="url(#ph-grain)" />
    </svg>
  );
}

const box = ([l, t, w, h], extra = {}) => ({ left: l + '%', top: t + '%', width: w + '%', height: h + '%', ...extra });

export default function Stage({ outfit, mode = 'flatlay', sceneId = 'studio', customBg = null, personPhoto = null, caption, compact = false, child = false }) {
  const o = outfit || {};
  const photos = usePhotos();
  const person = personPhoto || photos.model;
  const scenePhoto = photos.scenes[sceneId];
  const scene = SCENES.find((s) => s.id === sceneId) || SCENES[0];
  const onBody = mode === 'mannequin' || mode === 'scene';
  const KEYS = ['outer', 'bottom', 'top', 'shoes', 'bag', 'accessory'];
  const empty = !KEYS.some((k) => o[k]);

  let layers;
  if (!onBody) {
    const L = o.top?.category === 'dress' ? DRESS : o.outer ? FLATLAY_WITH_OUTER : FLATLAY;
    layers = KEYS.filter((k) => o[k]).map((k, i) => (
      <div key={k + o[k].id} className="stage-item" style={{ ...box(L[k] || FLATLAY[k]), '--i': i, '--r': `${((i * 37) % 7) - 3}deg` }}>
        <GarmentArt item={o[k]} />
      </div>
    ));
  } else {
    // dressed on the mannequin: every piece drawn to fit the body
    layers = <Worn key={KEYS.map((k) => o[k]?.id || '').join('|')} outfit={o} child={child} photoFor={(it) => it.image || photos.garments[it.id] || null} />;
  }

  // "On you": a real photo of a person, with the outfit pinned beside it as a product card.
  if (mode === 'person') {
    return (
      <div className={`stage ${compact ? 'compact' : ''} mode-person`}>
        {person ? <img className="stage-layer cover" src={person} alt={personPhoto ? 'Your photo' : 'Model'} /> : <div className="stage-empty">Add a photo of yourself (or a model you like) to see your outfit beside a real person.</div>}
        <div className="person-card">
          {['outer', 'top', 'bottom', 'shoes', 'bag', 'accessory'].filter((k) => o[k]).map((k) => <div key={k} className="person-piece"><GarmentArt item={o[k]} /></div>)}
        </div>
        {caption && <div className="stage-caption">{caption}</div>}
      </div>
    );
  }

  const bg = mode === 'scene'
    ? (customBg ? <img className="stage-layer cover" src={customBg} alt="" />
      : scenePhoto ? <img className="stage-layer cover" src={scenePhoto} alt="" onError={() => markBroken(scenePhoto)} />
      : <PhotoFinish>{scene.render()}</PhotoFinish>)
    : null;

  const photoOnBody = onBody && KEYS.some((k) => o[k] && (o[k].image || photos.garments[o[k].id]));
  return (
    <div className={`stage ${compact ? 'compact' : ''} mode-${mode}`}>
      {bg}
      {layers}
      {photoOnBody && !compact && <div className="stage-note">Your photos are placed as taken, not reshaped to the body</div>}
      {empty && !compact && <div className="stage-empty">Pick pieces from the slots below to start a look.</div>}
      {caption && <div className="stage-caption">{caption}</div>}
    </div>
  );
}
