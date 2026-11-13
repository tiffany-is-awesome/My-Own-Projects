import { useRef, useState } from 'react';
import { Modal } from './common.jsx';
import GarmentArt from './GarmentArt.jsx';
import { processUpload } from '../ai/tagger.js';
import { tagGarment } from '../ai/stylist.js';
import { NAMED_COLORS } from '../ai/color.js';
import { CATEGORIES } from '../data/closet.js';

const STEPS = ['Reading photo', 'Removing background', 'Reading colors', 'Tagging (category, fabric, season)'];
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const ART_BY_CAT = {
  top: ['tee', 'shirt', 'turtleneck', 'knit', 'stripe'], bottom: ['trousers', 'jeans', 'shorts', 'skirt'],
  outer: ['coat', 'trench', 'blazer', 'jacket', 'puffer', 'cardigan'], shoes: ['sneaker', 'loafer', 'boot', 'sandal'], accessory: ['tote', 'crossbody', 'scarf'],
};

/** Makes a "messy" demo photo: a sweater lying on a bed sheet. */
async function samplePhoto() {
  const c = document.createElement('canvas');
  c.width = 600; c.height = 700;
  const x = c.getContext('2d');
  x.fillStyle = '#CDBFA8'; x.fillRect(0, 0, 600, 700);
  for (let i = 0; i < 2500; i++) { x.fillStyle = `rgba(${150 + Math.random() * 60},${130 + Math.random() * 50},${100 + Math.random() * 40},.18)`; x.fillRect(Math.random() * 600, Math.random() * 700, 3, 3); }
  x.translate(60, 70); x.scale(2.4, 2.4);
  x.fillStyle = '#2F6B4A';
  x.fill(new Path2D('M64 46 L86 38 Q100 50 114 38 L136 46 L156 74 L170 186 L150 190 L138 104 L138 210 L62 210 L62 104 L50 190 L30 186 L44 74 Z'));
  x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 1.5;
  for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(78 + i * 9, 70); x.quadraticCurveTo(82 + i * 9, 140, 76 + i * 9, 205); x.stroke(); }
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
  return new File([blob], 'green-knit-sweater-on-bed.jpg', { type: 'image/jpeg' });
}

export default function UploadModal({ onClose, onSaved }) {
  const [phase, setPhase] = useState('pick'); // pick | working | confirm
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState('');
  const [aiLine, setAiLine] = useState('');
  const [taggedBy, setTaggedBy] = useState('');
  const inputRef = useRef();

  async function run(file) {
    if (!file || !file.type.startsWith('image/')) { setError('Please choose an image file.'); return; }
    setError(''); setPhase('working'); setStep(0);
    try {
      const g = await processUpload(file, (label) => setStep(STEPS.indexOf(label)));
      // Real AI: send the cut-out to Claude for tagging. Falls back to the on-device guess.
      setAiLine('Claude is looking at the piece…');
      const blob = await (await fetch(g.image)).blob();
      const ai = await tagGarment(blob, g);
      setAiLine('');
      if (ai?.garment) { setDraft(ai.garment); setTaggedBy(ai.provider); }
      else { setDraft(g); setTaggedBy(''); if (ai?.error) setError(ai.error); }
      setStep(STEPS.length);
      setPhase('confirm');
    } catch (e) {
      setError('That photo could not be read. Try another one.'); setPhase('pick');
    }
  }

  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <Modal title={phase === 'confirm' ? 'Confirm the details' : 'Add a piece'} onClose={onClose} wide={phase === 'confirm'}>
      {phase === 'pick' && (
        <>
          <p className="muted small" style={{ marginTop: 0 }}>Messy photos are fine: on a bed, a hanger or the floor. Ava’s Choices cuts the piece out, reads its colors, and drafts the tags for you.</p>
          <div
            className={'dropzone' + (drag ? ' drag' : '')}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); run(e.dataTransfer.files[0]); }}
          >
            <div className="label">Drop a photo here</div>
            <button className="btn primary" onClick={() => inputRef.current.click()}>Choose photo</button>
            <input ref={inputRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => run(e.target.files[0])} />
            <span className="tiny">Tip: plain backgrounds give the cleanest cut-out in this prototype.</span>
          </div>
          {error && <p className="small" style={{ color: 'var(--accent)' }}>{error}</p>}
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span className="small muted">No photo handy?</span>
            <button className="btn sm" onClick={async () => run(await samplePhoto())}>Try a sample messy photo</button>
          </div>
        </>
      )}

      {phase === 'working' && (
        <>
          <span className="ai-badge">AI processing</span>
          <div className="loading-bar"><i /></div>
          <ul className="steps">{STEPS.map((s, i) => <li key={s} className={i < step ? 'done' : i === step ? 'now' : ''}>{s}</li>)}</ul>
          {aiLine && <p className="small" style={{ fontWeight: 600 }}>{aiLine}</p>}
          <p className="tiny">Background removal and color reading run on your device. Only the cut-out piece is sent to Claude for tagging, never the original photo.</p>
        </>
      )}

      {phase === 'confirm' && draft && (
        <div className="confirm">
          <div>
            <div className="card-stage"><GarmentArt item={draft} /></div>
            <div className="swatches" style={{ marginTop: 10 }}><span className="swatch" style={{ background: draft.colors[0].hex }} /> <span className="small">{draft.colors[0].name} · read from pixels</span></div>
            <p style={{ marginTop: 10 }}>{taggedBy ? <span className="ai-badge">Tagged by {taggedBy}</span> : <span className="tiny">Tagged by the on-device guesser (Claude unavailable)</span>}</p>
            {draft.aiNote && <p className="small muted">“{draft.aiNote}”</p>}
            {draft.confidence < 0.6 && <p className="small" style={{ color: 'var(--warn)' }}>We're not sure about some details, so please check them.</p>}
            {error && <p className="tiny" style={{ color: 'var(--warn)' }}>{error}</p>}
          </div>
          <div>
            <div className="field"><label className="label">Name</label><input className="input" value={draft.name} onChange={(e) => set('name', e.target.value)} /></div>
            <div className="field-row">
              <div className="field"><label className="label">Category</label>
                <select className="select" value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value, art: ART_BY_CAT[e.target.value][0] }))}>
                  {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select></div>
              <div className="field"><label className="label">Type</label>
                <select className="select" value={draft.art} onChange={(e) => set('art', e.target.value)}>
                  {ART_BY_CAT[draft.category].map((a) => <option key={a} value={a}>{a}</option>)}
                </select></div>
            </div>
            <div className="field-row">
              <div className="field"><label className="label">Color</label>
                <select className="select" value={draft.colors[0].name} onChange={(e) => set('colors', [{ ...draft.colors[0], name: e.target.value }])}>
                  {NAMED_COLORS.map((c) => <option key={c.name}>{c.name}</option>)}
                </select></div>
              <div className="field"><label className="label">Material</label><input className="input" value={draft.material} onChange={(e) => set('material', e.target.value)} /></div>
            </div>
            <div className="field-row">
              <div className="field"><label className="label">Fit</label>
                <select className="select" value={draft.fit} onChange={(e) => set('fit', e.target.value)}>{['fitted', 'regular', 'relaxed', 'oversized'].map((f) => <option key={f}>{f}</option>)}</select></div>
              <div className="field"><label className="label">Weight</label>
                <select className="select" value={draft.weight} onChange={(e) => set('weight', e.target.value)}>{['light', 'mid', 'heavy'].map((f) => <option key={f}>{f}</option>)}</select></div>
            </div>
            <div className="field-row">
              <div className="field"><label className="label">Warmth · {draft.warmth}/5</label><input type="range" min="0" max="5" value={draft.warmth} onChange={(e) => set('warmth', +e.target.value)} /></div>
              <div className="field"><label className="label">Formality · {draft.formality}/5</label><input type="range" min="1" max="5" value={draft.formality} onChange={(e) => set('formality', +e.target.value)} /></div>
            </div>
            <div className="field"><label className="label">Seasons</label>
              <div className="chips">{SEASONS.map((s) => (
                <button key={s} className={'chip' + (draft.seasons.includes(s) ? ' on' : '')} onClick={() => set('seasons', draft.seasons.includes(s) ? draft.seasons.filter((x) => x !== s) : [...draft.seasons, s])}>{s}</button>
              ))}</div></div>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button className="btn primary" style={{ flex: 1 }} onClick={() => { onSaved(draft); }}>Looks right · Add to closet</button>
              <button className="btn" onClick={() => setPhase('pick')}>Retake</button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
