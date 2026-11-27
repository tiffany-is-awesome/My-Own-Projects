// Settings: account, AI stylist, family members, demo data, delete everything.
import { useState } from 'react';
import { useStore } from '../store.jsx';
import { useAuth, supabase, cloudTable, syncControl } from '../auth.jsx';
import { ConfirmButton, useToast, useUndoableDelete } from '../components/common.jsx';
import TipJar, { tipsOn } from '../components/TipJar.jsx';
import { useAutoDemo, setAutoDemo } from '../components/AutoDemoPhotos.jsx';
import { deleteCloudPhotos, forgetCaches, local as localPhotos } from '../photos.js';
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
  const undoDelete = useUndoableDelete();
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
            <ConfirmButton label="Remove" confirmLabel="Click to remove" onConfirm={() => undoDelete({ type: 'DELETE_LOCATION', id: l.id }, 'Place removed')} />
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
  const { state, dispatch, hasDemo, deviceSave } = useStore();
  const autoDemo = useAutoDemo();
  const { user, signOut } = useAuth() || {};
  const toast = useToast();
  const ai = useClaudeStatus();
  const [gem, setGem] = useState(undefined);
  const [busy, setBusy] = useState(false);
  if (gem === undefined && ai.via === 'puter') puterUser().then((u) => setGem(u || null)).catch(() => setGem(null));

  async function deleteEverything() {
    setBusy(true);
    syncControl.paused = true; // nothing may be re-uploaded while (or after) the account copy is deleted
    let cloud = '';
    if (supabase && user) {
      let error = null;
      try { await deleteCloudPhotos(supabase, user.id); } catch (e) { error = e; }
      if (!error) ({ error } = await supabase.from(await cloudTable()).delete().eq('user_id', user.id));
      cloud = error ? ` Your account copy could NOT be deleted (${error.message}). Try again when you're online.` : ' Your account copy was deleted too, and you were signed out.';
      if (!error) await signOut();
    }
    dispatch({ type: 'DELETE_ALL' });
    try { await localPhotos.clear(); } catch { /* none stored */ }
    forgetCaches();
    for (const k of ['wearwise.v1', 'unique-ava.v1']) { try { localStorage.removeItem(k); } catch { /* ignore */ } }
    syncControl.paused = false;
    setBusy(false);
    toast('All Wearwise data on this device was deleted.' + cloud);
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
        <p className="small">Wearwise uses Google Gemini through Puter: free, no API key. Each person signs in with their own Puter account, and Gemini's suggestions are checked by the built-in rules engine. Without it, the rules engine does all the styling.</p>
        {ai.via === 'puter' ? (
          gem ? <p className="small">Signed in to Puter as <b>{gem.username}</b>. <button className="btn sm" onClick={() => { puterSignOut(); setGem(null); toast('Signed out of Puter'); }}>Sign out</button></p>
            : <button className="btn sm primary" onClick={async () => { try { await puterSignIn(); setGem((await puterUser()) || null); } catch { toast('Sign-in was closed'); } }}>Sign in to Puter to switch on Gemini</button>
        ) : <p className="tiny">Status here: {ai.status === 'ready' ? `${ai.name} connected` : 'not connected'}.</p>}
        <label className="check-row" style={{ marginTop: 12 }}>
          <input type="checkbox" checked={autoDemo.pref} onChange={(e) => setAutoDemo(e.target.checked)} />
          <span className="small">Make realistic photos for the demo pieces automatically when signed in to AI (uses your Puter account's free allowance; made once, then kept)</span>
        </label>
      </section>

      <section className="settings-sec">
        <h2 className="h2">Your privacy: what happens where</h2>
        <ul className="privacy-list small">
          <li><b>Only on this device:</b> removing photo backgrounds, cropping, reading colors, outfit scoring and suggestions from the rules engine, matching typed inspiration looks, the calendar and trip planner.</li>
          <li><b>Sent to Google Gemini</b> (through Puter, only after you sign in to Puter and only when you use an AI feature):
            the <i>cut-out</i> of a clothing photo when you add it; the <i>whole</i> photo only if the cut-out failed <i>and</i> you tap "Ask Gemini using the whole photo"; an inspiration photo only when you tap "Identify the pieces"; and the <i>text details</i> of your clothes (names, colors, fabric, warmth…) when Gemini picks outfits or critiques one. Gemini picks outfits from these details; it doesn't look at your photos to do so.</li>
          <li><b>Sent to an AI image model</b> (through Puter, only when you tap "Make a realistic AI photo" or "Realistic photo (AI)"): the text details of the piece or outfit, and for an outfit, your own photos of those pieces (so the AI can copy them). The picture that comes back is labelled AI and kept separately; it never replaces your photos.</li>
          <li><b>Saved to your account</b> (Supabase, only when you're signed in): your whole Wearwise data. Clothing and inspiration photos are kept as private files in your own account folder. Each account can only read its own data and photos.</li>
          <li><b>Saved in this browser:</b> the same data, so it works offline. "Delete all my data" below removes both copies.</li>
          <li><b>Shared lookbook links</b> contain the outfit names and each piece's name, type and colors, <i>no photos</i>. Anyone you send the link to can see those, as illustrations.</li>
        </ul>
      </section>

      <section className="settings-sec"><ProfileManager /></section>

      <section className="settings-sec"><LocationManager /></section>

      <section className="settings-sec">
        <h2 className="h2">Demo closet</h2>
        <p className="small">A sample wardrobe (plus a sample Dad and Mia) for trying Wearwise out. Demo pieces are labelled “Demo” and can be removed in one click; your own pieces are never touched.</p>
        {hasDemo
          ? <ConfirmButton className="btn" label="Remove all demo items" confirmLabel="Click again to remove demo items" onConfirm={() => { dispatch({ type: 'REMOVE_DEMO' }); toast('Demo items removed'); }} />
          : <button className="btn" onClick={() => { dispatch({ type: 'LOAD_DEMO' }); toast('Demo closet added'); }}>Add the demo closet</button>}
      </section>

      {tipsOn() && <section className="settings-sec"><TipJar compact /></section>}

      <section className="settings-sec danger">
        <h2 className="h2">Delete my data</h2>
        <p className="small">Deletes every closet, outfit, lookbook, family member and photo from this browser{user ? ' and from your account' : ''}. This cannot be undone. {user ? 'Your sign-in itself stays; ask us if you want the account removed too.' : ''}</p>
        <ConfirmButton className="btn" label={busy ? 'Deleting…' : 'Delete all my Wearwise data'} confirmLabel="Click again: this cannot be undone" onConfirm={deleteEverything} />
        {(() => {
          const total = new Blob([JSON.stringify(state)]).size;
          const photos = state.garments.reduce((a, g) => a + (g.image ? g.image.length : 0), 0) + state.inspirations.reduce((a, i) => a + (i.image ? i.image.length : 0), 0);
          const mb = (n) => (n / 1e6).toFixed(n < 1e6 ? 2 : 1);
          return (
            <p className="tiny" style={{ marginTop: 8 }}>
              Your Wearwise data: <b>{mb(total)} MB</b>, of which photos {mb(photos)} MB. Photos are stored separately from the rest{user ? ', on this device and as private files in your account' : ' on this device'}, so a big closet is fine.
              {deviceSave === 'full' ? <b className="warn-text"> This browser has no room left to save on this device (photo storage may be turned off, e.g. in private browsing). Your latest changes are only kept until you close this tab{user ? ', and in your account' : ''}.</b> : ''}
            </p>
          );
        })()}
        <p className="tiny" style={{ marginTop: 8 }}>{state.garments.length} pieces · {state.outfits.length} outfits · {state.profiles.length} profile{state.profiles.length > 1 ? 's' : ''} stored now.</p>
      </section>
    </div>
  );
}
