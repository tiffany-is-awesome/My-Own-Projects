// Settings: account, AI stylist, family members, demo data, delete everything.
import { useState } from 'react';
import { useStore } from '../store.jsx';
import { useAuth, supabase } from '../auth.jsx';
import { ConfirmButton, useToast } from '../components/common.jsx';
import { useClaudeStatus, puterUser, puterSignIn, puterSignOut } from '../ai/claude.js';

export function ProfileManager() {
  const { state, dispatch, closetOf } = useStore();
  const toast = useToast();
  const [name, setName] = useState('');
  const [kind, setKind] = useState('adult');
  return (
    <div className="profile-manager">
      <span className="label">Family members</span>
      <p className="tiny" style={{ marginTop: 2 }}>Each member has a separate closet and saved outfits. Suggestions for one person never use another person's clothes.</p>
      <ul className="profile-rows">
        {state.profiles.map((p) => (
          <li key={p.id}>
            <input className="input" value={p.name} aria-label={`Name of ${p.name}`} onChange={(e) => dispatch({ type: 'UPDATE_PROFILE', profile: { id: p.id, name: e.target.value } })} />
            <select className="select" value={p.kind} aria-label={`Age group of ${p.name}`} onChange={(e) => dispatch({ type: 'UPDATE_PROFILE', profile: { id: p.id, kind: e.target.value } })}>
              <option value="adult">Adult</option><option value="child">Child</option>
            </select>
            <span className="tiny">{closetOf(p.id).length} pieces{p.demo ? ' · demo' : ''}</span>
            {p.id === 'p-me'
              ? <span className="tiny muted">Main profile</span>
              : <ConfirmButton label="Remove" confirmLabel={`Delete ${p.name} and their clothes?`} onConfirm={() => { dispatch({ type: 'DELETE_PROFILE', id: p.id }); toast(`${p.name} removed`); }} />}
          </li>
        ))}
      </ul>
      <form className="profile-add" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; dispatch({ type: 'ADD_PROFILE', name: name.trim(), kind }); toast(`${name.trim()} added. You're now viewing their closet.`); setName(''); }}>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. Dad or Mia" aria-label="New member name" />
        <select className="select" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="New member age group"><option value="adult">Adult</option><option value="child">Child</option></select>
        <button className="btn primary" type="submit">Add member</button>
      </form>
    </div>
  );
}

function LocationManager() {
  const { state, dispatch } = useStore();
  const [name, setName] = useState('');
  const count = (id) => state.garments.filter((g) => g.location === id).length;
  return (
    <div>
      <h2 className="h2">Where clothes are kept</h2>
      <p className="small">Name the places you keep clothes (a closet, a storage box, Lola's house…). Set each piece's place in My Closet, then filter by it to find things fast.</p>
      <ul className="profile-rows">
        {state.locations.map((l) => (
          <li key={l.id} style={{ gridTemplateColumns: '1fr 110px auto' }}>
            <input className="input" value={l.name} aria-label={`Rename ${l.name}`} onChange={(e) => dispatch({ type: 'RENAME_LOCATION', id: l.id, name: e.target.value })} />
            <span className="tiny">{count(l.id)} pieces</span>
            <ConfirmButton label="Remove" confirmLabel="Click to remove" onConfirm={() => dispatch({ type: 'DELETE_LOCATION', id: l.id })} />
          </li>
        ))}
      </ul>
      <form className="profile-add" style={{ gridTemplateColumns: '1fr auto' }} onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; dispatch({ type: 'ADD_LOCATION', location: { id: 'loc-' + Date.now().toString(36), name: name.trim() } }); setName(''); }}>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bedroom closet" aria-label="New place" />
        <button className="btn primary" type="submit">Add place</button>
      </form>
    </div>
  );
}

export default function Settings({ go }) {
  const { state, dispatch, hasDemo } = useStore();
  const { user } = useAuth() || {};
  const toast = useToast();
  const ai = useClaudeStatus();
  const [gem, setGem] = useState(undefined);
  const [busy, setBusy] = useState(false);
  if (gem === undefined && ai.via === 'puter') puterUser().then((u) => setGem(u || null)).catch(() => setGem(null));

  async function deleteEverything() {
    setBusy(true);
    dispatch({ type: 'DELETE_ALL' });
    try { localStorage.removeItem('unique-ava.v1'); } catch { /* ignore */ }
    let cloud = '';
    if (supabase && user) {
      const { error } = await supabase.from('unique_ava_data').delete().eq('user_id', user.id);
      cloud = error ? ` Your account copy could not be deleted (${error.message}).` : ' Your account copy was deleted too.';
    }
    setBusy(false);
    toast('All Unique Ava data on this device was deleted.' + cloud);
    go('#/home');
  }

  return (
    <div className="page narrow">
      <div className="page-head"><div><div className="label">Settings</div><h1 className="h1">Settings</h1></div></div>

      <section className="settings-sec">
        <h2 className="h2">Account</h2>
        <p className="small">{user ? <>Signed in as <b>{user.email}</b>. Your closets, outfits and family members are saved to your account and load on any device where you sign in.</> : <>Not signed in. Everything is kept in this browser only. Sign in (top right) to save it to your account.</>}</p>
      </section>

      <section className="settings-sec">
        <h2 className="h2">AI stylist</h2>
        <p className="small">Unique Ava uses Google Gemini through Puter: free, no API key. Each person signs in with their own Puter account, and Gemini's suggestions are checked by the built-in rules engine. Without it, the rules engine does all the styling.</p>
        {ai.via === 'puter' ? (
          gem ? <p className="small">Signed in to Puter as <b>{gem.username}</b>. <button className="btn sm" onClick={() => { puterSignOut(); setGem(null); toast('Signed out of Puter'); }}>Sign out</button></p>
            : <button className="btn sm primary" onClick={async () => { try { await puterSignIn(); setGem((await puterUser()) || null); } catch { toast('Sign-in was closed'); } }}>Sign in to Puter to switch on Gemini</button>
        ) : <p className="tiny">Status here: {ai.status === 'ready' ? `${ai.name} connected` : 'not connected'}.</p>}
      </section>

      <section className="settings-sec"><ProfileManager /></section>

      <section className="settings-sec"><LocationManager /></section>

      <section className="settings-sec">
        <h2 className="h2">Demo closet</h2>
        <p className="small">A sample wardrobe (plus a sample Dad and Mia) for trying Unique Ava out. Demo pieces are labelled “Demo” and can be removed in one click; your own pieces are never touched.</p>
        {hasDemo
          ? <ConfirmButton className="btn" label="Remove all demo items" confirmLabel="Click again to remove demo items" onConfirm={() => { dispatch({ type: 'REMOVE_DEMO' }); toast('Demo items removed'); }} />
          : <button className="btn" onClick={() => { dispatch({ type: 'LOAD_DEMO' }); toast('Demo closet added'); }}>Add the demo closet</button>}
      </section>

      <section className="settings-sec danger">
        <h2 className="h2">Delete my data</h2>
        <p className="small">Deletes every closet, outfit, lookbook, family member and photo from this browser{user ? ' and from your account' : ''}. This cannot be undone. {user ? 'Your sign-in itself stays; ask us if you want the account removed too.' : ''}</p>
        <ConfirmButton className="btn" label={busy ? 'Deleting…' : 'Delete all my Unique Ava data'} confirmLabel="Click again: this cannot be undone" onConfirm={deleteEverything} />
        <p className="tiny" style={{ marginTop: 8 }}>{state.garments.length} pieces · {state.outfits.length} outfits · {state.profiles.length} profile{state.profiles.length > 1 ? 's' : ''} stored now.</p>
      </section>
    </div>
  );
}
