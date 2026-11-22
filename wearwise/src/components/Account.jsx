// Header account button + sign-in / sign-up / reset modal.
import { useEffect, useRef, useState } from 'react';
import { useAuth, useCloudSync, inClaudePreview } from '../auth.jsx';
import { Modal, useToast } from './common.jsx';

function AuthModal({ onClose, initial = 'signin' }) {
  const auth = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState(initial); // signin | signup | reset
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');

  async function submit(e) {
    e.preventDefault();
    setErr(''); setInfo(''); setBusy(true);
    try {
      if (mode === 'signin') { await auth.signIn(email, password); toast('Welcome back!'); onClose(); }
      else if (mode === 'signup') {
        const r = await auth.signUp(name, email, password);
        if (r.needsConfirm) setInfo('Almost there! We sent a confirmation link to ' + email + '. Open it, then sign in.');
        else { toast('Account created'); onClose(); }
      } else { await auth.resetPassword(email); setInfo('If that email has an account, a reset link is on its way.'); }
    } catch (x) { setErr(x.message); }
    setBusy(false);
  }

  const title = mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create your account' : 'Reset your password';
  return (
    <Modal title={title} onClose={onClose}>
      <p className="small muted" style={{ marginTop: 0 }}>
        {mode === 'reset' ? 'Enter your email and we\'ll send you a link.' : 'Save your closet, looks and lookbooks to your account, and see them on every device.'}
      </p>
      {inClaudePreview && <p className="small" style={{ color: 'var(--warn)' }}>Sign-in works on the live site. This claude.ai preview can't reach the account server, so your closet stays in this browser here.</p>}
      <form onSubmit={submit}>
        {mode === 'signup' && <div className="field"><label className="label" htmlFor="au-name">Name</label><input id="au-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></div>}
        <div className="field"><label className="label" htmlFor="au-email">Email</label><input id="au-email" className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus /></div>
        {mode !== 'reset' && (
          <div className="field"><label className="label" htmlFor="au-pw">Password</label>
            <input id="au-pw" className="input" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
          </div>
        )}
        {err && <p className="small" style={{ color: 'var(--accent)' }}>{err}</p>}
        {info && <p className="small" style={{ color: 'var(--good)' }}>{info}</p>}
        <button className="btn primary block" disabled={busy}>{busy ? 'One moment…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}</button>
      </form>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
        {mode === 'signin' ? (
          <>
            <button className="btn ghost sm" onClick={() => { setMode('signup'); setErr(''); setInfo(''); }}>New here? Create an account</button>
            <button className="btn ghost sm" onClick={() => { setMode('reset'); setErr(''); setInfo(''); }}>Forgot password?</button>
          </>
        ) : (
          <button className="btn ghost sm" onClick={() => { setMode('signin'); setErr(''); setInfo(''); }}>← Back to sign in</button>
        )}
      </div>
    </Modal>
  );
}

function NewPasswordModal({ onClose }) {
  const auth = useAuth();
  const toast = useToast();
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  return (
    <Modal title="Choose a new password" onClose={onClose}>
      <form onSubmit={async (e) => { e.preventDefault(); try { await auth.updatePassword(pw); toast('Password updated'); onClose(); } catch (x) { setErr(x.message); } }}>
        <div className="field"><label className="label" htmlFor="np">New password</label><input id="np" className="input" type="password" minLength={6} required value={pw} onChange={(e) => setPw(e.target.value)} autoFocus /></div>
        {err && <p className="small" style={{ color: 'var(--accent)' }}>{err}</p>}
        <button className="btn primary block">Save password</button>
      </form>
    </Modal>
  );
}

const ago = (d) => { if (!d) return ''; const s = Math.round((Date.now() - d) / 1000); return s < 10 ? 'just now' : s < 60 ? `${s}s ago` : `${Math.round(s / 60)} min ago`; };

export default function Account() {
  const auth = useAuth();
  const sync = useCloudSync();
  const toast = useToast();
  const [open, setOpen] = useState(null); // 'signin' | 'signup' | null
  const [menu, setMenu] = useState(false);
  const ref = useRef();
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (!menu) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) setMenu(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);

  if (!auth?.configured) return null;
  const u = auth.user;
  const name = u?.user_metadata?.name || u?.email?.split('@')[0] || '';
  const syncText = { loading: 'Loading your closet…', saving: 'Saving…', synced: `☁️ Synced ${ago(sync.lastSaved)}`, error: 'Not synced', 'needs-setup': 'Cloud not set up', off: '' }[sync.status];

  return (
    <div className="account" ref={ref}>
      {!u ? (
        <button className="btn sm" onClick={() => setOpen('signin')}>Sign in</button>
      ) : (
        <button className="avatar" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-label="Account menu" title={syncText}>
          {name.charAt(0).toUpperCase()}
          <i className={'sync-dot ' + sync.status} />
        </button>
      )}
      {menu && u && (
        <div className="account-menu" role="menu">
          <div className="small" style={{ fontWeight: 700 }}>{name}</div>
          <div className="tiny">{u.email}</div>
          <div className="small" style={{ margin: '10px 0', color: sync.status === 'error' || sync.status === 'needs-setup' ? 'var(--warn)' : 'var(--ink-2)' }}>{syncText}</div>
          {sync.message && <div className="tiny" style={{ color: 'var(--warn)', marginBottom: 8 }}>{sync.message}</div>}
          <button className="btn sm block" onClick={async () => { setMenu(false); await auth.signOut(); toast('Signed out'); }}>Sign out</button>
        </div>
      )}
      {open && <AuthModal initial={open} onClose={() => setOpen(null)} />}
      {auth.recovery && u && <NewPasswordModal onClose={() => auth.endRecovery()} />}
    </div>
  );
}
