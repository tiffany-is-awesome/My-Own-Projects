// Scene backdrops for the visual stage (stand-ins for AI-generated scenes, Phase 2).
// All are original vector illustrations, 400×500 (4:5).

const Rain = () => (
  <g stroke="rgba(255,255,255,.35)" strokeWidth="1.2">
    {Array.from({ length: 70 }, (_, i) => {
      const x = (i * 53) % 420, y = (i * 97) % 520;
      return <line key={i} x1={x} y1={y} x2={x - 6} y2={y + 22} />;
    })}
  </g>
);

export const SCENES = [
  {
    id: 'studio', name: 'Studio', keywords: [],
    render: () => <rect width="400" height="500" fill="#F4F4F4" />,
  },
  {
    id: 'tokyo-rain', name: 'Rainy Tokyo street', keywords: ['tokyo', 'rain', 'drizzle', 'osaka', 'commute', 'storm', 'wet'],
    render: () => (
      <g>
        <defs>
          <linearGradient id="tk-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6E7A86" /><stop offset="1" stopColor="#3D454E" /></linearGradient>
          <linearGradient id="tk-road" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2E343B" /><stop offset="1" stopColor="#4A525B" /></linearGradient>
        </defs>
        <rect width="400" height="500" fill="url(#tk-sky)" />
        <rect x="0" y="90" width="90" height="300" fill="#2F363E" /><rect x="96" y="40" width="70" height="350" fill="#353C45" />
        <rect x="250" y="70" width="80" height="320" fill="#30373F" /><rect x="334" y="120" width="66" height="270" fill="#3A424B" />
        {[[20, 130, '#E04A4A'], [110, 90, '#3CC0B4'], [270, 120, '#F0B43C'], [350, 170, '#E04A4A']].map(([x, y, c], i) => (
          <g key={i}><rect x={x} y={y} width="16" height="70" fill={c} opacity=".85" /><rect x={x - 6} y={y - 6} width="28" height="82" fill={c} opacity=".15" /></g>
        ))}
        {Array.from({ length: 24 }, (_, i) => <rect key={i} x={110 + (i % 4) * 14} y={160 + Math.floor(i / 4) * 30} width="8" height="12" fill="#F7E3A8" opacity={(i * 7) % 3 ? 0.55 : 0.15} />)}
        <rect x="0" y="390" width="400" height="110" fill="url(#tk-road)" />
        {[[20, '#E04A4A'], [118, '#3CC0B4'], [278, '#F0B43C']].map(([x, c], i) => <rect key={i} x={x} y="400" width="10" height="60" fill={c} opacity=".25" />)}
        <g stroke="#E8E8E8" strokeWidth="6" opacity=".5">{[0, 1, 2, 3, 4, 5].map((i) => <line key={i} x1={40 + i * 60} y1="470" x2={70 + i * 60} y2="470" />)}</g>
        <Rain />
      </g>
    ),
  },
  {
    id: 'beach-cafe', name: 'Sunny beach café', keywords: ['beach', 'sea', 'summer', 'hot', 'sunny', 'resort', 'café', 'cafe', 'pool', 'island'],
    render: () => (
      <g>
        <defs><linearGradient id="bc-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#A9D6EC" /><stop offset="1" stopColor="#F4EEE0" /></linearGradient></defs>
        <rect width="400" height="500" fill="url(#bc-sky)" />
        <circle cx="320" cy="80" r="34" fill="#FFE7A3" opacity=".9" />
        <rect y="260" width="400" height="60" fill="#6FB3C8" /><rect y="300" width="400" height="10" fill="#9CCAD8" />
        <rect y="310" width="400" height="190" fill="#EADCC0" />
        <path d="M30 230 Q90 170 150 230 Z" fill="#F7F3EA" stroke="#D96C4E" strokeWidth="3" /><line x1="90" y1="200" x2="90" y2="380" stroke="#8C6B4F" strokeWidth="4" />
        <ellipse cx="90" cy="380" rx="44" ry="8" fill="#B5977A" /><rect x="86" y="380" width="8" height="50" fill="#8C6B4F" />
        <path d="M300 300 q8 -40 30 -60 q-14 30 -10 60" fill="#4E7A55" opacity=".7" />
      </g>
    ),
  },
  {
    id: 'office', name: 'Minimal office', keywords: ['office', 'work', 'meeting', 'presentation', 'interview', 'conference', 'business'],
    render: () => (
      <g>
        <rect width="400" height="500" fill="#ECE8E2" />
        <rect x="40" y="50" width="200" height="260" fill="#DCE6EC" stroke="#C9C2B8" strokeWidth="8" />
        <line x1="140" y1="50" x2="140" y2="310" stroke="#C9C2B8" strokeWidth="6" /><line x1="40" y1="180" x2="240" y2="180" stroke="#C9C2B8" strokeWidth="6" />
        <rect x="270" y="80" width="90" height="70" fill="#F7F6F2" stroke="#D3CCC1" strokeWidth="3" /><rect x="282" y="92" width="66" height="46" fill="#B8A88F" opacity=".35" />
        <rect y="380" width="400" height="120" fill="#CFC6B8" />
        <rect x="300" y="300" width="30" height="80" fill="#B5A58E" /><ellipse cx="315" cy="290" rx="34" ry="40" fill="#5F7A5A" />
      </g>
    ),
  },
  {
    id: 'kyoto-autumn', name: 'Kyoto in autumn', keywords: ['kyoto', 'temple', 'autumn', 'fall', 'japan', 'shrine', 'garden'],
    render: () => (
      <g>
        <defs><linearGradient id="ky-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F2D7B2" /><stop offset="1" stopColor="#F6EBDD" /></linearGradient></defs>
        <rect width="400" height="500" fill="url(#ky-sky)" />
        <path d="M120 190 L200 140 L280 190 Z" fill="#3A2E2A" /><rect x="140" y="190" width="120" height="16" fill="#3A2E2A" />
        <path d="M110 214 L200 170 L290 214 Z" fill="#4A3A33" /><rect x="150" y="214" width="100" height="90" fill="#8E3B2C" />
        <rect x="190" y="250" width="20" height="54" fill="#3A2E2A" />
        {[[40, 120], [70, 90], [30, 70], [350, 110], [330, 70], [370, 150], [60, 160]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={30 + (i % 3) * 8} fill={['#C8462B', '#D9772B', '#B33A2A'][i % 3]} opacity=".85" />)}
        <rect y="300" width="400" height="200" fill="#D8CBB6" /><path d="M170 500 L190 300 L210 300 L230 500 Z" fill="#E7DDCC" />
        {Array.from({ length: 22 }, (_, i) => <circle key={i} cx={(i * 71) % 400} cy={320 + ((i * 37) % 170)} r="4" fill={['#C8462B', '#D9772B'][i % 2]} opacity=".7" />)}
      </g>
    ),
  },
  {
    id: 'paris-street', name: 'Paris side street', keywords: ['paris', 'france', 'european', 'cobblestone', 'weekend', 'brunch', 'milan', 'lisbon', 'city', 'street', 'seoul', 'london', 'new york', 'dinner', 'date', 'museum'],
    render: () => (
      <g>
        <rect width="400" height="500" fill="#E9E2D4" />
        {[0, 1, 2].map((b) => (
          <g key={b}>
            <rect x={b * 140 - 10} y="30" width="130" height="360" fill={['#E2D6BF', '#D8CAAF', '#E6DCC8'][b]} stroke="#CBBB9D" />
            {Array.from({ length: 8 }, (_, i) => <g key={i}><rect x={b * 140 + 10 + (i % 2) * 56} y={60 + Math.floor(i / 2) * 80} width="34" height="52" fill="#56606A" opacity=".75" /><rect x={b * 140 + 6 + (i % 2) * 56} y={112 + Math.floor(i / 2) * 80} width="42" height="5" fill="#2F2F2F" /></g>)}
          </g>
        ))}
        <rect x="150" y="310" width="100" height="18" fill="#2F5D50" />
        <rect y="390" width="400" height="110" fill="#A8A096" />
        {Array.from({ length: 40 }, (_, i) => <rect key={i} x={(i % 10) * 40 + (Math.floor(i / 10) % 2) * 20} y={398 + Math.floor(i / 10) * 26} width="36" height="22" rx="4" fill="#B9B1A6" />)}
      </g>
    ),
  },
];

/** Mock "AI scene generation": picks the preset closest to a prompt. */
export function sceneForPrompt(prompt = '') {
  const t = prompt.toLowerCase();
  // default: a neutral city street (or the rainy street when it's wet)
  let best = /rain|drizzle|wet|storm/.test(t) ? SCENES[1] : SCENES[5], bestN = 0;
  for (const s of SCENES) {
    const n = s.keywords.filter((k) => t.includes(k)).length;
    if (n > bestN) { bestN = n; best = s; }
  }
  return best;
}
