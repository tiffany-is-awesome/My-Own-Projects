/* ---------- Account + sync: one sign-in with Puter ----------
   Signing in with Puter does two things at once: it turns on the free AI and it saves your
   kitchen to your own Puter account (Puter's private per-app storage), so there's no second
   account, password or confirmation email. */
const KV_KEY="p2p.kitchen";
const Cloud={
  user:null,status:"",timer:null,busy:false,
  async ready(){ await AI.loadPuter(); return window.puter; },
  async restore(){
    try{ const p=await this.ready(); if(await p.auth.isSignedIn()){ await this.adopt(); } }
    catch(e){ console.warn("Session restore failed",e); }
    renderAccount();
  },
  async adopt(){
    // The AI works as soon as you're signed in; saving the kitchen is a separate step that can't block it.
    S.puterConnected=true; renderAiStatus();
    let u=null; try{ u=await window.puter.auth.getUser(); }catch(e){ console.warn("Couldn't read the Puter profile",e); }
    if(!u||!u.uuid||!window.puter.kv){ this.user=null; this.setStatus("Not synced"); renderAccount(); return; }
    this.user={ id:"puter:"+u.uuid, name:u.username||"you" };
    await this.pull(); renderAccount();
  },
  /* Must run straight from a click: Puter opens its sign-in in a pop-up window. */
  async signIn(){ await AI.puterSignIn(); if(!(await AI.puterSignedIn())) throw {code:"not_confirmed"}; await this.adopt(); },
  async signOut(){
    clearTimeout(this.timer); if(this.user&&this.status!=="Synced") await this.push();
    try{ window.puter&&window.puter.auth.signOut(); }catch(e){}
    this.user=null; this.status=""; S.puterConnected=false; resetToSample(); renderAccount(); renderAiStatus(); rerender();
  },
  setStatus(t){this.status=t;const el=document.getElementById("syncState");if(el)el.textContent=t;const b=$("#acctBtn");if(b&&this.user)b.title="Account · "+t;},
  /* Your kitchen in Puter storage (split into parts if it's bigger than one entry can hold). */
  async load(){
    const kv=window.puter.kv, head=await kv.get(KV_KEY);
    if(!head) return null;
    const h=typeof head==="string"?JSON.parse(head):head;
    if(!h.parts) return h;
    let txt=""; for(let i=0;i<h.parts;i++){ txt+=await kv.get(KV_KEY+":"+i)||""; }
    return JSON.parse(txt);
  },
  async save(data){
    const kv=window.puter.kv, txt=JSON.stringify(data), max=Math.max(20000,(kv.MAX_VALUE_SIZE||400000)-2000);
    if(txt.length<=max){ await kv.set(KV_KEY,data); return; }
    const parts=Math.ceil(txt.length/max);
    for(let i=0;i<parts;i++) await kv.set(KV_KEY+":"+i,txt.slice(i*max,(i+1)*max));
    await kv.set(KV_KEY,{parts,savedAt:data.savedAt});
  },
  /* Sync rules: never overwrite newer data.
     - First sign-in on a device: the account's data wins, and if this device had its own kitchen,
       you're asked whether to add it to the account (nothing is merged silently).
     - Afterwards: whichever side was changed most recently wins. */
  async pull(){
    if(!this.user||this.busy) return; this.busy=true; this.setStatus("Syncing…");
    try{
      const remote=await this.load(), remoteAt=remote?(remote.savedAt||1):0;
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
    }catch(e){console.warn("Cloud pull failed",e);this.setStatus("Not synced");}
    finally{this.busy=false;}
  },
  schedule(){if(!this.user)return;clearTimeout(this.timer);this.setStatus("Saving…");this.timer=setTimeout(()=>this.push(),1200);},
  async push(){
    if(!this.user) return;
    try{
      if(!S.savedAt) S.savedAt=Date.now();
      // Don't overwrite a newer copy saved from another device: take that one instead.
      const cur=await this.load();
      if(cur&&(cur.savedAt||0)>S.savedAt){ applySnapshot(cur); S.owner=this.user.id; saveLocal(); rerender(); this.setStatus("Synced"); toast("Updated with newer changes from your other device."); return; }
      S.owner=this.user.id;
      await this.save(snapshot()); saveLocal(); this.setStatus("Synced");
    }catch(e){console.warn("Cloud push failed",e);this.setStatus("Not synced");}
  }
};
/* Recipe reports go to the site owner without needing an account (insert-only, nobody can read others'). */
async function sendFeedback(row){
  try{
    const r=await fetch(CONFIG.SUPABASE_URL+"/rest/v1/pantry_feedback",{method:"POST",headers:{apikey:CONFIG.SUPABASE_KEY,Authorization:"Bearer "+CONFIG.SUPABASE_KEY,"Content-Type":"application/json",Prefer:"return=minimal"},body:JSON.stringify(row)});
    return r.ok;
  }catch(e){return false;}
}

/* ---------- Account UI ---------- */
function renderAccount(){
  const b=$("#acctBtn"); if(!b) return;
  b.hidden=!CLOUD_OK;
  if(Cloud.user){const n=Cloud.user.name||"?";
    b.classList.remove("out");b.innerHTML=`<span class="avatar" aria-hidden="true">${esc(n.trim()[0]||"?").toUpperCase()}</span>Account`;}
  else{b.classList.add("out");b.textContent="Sign in";}
}
function openAuth(mode,msg,kind){
  const box=$("#authBox"), u=Cloud.user;
  const note=msg?`<div class="msg ${kind||"err"}" role="alert">${esc(msg)}</div>`:"";
  box.innerHTML=(mode==="account"&&u
    ? `<h2 id="authTitle">Your account</h2>${note}
      <dl><dt>Signed in as</dt><dd>${esc(u.name)} <span class="muted">(Puter)</span></dd><dt>Free AI</dt><dd>On</dd><dt>Sync</dt><dd id="syncState">${esc(Cloud.status||"Synced")}</dd></dl>
      <p>Your kitchen, basics, plan and saved recipes save to your own Puter account automatically, so they follow you to every device.</p>
      <button class="btn" data-act="sign-out">Sign out</button>`
    : `<div class="signin-art">${typeof ill==="function"?ill("fridge"):""}</div><h2 id="authTitle">Sign in with Puter</h2>${note}
      <p>One free sign-in does two things:</p>
      <ul class="signin-list"><li>${icon("fridge")}<span><b>Saves your kitchen</b> so it follows you to your phone and other devices</span></li>
      <li>${icon("spark")}<span><b>Turns on the free AI</b> for new recipe ideas, dish fixes and photo scanning</span></li></ul>
      <button class="btn primary big" data-act="puter-connect">Sign in with Puter</button>
      <p class="small muted">No Puter account yet? You can create one for free in the same window. Your data is kept in your own Puter account.</p>`)
    +`<button class="linkbtn" data-act="auth-close" style="align-self:center">${mode==="account"?"Close":"Not now"}</button>`;
  $("#authModal").hidden=false;
  box.querySelector(".btn").focus();
}
async function submitAuth(){ /* no forms any more: sign-in happens in Puter's window */ }
