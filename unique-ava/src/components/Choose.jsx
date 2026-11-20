// Building blocks for "choose → get outfits → compare → save".
import { useState } from 'react';
import Stage from './Stage.jsx';
import { PieceList, ScoreBadge, HeartButton } from './common.jsx';
import { OCCASIONS, STYLES, SLOTS } from '../data/closet.js';
import { WEATHER_CHOICES, PREF_CHOICES, buildContext } from '../ai/context.js';
import { alternatives } from '../ai/generator.js';
import { critique } from '../ai/critic.js';
import { explain, describe, vibeOf } from '../ai/generator.js';

export const DEFAULT_CHOICE = { occasion: 'everyday', style: null, weather: 'warm', prefs: [], text: '' };
export const contextOf = (choice) => buildContext(choice, OCCASIONS);
export const toSlots = (o) => Object.fromEntries(SLOTS.map((k) => [k, o[k]?.id || null]));

/** Occasion, style, weather, preferences, optional note. Every choice has a sensible default. */
export function ContextPicker({ value, onChange, compact = false, showText = true }) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  const togglePref = (id) => set('prefs', value.prefs.includes(id) ? value.prefs.filter((p) => p !== id) : [...value.prefs, id]);
  return (
    <div className={'ctx-picker' + (compact ? ' compact' : '')}>
      <div className="ctx-row"><span className="label">Occasion</span>
        <div className="chips" role="group" aria-label="Occasion">
          {OCCASIONS.map((o) => <button key={o.id} className={'chip' + (value.occasion === o.id ? ' on' : '')} onClick={() => set('occasion', o.id)}>{o.label}</button>)}
        </div></div>
      <div className="ctx-row"><span className="label">Weather</span>
        <div className="chips" role="group" aria-label="Weather">
          {WEATHER_CHOICES.map((w) => <button key={w.id} className={'chip' + (value.weather === w.id ? ' on' : '')} onClick={() => set('weather', w.id)}>{w.label}</button>)}
        </div></div>
      <div className="ctx-row"><span className="label">Style</span>
        <div className="chips" role="group" aria-label="Style">
          <button className={'chip' + (!value.style ? ' on' : '')} onClick={() => set('style', null)}>Any</button>
          {STYLES.map((s) => <button key={s.id} className={'chip' + (value.style === s.id ? ' on' : '')} onClick={() => set('style', s.id)}>{s.label}</button>)}
        </div></div>
      {!compact && (
        <div className="ctx-row"><span className="label">Preferences</span>
          <div className="chips" role="group" aria-label="Preferences">
            {PREF_CHOICES.map((p) => <button key={p.id} className={'chip' + (value.prefs.includes(p.id) ? ' on' : '')} onClick={() => togglePref(p.id)}>{p.label}</button>)}
          </div></div>
      )}
      {showText && !compact && (
        <div className="ctx-row"><span className="label">Anything else? <span className="muted">(optional)</span></span>
          <input className="input" value={value.text} onChange={(e) => set('text', e.target.value)} placeholder="e.g. outdoor garden wedding, 18°C · lots of walking" aria-label="Extra details" />
        </div>
      )}
    </div>
  );
}

/** Strengths and weaknesses pulled from the critique, for cards and comparison. */
export function strengthsOf(c, n = 3) {
  return c.pillars.slice().sort((a, b) => b.score - a.score).flatMap((p) => p.pros).slice(0, n);
}
export function weaknessesOf(c, n = 3) {
  return c.pillars.slice().sort((a, b) => a.score - b.score).flatMap((p) => p.cons).slice(0, n);
}
export function suitability(c, ctx) {
  const occ = c.pillars.find((p) => p.id === 'occasion')?.score ?? c.overall;
  const weather = c.pillars.find((p) => p.id === 'fabric')?.score ?? c.overall;
  const word = (s) => (s >= 85 ? 'Excellent' : s >= 72 ? 'Good' : s >= 60 ? 'Fair' : 'Weak');
  return { occasion: `${word(occ)} for ${ctx.occasionLabel.toLowerCase()}`, weather: `${word(weather)} for ${ctx.weather.toLowerCase()} weather (${ctx.tempC}°C)` };
}

const SOURCE = { ai: 'Picked by Gemini · checked by the rules engine', rules: 'Picked by the rules engine' };

/** One suggested outfit with explanation, alternatives and save. */
export function OutfitCard({ result, ctx, pool, index, child = false, onReplace, onSave, onOpen, onWore, saved }) {
  const [wore, setWore] = useState(false);
  const [mode, setMode] = useState('flatlay');
  const [showAlts, setShowAlts] = useState(false);
  const alts = showAlts ? alternatives(result.outfit, ctx, pool) : [];
  const c = result.critique;
  return (
    <article className="outfit-card" aria-label={`Outfit ${index + 1}`}>
      <div className="outfit-card-stage">
        <Stage outfit={result.outfit} mode={mode} compact child={child} />
        <div className="seg mini-seg">
          <button className={mode === 'flatlay' ? 'on' : ''} onClick={() => setMode('flatlay')}>Flat-lay</button>
          <button className={mode === 'mannequin' ? 'on' : ''} onClick={() => setMode('mannequin')}>Mannequin</button>
        </div>
      </div>
      <div className="outfit-card-body">
        <div className="outfit-card-head">
          <div>
            <div className="tiny">Outfit {index + 1}{result.label ? ` · ${result.label}` : ''}{result.vibe || result.outfit ? ` · ${result.vibe || vibeOf(result.outfit)}` : ''}</div>
            <h3 className="h3">{result.name}</h3>
          </div>
          <ScoreBadge score={c.overall} />
        </div>
        {result.source && <span className={'source-tag ' + result.source}>{SOURCE[result.source] || 'Edited by you'}</span>}
        {result.critique.dealBreakers?.length > 0 && <span className="source-tag weak">Weak option · {result.critique.dealBreakers[0]}</span>}
        <p className="small why">{result.why}</p>
        <PieceList outfit={result.outfit} />
        <div className="outfit-card-actions">
          <HeartButton saved={saved} onSave={onSave} />
          <button className="btn sm" onClick={() => setShowAlts(!showAlts)} aria-expanded={showAlts}>{showAlts ? 'Hide changes' : 'Improve or change'}</button>
          {onWore && <button className="btn sm ghost" disabled={wore} onClick={() => { onWore(); setWore(true); }}>{wore ? '✓ Logged' : 'I wore this'}</button>}
          {onOpen && <button className="btn sm ghost" onClick={onOpen}>Open in builder</button>}
        </div>
        {showAlts && (
          <div className="alts">
            {alts.length === 0 && <p className="tiny">No other combinations from your available clothes improve or vary this one.</p>}
            {alts.map((a) => (
              <button key={a.id} className="alt" onClick={() => { onReplace(withCritique(a.outfit, ctx, result)); setShowAlts(false); }}>
                <span>{a.label}</span>
                <span className={'tiny ' + (a.delta >= 0 ? 'up' : 'down')}>{a.score} ({a.delta >= 0 ? '+' : ''}{a.delta})</span>
              </button>
            ))}
            <p className="tiny">Only clothes in this closet that are available are used.</p>
          </div>
        )}
      </div>
    </article>
  );
}

export function withCritique(outfit, ctx, prev = {}) {
  const c = critique(outfit, ctx);
  return { ...prev, name: describe(outfit), outfit, critique: c, why: explain(outfit, c, ctx), source: prev.source === 'ai' ? 'edited' : prev.source };
}

/** Side by side: previews, items, explanation, strengths, weaknesses, occasion suitability. */
export function Compare({ results, ctx, child = false, onPick, onClose, savedIdx = [] }) {
  const best = results.reduce((b, r, i) => (r.critique.overall > results[b].critique.overall ? i : b), 0);
  return (
    <section className="compare" aria-label="Compare outfits">
      <div className="compare-head">
        <h2 className="h2">Compare side by side</h2>
        <button className="btn sm" onClick={onClose}>Back to cards</button>
      </div>
      <div className="compare-grid" style={{ gridTemplateColumns: `repeat(${results.length}, minmax(0, 1fr))` }}>
        {results.map((r, i) => {
          const s = suitability(r.critique, ctx);
          return (
            <div key={i} className={'compare-col' + (i === best ? ' best' : '')}>
              <div className="tiny">Outfit {i + 1}{i === best ? ' · highest score' : ''}</div>
              <h3 className="h3">{r.name}</h3>
              <Stage outfit={r.outfit} mode="flatlay" compact child={child} />
              <div className="compare-score"><ScoreBadge score={r.critique.overall} /></div>
              <div className="compare-sec"><span className="label">Pieces</span><PieceList outfit={r.outfit} /></div>
              <div className="compare-sec"><span className="label">Why it works</span><p className="small">{r.why}</p></div>
              <div className="compare-sec"><span className="label">Strengths</span>
                <ul className="mini-list pro">{strengthsOf(r.critique).map((t, k) => <li key={k}>{t}</li>)}</ul></div>
              <div className="compare-sec"><span className="label">Weaknesses</span>
                {weaknessesOf(r.critique).length ? <ul className="mini-list con">{weaknessesOf(r.critique).map((t, k) => <li key={k}>{t}</li>)}</ul> : <p className="tiny">Nothing significant.</p>}</div>
              <div className="compare-sec"><span className="label">Suitability</span><p className="small">{s.occasion}<br />{s.weather}</p></div>
              <div className="compare-sec"><span className="label">Pillar scores</span>
                {r.critique.pillars.map((p) => (
                  <div key={p.id} className="mini-bar"><span className="tiny">{p.label}</span><span className={'bar' + (p.score < 65 ? ' low' : '')}><i style={{ width: p.score + '%' }} /></span><span className="tiny">{p.score}</span></div>
                ))}</div>
              <button className={'btn block ' + (savedIdx.includes(i) ? '' : 'accent')} disabled={savedIdx.includes(i)} onClick={() => onPick(i)}>{savedIdx.includes(i) ? '♥ Saved as favorite' : '♥ This one'}</button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
