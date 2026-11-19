// Outfit History: what was actually worn, with ratings and quick feedback that personalize future suggestions.
import { useMemo } from 'react';
import { useStore } from '../store.jsx';
import Stage from '../components/Stage.jsx';
import { ConfirmButton, PieceList, useToast } from '../components/common.jsx';
import { FEEDBACK_TAGS, describePreferences } from '../ai/insights.js';

function Stars({ value, onChange }) {
  return (
    <span className="stars" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} className={n <= (value || 0) ? 'on' : ''} onClick={() => onChange(value === n ? null : n)}>★</button>
      ))}
    </span>
  );
}

export default function History({ go }) {
  const { dispatch, resolve, historyOf, profile, personal, get } = useStore();
  const toast = useToast();
  const list = historyOf(profile.id);
  const learned = useMemo(() => describePreferences(personal, get), [personal, get]);
  const child = profile.kind === 'child';
  const fmt = (d) => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="label">{profile.name === 'Me' ? 'Your' : `${profile.name}'s`} outfit history</div>
          <h1 className="h1">Outfit History <span className="muted" style={{ fontWeight: 400 }}>· {list.length} worn</span></h1>
          <p className="small muted" style={{ margin: 0 }}>Tap “I wore this” on any outfit to log it. Rate it afterwards: your ratings quietly shape future suggestions.</p>
        </div>
        <button className="btn" onClick={() => go('#/insights')}>Closet insights</button>
      </div>

      <div className="notice">
        <b>What Unique Ava has learned{personal.rated ? ` from ${personal.rated} rated outfit${personal.rated > 1 ? 's' : ''}` : ''}:</b>{' '}
        {personal.rated === 0 ? 'Nothing yet. Rate a few outfits you wore and suggestions will lean toward what you love.' : learned.length ? learned.join(' ') : 'Not enough of a pattern yet. Keep rating.'}
        {personal.rated > 0 && <div className="tiny" style={{ marginTop: 4 }}>Learned taste only chooses between outfits that already pass every styling check; it never overrides weather or occasion rules.</div>}
      </div>

      {list.length === 0 ? (
        <div className="empty">
          <p className="h2" style={{ marginBottom: 8 }}>No outfits logged yet.</p>
          <button className="btn primary" onClick={() => go('#/create')}>Create an Outfit</button>
        </div>
      ) : (
        <div className="history-list">
          {list.map((h) => {
            const o = resolve(h.slots);
            const gone = Object.values(h.slots).filter(Boolean).length > Object.values(o).filter(Boolean).length;
            return (
              <article key={h.id} className="history-row">
                <div className="history-thumb"><Stage outfit={o} mode="flatlay" compact child={child} /></div>
                <div className="history-body">
                  <div className="history-head">
                    <div>
                      <input type="date" className="input date-input" value={h.date} aria-label="Date worn" onChange={(e) => e.target.value && dispatch({ type: 'UPDATE_WEAR_DATE', id: h.id, date: e.target.value })} />
                      {h.context?.prompt && <div className="tiny">{h.context.prompt}</div>}
                    </div>
                    <Stars value={h.rating} onChange={(rating) => { dispatch({ type: 'RATE_WEAR', id: h.id, rating }); if (rating) toast('Thanks! Suggestions will take this into account.'); }} />
                  </div>
                  <div className="chips">
                    {FEEDBACK_TAGS.map((t) => {
                      const on = (h.tags || []).includes(t.id);
                      return <button key={t.id} className={'chip sm' + (on ? ' on' : '')} onClick={() => dispatch({ type: 'RATE_WEAR', id: h.id, tags: on ? h.tags.filter((x) => x !== t.id) : [...(h.tags || []), t.id] })}>{t.label}</button>;
                    })}
                  </div>
                  <PieceList outfit={o} />
                  {gone && <p className="tiny">Some pieces from this outfit are no longer in the closet.</p>}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn sm ghost" onClick={() => { dispatch({ type: 'LOAD_DRAFT', draft: { slots: h.slots, name: 'Worn ' + fmt(h.date) } }); go('#/builder'); }}>Open in builder</button>
                    <ConfirmButton label="Remove" confirmLabel="Click to remove" onConfirm={() => dispatch({ type: 'DELETE_WEAR', id: h.id })} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
