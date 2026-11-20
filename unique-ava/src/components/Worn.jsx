// "Worn" view: the outfit dressed on a front-facing studio mannequin (400×500).
// Unlike the flat-lay renders, every piece here is drawn to fit the body:
// shoulders, sleeves down the arms, trousers from the waist, shoes on the feet,
// a tote in the hand, a crossbody across the chest, a scarf around the neck.
// Pieces with only a photo (your uploads, Gemini photos) are placed as cut-outs on top.
import { useId } from 'react';
import { shade } from '../ai/color.js';
import { Body, Defs, fabricFor } from './GarmentArt.jsx';

// Mirror a path left↔right around x = 200 (all our paths use absolute x y pairs).
const mirror = (d) => d.replace(/(-?\d+(?:\.\d+)?)[ ,](-?\d+(?:\.\d+)?)/g, (_, x, y) => `${+(400 - x).toFixed(2)} ${y}`);

// ── Mannequin (matte, faceless) ──────────────────────────────────────────────
function Mannequin() {
  return (
    <g>
      <defs>
        <linearGradient id="mq-body" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#CFCAC3" /><stop offset=".35" stopColor="#F3F0EC" /><stop offset=".6" stopColor="#E6E1DA" /><stop offset="1" stopColor="#BDB7AF" />
        </linearGradient>
        <radialGradient id="mq-head" cx=".4" cy=".35" r=".7"><stop offset="0" stopColor="#F7F5F2" /><stop offset=".7" stopColor="#DDD7CF" /><stop offset="1" stopColor="#BFB8AE" /></radialGradient>
        <filter id="mq-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7" /></filter>
      </defs>
      <ellipse cx="200" cy="492" rx="80" ry="7" fill="#000" opacity=".2" filter="url(#mq-soft)" />
      <path d="M200 20 C186 20 176 32 176 50 C176 68 186 82 200 82 C214 82 224 68 224 50 C224 32 214 20 200 20 Z" fill="url(#mq-head)" />
      <path d="M190 78 C190 88 189 96 186 102 L214 102 C211 96 210 88 210 78 Z" fill="url(#mq-body)" />
      <path d="M150 108 C168 98 186 100 200 100 C214 100 232 98 250 108 C258 140 262 190 256 236 C252 260 246 290 244 330 L240 474 C240 480 236 482 230 482 L212 482 C207 482 205 479 205 474 L201 300 L199 300 L195 474 C195 479 193 482 188 482 L170 482 C164 482 160 480 160 474 L156 330 C154 290 148 260 144 236 C138 190 142 140 150 108 Z" fill="url(#mq-body)" />
      <path d="M152 110 C142 120 136 150 132 190 L124 238 C123 244 128 246 132 242 L146 200 C150 170 156 140 160 124 Z" fill="url(#mq-body)" />
      <path d={mirror('M152 110 C142 120 136 150 132 190 L124 238 C123 244 128 246 132 242 L146 200 C150 170 156 140 160 124 Z')} fill="url(#mq-body)" />
      {/* feet */}
      <path d="M163 474 C163 468 170 466 178 466 C186 466 193 468 193 474 L194 486 C194 489 191 491 187 491 L169 491 C165 491 162 489 162 486 Z" fill="url(#mq-body)" />
      <path d={mirror('M163 474 C163 468 170 466 178 466 C186 466 193 468 193 474 L194 486 C194 489 191 491 187 491 L169 491 C165 491 162 489 162 486 Z')} fill="url(#mq-body)" />
    </g>
  );
}

// ── Shapes fitted to the mannequin ──────────────────────────────────────────
function torso(e = 0, hem = 268) {
  return `M${148 - e} 106 C${168 - e} 97 184 98 190 100 C194 110 206 110 210 100 C216 98 ${232 + e} 97 ${252 + e} 106 C${261 + e} 138 ${264 + e} 188 ${260 + e} 240 L${258 + e} ${hem - 6} C${258 + e} ${hem - 2} ${255 + e} ${hem} ${251 + e} ${hem} L${149 - e} ${hem} C${145 - e} ${hem} ${142 - e} ${hem - 2} ${142 - e} ${hem - 6} L${140 - e} 240 C${136 - e} 188 ${139 - e} 138 ${148 - e} 106 Z`;
}
const SLEEVE_LONG = 'M148 107 C137 118 131 148 127 188 L121 228 C120 234 125 237 131 236 L139 235 C143 234 145 231 145 227 L152 196 C156 170 160 146 162 128 Z';
const SLEEVE_SHORT = 'M148 107 C139 116 133 132 129 152 L147 160 C150 146 155 134 162 128 Z';
const both = (d) => `${d} ${mirror(d)}`;

/** Several fabric parts of one garment, drawn back-to-front so overlaps never cancel out. */
function Parts({ id, c, fab, parts, folds, lights, children }) {
  return parts.map((d, i) => (
    <Body key={i} part={String(i)} id={id} d={d} c={c} fab={fab} folds={i === parts.length - 1 ? folds : []} lights={i === parts.length - 1 ? lights : []}>
      {children}
    </Body>
  ));
}

function WornTop({ item }) {
  const id = 'w' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const c = item.colors?.[0]?.hex || '#999';
  const fab = fabricFor(item);
  const art = item.art;
  const loose = item.fit === 'oversized' ? 6 : item.fit === 'relaxed' ? 3 : 0;
  const hem = art === 'knit' ? 274 : art === 'tee' ? 266 : 270;
  const sl = art === 'tee' ? SLEEVE_SHORT : SLEEVE_LONG;
  const parts = [sl, mirror(sl), torso(loose, hem)];
  const c2 = item.colors?.[1]?.hex;
  return (
    <g>
      <Defs id={id} c={c} fab={fab} />
      <Parts id={id} c={c} fab={fab} parts={parts}
        folds={['M158 150 Q166 200 160 250', 'M242 150 Q234 200 240 250', 'M176 240 Q200 250 224 240']}
        lights={['M196 120 Q202 180 198 250', 'M150 120 Q146 160 144 200']}>
        {art === 'stripe' && Array.from({ length: 15 }, (_, i) => <path key={i} d={`M100 ${120 + i * 11} Q200 ${123 + i * 11} 300 ${120 + i * 11}`} stroke={c2 || '#1F2A44'} strokeWidth="4.4" fill="none" opacity=".92" />)}
        {art === 'knit' && [170, 185, 200, 215, 230].map((x) => <path key={x} d={`M${x} 120 C${x + 5} 150 ${x - 5} 180 ${x} 210 C${x + 5} 235 ${x - 5} 250 ${x} 270`} stroke={shade(c, -0.3)} strokeOpacity=".45" strokeWidth="3" fill="none" />)}
        {(art === 'knit' || art === 'stripe' || art === 'turtleneck') && <rect x="130" y={hem - 12} width="140" height="12" fill={shade(c, -0.1)} opacity=".6" />}
        {art === 'shirt' && (
          <g>
            <line x1="200" y1="110" x2="200" y2={hem} stroke={shade(c, -0.35)} strokeOpacity=".6" />
            {[132, 162, 192, 222, 252].map((y) => <circle key={y} cx="203" cy={y} r="2" fill={shade(c, 0.3)} stroke={shade(c, -0.35)} strokeWidth=".5" />)}
            <rect x="166" y="138" width="16" height="16" fill="none" stroke={shade(c, -0.35)} strokeOpacity=".45" />
          </g>
        )}
      </Parts>
      {(art === 'tee' || art === 'stripe' || art === 'knit') && <path d="M190 100 C194 112 206 112 210 100" fill="none" stroke={shade(c, -0.25)} strokeWidth={art === 'knit' ? 4 : 2.5} strokeLinecap="round" />}
      {art === 'turtleneck' && (
        <g>
          <path d="M187 78 C194 76 206 76 213 78 L214 104 C206 108 194 108 186 104 Z" fill={`url(#${id}g)`} filter={`url(#${id}t)`} />
          {[190, 195, 200, 205, 210].map((x) => <line key={x} x1={x} y1="79" x2={x} y2="105" stroke={shade(c, -0.4)} strokeOpacity=".3" />)}
        </g>
      )}
      {art === 'shirt' && (
        <g fill={shade(c, 0.05)} stroke={shade(c, -0.4)} strokeOpacity=".5" strokeWidth=".8">
          <path d="M188 96 L200 116 L192 124 L180 104 Z" /><path d="M212 96 L200 116 L208 124 L220 104 Z" />
        </g>
      )}
    </g>
  );
}

function WornBottom({ item }) {
  const id = 'w' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const c = item.colors?.[0]?.hex || '#999';
  const fab = fabricFor(item);
  const art = item.art;
  const wide = item.fit === 'relaxed' || item.fit === 'oversized';
  const d = art === 'skirt'
    ? 'M152 238 L248 238 C258 290 270 350 280 404 C281 408 278 411 274 411 C226 416 174 416 126 411 C122 411 119 408 120 404 C130 350 142 290 152 238 Z'
    : art === 'shorts'
      ? 'M148 238 L252 238 C255 262 258 292 260 334 C260 338 257 340 253 340 L208 340 C205 340 203 338 203 334 L201 300 L199 300 L197 334 C197 338 195 340 192 340 L147 340 C143 340 140 338 140 334 C142 292 145 262 148 238 Z'
      : wide
        ? 'M148 238 L252 238 C256 262 258 292 258 330 L256 470 C256 474 253 476 249 476 L207 476 C204 476 202 474 202 470 L201 304 L199 304 L198 470 C198 474 196 476 193 476 L151 476 C147 476 144 474 144 470 L142 330 C142 292 144 262 148 238 Z'
        : 'M150 238 L250 238 C253 262 255 292 252 330 L245 470 C245 474 242 476 238 476 L208 476 C205 476 203 474 203 470 L201 302 L199 302 L197 470 C197 474 195 476 192 476 L162 476 C158 476 155 474 155 470 L148 330 C145 292 147 262 150 238 Z';
  return (
    <g>
      <Defs id={id} c={c} fab={fab} />
      <Body id={id} d={d} c={c} fab={fab}
        folds={art === 'skirt' ? [] : ['M176 300 Q180 380 174 470', 'M224 300 Q220 380 226 470', 'M160 440 Q176 448 192 440', 'M208 440 Q224 448 240 440']}
        lights={art === 'skirt' ? [] : ['M164 260 Q160 360 162 460', 'M236 260 Q240 360 238 460']}>
        {art === 'skirt' && [130, 146, 162, 178, 194, 210, 226, 242, 258, 274].map((x, i) => (
          <path key={x} d={`M${200 + (x - 200) * 0.4} 248 L${x} 412`} stroke={i % 2 ? '#fff' : shade(c, -0.5)} strokeOpacity={i % 2 ? 0.14 : 0.3} strokeWidth="2.2" />
        ))}
        <rect x="140" y="238" width="120" height="10" fill={shade(c, -0.07)} />
        {art !== 'skirt' && <line x1="200" y1="248" x2="200" y2="290" stroke={shade(c, -0.4)} strokeOpacity=".5" />}
        {art === 'jeans' && <path d="M160 250 Q166 270 184 268 M240 250 Q234 270 216 268" fill="none" stroke="#C99A4B" strokeOpacity=".85" strokeDasharray="2 1.4" />}
        {art === 'trousers' && <g stroke="#fff" strokeOpacity=".16" strokeWidth="1.2"><line x1="176" y1="250" x2="174" y2="474" /><line x1="224" y1="250" x2="226" y2="474" /></g>}
      </Body>
    </g>
  );
}

function WornOuter({ item }) {
  const id = 'w' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const c = item.colors?.[0]?.hex || '#999';
  const fab = fabricFor(item);
  const art = item.art;
  const hem = item.length === 'long' || art === 'coat' || art === 'trench' ? 404 : item.length === 'cropped' ? 254 : 284;
  const sleeve = 'M142 104 C130 116 124 148 120 188 L114 232 C113 239 119 242 126 241 L138 239 C142 238 145 235 145 231 L152 196 C156 170 160 146 162 128 Z';
  const flare = hem > 300 ? 128 : 136;
  const panel = `M142 103 C160 95 180 95 190 97 L197 150 L199 ${hem} L${flare + 6} ${hem} C${flare + 2} ${hem} ${flare} ${hem - 3} ${flare} ${hem - 7} L134 240 C129 186 133 134 142 103 Z`;
  const closed = art === 'puffer';
  const body = `M142 103 C160 95 182 96 190 98 C194 106 206 106 210 98 C218 96 240 95 258 103 C267 134 271 186 266 240 L264 ${hem - 7} C264 ${hem - 3} 262 ${hem} 258 ${hem} L142 ${hem} C138 ${hem} 136 ${hem - 3} 136 ${hem - 7} L134 240 C129 186 133 134 142 103 Z`;
  const parts = closed ? [sleeve, mirror(sleeve), body] : [sleeve, mirror(sleeve), mirror(panel), panel];
  return (
    <g>
      <Defs id={id} c={c} fab={fab} />
      <Parts id={id} c={c} fab={fab} parts={parts}
        folds={[`M160 160 Q168 ${hem / 2 + 80} 160 ${hem - 10}`, `M240 160 Q232 ${hem / 2 + 80} 240 ${hem - 10}`]}
        lights={['M176 120 Q172 200 170 ' + (hem - 20), 'M144 120 Q138 170 134 210']}>
        {closed && [130, 160, 190, 220, 250].filter((y) => y < hem - 10).map((y) => <path key={y} d={`M110 ${y} Q200 ${y + 5} 290 ${y}`} stroke={shade(c, -0.6)} strokeOpacity=".5" strokeWidth="2" fill="none" filter={`url(#${id}b)`} />)}
        {closed && <line x1="200" y1="104" x2="200" y2={hem} stroke={shade(c, -0.6)} strokeOpacity=".7" strokeWidth="1.4" />}
        {art === 'trench' && <g><rect x="128" y="252" width="144" height="9" fill={shade(c, -0.06)} /><rect x="214" y="250" width="9" height="13" fill="none" stroke={shade(c, -0.45)} strokeWidth="1.4" /></g>}
        {art === 'cardigan' && [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => <line key={i} x1={136 + i * 10} y1={hem - 10} x2={136 + i * 10} y2={hem} stroke={shade(c, -0.3)} strokeOpacity=".35" />)}
      </Parts>
      {!closed && (
        <g>
          <path d="M190 97 L176 110 L194 176 L197 150 Z" fill={shade(c, 0.05)} stroke={shade(c, -0.4)} strokeOpacity=".4" strokeWidth=".7" />
          <path d={mirror('M190 97 L176 110 L194 176 L197 150 Z')} fill={shade(c, -0.08)} stroke={shade(c, -0.4)} strokeOpacity=".4" strokeWidth=".7" />
          {/* shadow the coat casts on what's underneath, along the opening */}
          <path d={`M197 150 L199 ${hem}`} stroke="#000" strokeOpacity=".18" strokeWidth="4" filter={`url(#${id}b)`} />
          <path d={mirror(`M197 150 L199 ${hem}`)} stroke="#000" strokeOpacity=".18" strokeWidth="4" filter={`url(#${id}b)`} />
          {(art === 'coat' || art === 'blazer' || art === 'trench' || art === 'cardigan') && [200, 236].filter((y) => y < hem - 12).map((y) => <circle key={y} cx="193" cy={y} r="3" fill={shade(c, -0.55)} />)}
        </g>
      )}
    </g>
  );
}

function Shoe({ cx, item, id, c }) {
  const art = item.art;
  const sole = art === 'sneaker' ? '#F2F0EC' : art === 'boot' ? '#262626' : shade(c, -0.45);
  const top = art === 'boot' ? 440 : art === 'loafer' ? 470 : art === 'sandal' ? 478 : 464;
  const upper = art === 'boot'
    ? `M${cx - 14} ${top} L${cx + 14} ${top} L${cx + 15} 474 C${cx + 18} 478 ${cx + 18} 482 ${cx + 17} 487 L${cx - 17} 487 C${cx - 18} 482 ${cx - 18} 478 ${cx - 15} 474 Z`
    : `M${cx - 17} 487 C${cx - 18} 478 ${cx - 14} ${top} ${cx} ${top} C${cx + 14} ${top} ${cx + 18} 478 ${cx + 17} 487 Z`;
  return (
    <g>
      {art !== 'sandal' && <path d={upper} fill={`url(#${id}g)`} filter={`url(#${id}t)`} />}
      {art !== 'sandal' && <path d={upper} fill={`url(#${id}h)`} />}
      {art === 'sandal' && <g stroke={c} strokeWidth="4" strokeLinecap="round"><path d={`M${cx - 13} 478 L${cx + 13} 478`} /><path d={`M${cx - 10} 485 L${cx + 10} 472`} /></g>}
      {art === 'sneaker' && [0, 1, 2].map((i) => <line key={i} x1={cx - 6} y1={470 + i * 4} x2={cx + 6} y2={470 + i * 4} stroke={shade(c, -0.3)} strokeWidth="1.4" />)}
      {art === 'loafer' && <rect x={cx - 8} y="474" width="16" height="3" rx="1" fill={shade(c, -0.3)} />}
      {fab_sheen(item) && <ellipse cx={cx - 6} cy={top + 14} rx="3" ry="9" fill="#fff" opacity=".14" />}
      <path d={`M${cx - 18} 486 L${cx + 18} 486 L${cx + 17} 492 C${cx + 17} 493 ${cx + 16} 494 ${cx + 14} 494 L${cx - 14} 494 C${cx - 16} 494 ${cx - 17} 493 ${cx - 17} 492 Z`} fill={sole} stroke="#000" strokeOpacity=".15" strokeWidth=".6" />
    </g>
  );
}
const fab_sheen = (item) => fabricFor(item).sheen > 0.3;

function WornShoes({ item }) {
  const id = 'w' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const c = item.colors?.[0]?.hex || '#999';
  const fab = fabricFor(item);
  return (
    <g>
      <Defs id={id} c={c} fab={fab} />
      <Shoe cx={178} item={item} id={id} c={c} />
      <Shoe cx={222} item={item} id={id} c={c} />
    </g>
  );
}

function WornDress({ item }) {
  const id = 'w' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const c = item.colors?.[0]?.hex || '#999';
  const c2 = item.colors?.[1]?.hex;
  const fab = fabricFor(item);
  const body = 'M156 104 C170 100 184 100 190 100 C194 110 206 110 210 100 C216 100 230 100 244 104 C254 130 256 180 250 236 C262 300 272 360 280 404 C281 408 278 411 274 411 C226 416 174 416 126 411 C122 411 119 408 120 404 C128 360 138 300 150 236 C144 180 146 130 156 104 Z';
  const sleeved = item.sleeve && item.sleeve !== 'sleeveless';
  const parts = sleeved ? [SLEEVE_SHORT, mirror(SLEEVE_SHORT), body] : [body];
  return (
    <g>
      <Defs id={id} c={c} fab={fab} />
      <Parts id={id} c={c} fab={fab} parts={parts}
        folds={['M170 260 Q160 330 150 404', 'M230 260 Q240 330 250 404', 'M200 250 Q198 330 200 410']}
        lights={['M186 120 Q190 180 186 230', 'M182 260 Q174 330 168 404']}>
        {item.pattern === 'floral' && Array.from({ length: 40 }, (_, i) => (
          <g key={i} transform={`translate(${130 + (i * 41) % 140} ${110 + Math.floor(i / 5) * 37 + (i % 2) * 9})`}>
            {[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cx="0" cy="-3" rx="2" ry="3.4" fill={c2 || shade(c, 0.45)} transform={`rotate(${a})`} opacity=".85" />)}
            <circle r="1.3" fill={shade(c, -0.4)} />
          </g>
        ))}
        <path d="M150 236 C180 242 220 242 250 236" fill="none" stroke={shade(c, -0.35)} strokeOpacity=".45" strokeWidth="1.2" />
      </Parts>
      <path d="M190 100 C194 112 206 112 210 100" fill="none" stroke={shade(c, -0.3)} strokeWidth="2" />
    </g>
  );
}

function WornAccessory({ item }) {
  const id = 'w' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const c = item.colors?.[0]?.hex || '#999';
  const fab = fabricFor(item);
  if (item.art === 'hat') {
    const d = 'M146 48 C146 39 170 34 200 34 C230 34 254 39 254 48 C254 55 230 59 200 59 C170 59 146 55 146 48 Z M174 42 C174 20 186 10 200 10 C214 10 226 20 226 42 Z';
    return (
      <g>
        <Defs id={id} c={c} fab={fab} />
        <Body id={id} d={d} c={c} fab={fab} folds={['M160 50 Q200 58 240 50']} lights={['M184 22 Q194 14 210 16']}>
          <rect x="174" y="36" width="52" height="6" fill={shade(c, -0.3)} />
        </Body>
      </g>
    );
  }
  if (item.art === 'necklace') {
    return (
      <g fill="none">
        <path d="M188 100 C188 134 212 134 212 100" stroke={shade(c, -0.2)} strokeWidth="2" />
        <path d="M188 100 C188 134 212 134 212 100" stroke={shade(c, 0.4)} strokeWidth=".8" strokeDasharray="1.5 2.5" />
        <circle cx="200" cy="128" r="4" fill={c} stroke={shade(c, -0.35)} strokeWidth="1" />
      </g>
    );
  }
  if (item.art === 'belt') {
    return (
      <g>
        <Defs id={id} c={c} fab={fab} />
        <path d="M144 234 C180 240 220 240 256 234 L256 244 C220 250 180 250 144 244 Z" fill={`url(#${id}g)`} filter={`url(#${id}t)`} />
        <rect x="192" y="232" width="16" height="16" rx="2" fill="none" stroke="#B9A35A" strokeWidth="2.6" />
      </g>
    );
  }
  if (item.art === 'scarf') {
    const d = 'M182 90 C190 104 210 104 218 90 L222 104 C212 120 188 120 178 104 Z M186 110 L178 230 C178 233 180 235 183 235 L194 235 C196 235 197 233 197 231 L199 114 Z M206 112 L212 212 C212 215 214 216 217 216 L226 214 C228 213 229 211 228 208 L215 108 Z';
    return (
      <g>
        <Defs id={id} c={c} fab={fab} />
        <Body id={id} d={d} c={c} fab={fab} folds={['M190 130 Q188 180 186 228']} lights={['M182 120 Q180 170 180 220']} />
        <g stroke={c} strokeWidth="1.2">{[180, 183, 186, 189, 192, 195].map((x) => <line key={x} x1={x} y1="235" x2={x} y2="242" />)}{[214, 217, 220, 223, 226].map((x) => <line key={x} x1={x} y1="215" x2={x + 0.5} y2="222" />)}</g>
      </g>
    );
  }
  if (item.art === 'crossbody') {
    const d = 'M234 254 L276 254 C279 254 281 256 281 259 L281 292 C281 295 279 297 276 297 L234 297 C231 297 229 295 229 292 L229 259 C229 256 231 254 234 254 Z';
    return (
      <g>
        <Defs id={id} c={c} fab={fab} />
        <path d="M160 104 L238 256" stroke={shade(c, -0.2)} strokeWidth="4" strokeLinecap="round" />
        <path d="M160 104 L238 256" stroke="#000" strokeOpacity=".15" strokeWidth="7" filter={`url(#${id}b)`} />
        <Body id={id} d={d} c={c} fab={fab}>
          <path d="M229 254 L281 254 L281 276 C266 280 244 280 229 276 Z" fill={shade(c, 0.05)} />
        </Body>
        <rect x="250" y="273" width="9" height="7" rx="1" fill="#C9C6BE" />
      </g>
    );
  }
  // tote, held in the right hand
  const d = 'M246 252 L298 252 L304 322 C304 325 302 327 299 327 L245 327 C242 327 240 325 240 322 Z';
  return (
    <g>
      <Defs id={id} c={c} fab={fab} />
      <path d="M262 254 C262 232 282 232 282 254" fill="none" stroke={shade(c, -0.3)} strokeWidth="4" />
      <Body id={id} d={d} c={c} fab={fab} folds={['M256 262 Q258 292 254 322']} lights={['M276 262 Q280 292 278 322']} />
    </g>
  );
}

// Fallback placement for pieces that only have a photo (box: left, top, width, height in %).
const PHOTO_BOX = { shoes: [36, 86, 28, 9], bottom: [34, 44, 32, 46], top: [29, 19.5, 42, 36], outer: [27, 19, 46, 60], bag: [60, 48, 18, 20], accessory: [42, 18, 16, 14] };
const PHOTO_ANCHOR = { shoes: 'center bottom', bottom: 'center top', top: 'center top', outer: 'center top', bag: 'center', accessory: 'center top' };
const CHILD_BOX = (b) => [36 + (b[0] - 36) * 0.64, 30 + b[1] * 0.64, b[2] * 0.64, b[3] * 0.64];

export default function Worn({ outfit, photoFor, child = false }) {
  const o = outfit || {};
  const drawable = (k) => o[k] && !photoFor(o[k]);
  const acc = drawable('accessory') ? o.accessory : null;
  const under = acc && ['necklace', 'belt'].includes(acc.art); // worn under an open coat
  const isDressTop = o.top?.category === 'dress';
  return (
    <>
      <svg className="stage-layer" viewBox="0 0 400 500" aria-label={child ? "Outfit on a child's mannequin" : 'Outfit on a studio mannequin'} role="img">
        <g transform={child ? 'translate(72 150) scale(0.64)' : 'translate(20 16) scale(0.9)'}>
        <Mannequin />
        {drawable('shoes') && <WornShoes item={o.shoes} />}
        {drawable('bottom') && !isDressTop && <WornBottom item={o.bottom} />}
        {drawable('top') && (isDressTop ? <WornDress item={o.top} /> : <WornTop item={o.top} />)}
        {under && <WornAccessory item={acc} />}
        {drawable('outer') && <WornOuter item={o.outer} />}
        {drawable('bag') && <WornAccessory item={o.bag} />}
        {acc && !under && <WornAccessory item={acc} />}
        </g>
      </svg>
      {['shoes', 'bottom', 'top', 'outer', 'bag', 'accessory'].filter((k) => o[k] && photoFor(o[k])).map((k) => {
        const [l, t, w, h] = child ? CHILD_BOX(PHOTO_BOX[k]) : PHOTO_BOX[k];
        return <img key={k} className="stage-photo-piece" src={photoFor(o[k])} alt={o[k].name} style={{ left: l + '%', top: t + '%', width: w + '%', height: h + '%', objectPosition: PHOTO_ANCHOR[k] }} />;
      })}
    </>
  );
}
