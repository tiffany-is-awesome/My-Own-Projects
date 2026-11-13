// Realistic product-style garment renders (SVG, 200×250 viewBox).
// Each piece gets studio lighting (gradient), a fabric texture matched to its material
// (procedural noise), soft fold shading, stitching and a soft contact shadow.
// Uploaded garments show their real cut-out photo instead.
import { useId } from 'react';
import { shade } from '../ai/color.js';

// ── Silhouettes ──────────────────────────────────────────────────────────────
const P = {
  tee: 'M70 44 C80 40 88 37 90 36 C94 46 106 46 110 36 C112 37 120 40 130 44 L160 70 C162 73 161 76 158 78 L144 90 C142 92 139 91 138 89 L138.5 205 C138.5 209 135.5 211 131.5 211 L68.5 211 C64.5 211 61.5 209 61.5 205 L62 89 C61 91 58 92 56 90 L42 78 C39 76 38 73 40 70 Z',
  long: 'M70 44 C80 40 88 37 90 36 C94 46 106 46 110 36 C112 37 120 40 130 44 C140 48 148 54 151 66 L166 182 C166.5 186 164 188 160 188.5 L151 189.5 C147.5 190 145 188 144.5 184.5 L138 112 L138.5 208 C138.5 211 136 213 132 213 L68 213 C64 213 61.5 211 61.5 208 L62 112 L55.5 184.5 C55 188 52.5 190 49 189.5 L40 188.5 C36 188 33.5 186 34 182 L49 66 C52 54 60 48 70 44 Z',
  knit: 'M68 46 C78 41 87 38 89 37 C94 47 106 47 111 37 C113 38 122 41 132 46 C143 51 150 58 153 70 L167 180 C168 186 165 189 160 189.5 L150 190.5 C146 191 143 188.5 142.5 185 L140 118 C141 150 141 180 140.5 206 C140.5 211 137 213 132 213 L68 213 C63 213 59.5 211 59.5 206 C59 180 59 150 60 118 L57.5 185 C57 188.5 54 191 50 190.5 L40 189.5 C35 189 32 186 33 180 L47 70 C50 58 57 51 68 46 Z',
  trousers: 'M66 30 L134 30 C135.5 80 139 160 142.5 224 C142.7 227 140.5 229 137.5 229 L113 229 C110 229 108.2 227 108 224 L100.6 98 L99.4 98 L92 224 C91.8 227 90 229 87 229 L62.5 229 C59.5 229 57.3 227 57.5 224 C61 160 64.5 80 66 30 Z',
  wide: 'M66 30 L134 30 C138 80 146 160 151 223 C151.3 226.5 149 229 145.5 229 L111 229 C108 229 106.3 227 106 224 L100.6 100 L99.4 100 L94 224 C93.7 227 92 229 89 229 L54.5 229 C51 229 48.7 226.5 49 223 C54 160 62 80 66 30 Z',
  shorts: 'M62 58 L138 58 C141 90 146 130 150 162 C150.5 166 148 168.5 144.5 169 L110 172 C107 172.2 105 170.5 104.6 167.5 L100.6 116 L99.4 116 L95.4 167.5 C95 170.5 93 172.2 90 172 L55.5 169 C52 168.5 49.5 166 50 162 C54 130 59 90 62 58 Z',
  skirt: 'M72 40 L128 40 C138 90 150 160 160 210 C161 214 158.5 217 154.5 217.5 C120 222 80 222 45.5 217.5 C41.5 217 39 214 40 210 C50 160 62 90 72 40 Z',
  coat: 'M68 30 C76 27 84 25 88 24 L100 72 L112 24 C116 25 124 27 132 30 C144 34 152 42 155 56 L170 196 C170.5 200 168 202 164 202.5 L155 203.5 C151 204 148.5 202 148 198.5 L142 112 L143 228 C143 231 140.5 233 137 233 L63 233 C59.5 233 57 231 57 228 L58 112 L52 198.5 C51.5 202 49 204 45 203.5 L36 202.5 C32 202 29.5 200 30 196 L45 56 C48 42 56 34 68 30 Z',
  jacket: 'M68 38 C76 35 84 33 88 32 L100 78 L112 32 C116 33 124 35 132 38 C144 42 152 50 155 64 L168 176 C168.5 180 166 182 162 182.5 L153 183.5 C149 184 146.5 182 146 178.5 L142 116 L142.5 184 C142.5 187 140 189 136.5 189 L63.5 189 C60 189 57.5 187 57.5 184 L58 116 L54 178.5 C53.5 182 51 184 47 183.5 L38 182.5 C34 182 31.5 180 32 176 L45 64 C48 50 56 42 68 38 Z',
  puffer: 'M66 40 C78 34 88 32 90 32 C94 40 106 40 110 32 C112 32 122 34 134 40 C148 47 156 56 159 70 L172 178 C173 184 169 188 163 188.5 L151 189.5 C146 190 142.5 186.5 142 182 L141 120 L142 188 C142 192.5 138.5 195 134 195 L66 195 C61.5 195 58 192.5 58 188 L59 120 L58 182 C57.5 186.5 54 190 49 189.5 L37 188.5 C31 188 27 184 28 178 L41 70 C44 56 52 47 66 40 Z',
};

// Fabric look by material/shape: noise frequency, contrast, sheen
function fabricFor(item) {
  const m = (item.material || '').toLowerCase();
  if (/leather|patent/.test(m) && !/suede/.test(m)) return { f: '0.035', k: 0.05, sheen: 0.5 };
  if (/suede/.test(m)) return { f: '1.6', k: 0.2, sheen: 0 };
  if (/rubber|nylon|down|waterproof|polyester/.test(m)) return { f: '0.04', k: 0.05, sheen: 0.35 };
  if (/denim/.test(m) || item.art === 'jeans') return { f: '0.9 0.5', k: 0.28, sheen: 0.05, twill: true };
  if (/knit|lambswool|cable|souffle|merino|cashmere|fleece|acrylic/.test(m) || item.art === 'knit') return { f: '0.06 0.9', k: 0.22, sheen: 0.05 };
  if (/linen/.test(m)) return { f: '1.1 0.35', k: 0.2, sheen: 0.05 };
  if (/wool|hopsack|gabardine|tweed/.test(m)) return { f: '1.2', k: 0.16, sheen: 0.08 };
  if (/canvas/.test(m)) return { f: '1.4 1.0', k: 0.18, sheen: 0.04 };
  return { f: '1.5', k: 0.12, sheen: 0.1 }; // cotton & default
}

function Defs({ id, c, fab }) {
  const k = fab.k;
  return (
    <defs>
      <linearGradient id={`${id}g`} x1="0.15" y1="0" x2="0.85" y2="1">
        <stop offset="0" stopColor={shade(c, 0.16)} />
        <stop offset="0.5" stopColor={c} />
        <stop offset="1" stopColor={shade(c, -0.22)} />
      </linearGradient>
      <radialGradient id={`${id}h`} cx="0.38" cy="0.3" r="0.55">
        <stop offset="0" stopColor="#fff" stopOpacity={0.18 + fab.sheen * 0.3} />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </radialGradient>
      <filter id={`${id}t`} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency={fab.f} numOctaves="2" seed="7" result="n" />
        <feColorMatrix in="n" type="saturate" values="0" result="m" />
        <feComponentTransfer in="m" result="s">
          <feFuncR type="linear" slope={k * 2} intercept={1 - k} />
          <feFuncG type="linear" slope={k * 2} intercept={1 - k} />
          <feFuncB type="linear" slope={k * 2} intercept={1 - k} />
        </feComponentTransfer>
        <feBlend in="SourceGraphic" in2="s" mode="multiply" result="b" />
        <feComposite in="b" in2="SourceGraphic" operator="in" />
      </filter>
      <filter id={`${id}b`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3.2" /></filter>
      <filter id={`${id}s`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6" /></filter>
      {fab.twill && (
        <pattern id={`${id}w`} width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
          <rect width="3" height="1.2" fill="#fff" opacity=".10" />
        </pattern>
      )}
    </defs>
  );
}

/** A fabric body: lit fill + texture + folds clipped to the shape + subtle edge. */
function Body({ id, d, c, fab, folds = [], lights = [], children }) {
  return (
    <g>
      <clipPath id={`${id}c`}><path d={d} /></clipPath>
      <path d={d} fill={`url(#${id}g)`} filter={`url(#${id}t)`} />
      <g clipPath={`url(#${id}c)`}>
        {fab.twill && <path d={d} fill={`url(#${id}w)`} />}
        <g filter={`url(#${id}b)`}>
          {folds.map((f, i) => <path key={'f' + i} d={f} fill="none" stroke={shade(c, -0.5)} strokeOpacity=".2" strokeWidth="4.5" strokeLinecap="round" />)}
          {lights.map((f, i) => <path key={'l' + i} d={f} fill="none" stroke="#fff" strokeOpacity=".15" strokeWidth="4.5" strokeLinecap="round" />)}
        </g>
        <path d={d} fill={`url(#${id}h)`} />
        {children}
      </g>
      <path d={d} fill="none" stroke={shade(c, -0.45)} strokeOpacity=".35" strokeWidth="0.8" />
    </g>
  );
}

const stitch = (c, d, w = 0.7) => <path d={d} fill="none" stroke={shade(c, -0.4)} strokeOpacity=".55" strokeWidth={w} strokeDasharray="2.2 1.6" />;

function Top({ id, item, c, fab }) {
  const art = item.art;
  const d = art === 'tee' ? P.tee : art === 'knit' ? P.knit : P.long;
  const folds = art === 'tee'
    ? ['M66 96 Q78 130 70 170', 'M134 96 Q124 135 130 175']
    : ['M64 118 Q76 150 68 196', 'M136 118 Q126 150 132 196', 'M48 120 Q54 150 46 180', 'M152 120 Q146 150 154 180', 'M90 160 Q100 170 112 160'];
  const lights = ['M96 70 Q100 120 98 190', 'M58 80 Q54 110 50 150'];
  const c2 = item.colors?.[1]?.hex;
  const ribbed = art === 'knit' || art === 'turtleneck' || art === 'stripe';
  return (
    <g>
      <Body id={id} d={d} c={c} fab={fab} folds={folds} lights={lights}>
        {art === 'stripe' && Array.from({ length: 14 }, (_, i) => (
          <path key={i} d={`M20 ${58 + i * 11} Q100 ${61 + i * 11} 180 ${58 + i * 11}`} stroke={c2 || '#1F2A44'} strokeWidth="4.2" fill="none" opacity=".92" />
        ))}
        {art === 'knit' && (
          <g opacity=".5">
            {[76, 88, 100, 112, 124].map((x) => <path key={x} d={`M${x} 60 C${x + 5} 80 ${x - 5} 100 ${x} 120 C${x + 5} 140 ${x - 5} 160 ${x} 200`} stroke={shade(c, -0.35)} strokeWidth="3" fill="none" />)}
            {[76, 88, 100, 112, 124].map((x) => <path key={'h' + x} d={`M${x + 2} 60 C${x + 7} 80 ${x - 3} 100 ${x + 2} 120 C${x + 7} 140 ${x - 3} 160 ${x + 2} 200`} stroke={shade(c, 0.25)} strokeWidth="1.4" fill="none" />)}
          </g>
        )}
        {ribbed && <rect x="58" y="200" width="84" height="14" fill={shade(c, -0.1)} opacity=".7" />}
        {ribbed && Array.from({ length: 21 }, (_, i) => <line key={i} x1={60 + i * 4} y1="201" x2={60 + i * 4} y2="213" stroke={shade(c, -0.3)} strokeOpacity=".35" strokeWidth="1" />)}
        {art === 'tee' && stitch(c, 'M62.5 203 L138 203')}
        {art === 'tee' && stitch(c, 'M45 75 L57 87 M155 75 L143 87')}
      </Body>
      {(art === 'tee' || art === 'stripe' || art === 'knit') && (
        <path d="M90 36.5 C94 47 106 47 110 36.5" fill="none" stroke={shade(c, art === 'tee' ? -0.18 : -0.25)} strokeWidth={art === 'knit' ? 5 : 3} strokeLinecap="round" />
      )}
      {art === 'turtleneck' && (
        <g>
          <path d="M86 18 C92 16 108 16 114 18 L115 42 C108 46 92 46 85 42 Z" fill={`url(#${id}g)`} filter={`url(#${id}t)`} />
          {[88, 92, 96, 100, 104, 108, 112].map((x) => <line key={x} x1={x} y1="19" x2={x} y2="43" stroke={shade(c, -0.4)} strokeOpacity=".35" />)}
          <path d="M85 42 C92 46 108 46 115 42" fill="none" stroke={shade(c, -0.5)} strokeOpacity=".5" strokeWidth="1.5" />
        </g>
      )}
      {art === 'shirt' && (
        <g>
          <path d="M88 34 L100 58 L112 34 L109 30 C104 33 96 33 91 30 Z" fill={shade(c, 0.05)} stroke={shade(c, -0.4)} strokeOpacity=".45" strokeWidth=".8" />
          <path d="M88 34 L79 46 L94 52 Z M112 34 L121 46 L106 52 Z" fill={shade(c, 0.08)} stroke={shade(c, -0.4)} strokeOpacity=".45" strokeWidth=".8" />
          <rect x="97.5" y="58" width="5" height="154" fill={shade(c, -0.04)} opacity=".6" />
          {stitch(c, 'M97 58 L97 212 M103 58 L103 212', 0.6)}
          {[76, 102, 128, 154, 180].map((y) => <g key={y}><circle cx="100" cy={y} r="2.1" fill={shade(c, 0.35)} stroke={shade(c, -0.35)} strokeWidth=".5" /><circle cx="99.4" cy={y - 0.4} r=".4" fill={shade(c, -0.4)} /></g>)}
          <path d="M70 84 L86 84 L86 100 L78 103 L70 100 Z" fill="none" stroke={shade(c, -0.4)} strokeOpacity=".45" strokeWidth=".8" />
          {stitch(c, 'M144 176 L163 174 M56 176 L37 174', 0.6)}
        </g>
      )}
    </g>
  );
}

function Bottom({ id, item, c, fab }) {
  const art = item.art;
  if (art === 'skirt') {
    return (
      <Body id={id} d={P.skirt} c={c} fab={fab}>
        {[52, 64, 76, 88, 100, 112, 124, 136, 148].map((x, i) => (
          <g key={x}>
            <path d={`M${100 + (x - 100) * 0.3} 52 L${x} 220`} stroke={shade(c, -0.5)} strokeOpacity=".35" strokeWidth="2.4" filter={`url(#${id}b)`} />
            <path d={`M${100 + (x - 100) * 0.3 + 2} 52 L${x + 5} 220`} stroke="#fff" strokeOpacity={i % 2 ? 0.12 : 0.2} strokeWidth="2" />
          </g>
        ))}
        <rect x="70" y="40" width="60" height="12" fill={shade(c, -0.08)} />
      </Body>
    );
  }
  const d = art === 'shorts' ? P.shorts : item.fit === 'relaxed' || item.fit === 'oversized' ? P.wide : P.trousers;
  const top = art === 'shorts' ? 58 : 30;
  const folds = art === 'shorts'
    ? ['M78 100 Q82 130 76 160', 'M122 100 Q118 130 124 160']
    : ['M80 110 Q84 160 76 220', 'M120 110 Q116 160 124 220', 'M64 200 Q74 206 86 200', 'M114 200 Q126 206 136 200'];
  const lights = art === 'shorts' ? ['M70 80 Q66 120 62 150'] : ['M72 50 Q68 140 64 215', 'M128 50 Q132 140 136 215'];
  return (
    <Body id={id} d={d} c={c} fab={fab} folds={folds} lights={lights}>
      <rect x="60" y={top} width="80" height="11" fill={shade(c, -0.06)} opacity=".9" />
      {stitch(c, `M60 ${top + 11} L140 ${top + 11}`)}
      {[70, 86, 114, 130].map((x) => <rect key={x} x={x} y={top - 1} width="3" height="13" fill={shade(c, -0.12)} />)}
      <circle cx="100" cy={top + 5.5} r="2.2" fill={art === 'jeans' ? '#B98B3E' : shade(c, -0.3)} />
      {stitch(c, `M100 ${top + 12} L100 ${top + 60}`, 0.7)}
      {art === 'jeans' ? (
        <g fill="none" stroke="#C99A4B" strokeOpacity=".85" strokeWidth=".8" strokeDasharray="2 1.4">
          <path d={`M66 ${top + 14} Q74 ${top + 34} 90 ${top + 32}`} /><path d={`M134 ${top + 14} Q126 ${top + 34} 110 ${top + 32}`} />
          <path d="M60 222 L90 222 M110 222 L140 222" />
        </g>
      ) : (
        <g>
          <path d={`M68 ${top + 14} L72 ${top + 34}`} stroke={shade(c, -0.4)} strokeOpacity=".5" />
          <path d={`M132 ${top + 14} L128 ${top + 34}`} stroke={shade(c, -0.4)} strokeOpacity=".5" />
          {art !== 'shorts' && <g stroke="#fff" strokeOpacity=".16" strokeWidth="1.2"><line x1="81" y1={top + 12} x2="76" y2="226" /><line x1="119" y1={top + 12} x2="124" y2="226" /></g>}
        </g>
      )}
    </Body>
  );
}

function Outer({ id, item, c, fab }) {
  const art = item.art;
  const d = art === 'coat' || art === 'trench' ? P.coat : art === 'puffer' ? P.puffer : P.jacket;
  const hem = art === 'coat' || art === 'trench' ? 233 : art === 'puffer' ? 195 : 189;
  const openFront = art !== 'puffer';
  const folds = ['M66 120 Q76 160 70 ' + (hem - 10), 'M134 120 Q124 160 130 ' + (hem - 10), 'M44 110 Q50 150 42 190', 'M156 110 Q150 150 158 190'];
  return (
    <g>
      <Body id={id} d={d} c={c} fab={fab} folds={folds} lights={['M78 60 Q74 120 72 ' + (hem - 20), 'M50 70 Q46 110 42 150']}>
        {art === 'puffer' && [62, 84, 106, 128, 150, 172].map((y) => (
          <g key={y}>
            <path d={`M20 ${y} Q100 ${y + 5} 180 ${y}`} stroke={shade(c, -0.6)} strokeOpacity=".55" strokeWidth="2.2" fill="none" filter={`url(#${id}b)`} />
            <path d={`M20 ${y + 9} Q100 ${y + 14} 180 ${y + 9}`} stroke="#fff" strokeOpacity=".22" strokeWidth="4" fill="none" filter={`url(#${id}b)`} />
          </g>
        ))}
        {art === 'trench' && (
          <g>
            <rect x="56" y="128" width="88" height="9" fill={shade(c, -0.06)} />
            {stitch(c, 'M56 129.5 L144 129.5 M56 135.5 L144 135.5', 0.6)}
            <rect x="104" y="126" width="9" height="13" fill="none" stroke={shade(c, -0.45)} strokeWidth="1.4" />
            <path d="M60 54 L82 64 L80 92 L60 84 Z" fill={shade(c, -0.03)} stroke={shade(c, -0.35)} strokeOpacity=".4" strokeWidth=".6" />
          </g>
        )}
        {art === 'cardigan' && Array.from({ length: 13 }, (_, i) => <line key={i} x1={60 + i * 6.6} y1="178" x2={60 + i * 6.6} y2="189" stroke={shade(c, -0.3)} strokeOpacity=".4" />)}
        {art === 'jacket' && (
          <g>
            {stitch(c, 'M60 112 L140 112')}
            <path d="M66 86 L86 86 L86 104 L76 107 L66 104 Z" fill="none" stroke={shade(c, -0.4)} strokeOpacity=".5" strokeWidth=".8" />
            <path d="M134 86 L114 86 L114 104 L124 107 L134 104 Z" fill="none" stroke={shade(c, -0.4)} strokeOpacity=".5" strokeWidth=".8" />
            {[120, 150, 176].map((y) => <circle key={y} cx="104" cy={y} r="2.4" fill="#B98B3E" />)}
          </g>
        )}
        {(art === 'coat' || art === 'blazer') && <path d={`M70 ${hem - 70} L86 ${hem - 72} M114 ${hem - 72} L130 ${hem - 70}`} stroke={shade(c, -0.4)} strokeOpacity=".45" strokeWidth="1.2" />}
      </Body>
      {openFront && (
        <g>
          <path d="M88 24 L82 46 L97 98 L100 72 Z" fill={shade(c, 0.04)} stroke={shade(c, -0.4)} strokeOpacity=".4" strokeWidth=".7" />
          <path d="M112 24 L118 46 L103 98 L100 72 Z" fill={shade(c, -0.08)} stroke={shade(c, -0.4)} strokeOpacity=".4" strokeWidth=".7" />
          <path d="M97 98 L100 72 L103 98" fill="none" stroke={shade(c, -0.6)} strokeOpacity=".4" strokeWidth="2" filter={`url(#${id}b)`} />
          <line x1="100" y1="96" x2="100" y2={hem} stroke={shade(c, -0.5)} strokeOpacity=".55" strokeWidth="1.1" />
          {(art === 'coat' || art === 'blazer' || art === 'trench' || art === 'cardigan') && [118, 156].filter((y) => y < hem - 10).map((y) => (
            <g key={y}><circle cx="107" cy={y} r="3.2" fill={shade(c, -0.55)} /><circle cx="106.2" cy={y - 0.8} r="1" fill="#fff" opacity=".25" /></g>
          ))}
        </g>
      )}
      {art === 'puffer' && <line x1="100" y1="36" x2="100" y2={hem} stroke={shade(c, -0.6)} strokeOpacity=".7" strokeWidth="1.6" />}
    </g>
  );
}

function Shoe({ id, item, c, fab, x, y, back }) {
  const art = item.art;
  const sole = art === 'sneaker' ? '#F2F0EC' : art === 'boot' ? '#262626' : shade(c, -0.45);
  let upper, soleD, extra = null;
  if (art === 'boot') {
    upper = 'M30 60 C30 56 33 54 37 54 L78 54 C82 54 84 57 84 61 L86 128 C104 134 126 142 140 152 C148 158 152 164 152 172 L152 176 L28 176 C26 120 28 90 30 60 Z';
    soleD = 'M26 176 L154 176 C154 182 151 186 146 186 L74 186 L72 190 L34 190 C29 190 26 186 26 182 Z';
    extra = <path d="M52 62 Q46 100 54 140 L76 140 Q70 100 76 62 Z" fill={shade(c, -0.18)} opacity=".85" />;
  } else if (art === 'loafer') {
    upper = 'M18 160 C18 146 28 138 44 138 C70 136 108 140 132 150 C144 155 150 162 150 170 L150 174 L18 174 Z';
    soleD = 'M16 174 L152 174 C152 179 149 182 144 182 L22 182 C18 182 16 179 16 176 Z';
    extra = (
      <g>
        <path d="M70 146 C90 140 120 144 134 152" fill="none" stroke={shade(c, -0.45)} strokeOpacity=".6" strokeWidth="1" strokeDasharray="2 1.4" />
        <rect x="84" y="146" width="30" height="7" rx="2" fill={shade(c, -0.15)} />
        <ellipse cx="99" cy="149.5" rx="7" ry="1.6" fill={shade(c, -0.55)} />
      </g>
    );
  } else if (art === 'sandal') {
    upper = 'M14 166 C14 160 18 158 24 158 L140 160 C148 160 152 164 152 170 L152 174 L14 174 Z';
    soleD = 'M12 174 L154 174 C154 179 151 182 146 182 L18 182 C14 182 12 179 12 176 Z';
    extra = (
      <g fill="none" stroke={shade(c, -0.05)} strokeWidth="7" strokeLinecap="round">
        <path d="M40 160 Q64 128 92 160" /><path d="M78 160 Q104 132 126 161" />
      </g>
    );
  } else {
    upper = 'M20 150 C20 128 30 118 46 116 C58 114 66 118 74 126 C90 132 112 138 130 146 C142 151 148 158 148 166 L148 172 L20 172 Z';
    soleD = 'M18 172 L150 172 C150 180 146 184 140 184 L24 184 C20 184 18 181 18 178 Z';
    extra = (
      <g>
        <path d="M60 124 C76 128 96 134 118 142" fill="none" stroke={shade(c, -0.3)} strokeOpacity=".5" strokeWidth="1" strokeDasharray="2 1.4" />
        {[0, 1, 2, 3, 4].map((i) => <line key={i} x1={74 + i * 9} y1={128 + i * 2.4} x2={80 + i * 9} y2={138 + i * 2.4} stroke={shade(c, -0.25)} strokeWidth="2" strokeLinecap="round" />)}
        <path d="M22 160 C40 158 60 160 80 166" fill="none" stroke={shade(c, -0.35)} strokeOpacity=".4" strokeWidth=".8" strokeDasharray="2 1.4" />
        <line x1="20" y1="178" x2="150" y2="178" stroke="#C9C6C0" strokeWidth=".8" />
      </g>
    );
  }
  const sid = id + (back ? 'k' : 'f');
  return (
    <g transform={`translate(${x} ${y})`} style={back ? { filter: 'brightness(.8)' } : undefined}>
      <clipPath id={`${sid}c`}><path d={upper} /></clipPath>
      <path d={upper} fill={`url(#${id}g)`} filter={`url(#${id}t)`} />
      <g clipPath={`url(#${sid}c)`}>
        <path d={upper} fill={`url(#${id}h)`} />
        {fab.sheen > 0.3 && <ellipse cx="70" cy="132" rx="40" ry="6" fill="#fff" opacity=".28" filter={`url(#${id}b)`} />}
        {extra}
      </g>
      <path d={upper} fill="none" stroke={shade(c, -0.45)} strokeOpacity=".4" strokeWidth=".8" />
      <path d={soleD} fill={sole} />
      <path d={soleD} fill="none" stroke="#000" strokeOpacity=".15" strokeWidth=".6" />
    </g>
  );
}

function Shoes(props) {
  // product-shot pair: one shoe behind, slightly offset
  return (
    <g transform="translate(14 22)">
      <Shoe {...props} x={22} y={-22} back />
      <Shoe {...props} x={0} y={0} />
    </g>
  );
}

function Accessory({ id, item, c, fab }) {
  if (item.art === 'scarf') {
    const d = 'M72 36 C88 32 112 32 128 36 L132 196 C126 198 116 198 110 196 L110 74 L90 74 L90 212 C84 214 74 214 68 212 Z';
    return (
      <Body id={id} d={d} c={c} fab={fab} folds={['M100 40 Q96 60 100 74', 'M80 90 Q84 150 78 200', 'M120 90 Q116 140 122 190']} lights={['M74 60 Q72 140 72 200']}>
        <g stroke={shade(c, -0.3)} strokeOpacity=".3">{Array.from({ length: 30 }, (_, i) => { const x = 68 + (i % 15) * 1.6 + (i > 14 ? 42 : 0); return <line key={i} x1={x} y1="40" x2={x} y2="210" />; })}</g>
      </Body>
    );
  }
  if (item.art === 'crossbody') {
    const d = 'M54 122 C54 116 58 112 64 112 L136 112 C142 112 146 116 146 122 L146 182 C146 188 142 192 136 192 L64 192 C58 192 54 188 54 182 Z';
    return (
      <g>
        <path d="M58 116 C62 40 138 40 142 116" fill="none" stroke={shade(c, -0.25)} strokeWidth="4.5" />
        <path d="M58 116 C62 40 138 40 142 116" fill="none" stroke="#fff" strokeOpacity=".15" strokeWidth="1.5" />
        <Body id={id} d={d} c={c} fab={fab} folds={['M60 186 Q100 190 140 186']} lights={['M64 120 Q100 116 136 120']}>
          <path d="M54 112 L146 112 L146 148 C120 154 80 154 54 148 Z" fill={shade(c, 0.04)} />
          <path d="M54 148 C80 154 120 154 146 148" fill="none" stroke={shade(c, -0.6)} strokeOpacity=".5" strokeWidth="2" filter={`url(#${id}b)`} />
          {stitch(c, 'M58 116 L142 116 M58 145 C82 150 118 150 142 145', 0.6)}
        </Body>
        <rect x="94" y="144" width="12" height="10" rx="1.5" fill="#C9C6BE" stroke="#8C8A84" strokeWidth=".6" />
      </g>
    );
  }
  const d = 'M50 100 L150 100 L158 214 C158 218 155 220 151 220 L49 220 C45 220 42 218 42 214 Z';
  return (
    <g>
      <path d="M74 102 C74 54 126 54 126 102" fill="none" stroke={shade(c, -0.3)} strokeWidth="6" />
      <Body id={id} d={d} c={c} fab={fab} folds={['M70 110 Q74 160 66 214', 'M130 110 Q126 160 134 214']} lights={['M90 110 Q96 160 92 210']}>
        {stitch(c, 'M50 106 L150 106')}
      </Body>
    </g>
  );
}

export default function GarmentArt({ item, className = '', style }) {
  const rid = useId().replace(/[^a-zA-Z0-9]/g, '');
  if (!item) return null;
  if (item.image) {
    return <img className={'garment-img ' + className} style={style} src={item.image} alt={`${item.colors?.[0]?.name || ''} ${item.name}`} draggable="false" />;
  }
  const c = item.colors?.[0]?.hex || '#999999';
  const fab = fabricFor(item);
  const id = 'g' + rid;
  const props = { id, item, c, fab };
  const body = { top: <Top {...props} />, bottom: <Bottom {...props} />, outer: <Outer {...props} />, shoes: <Shoes {...props} />, accessory: <Accessory {...props} /> }[item.category]
    || <Body id={id} d="M50 40 L150 40 L150 210 L50 210 Z" c={c} fab={fab} />;
  return (
    <svg className={'garment-svg ' + className} style={style} viewBox="0 0 200 250" role="img" aria-label={`${item.colors?.[0]?.name || ''} ${item.name}`}>
      <Defs id={id} c={c} fab={fab} />
      <ellipse className="contact-shadow" cx="100" cy="236" rx="74" ry="7" fill="#000" opacity=".10" filter={`url(#${id}s)`} />
      {body}
    </svg>
  );
}
