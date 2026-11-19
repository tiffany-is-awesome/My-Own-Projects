// The 4:5 visual stage: flat-lay, mannequin, or scene.
import GarmentArt from './GarmentArt.jsx';
import { SCENES } from '../data/scenes.jsx';
import { usePhotos, markBroken } from '../data/photos.js';
import Worn from './Worn.jsx';

// Box positions in % of the 4:5 stage: [left, top, width, height]
const FLATLAY_WITH_OUTER = {
  outer: [2, 4, 50, 56], top: [46, 2, 44, 44], bottom: [50, 40, 38, 56], shoes: [4, 56, 42, 38], accessory: [78, 64, 22, 26],
};
const FLATLAY = {
  top: [4, 4, 52, 50], bottom: [50, 14, 42, 60], shoes: [8, 52, 44, 40], accessory: [66, 70, 28, 26],
};

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

export default function Stage({ outfit, mode = 'flatlay', sceneId = 'studio', customBg = null, personPhoto = null, caption, compact = false }) {
  const o = outfit || {};
  const photos = usePhotos();
  const person = personPhoto || photos.model;
  const scenePhoto = photos.scenes[sceneId];
  const scene = SCENES.find((s) => s.id === sceneId) || SCENES[0];
  const onBody = mode === 'mannequin' || mode === 'scene';
  const empty = !['top', 'bottom', 'outer', 'shoes', 'accessory'].some((k) => o[k]);

  let layers;
  if (!onBody) {
    const L = o.outer ? FLATLAY_WITH_OUTER : FLATLAY;
    const order = ['outer', 'bottom', 'top', 'shoes', 'accessory'];
    layers = order.filter((k) => o[k]).map((k) => (
      <div key={k} className="stage-item" style={box(L[k] || FLATLAY[k])}>
        <GarmentArt item={o[k]} />
        {!compact && o[k].placeholder && <span className="basic-tag">Basic</span>}
      </div>
    ));
  } else {
    // dressed on the mannequin: every piece drawn to fit the body
    layers = <Worn outfit={o} photoFor={(it) => it.image || photos.garments[it.id] || null} />;
  }

  // "On you": a real photo of a person, with the outfit pinned beside it as a product card.
  if (mode === 'person') {
    return (
      <div className={`stage ${compact ? 'compact' : ''} mode-person`}>
        {person ? <img className="stage-layer cover" src={person} alt={personPhoto ? 'Your photo' : 'Model'} /> : <div className="stage-empty">Add a photo of yourself (or a model you like) to see your outfit beside a real person.</div>}
        <div className="person-card">
          {['outer', 'top', 'bottom', 'shoes', 'accessory'].filter((k) => o[k]).map((k) => <div key={k} className="person-piece"><GarmentArt item={o[k]} /></div>)}
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

  return (
    <div className={`stage ${compact ? 'compact' : ''} mode-${mode}`}>
      {bg}
      {layers}
      {empty && !compact && <div className="stage-empty">Pick pieces from the slots below to start a look.</div>}
      {caption && <div className="stage-caption">{caption}</div>}
    </div>
  );
}
