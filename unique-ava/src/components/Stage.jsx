// The 4:5 visual stage: flat-lay, mannequin, or scene.
import GarmentArt from './GarmentArt.jsx';
import { SCENES } from '../data/scenes.jsx';
import { usePhotos, markBroken } from '../data/photos.js';

// Box positions in % of the 4:5 stage: [left, top, width, height]
const FLATLAY_WITH_OUTER = {
  outer: [2, 4, 50, 56], top: [46, 2, 44, 44], bottom: [50, 40, 38, 56], shoes: [4, 56, 42, 38], accessory: [78, 64, 22, 26],
};
const FLATLAY = {
  top: [4, 4, 52, 50], bottom: [50, 14, 42, 60], shoes: [8, 52, 44, 40], accessory: [66, 70, 28, 26],
};
const MANNEQUIN = {
  shoes: [36, 74, 28, 28], bottom: [22, 41, 56, 54], top: [17.5, 10, 65, 65], outer: [16, 9, 68, 68],
};
const ACC_ON_BODY = { scarf: [32, 14, 36, 45], default: [64, 42, 28, 34] };

// A matte, faceless retail mannequin with studio shading (no cartoon features).
function Mannequin() {
  return (
    <svg className="stage-layer" viewBox="0 0 400 500" aria-hidden="true">
      <defs>
        <linearGradient id="mq-body" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#CFCAC3" /><stop offset=".35" stopColor="#F3F0EC" /><stop offset=".6" stopColor="#E6E1DA" /><stop offset="1" stopColor="#BDB7AF" />
        </linearGradient>
        <radialGradient id="mq-head" cx=".4" cy=".35" r=".7"><stop offset="0" stopColor="#F7F5F2" /><stop offset=".7" stopColor="#DDD7CF" /><stop offset="1" stopColor="#BFB8AE" /></radialGradient>
        <filter id="mq-soft"><feGaussianBlur stdDeviation="8" /></filter>
      </defs>
      <ellipse cx="200" cy="490" rx="110" ry="10" fill="#000" opacity=".22" filter="url(#mq-soft)" />
      <g>
        <path d="M200 20 C186 20 176 32 176 50 C176 68 186 82 200 82 C214 82 224 68 224 50 C224 32 214 20 200 20 Z" fill="url(#mq-head)" />
        <path d="M190 78 C190 88 189 96 186 102 L214 102 C211 96 210 88 210 78 Z" fill="url(#mq-body)" />
        <path d="M150 108 C168 98 186 100 200 100 C214 100 232 98 250 108 C258 140 262 190 256 236 C252 260 246 290 244 330 L240 474 C240 480 236 482 230 482 L212 482 C207 482 205 479 205 474 L201 300 L199 300 L195 474 C195 479 193 482 188 482 L170 482 C164 482 160 480 160 474 L156 330 C154 290 148 260 144 236 C138 190 142 140 150 108 Z" fill="url(#mq-body)" />
        <path d="M152 110 C142 120 136 150 132 190 L124 238 C123 244 128 246 132 242 L146 200 C150 170 156 140 160 124 Z" fill="url(#mq-body)" />
        <path d="M248 110 C258 120 264 150 268 190 L276 238 C277 244 272 246 268 242 L254 200 C250 170 244 140 240 124 Z" fill="url(#mq-body)" />
        <path d="M200 300 L200 470" stroke="#B7B0A7" strokeWidth="1" opacity=".5" />
        <path d="M200 240 C210 250 230 252 244 246" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="3" filter="url(#mq-soft)" />
      </g>
    </svg>
  );
}

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
    const order = ['shoes', 'bottom', 'top', 'outer', 'accessory'];
    layers = order.filter((k) => o[k]).map((k) => {
      const pos = k === 'accessory' ? (ACC_ON_BODY[o[k].art] || ACC_ON_BODY.default) : MANNEQUIN[k];
      return <div key={k} className="stage-item on-body" style={box(pos)}><GarmentArt item={o[k]} /></div>;
    });
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
      {onBody && <Mannequin />}
      {layers}
      {empty && !compact && <div className="stage-empty">Pick pieces from the slots below to start a look.</div>}
      {caption && <div className="stage-caption">{caption}</div>}
    </div>
  );
}
