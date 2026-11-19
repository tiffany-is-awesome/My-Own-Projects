import { useRef, useState } from 'react';
import { Modal } from './common.jsx';
import GarmentArt from './GarmentArt.jsx';
import { processUpload } from '../ai/tagger.js';
import { tagGarment } from '../ai/stylist.js';
import ItemForm, { blankItem } from './ItemForm.jsx';

const STEPS = ['Reading photo', 'Removing background', 'Reading colors', 'Tagging (category, fabric, season)'];

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

export default function UploadModal({ onClose, onSaved, ownerName }) {
  const [phase, setPhase] = useState('pick'); // pick | working | review
  const [queue, setQueue] = useState([]);     // [{ key, file, state: 'waiting'|'working'|'done'|'failed', step, item, taggedBy, error }]
  const [sel, setSel] = useState(0);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef();
  const patch = (key, p) => setQueue((q) => q.map((x) => (x.key === key ? { ...x, ...p } : x)));

  async function runAll(fileList) {
    const files = [...(fileList || [])].filter((f) => f.type.startsWith('image/')).slice(0, 12);
    if (!files.length) { setError('Please choose one or more image files.'); return; }
    setError('');
    const jobs = files.map((file, i) => ({ key: Date.now() + '-' + i, file, state: 'waiting', step: 0 }));
    setQueue(jobs); setSel(0); setPhase('working');
    for (const job of jobs) { // one at a time keeps the browser responsive and the AI within rate limits
      patch(job.key, { state: 'working' });
      try {
        const g = await processUpload(job.file, (label) => patch(job.key, { step: STEPS.indexOf(label) }));
        g.id = 'u-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        g.status = 'available';
        const blob = await (await fetch(g.image)).blob();
        const ai = await tagGarment(blob, g);
        if (ai?.garment) patch(job.key, { state: 'done', item: ai.garment, taggedBy: ai.provider });
        else patch(job.key, { state: 'done', item: g, taggedBy: '', error: ai?.error || '' });
      } catch {
        patch(job.key, { state: 'failed', error: 'This photo could not be read.' });
      }
    }
    setPhase('review');
  }

  function manual() {
    setQueue([{ key: 'manual', state: 'done', item: blankItem('top'), taggedBy: '', manual: true }]);
    setSel(0); setPhase('review');
  }

  const ready = queue.filter((x) => x.state === 'done' && x.item);
  const current = queue[sel];
  const valid = (it) => it.name.trim().length > 0;

  function addAll() {
    const items = ready.map((x) => ({ ...x.item, name: x.item.name.trim() || 'Untitled piece' }));
    onSaved(items);
  }

  return (
    <Modal title={phase === 'review' ? (queue.length > 1 ? `Review ${ready.length} pieces` : 'Check the details') : 'Add pieces'} onClose={onClose} wide={phase !== 'pick'}>
      {phase === 'pick' && (
        <>
          <p className="muted small" style={{ marginTop: 0 }}>Choose one photo or several at once (up to 12). Messy photos are fine: on a bed, a hanger or the floor. Each piece is cut out, its colors are measured, and the AI drafts the details for you to check.{ownerName && ownerName !== 'Me' ? <> These go into <b>{ownerName}</b>'s closet.</> : null}</p>
          <div
            className={'dropzone' + (drag ? ' drag' : '')}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); runAll(e.dataTransfer.files); }}
          >
            <div className="label">Drop photos here</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="btn primary" onClick={() => inputRef.current.click()}>Choose photos</button>
              <label className="btn">Take a photo<input type="file" accept="image/*" capture="environment" hidden onChange={(e) => runAll(e.target.files)} /></label>
            </div>
            <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => runAll(e.target.files)} />
            <span className="tiny">Plain backgrounds give the cleanest cut-out.</span>
          </div>
          {error && <p className="small" style={{ color: 'var(--accent)' }}>{error}</p>}
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button className="btn sm" onClick={manual}>Add without a photo</button>
            <button className="btn ghost sm" onClick={async () => runAll([await samplePhoto()])}>Test with a sample photo</button>
          </div>
        </>
      )}

      {phase === 'working' && (
        <>
          <span className="ai-badge">Reading {queue.length} photo{queue.length > 1 ? 's' : ''}</span>
          <div className="loading-bar"><i /></div>
          <ul className="steps">
            {queue.map((x, i) => (
              <li key={x.key} className={x.state === 'done' ? 'done' : x.state === 'working' ? 'now' : ''}>
                Photo {i + 1} · {x.state === 'working' ? (STEPS[x.step] || 'Asking the AI for details') : x.state === 'done' ? 'ready' : x.state === 'failed' ? 'could not be read' : 'waiting'}
              </li>
            ))}
          </ul>
          <p className="tiny">Background removal and color reading run on your device. Only the cut-out piece is sent to the AI (Google Gemini, through your Puter account), never the original photo.</p>
        </>
      )}

      {phase === 'review' && current && (
        <div className="review">
          {queue.length > 1 && (
            <div className="review-list" role="tablist" aria-label="Uploaded pieces">
              {queue.map((x, i) => (
                <button key={x.key} role="tab" aria-selected={i === sel} className={'review-thumb' + (i === sel ? ' on' : '') + (x.state === 'failed' ? ' failed' : '')} onClick={() => setSel(i)}>
                  {x.item ? <GarmentArt item={x.item} /> : <span className="tiny">Failed</span>}
                </button>
              ))}
            </div>
          )}
          {current.state === 'failed' ? (
            <div className="empty"><p className="small">{current.error} Try another photo, or add the piece without one.</p></div>
          ) : (
            <div className="confirm">
              <div>
                <div className="card-stage"><GarmentArt item={current.item} /></div>
                {current.item.image && <div className="swatches" style={{ marginTop: 10 }}><span className="swatch" style={{ background: current.item.colors[0].hex }} /> <span className="small">Color measured from your photo</span></div>}
                <p style={{ marginTop: 10 }}>
                  {current.manual ? <span className="tiny">Added by hand. Fill in what you know.</span>
                    : current.taggedBy ? <span className="ai-badge">Details drafted by {current.taggedBy}</span>
                    : <span className="tiny">The AI wasn't available, so these details are a rough on-device guess. Please check them.</span>}
                </p>
                {current.item.aiNote && <p className="small muted">“{current.item.aiNote}”</p>}
                {!current.manual && current.item.confidence < 0.6 && <p className="small" style={{ color: 'var(--warn)' }}>Some details are uncertain. Please check them.</p>}
                {current.error && <p className="tiny" style={{ color: 'var(--warn)' }}>{current.error}</p>}
              </div>
              <div>
                <ItemForm item={current.item} onChange={(item) => patch(current.key, { item })} />
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {queue.length > 1 && current.state === 'done' && <button className="btn" onClick={() => { setQueue((q) => q.filter((x) => x.key !== current.key)); setSel(0); }}>Skip this one</button>}
            <button className="btn" onClick={() => setPhase('pick')}>Start over</button>
            <button className="btn primary" disabled={!ready.length || (current.manual && !valid(current.item))} onClick={addAll}>
              {ready.length > 1 ? `Add all ${ready.length} to closet` : 'Add to closet'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
