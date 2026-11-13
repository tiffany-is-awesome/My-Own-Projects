// Flat-lay garment illustrations (SVG, 200×250 viewBox).
// Uploaded garments render their real cut-out photo instead.
import { shade } from '../ai/color.js';

const BODY = {
  tee: 'M62 48 L86 38 Q100 52 114 38 L138 48 L168 78 L148 98 L140 90 L140 208 L60 208 L60 90 L52 98 L32 78 Z',
  longsleeve: 'M64 46 L86 38 Q100 50 114 38 L136 46 L156 74 L170 186 L150 190 L138 104 L138 210 L62 210 L62 104 L50 190 L30 186 L44 74 Z',
  trousers: 'M64 30 L136 30 L144 226 L110 226 L100 92 L90 226 L56 226 Z',
  widetrousers: 'M66 30 L134 30 L152 226 L108 226 L100 96 L92 226 L48 226 Z',
  shorts: 'M60 60 L140 60 L150 168 L108 172 L100 112 L92 172 L50 168 Z',
  skirt: 'M72 40 L128 40 L160 214 Q100 226 40 214 Z',
  coat: 'M66 30 L88 24 L100 70 L112 24 L134 30 L158 62 L172 200 L152 204 L142 104 L142 232 L58 232 L58 104 L48 204 L28 200 L42 62 Z',
  jacket: 'M66 40 L88 32 L100 74 L112 32 L134 40 L158 70 L170 178 L150 182 L142 108 L142 186 L58 186 L58 108 L50 182 L30 178 L42 70 Z',
  puffer: 'M66 40 L88 32 Q100 42 112 32 L134 40 L160 70 L172 182 L150 186 L142 110 L142 192 L58 192 L58 110 L50 186 L28 182 L40 70 Z',
};

function Top({ c, d, art, c2 }) {
  const path = art === 'tee' ? BODY.tee : BODY.longsleeve;
  return (
    <g>
      <path d={path} fill={c} stroke={d} strokeWidth="2" strokeLinejoin="round" />
      {art === 'tee' && <path d="M86 38 Q100 56 114 38" fill="none" stroke={d} strokeWidth="3" />}
      {art === 'turtleneck' && <rect x="84" y="24" width="32" height="22" rx="4" fill={c} stroke={d} strokeWidth="2" />}
      {art === 'turtleneck' && [30, 36, 42].map((y) => <line key={y} x1="86" y1={y} x2="114" y2={y} stroke={d} strokeOpacity=".35" />)}
      {art === 'shirt' && (
        <g>
          <path d="M86 38 L100 60 L114 38 L108 34 L100 46 L92 34 Z" fill={shade(c, -0.06)} stroke={d} strokeWidth="1.5" />
          <line x1="100" y1="60" x2="100" y2="210" stroke={d} strokeWidth="1.5" />
          {[78, 104, 130, 156, 182].map((y) => <circle key={y} cx="104" cy={y} r="2.2" fill={d} />)}
          <rect x="68" y="80" width="18" height="16" fill="none" stroke={d} strokeOpacity=".5" />
        </g>
      )}
      {art === 'knit' && (
        <g stroke={d} strokeOpacity=".35" fill="none">
          <path d="M86 38 Q100 54 114 38" strokeWidth="5" strokeOpacity=".6" />
          {[78, 92, 106, 120].map((x) => <path key={x} d={`M${x} 64 q4 8 0 16 q-4 8 0 16 q4 8 0 16 q-4 8 0 16 q4 8 0 16 q-4 8 0 16 q4 8 0 16 q-4 8 0 16`} strokeWidth="2" />)}
          <line x1="62" y1="200" x2="138" y2="200" strokeWidth="6" />
        </g>
      )}
      {art === 'stripe' && (
        <g>
          <clipPath id="stripeclip"><path d={path} /></clipPath>
          <g clipPath="url(#stripeclip)">
            {Array.from({ length: 13 }, (_, i) => <rect key={i} x="20" y={58 + i * 12} width="160" height="5" fill={c2 || '#1F2A44'} />)}
          </g>
          <path d="M86 38 Q100 50 114 38" fill="none" stroke={c2 || '#1F2A44'} strokeWidth="3" />
        </g>
      )}
    </g>
  );
}

function Bottom({ c, d, art, fit }) {
  if (art === 'shorts') return (
    <g><path d={BODY.shorts} fill={c} stroke={d} strokeWidth="2" strokeLinejoin="round" />
      <rect x="60" y="60" width="80" height="10" fill={shade(c, -0.08)} stroke={d} strokeWidth="1.5" /></g>
  );
  if (art === 'skirt') return (
    <g><path d={BODY.skirt} fill={c} stroke={d} strokeWidth="2" strokeLinejoin="round" />
      {[60, 75, 90, 100, 110, 125, 140].map((x) => <line key={x} x1={100 + (x - 100) * 0.3} y1="52" x2={x} y2="218" stroke={d} strokeOpacity=".4" />)}
      <rect x="72" y="40" width="56" height="12" fill={shade(c, -0.08)} stroke={d} strokeWidth="1.5" /></g>
  );
  const path = fit === 'relaxed' || fit === 'oversized' ? BODY.widetrousers : BODY.trousers;
  return (
    <g>
      <path d={path} fill={c} stroke={d} strokeWidth="2" strokeLinejoin="round" />
      <rect x="64" y="30" width="72" height="11" fill={shade(c, -0.08)} stroke={d} strokeWidth="1.5" />
      <line x1="100" y1="41" x2="100" y2="92" stroke={d} strokeWidth="1.5" />
      {art === 'jeans' ? (
        <g fill="none" stroke="#C9A13B" strokeOpacity=".8" strokeDasharray="3 2">
          <path d="M70 44 Q76 64 92 62" /><path d="M130 44 Q124 64 108 62" />
        </g>
      ) : (
        <g stroke={d} strokeOpacity=".3"><line x1="80" y1="44" x2="74" y2="224" /><line x1="120" y1="44" x2="126" y2="224" /></g>
      )}
    </g>
  );
}

function Outer({ c, d, art }) {
  const path = art === 'coat' || art === 'trench' ? BODY.coat : art === 'puffer' ? BODY.puffer : BODY.jacket;
  const bottom = art === 'coat' || art === 'trench' ? 232 : art === 'puffer' ? 192 : 186;
  return (
    <g>
      <path d={path} fill={c} stroke={d} strokeWidth="2" strokeLinejoin="round" />
      {art === 'puffer' ? (
        [70, 92, 114, 136, 158].map((y) => <line key={y} x1="44" y1={y} x2="156" y2={y} stroke={d} strokeOpacity=".4" strokeWidth="1.5" />)
      ) : (
        <g>
          <path d="M88 24 L84 44 L96 94 L100 70 Z" fill={shade(c, -0.1)} stroke={d} strokeWidth="1.5" />
          <path d="M112 24 L116 44 L104 94 L100 70 Z" fill={shade(c, -0.1)} stroke={d} strokeWidth="1.5" />
        </g>
      )}
      <line x1="100" y1={art === 'puffer' ? 36 : 70} x2="100" y2={bottom} stroke={d} strokeWidth="1.5" />
      {art === 'trench' && <rect x="58" y="128" width="84" height="8" fill={shade(c, -0.12)} stroke={d} strokeWidth="1" />}
      {art === 'denim' || art === 'jacket' ? <rect x="66" y="86" width="20" height="16" fill="none" stroke={d} strokeOpacity=".5" /> : null}
      {(art === 'blazer' || art === 'coat' || art === 'trench' || art === 'cardigan') && [112, 150].map((y) => <circle key={y} cx="108" cy={y} r="3" fill={d} />)}
    </g>
  );
}

function Shoes({ c, d, art }) {
  const sole = art === 'sneaker' ? '#FFFFFF' : art === 'boot' ? '#2A2A2A' : shade(c, -0.25);
  const one = (x, flip) => {
    const t = `translate(${x} 0) ${flip ? 'scale(-1 1)' : ''}`;
    if (art === 'boot') return (
      <g transform={t}>
        <path d="M-40 60 L-6 60 L-4 140 Q20 146 40 164 L40 182 L-40 182 Z" fill={c} stroke={d} strokeWidth="2" />
        <rect x="-40" y="182" width="80" height="12" fill={sole} />
        <path d="M-6 80 Q-22 100 -6 130" fill="none" stroke={d} strokeOpacity=".5" strokeWidth="6" />
      </g>
    );
    if (art === 'sandal') return (
      <g transform={t}>
        <path d="M-40 174 Q-40 160 -20 160 L30 160 Q44 162 44 176 L44 184 L-40 184 Z" fill={shade(c, 0.3)} stroke={d} strokeWidth="1.5" />
        <path d="M-24 162 L-6 136 L18 162 M-30 168 L30 140" fill="none" stroke={c} strokeWidth="7" strokeLinecap="round" />
      </g>
    );
    if (art === 'loafer') return (
      <g transform={t}>
        <path d="M-42 172 Q-44 140 -14 138 Q14 136 30 150 Q44 160 44 176 L-42 176 Z" fill={c} stroke={d} strokeWidth="2" />
        <rect x="-42" y="176" width="86" height="8" fill={sole} />
        <path d="M-2 144 L22 150" stroke={d} strokeWidth="4" strokeOpacity=".5" />
      </g>
    );
    return (
      <g transform={t}>
        <path d="M-42 172 Q-44 132 -16 132 Q4 132 12 148 Q36 154 44 170 L44 176 L-42 176 Z" fill={c} stroke={d} strokeWidth="2" />
        <rect x="-42" y="176" width="86" height="10" rx="3" fill={sole} stroke={d} strokeWidth="1" />
        {[-6, 2, 10].map((x) => <line key={x} x1={x} y1={140 + (x + 6) * 0.4} x2={x + 6} y2={150 + (x + 6) * 0.4} stroke={d} strokeOpacity=".6" />)}
      </g>
    );
  };
  return <g transform="translate(0 40)">{one(58, true)}{one(146, false)}</g>;
}

function Accessory({ c, d, art }) {
  if (art === 'scarf') return (
    <g>
      <path d="M70 40 L130 40 L130 200 L112 200 L112 70 L88 70 L88 214 L70 214 Z" fill={c} stroke={d} strokeWidth="2" />
      {[74, 80, 116, 122].map((x) => <line key={x} x1={x} y1={x < 100 ? 214 : 200} x2={x} y2={(x < 100 ? 214 : 200) + 14} stroke={c} strokeWidth="3" />)}
    </g>
  );
  if (art === 'crossbody') return (
    <g>
      <path d="M62 120 Q100 20 138 120" fill="none" stroke={d} strokeWidth="5" />
      <rect x="56" y="118" width="88" height="70" rx="10" fill={c} stroke={d} strokeWidth="2" />
      <path d="M56 140 L144 140" stroke={d} strokeOpacity=".5" />
      <rect x="94" y="136" width="12" height="10" fill="#B8B8B8" />
    </g>
  );
  return (
    <g>
      <path d="M78 96 Q78 50 100 50 Q122 50 122 96" fill="none" stroke={shade(c, -0.25)} strokeWidth="6" />
      <path d="M52 96 L148 96 L156 214 L44 214 Z" fill={c} stroke={d} strokeWidth="2" />
    </g>
  );
}

function Generic({ c, d }) {
  return <rect x="50" y="40" width="100" height="170" fill={c} stroke={d} strokeWidth="2" />;
}

export default function GarmentArt({ item, className = '', style }) {
  if (!item) return null;
  if (item.image) {
    return <img className={'garment-img ' + className} style={style} src={item.image} alt={`${item.colors?.[0]?.name || ''} ${item.name}`} draggable="false" />;
  }
  const c = item.colors?.[0]?.hex || '#999';
  const d = shade(c, -0.36);
  const props = { c, d, art: item.art, fit: item.fit, c2: item.colors?.[1]?.hex };
  const body = {
    top: <Top {...props} />, bottom: <Bottom {...props} />, outer: <Outer {...props} />,
    shoes: <Shoes {...props} />, accessory: <Accessory {...props} />,
  }[item.category] || <Generic {...props} />;
  return (
    <svg className={'garment-svg ' + className} style={style} viewBox="0 0 200 250" role="img" aria-label={`${item.colors?.[0]?.name || ''} ${item.name}`}>
      <ellipse cx="100" cy="238" rx="70" ry="5" fill="rgba(0,0,0,.06)" />
      {body}
    </svg>
  );
}
