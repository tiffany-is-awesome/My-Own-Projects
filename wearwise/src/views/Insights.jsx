// Closet insights: Rediscover My Closet + Wardrobe Versatility, for the active profile's own closet.
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store.jsx';
import Stage from '../components/Stage.jsx';
import GarmentArt from '../components/GarmentArt.jsx';
import { PieceList, ScoreBadge, useToast } from '../components/common.jsx';
import { toSlots } from '../components/Choose.jsx';
import { versatilityAsync, rediscover, wearStats, whyHardToStyle, VERSATILITY_CONTEXTS } from '../ai/insights.js';
import { missingForOutfit } from '../ai/generator.js';
import { CATEGORY_LABEL } from '../data/closet.js';

export default function Insights({ go }) {
  const { dispatch, owned, profile, historyOf, personal } = useStore();
  const toast = useToast();
  const [data, setData] = useState(null);
  const history = useMemo(() => historyOf(profile.id), [historyOf, profile.id]);
  const child = profile.kind === 'child';

  // Rediscover is quick; versatility checks every piece in six situations, so it runs in small batches
  // with a progress line and the page stays responsive even for a big closet.
  const [progress, setProgress] = useState(null);
  useEffect(() => {
    setData(null); setProgress(null);
    let cancelled = false;
    const t = setTimeout(async () => {
      const ctxP = personal.rated ? personal : null;
      const r = rediscover(owned, history, { contexts: VERSATILITY_CONTEXTS.slice(0, 2).map((c) => ({ ...c, personal: ctxP })) });
      setData({ v: null, r, stats: wearStats(history) });
      const v = await versatilityAsync(owned, (done, total) => !cancelled && setProgress({ done, total }), VERSATILITY_CONTEXTS, () => cancelled);
      if (!cancelled && v) setData((d) => ({ ...d, v }));
    }, 30);
    return () => { cancelled = true; clearTimeout(t); };
  }, [owned, history, personal]);

  const missing = missingForOutfit(owned);
  if (missing.length) {
    return <div className="page"><div className="empty"><p className="small">Insights need a closet that can make full outfits. Add {missing.join(', ')} first.</p><button className="btn primary" onClick={() => go('#/closet')}>Add clothes</button></div></div>;
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="label">{profile.name === 'Me' ? 'Your' : `${profile.name}'s`} closet</div>
          <h1 className="h1">Closet insights</h1>
        </div>
        <button className="btn" onClick={() => go('#/history')}>Outfit History</button>
      </div>

      {!data ? <div className="loading-block"><div className="loading-bar"><i /></div><p className="small muted">Checking every piece against the rest of the closet…</p></div> : (
        <>
          <section>
            <h2 className="h2">Rediscover My Closet</h2>
            <p className="small muted" style={{ marginTop: 0 }}>{history.length ? 'Pieces you haven\'t worn in 30 days or more, each in a strong outfit.' : 'Nothing is logged in Outfit History yet, so every piece counts as unworn. Tap "I wore this" on outfits to make this smarter.'}</p>
            {data.r.length === 0 ? <p className="small">Nothing forgotten. Everything has been worn recently, or the pieces you haven't worn don't make a strong outfit yet.</p> : (
              <div className="outfit-grid">
                {data.r.map((x) => (
                  <article key={x.item.id} className="outfit-card">
                    <Stage outfit={x.outfit} mode="flatlay" compact child={child} />
                    <div className="outfit-card-body">
                      <div className="outfit-card-head">
                        <div>
                          <div className="tiny">{x.daysSince === null ? 'Never worn' : `Last worn ${x.daysSince} days ago`}</div>
                          <h3 className="h3">{x.item.name}</h3>
                        </div>
                        <ScoreBadge score={x.critique.overall} />
                      </div>
                      <p className="small why">{x.why}</p>
                      <PieceList outfit={x.outfit} />
                      <div className="outfit-card-actions">
                        <button className="btn sm accent" onClick={() => { dispatch({ type: 'LOG_WEAR', entry: { slots: toSlots(x.outfit), context: x.ctx } }); toast('Logged in Outfit History'); }}>I'll wear this</button>
                        <button className="btn sm" onClick={() => go('#/style/' + encodeURIComponent(x.item.id))}>More ideas</button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section style={{ marginTop: 36 }}>
            <div className="results-head" style={{ marginTop: 0 }}>
              <h2 className="h2" style={{ margin: 0 }}>Wardrobe versatility</h2>
              {data.v && <span className="versatility-score"><b>{data.v.score}</b>/100</span>}
            </div>
            <p className="small muted" style={{ marginTop: 0 }}>How many other pieces each item makes strong outfits with, and in which of six everyday situations (everyday warm and cool, work, date, church, hot-weather vacation). The score is the share of pieces that pair with at least 3 others in at least 2 situations.</p>
            {!data.v ? (
              <div className="loading-block"><div className="loading-bar"><i style={progress ? { width: `${Math.round((progress.done / progress.total) * 100)}%`, animation: 'none' } : undefined} /></div><p className="small muted">Checking each piece against the rest of the closet{progress ? ` · ${progress.done} of ${progress.total}` : ''}…</p></div>
            ) : (<>
            <table className="vtable">
              <thead><tr><th>Piece</th><th>Pairs well with</th><th>Works for</th><th>Worn</th></tr></thead>
              <tbody>
                {data.v.items.map((x) => (
                  <tr key={x.item.id} className={x.contexts.length === 0 ? 'hard' : ''}>
                    <td><button className="vlink" onClick={() => go('#/style/' + encodeURIComponent(x.item.id))}><span className="mini" style={{ width: 34 }}><GarmentArt item={x.item} /></span><span>{x.item.name}<span className="tiny"> · {CATEGORY_LABEL[x.item.category]}</span></span></button></td>
                    <td>{x.partners} piece{x.partners === 1 ? '' : 's'}</td>
                    <td className="small">{x.contexts.length ? x.contexts.join(', ') : <span className="watch">{whyHardToStyle(x.item, owned)}</span>}</td>
                    <td className="small">{data.stats[x.item.id]?.wears || 0}×</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.v.hardToStyle.length > 0 && <p className="tiny" style={{ marginTop: 8 }}>{data.v.hardToStyle.length} piece{data.v.hardToStyle.length > 1 ? 's don\'t' : ' doesn\'t'} make a strong outfit with anything else right now. The note says what's missing.</p>}
            </>)}
          </section>
        </>
      )}
    </div>
  );
}

