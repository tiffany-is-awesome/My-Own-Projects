// Outfit Calendar: plan outfits for days ahead (from saved outfits or a fresh suggestion), plan whole trips with a
// packing list, and see what was actually worn. One screen, per person.
import { useMemo, useState } from 'react';
import { useStore } from '../store.jsx';
import Stage from '../components/Stage.jsx';
import { Modal, PieceList, ScoreBadge, Verdict, ConfirmButton, useToast } from '../components/common.jsx';
import { ContextPicker, DEFAULT_CHOICE, contextOf, toSlots } from '../components/Choose.jsx';
import { generateOutfits } from '../ai/generator.js';
import { critique } from '../ai/critic.js';
import { planTrip, daysBetween, iso } from '../ai/planner.js';
import { OCCASIONS } from '../data/closet.js';
import { WEATHER_CHOICES } from '../ai/context.js';

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const todayIso = () => iso(Date.now() - new Date().getTimezoneOffset() * 60000);
const nice = (d, o = { weekday: 'long', day: 'numeric', month: 'long' }) => new Date(d + 'T12:00:00').toLocaleDateString(undefined, o);

function monthGrid(year, month) {
  const first = new Date(year, month, 1, 12);
  const lead = (first.getDay() + 6) % 7; // Monday first
  const cells = [];
  for (let i = -lead; i < 42 - lead; i++) {
    const d = new Date(year, month, 1 + i, 12);
    cells.push({ date: iso(d.getTime() - d.getTimezoneOffset() * 60000), day: d.getDate(), inMonth: d.getMonth() === month });
  }
  // drop a trailing week that's entirely next month
  return cells.slice(35).every((c) => !c.inMonth) ? cells.slice(0, 35) : cells;
}

function DayPanel({ date, onClose }) {
  const { state, dispatch, resolve, profile, owned, outfitsOf, historyOf } = useStore();
  const toast = useToast();
  const plan = state.plans.find((p) => p.profileId === profile.id && p.date === date);
  const worn = historyOf(profile.id).filter((h) => h.date === date);
  const trip = plan?.tripId && state.trips.find((t) => t.id === plan.tripId);
  const [tab, setTab] = useState('saved');
  const [wardrobe, setWardrobe] = useState('all');
  const [choice, setChoice] = useState(DEFAULT_CHOICE);
  const [ideas, setIdeas] = useState(null);
  const saved = outfitsOf(profile.id).filter((o) => wardrobe === 'all' || (wardrobe === 'fav' ? o.favorite : o.wardrobe === wardrobe));
  const wardrobes = state.wardrobes.filter((w) => w.profileId === profile.id);
  const isPastOrToday = date <= todayIso();
  const child = profile.kind === 'child';
  const planIt = (slots, name, extra = {}) => { dispatch({ type: 'PLAN_DAY', plan: { date, slots, name, ...extra } }); toast(`Planned for ${nice(date, { weekday: 'short', day: 'numeric', month: 'short' })}`); };

  const planned = plan && resolve(plan.slots);
  const ctx = plan?.context || contextOf(DEFAULT_CHOICE);
  return (
    <Modal title={nice(date)} onClose={onClose} wide>
      {worn.length > 0 && (
        <div className="notice"><b>Worn this day:</b> {worn.map((h) => Object.values(resolve(h.slots)).filter(Boolean).map((g) => g.name).join(', ')).join(' · ')}</div>
      )}
      {plan ? (
        <div className="day-plan">
          <Stage outfit={planned} mode="flatlay" compact child={child} />
          <div className="day-plan-body">
            {trip && <span className="trip-pill">{trip.name}</span>}
            <div className="outfit-card-head"><h3 className="h2" style={{ margin: 0 }}>{plan.name}</h3><ScoreBadge score={critique(planned, ctx).overall} /></div>
            <Verdict critique={critique(planned, ctx)} />
            <PieceList outfit={planned} />
            <div className="outfit-card-actions">
              {isPastOrToday && <button className="btn sm accent" onClick={() => { dispatch({ type: 'LOG_WEAR', entry: { date, slots: plan.slots, context: plan.context } }); toast('Marked as worn'); }}>I wore it</button>}
              <button className="btn sm" onClick={() => { dispatch({ type: 'UNPLAN_DAY', date }); }}>Change</button>
              <ConfirmButton label="Remove" confirmLabel="Click to remove" onConfirm={() => { dispatch({ type: 'UNPLAN_DAY', date }); onClose(); }} />
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="seg" role="tablist" style={{ marginBottom: 12 }}>
            <button role="tab" aria-selected={tab === 'saved'} className={tab === 'saved' ? 'on' : ''} onClick={() => setTab('saved')}>From saved outfits</button>
            <button role="tab" aria-selected={tab === 'suggest'} className={tab === 'suggest' ? 'on' : ''} onClick={() => setTab('suggest')}>Suggest one</button>
          </div>
          {tab === 'saved' ? (
            <>
              <div className="chips" style={{ marginBottom: 10 }}>
                <button className={'chip sm' + (wardrobe === 'all' ? ' on' : '')} onClick={() => setWardrobe('all')}>All</button>
                <button className={'chip sm' + (wardrobe === 'fav' ? ' on' : '')} onClick={() => setWardrobe('fav')}>♥ Favorites</button>
                {wardrobes.map((w) => <button key={w.id} className={'chip sm' + (wardrobe === w.id ? ' on' : '')} onClick={() => setWardrobe(w.id)}>{w.name}</button>)}
              </div>
              {saved.length === 0 ? <p className="small muted">No saved outfits here yet. Try “Suggest one”.</p> : (
                <div className="pick-grid">
                  {saved.map((o) => (
                    <button key={o.id} className="pick-outfit" onClick={() => { planIt(o.slots, o.name, { outfitId: o.id, context: o.context }); onClose(); }}>
                      <Stage outfit={resolve(o.slots)} mode="flatlay" compact child={child} />
                      <span className="tiny">{o.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <ContextPicker value={choice} onChange={(c) => { setChoice(c); setIdeas(null); }} compact />
              <button className="btn accent" style={{ marginTop: 12 }} onClick={() => setIdeas(generateOutfits(owned, contextOf(choice)))}>Suggest outfits</button>
              {ideas?.missing?.length > 0 && <p className="small">Add {ideas.missing.join(', ')} to the closet first.</p>}
              {ideas?.outfits?.length > 0 && (
                <div className="pick-grid" style={{ marginTop: 12 }}>
                  {ideas.outfits.map((r, i) => (
                    <button key={i} className="pick-outfit" onClick={() => { planIt(toSlots(r.outfit), r.name, { context: contextOf(choice) }); onClose(); }}>
                      <Stage outfit={r.outfit} mode="flatlay" compact child={child} />
                      <span className="tiny">{r.name} · {r.critique.overall}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </Modal>
  );
}

function TripPlanner({ onClose }) {
  const { dispatch, owned, profile } = useStore();
  const toast = useToast();
  const t0 = todayIso();
  const [name, setName] = useState('');
  const [start, setStart] = useState(t0);
  const [end, setEnd] = useState(iso(new Date(t0 + 'T12:00:00').getTime() + 3 * 86400000));
  const [occasion, setOccasion] = useState('vacation');
  const [weather, setWeather] = useState('warm');
  const [plan, setPlan] = useState(null);
  const [packedOff, setPackedOff] = useState({});
  const dates = end >= start ? daysBetween(start, end) : [];
  const ctx = useMemo(() => contextOf({ ...DEFAULT_CHOICE, occasion, weather }), [occasion, weather]);
  const child = profile.kind === 'child';

  function save() {
    dispatch({ type: 'SAVE_TRIP', trip: { name: name.trim() || `Trip ${nice(start, { day: 'numeric', month: 'short' })}`, start, end, occasion, weather }, days: plan.days.map((d) => ({ date: d.date, slots: toSlots(d.outfit), name: d.name, context: ctx })) });
    toast(`Trip planned: ${plan.days.length} outfits on your calendar`);
    onClose();
  }

  return (
    <Modal title="Plan a trip" onClose={onClose} wide>
      {!plan ? (
        <div className="trip-form">
          <div className="field"><label className="label">Trip name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Baguio weekend" /></div>
          <div className="field-row">
            <div className="field"><label className="label">From</label><input type="date" className="input" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div className="field"><label className="label">To</label><input type="date" className="input" value={end} min={start} onChange={(e) => setEnd(e.target.value)} /></div>
          </div>
          <div className="field"><label className="label">Mostly for</label>
            <div className="chips">{OCCASIONS.map((o) => <button key={o.id} className={'chip sm' + (occasion === o.id ? ' on' : '')} onClick={() => setOccasion(o.id)}>{o.label}</button>)}</div></div>
          <div className="field"><label className="label">Expected weather</label>
            <div className="chips">{WEATHER_CHOICES.map((w) => <button key={w.id} className={'chip sm' + (weather === w.id ? ' on' : '')} onClick={() => setWeather(w.id)}>{w.label}</button>)}</div></div>
          <button className="btn accent" disabled={!dates.length} onClick={() => setPlan(planTrip(owned, ctx, dates))}>{dates.length ? `Plan ${dates.length} day${dates.length > 1 ? 's' : ''}` : 'Pick valid dates'}</button>
          {dates.length >= 31 && <span className="tiny">Trips are planned up to 31 days.</span>}
        </div>
      ) : plan.missing.length || !plan.days.length ? (
        <div className="empty"><p className="small">{plan.missing.length ? `Add ${plan.missing.join(', ')} to the closet first.` : plan.note}</p><button className="btn" onClick={() => setPlan(null)}>Back</button></div>
      ) : (
        <div className="trip-result">
          {plan.note && <div className="notice">{plan.note}</div>}
          <div className="trip-days">
            {plan.days.map((d) => (
              <div key={d.date} className="trip-day">
                <span className="tiny">{nice(d.date, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                <Stage outfit={d.outfit} mode="flatlay" compact child={child} />
                <span className="tiny trip-day-name">{d.name}</span>
              </div>
            ))}
          </div>
          <h3 className="h2" style={{ marginTop: 18 }}>Packing list · {plan.packing.length} pieces</h3>
          <p className="tiny" style={{ marginTop: 0 }}>Pieces worn on several days are re-used on purpose to keep the bag light.</p>
          <ul className="packing">
            {plan.packing.map(({ item, days }) => (
              <li key={item.id}><label><input type="checkbox" checked={!!packedOff[item.id]} onChange={() => setPackedOff((x) => ({ ...x, [item.id]: !x[item.id] }))} /> <span>{item.name}</span><span className="tiny">{days} day{days > 1 ? 's' : ''}</span></label></li>
            ))}
          </ul>
          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <button className="btn accent" onClick={save}>Add to calendar</button>
            <button className="btn" onClick={() => setPlan(planTrip(owned, ctx, dates, plan.days))}>Try other outfits</button>
            <button className="btn ghost" onClick={() => setPlan(null)}>Change trip details</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function TripCard({ trip }) {
  const { state, dispatch, resolve, profile } = useStore();
  const [open, setOpen] = useState(false);
  const plans = state.plans.filter((p) => p.tripId === trip.id).sort((a, b) => a.date.localeCompare(b.date));
  const counts = new Map();
  for (const p of plans) for (const id of Object.values(p.slots)) if (id) counts.set(id, (counts.get(id) || 0) + 1);
  const items = [...counts.entries()].map(([id, n]) => ({ g: state.garments.find((x) => x.id === id), n })).filter((x) => x.g);
  return (
    <div className="trip-card">
      <div className="trip-card-head">
        <div><b>{trip.name}</b><div className="tiny">{nice(trip.start, { day: 'numeric', month: 'short' })} – {nice(trip.end, { day: 'numeric', month: 'short', year: 'numeric' })} · {plans.length} outfits · {items.length} pieces to pack</div></div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn sm" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'Hide' : 'Packing list'}</button>
          <ConfirmButton label="Delete" confirmLabel="Delete trip and its plans?" onConfirm={() => dispatch({ type: 'DELETE_TRIP', id: trip.id })} />
        </div>
      </div>
      {open && (
        <>
          <div className="trip-days">{plans.map((p) => <div key={p.id} className="trip-day"><span className="tiny">{nice(p.date, { weekday: 'short', day: 'numeric' })}</span><Stage outfit={resolve(p.slots)} mode="flatlay" compact child={profile.kind === 'child'} /></div>)}</div>
          <ul className="packing">{items.map(({ g, n }) => <li key={g.id}><label><input type="checkbox" /> <span>{g.name}</span><span className="tiny">{n} day{n > 1 ? 's' : ''}</span></label></li>)}</ul>
        </>
      )}
    </div>
  );
}

export default function Calendar({ go }) {
  const { state, resolve, profile, historyOf } = useStore();
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [day, setDay] = useState(null);
  const [tripOpen, setTripOpen] = useState(false);
  const cells = monthGrid(ym.y, ym.m);
  const plans = new Map(state.plans.filter((p) => p.profileId === profile.id).map((p) => [p.date, p]));
  const worn = new Set(historyOf(profile.id).map((h) => h.date));
  const trips = state.trips.filter((t) => t.profileId === profile.id).sort((a, b) => a.start.localeCompare(b.start));
  const tripOf = (date) => trips.find((t) => date >= t.start && date <= t.end);
  const t0 = todayIso();
  const shift = (k) => setYm(({ y, m }) => { const d = new Date(y, m + k, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const upcoming = [...plans.values()].filter((p) => p.date >= t0).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="label">{profile.name === 'Me' ? 'Your' : `${profile.name}'s`} outfit calendar</div>
          <h1 className="h1">Calendar</h1>
          <p className="small muted" style={{ margin: 0 }}>Tap a day to plan what to wear. Planning a trip fills every day and makes a packing list.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => go('#/history')}>Outfit history</button>
          <button className="btn accent" onClick={() => setTripOpen(true)}>✈ Plan a trip</button>
        </div>
      </div>

      <div className="cal">
        <div className="cal-head">
          <button className="btn sm ghost" onClick={() => shift(-1)} aria-label="Previous month">‹</button>
          <h2 className="h2">{new Date(ym.y, ym.m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
          <button className="btn sm ghost" onClick={() => shift(1)} aria-label="Next month">›</button>
          {(ym.y !== now.getFullYear() || ym.m !== now.getMonth()) && <button className="btn sm" onClick={() => setYm({ y: now.getFullYear(), m: now.getMonth() })}>Today</button>}
        </div>
        <div className="cal-grid" role="grid">
          {WEEK.map((w) => <div key={w} className="cal-wd" role="columnheader">{w}</div>)}
          {cells.map((c) => {
            const p = plans.get(c.date);
            const trip = tripOf(c.date);
            return (
              <button key={c.date} role="gridcell" className={'cal-cell' + (c.inMonth ? '' : ' out') + (c.date === t0 ? ' today' : '') + (p ? ' has-plan' : '') + (c.date < t0 ? ' past' : '')}
                onClick={() => setDay(c.date)} aria-label={`${nice(c.date)}${p ? ', planned: ' + p.name : ''}${worn.has(c.date) ? ', worn' : ''}`}>
                <span className="cal-num">{c.day}</span>
                {trip && <span className="cal-trip" title={trip.name}>{c.date === trip.start || c.day === 1 ? trip.name : ''}</span>}
                {p && <span className="cal-thumb"><Stage outfit={resolve(p.slots)} mode="flatlay" compact child={profile.kind === 'child'} /></span>}
                {p && <span className="cal-dot" aria-hidden="true" />}
                {worn.has(c.date) && <span className="cal-worn" title="Worn">✓</span>}
              </button>
            );
          })}
        </div>
        <div className="cal-legend tiny"><span><i className="cal-dot" /> planned</span><span><b className="cal-worn">✓</b> worn</span><span><i className="cal-trip-key" /> trip</span></div>
      </div>

      {upcoming.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2 className="h2">Coming up</h2>
          <ul className="upcoming">
            {upcoming.map((p) => <li key={p.id}><button onClick={() => setDay(p.date)}><b>{nice(p.date, { weekday: 'short', day: 'numeric', month: 'short' })}</b><span>{p.name}</span></button></li>)}
          </ul>
        </section>
      )}
      {trips.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2 className="h2">Trips</h2>
          <div className="trip-list">{trips.map((t) => <TripCard key={t.id} trip={t} />)}</div>
        </section>
      )}
      {day && <DayPanel date={day} onClose={() => setDay(null)} />}
      {tripOpen && <TripPlanner onClose={() => setTripOpen(false)} />}
    </div>
  );
}
