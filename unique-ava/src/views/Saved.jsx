// Saved Outfits for the active profile: favorites, open, rename, delete.
import { useState } from 'react';
import { useStore } from '../store.jsx';
import { OutfitThumb, ScoreBadge, ConfirmButton, useToast } from '../components/common.jsx';

export default function Saved({ go }) {
  const { state, dispatch, resolve, outfitsOf, profile, scoreOf } = useStore();
  const toast = useToast();
  const [onlyFav, setOnlyFav] = useState(false);
  const all = outfitsOf(profile.id);
  const list = onlyFav ? all.filter((o) => o.favorite) : all;
  const child = profile.kind === 'child';

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="label">{profile.name === 'Me' ? 'Your' : `${profile.name}'s`} looks</div>
          <h1 className="h1">Saved Outfits <span className="muted" style={{ fontWeight: 400 }}>· {all.length}</span></h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => go('#/lookbooks')}>Lookbooks</button>
          <button className="btn accent" onClick={() => go('#/create')}>Create an Outfit</button>
        </div>
      </div>
      <div className="toolbar">
        <div className="chips">
          <button className={'chip' + (!onlyFav ? ' on' : '')} onClick={() => setOnlyFav(false)}>All</button>
          <button className={'chip' + (onlyFav ? ' on' : '')} onClick={() => setOnlyFav(true)}>♥ Favorites {all.filter((o) => o.favorite).length}</button>
        </div>
      </div>
      {list.length === 0 ? (
        <div className="empty">
          <p className="h2" style={{ marginBottom: 8 }}>{onlyFav ? 'No favorites yet.' : 'Nothing saved yet.'}</p>
          <p className="small">Create an outfit, then tap ♡ Save on the ones you like.</p>
          <button className="btn primary" onClick={() => go('#/create')}>Create an Outfit</button>
        </div>
      ) : (
        <div className="grid">
          {list.map((o) => {
            const score = scoreOf(o);
            return (
              <div key={o.id} className="card saved-card">
                <button className="card" onClick={() => { dispatch({ type: 'LOAD_DRAFT', draft: { slots: o.slots, name: o.name, context: o.context, stage: o.stage } }); go('#/builder'); }} aria-label={`Open ${o.name}`}>
                  <div className="card-stage"><OutfitThumb outfit={o} resolve={resolve} child={child} />{o.demo && <span className="card-flag basic">Demo</span>}</div>
                </button>
                <div className="card-body">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                    <div>
                      <div className="card-name">{o.name}</div>
                      <div className="card-meta">{o.context?.prompt || ''}</div>
                    </div>
                    <ScoreBadge score={score} />
                  </div>
                  {o.why && <p className="tiny" style={{ marginTop: 6 }}>{o.why}</p>}
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    <button className="btn sm" aria-pressed={!!o.favorite} onClick={() => dispatch({ type: 'TOGGLE_FAVORITE', id: o.id })}>{o.favorite ? '♥ Favorite' : '♡ Favorite'}</button>
                    <ConfirmButton label="Delete" confirmLabel="Click to delete" onConfirm={() => { dispatch({ type: 'DELETE_OUTFIT', id: o.id }); toast('Outfit deleted'); }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {state.catalogs.length > 0 && <p className="tiny" style={{ marginTop: 20 }}>Group outfits into collections and trips in <a href="#/lookbooks">Lookbooks</a>.</p>}
    </div>
  );
}
