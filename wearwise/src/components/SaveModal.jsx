import { useState } from 'react';
import { Modal } from './common.jsx';
import { useStore } from '../store.jsx';

export default function SaveModal({ defaultName = '', onClose, onDone }) {
  const { state, dispatch } = useStore();
  const [name, setName] = useState(defaultName);
  const [target, setTarget] = useState(state.catalogs[0]?.id || 'new');
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('collection');
  const [city, setCity] = useState('');
  const [days, setDays] = useState(3);

  function save() {
    if (target === 'new') {
      const t = title.trim() || 'New lookbook';
      dispatch({ type: 'SAVE_OUTFIT', name, newCatalog: { title: t, kind, ...(kind === 'trip' ? { trip: { city: city || '—', days: +days } } : {}) } });
      onDone(t);
    } else {
      dispatch({ type: 'SAVE_OUTFIT', name, catalogId: target });
      onDone(state.catalogs.find((c) => c.id === target)?.title);
    }
  }

  return (
    <Modal title="Save to lookbook" onClose={onClose}>
      <div className="field"><label className="label">Look name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rainy café uniform" autoFocus /></div>
      <div className="field"><label className="label">Lookbook</label>
        <select className="select" value={target} onChange={(e) => setTarget(e.target.value)}>
          {state.catalogs.map((c) => <option key={c.id} value={c.id}>{c.title}{c.kind === 'trip' ? ' (trip)' : ''}</option>)}
          <option value="new">+ New lookbook…</option>
        </select></div>
      {target === 'new' && (
        <>
          <div className="field"><label className="label">Title</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Spring Rotation, 4-Day Kyoto Trip…" /></div>
          <div className="field"><label className="label">Type</label>
            <div className="chips">
              <button className={'chip' + (kind === 'collection' ? ' on' : '')} onClick={() => setKind('collection')}>Collection</button>
              <button className={'chip' + (kind === 'trip' ? ' on' : '')} onClick={() => setKind('trip')}>Trip (with versatility score)</button>
            </div></div>
          {kind === 'trip' && (
            <div className="field-row">
              <div className="field"><label className="label">City</label><input className="input" value={city} onChange={(e) => setCity(e.target.value)} /></div>
              <div className="field"><label className="label">Days</label><input className="input" type="number" min="1" max="21" value={days} onChange={(e) => setDays(e.target.value)} /></div>
            </div>
          )}
        </>
      )}
      <button className="btn accent block" onClick={save}>Save look</button>
    </Modal>
  );
}
