/* ---------- Cloud sync ---------- */
const Cloud={
  sb:null,user:null,status:"",timer:null,busy:false,
  async client(){
    if(this.sb) return this.sb;
    if(!window.supabase){
      await new Promise((res,rej)=>{const sc=document.createElement("script");sc.src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";sc.onload=res;sc.onerror=()=>rej(new Error("Failed to load the sign-in library"));document.head.appendChild(sc);});
    }
    this.sb=window.supabase.createClient(CONFIG.SUPABASE_URL,CONFIG.SUPABASE_KEY);
    this.sb.auth.onAuthStateChange((ev,session)=>{
      if(ev==="PASSWORD_RECOVERY"){this.user=session&&session.user;renderAccount();openAuth("newpass");}
    });
    return this.sb;
  },
  async restore(){
    try{const sb=await this.client();const {data}=await sb.auth.getSession();this.user=data.session?data.session.user:null;if(this.user)await this.pull();}
    catch(e){console.warn("Session restore failed",e);}
    renderAccount();
  },
  async signIn(email,password){
    const sb=await this.client();const {data,error}=await sb.auth.signInWithPassword({email,password});
    if(error) throw error; this.user=data.user; await this.pull(); renderAccount();
  },
  async signUp(email,password,name){
    const sb=await this.client();
    const {data,error}=await sb.auth.signUp({email,password,options:{data:{name},emailRedirectTo:location.href.split("#")[0]}});
    if(error) throw error;
    if(!data.session) return "confirm";
    this.user=data.user; await this.pull(); renderAccount(); return "in";
  },
  async reset(email){const sb=await this.client();const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.href.split("#")[0]});if(error)throw error;},
  async newPassword(password){const sb=await this.client();const {error}=await sb.auth.updateUser({password});if(error)throw error;},
  async signOut(){
    clearTimeout(this.timer); if(this.user&&this.status!=="Synced") await this.push();
    try{await (await this.client()).auth.signOut();}catch(e){}
    this.user=null;this.status="";resetToSample();renderAccount();rerender();
  },
  setStatus(t){this.status=t;const el=document.getElementById("syncState");if(el)el.textContent=t;const b=$("#acctBtn");if(b&&this.user)b.title="Account · "+t;},
  /* Sync rules: never overwrite newer data.
     - First sign-in on a device: the account's data wins, and if this device had its own kitchen,
       you're asked whether to add it to the account (nothing is merged silently).
     - Afterwards: whichever side was changed most recently wins. */
  async pull(){
    if(!this.user||this.busy) return; this.busy=true; this.setStatus("Syncing…");
    try{
      const sb=await this.client();
      const {data,error}=await sb.from(CONFIG.TABLE).select("data, updated_at").eq("user_id",this.user.id).maybeSingle();
      if(error) throw error;
      const remote=data&&data.data, remoteAt=remote?(remote.savedAt||Date.parse(data.updated_at)||1):0;
      const mine=S.owner===this.user.id;
      const localOwn=!S.sample&&(S.pantry.length||S.saved.length);
      if(remote&&!mine){
        const local=snapshot();
        applySnapshot({...remote,savedAt:remoteAt}); S.owner=this.user.id; saveLocal(); rerender();
        if(localOwn) offerMerge(local);
        this.setStatus("Synced");
      }else if(remote&&remoteAt>(S.savedAt||0)){
        applySnapshot({...remote,savedAt:remoteAt}); S.owner=this.user.id; saveLocal(); rerender(); this.setStatus("Synced");
      }else{ S.owner=this.user.id; this.busy=false; await this.push(); }
    }catch(e){console.warn("Cloud pull failed",e);this.setStatus(tableMissing(e)?"Cloud table not set up yet":"Not synced");}
    finally{this.busy=false;}
  },
  schedule(){if(!this.user)return;clearTimeout(this.timer);this.setStatus("Saving…");this.timer=setTimeout(()=>this.push(),1200);},
  async push(){
    if(!this.user) return;
    try{
      const sb=await this.client();
      if(!S.savedAt) S.savedAt=Date.now();
      // Don't overwrite a newer copy saved from another device: take that one instead.
      const cur=await sb.from(CONFIG.TABLE).select("data, updated_at").eq("user_id",this.user.id).maybeSingle();
      if(!cur.error&&cur.data&&cur.data.data){
        const at=cur.data.data.savedAt||Date.parse(cur.data.updated_at)||0;
        if(at>S.savedAt){ applySnapshot({...cur.data.data,savedAt:at}); S.owner=this.user.id; saveLocal(); rerender(); this.setStatus("Synced"); toast("Updated with newer changes from your other device."); return; }
      }
      S.owner=this.user.id;
      const {error}=await sb.from(CONFIG.TABLE).upsert({user_id:this.user.id,data:snapshot(),updated_at:new Date(S.savedAt).toISOString()});
      if(error) throw error; saveLocal(); this.setStatus("Synced");
    }catch(e){console.warn("Cloud push failed",e);this.setStatus(tableMissing(e)?"Cloud table not set up yet":"Not synced");}
  }
};
const tableMissing=e=>!!e&&(e.code==="42P01"||e.code==="PGRST205"||/does not exist|schema cache/i.test(e.message||""));
function friendly(e){
  const m=(e&&e.message)||"";
  if(/fetch|network|load/i.test(m)) return "Couldn't reach the account server. Check your connection and try again.";
  if(/not authorized|error sending|sending (confirmation|recovery|magic)|smtp/i.test(m)) return "We couldn't send the email to that address yet: the site's email service is still being set up. Please try again later.";
  if(/signups? not allowed|signup is disabled/i.test(m)) return "New accounts aren't open yet. Please try again later.";
  if(/invalid login credentials/i.test(m)) return "Email or password is incorrect.";
  if(/email not confirmed/i.test(m)) return "Please confirm your email first. The link is in your inbox.";
  if(/already registered|already exists/i.test(m)) return "That email already has an account. Try signing in instead.";
  if(/rate limit|too many/i.test(m)) return "Too many attempts. Wait a minute and try again.";
  if(/password should be|at least/i.test(m)) return "Password needs at least 8 characters.";
  return m||"Something went wrong. Try again.";
}

/* ---------- Account UI ---------- */
let authMode="signin";
function renderAccount(){
  const b=$("#acctBtn"); if(!b) return;
  b.hidden=!CLOUD_OK;
  if(Cloud.user){const n=(Cloud.user.user_metadata&&Cloud.user.user_metadata.name)||Cloud.user.email;
    b.classList.remove("out");b.innerHTML=`<span class="avatar" aria-hidden="true">${esc(n.trim()[0]||"?").toUpperCase()}</span>Account`;}
  else{b.classList.add("out");b.textContent="Sign in";}
}
function openAuth(mode,msg,kind){
  authMode=mode; const box=$("#authBox"), u=Cloud.user;
  const note=msg?`<div class="msg ${kind||"err"}" role="alert">${esc(msg)}</div>`:"";
  const email=`<label for="authEmail">Email<input type="email" id="authEmail" autocomplete="email" required></label>`;
  const pass=(ac)=>`<label for="authPass">Password<input type="password" id="authPass" autocomplete="${ac}" minlength="8" required></label>`;
  const T={
    signin:`<h2 id="authTitle">Sign in</h2><p>Your kitchen and saved recipes follow you to every device.</p>${note}
      <form id="authForm">${email}${pass("current-password")}<button class="btn primary" type="submit">Sign in</button></form>
      <div class="links"><button class="linkbtn" data-act="auth-mode" data-m="forgot">Forgot password?</button><button class="linkbtn" data-act="auth-mode" data-m="signup">Create an account</button></div>`,
    signup:`<h2 id="authTitle">Create your account</h2><p>Free. Your kitchen, staples and saved recipes are saved to your account.</p>${note}
      <form id="authForm"><label for="authName">Name<input type="text" id="authName" autocomplete="name" required></label>${email}${pass("new-password")}
      <button class="btn primary" type="submit">Create account</button></form>
      <div class="links"><span></span><button class="linkbtn" data-act="auth-mode" data-m="signin">I already have an account</button></div>`,
    forgot:`<h2 id="authTitle">Reset your password</h2><p>We'll email you a link to choose a new one.</p>${note}
      <form id="authForm">${email}<button class="btn primary" type="submit">Send reset link</button></form>
      <div class="links"><span></span><button class="linkbtn" data-act="auth-mode" data-m="signin">Back to sign in</button></div>`,
    newpass:`<h2 id="authTitle">Choose a new password</h2>${note}
      <form id="authForm">${pass("new-password")}<button class="btn primary" type="submit">Save password</button></form>`,
    account:u?`<h2 id="authTitle">Your account</h2>${note}
      <dl><dt>Name</dt><dd>${esc((u.user_metadata&&u.user_metadata.name)||"—")}</dd><dt>Email</dt><dd>${esc(u.email)}</dd><dt>Sync</dt><dd id="syncState">${esc(Cloud.status||"Synced")}</dd></dl>
      <p>Changes to your kitchen, staples and saved recipes save to your account automatically.</p>
      <button class="btn" data-act="sign-out">Sign out</button>`:""
  };
  box.innerHTML=T[mode]+`<button class="linkbtn" data-act="auth-close" style="align-self:center">Close</button>`;
  $("#authModal").hidden=false;
  const f=box.querySelector("input");if(f)f.focus();else box.querySelector("button").focus();
}

async function submitAuth(){
  const btn=$("#authForm button[type=submit]"), v=id=>{const el=document.getElementById(id);return el?el.value.trim():""};
  const email=v("authEmail").toLowerCase(), pw=document.getElementById("authPass")?document.getElementById("authPass").value:"";
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)){openAuth(authMode,"That email doesn't look right.");return;}
  if(document.getElementById("authPass")&&pw.length<8){openAuth(authMode,"Password needs at least 8 characters.");return;}
  btn.disabled=true; btn.textContent="One moment…";
  try{
    if(authMode==="signin"){await Cloud.signIn(email,pw);closeAuth();toast("Signed in. Your kitchen is synced.");}
    else if(authMode==="signup"){const r=await Cloud.signUp(email,pw,v("authName"));
      if(r==="confirm") openAuth("signin",`Almost there! We sent a confirmation link to ${email}. Click it, then sign in here.`,"ok");
      else{closeAuth();toast("Account created. Your kitchen is synced.");}}
    else if(authMode==="forgot"){await Cloud.reset(email);openAuth("signin",`If ${email} has an account, a reset link is on its way.`,"ok");}
    else if(authMode==="newpass"){await Cloud.newPassword(pw);closeAuth();toast("New password saved.");}
  }catch(e){openAuth(authMode,friendly(e));}
}



