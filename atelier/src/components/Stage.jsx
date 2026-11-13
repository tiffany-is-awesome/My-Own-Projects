// The 4:5 visual stage: flat-lay, mannequin, or scene.
import GarmentArt from './GarmentArt.jsx';
import { SCENES } from '../data/scenes.jsx';

// Box positions in % of the 4:5 stage: [left, top, width, height]
const FLATLAY_WITH_OUTER = {
  outer: [2, 4, 50, 56], top: [46, 2, 44, 44], bottom: [50, 40, 38, 56], shoes: [4, 56, 42, 38], accessory: [78, 64, 22, 26],
};
const FLATLAY = {
  top: [4, 4, 52, 50], bottom: [50, 14, 42, 60], shoes: [8, 52, 44, 40], accessory: [66, 70, 28, 26],
};
const MANNEQUIN = {
  shoes: [30, 61.8, 40, 40], bottom: [22, 41, 56, 54], top: [17.5, 10, 65, 65], outer: [16, 9, 68, 68],
};
const ACC_ON_BODY = { scarf: [32, 14, 36, 45], default: [64, 42, 28, 34] };

function Mannequin() {
  return (
    <svg className="stage-layer" viewBox="0 0 400 500" aria-hidden="true">
      <ellipse cx="200" cy="492" rx="90" ry="8" fill="rgba(0,0,0,.12)" />
      <g fill="#E4DED6" stroke="#CFC7BC" strokeWidth="1.5">
        <ellipse cx="200" cy="52" rx="24" ry="30" />
        <rect x="190" y="78" width="20" height="22" />
        <path d="M150 104 Q200 92 250 104 L262 232 L246 470 L210 470 L200 258 L190 470 L154 470 L138 232 Z" />
        <path d="M150 106 L118 230 L130 234 L158 140 Z" /><path d="M250 106 L282 230 L270 234 L242 140 Z" />
      </g>
    </svg>
  );
}

const box = ([l, t, w, h], extra = {}) => ({ left: l + '%', top: t + '%', width: w + '%', height: h + '%', ...extra });

export default function Stage({ outfit, mode = 'flatlay', sceneId = 'studio', customBg = null, caption, compact = false }) {
  const o = outfit || {};
  const scene = SCENES.find((s) => s.id === sceneId) || SCENES[0];
  const onBody = mode !== 'flatlay';
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

  const bg = mode === 'scene'
    ? (customBg ? <img className="stage-layer cover" src={customBg} alt="" /> : <svg className="stage-layer" viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true">{scene.render()}</svg>)
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
