/* ================= ACCOUNTS (Supabase) =================
   Sign-in and syncing use the same Supabase project as Tiffo.
   The publishable key is meant to sit in website code: Row Level Security
   (see supabase/pantry-setup.sql) means each person can only read their own row.
   Never put the secret / service_role key here. */
const CONFIG={
  SUPABASE_URL:"https://hvhbygkgvxdpvwvclyns.supabase.co",
  SUPABASE_KEY:"sb_publishable_t8Zf_XjZPrRZB9piISZOhQ_FXdNja7h",
  TABLE:"pantry_data",
  LIVE_SITE:"https://tiffany-is-awesome.github.io/My-Own-Projects/pantry-to-plate/"
};
/* The claude.ai preview blocks calls to other servers, so accounts only run on the published site. */
const CLOUD_OK=!/claude|anthropic/i.test(location.hostname);

/* ================= AI PROVIDER =================
   Every AI request in this app goes through AI.json().
   For now it uses Claude, through claude.ai's built-in "sample" capability.
   To switch to your own AI later, change only AI.init() and AI.json():
   keep the same input (a prompt string, optional image files) and the same
   output (the parsed JSON object). Nothing else in the app needs to change. */
const AI={
  name:"Claude", ready:false, mode:null, _c:null,
  FUNCTION_URL:CONFIG.SUPABASE_URL+"/functions/v1/pantry-ai",
  async init(){
    // 1) Inside claude.ai: use Claude directly.
    if(window.claude&&typeof window.claude.use==="function"){
      const c=await window.claude.use("sample");
      if(c){this._c=c;this.mode="claude-ai";this.name="Claude";this.ready=true;return true;}
    }
    if(!CLOUD_OK) return false;
    // 2) On your own site, if you ever add an AI key in Supabase, the pantry-ai function is used.
    try{
      const r=await fetch(this.FUNCTION_URL,{method:"POST",headers:{"Content-Type":"application/json",apikey:CONFIG.SUPABASE_KEY},body:JSON.stringify({task:"status"})});
      const j=await r.json();
      if(j&&j.ready){this.mode="server";this.name=j.provider||"AI";this.ready=true;return true;}
    }catch(e){}
    // 3) Otherwise: free Gemini through Puter. No API key anywhere. Each visitor signs in to a
    //    free Puter account once, and their AI use comes out of that account's free allowance.
    try{ await this.loadPuter(); this.mode="puter"; this.name="Gemini"; this.ready=true; return true; }catch(e){}
    return false;
  },
  PUTER_MODELS:{full:["google/gemini-3.5-flash","google/gemini-2.5-flash"],fast:["google/gemini-3.5-flash-lite","google/gemini-2.5-flash-lite"]},
  loadPuter(){
    if(window.puter) return Promise.resolve();
    if(this._pl) return this._pl;
    this._pl=new Promise((res,rej)=>{const sc=document.createElement("script");sc.src="https://js.puter.com/v2/";sc.onload=()=>window.puter?res():rej(new Error("Puter missing"));sc.onerror=()=>{this._pl=null;rej(new Error("Couldn't load Puter"));};document.head.appendChild(sc);});
    return this._pl;
  },
  async puterSignedIn(){try{await this.loadPuter();return !!(await window.puter.auth.isSignedIn());}catch(e){return false;}},
  async puterSignIn(){await this.loadPuter();await window.puter.auth.signIn();},
  async json(prompt,opts={}){
    try{ const r=await this._json(prompt,opts); this.onResult&&this.onResult(true); return r; }
    catch(e){ if(!(e&&e.code==="bad_json")) this.onResult&&this.onResult(false,e&&e.code); throw e; }
  },
  async _json(prompt,{fast}={}){
    if(this.mode==="claude-ai") return this._c.json(prompt,{modelTier:fast?"quick":"default"});
    if(this.mode==="puter"){
      if(!(await this.puterSignedIn())) throw {code:"puter_sign_in"};
      const full="You are the AI inside a cooking app. Answer with valid JSON only: no markdown, no code fences, no extra text.\n\n"+prompt;
      let lastErr;
      for(const model of this.PUTER_MODELS[fast?"fast":"full"]){
        try{ const res=await window.puter.ai.chat(full,{model}); return parseJSON(puterText(res)); }
        catch(e){ lastErr=e; if(e&&e.code==="bad_json") throw e; }
      }
      throw {code:"puter_failed",message:lastErr&&(lastErr.message||lastErr.error&&lastErr.error.message)};
    }
    let session=null;
    try{ if(Cloud.user){ session=(await (await Cloud.client()).auth.getSession()).data.session; } }catch(e){}
    if(!session) throw {code:"sign_in"};
    const r=await fetch(this.FUNCTION_URL,{method:"POST",headers:{"Content-Type":"application/json",apikey:CONFIG.SUPABASE_KEY,Authorization:"Bearer "+session.access_token},body:JSON.stringify({prompt,fast:!!fast})});
    const j=await r.json().catch(()=>({}));
    if(!r.ok) throw {code:r.status===429?"rate_limited":r.status===401?"sign_in":"server",message:j.error};
    return parseJSON(j.text);
  }
};
function puterText(r){
  if(typeof r==="string") return r;
  const c=r&&r.message&&r.message.content;
  if(typeof c==="string") return c;
  if(Array.isArray(c)) return c.map(x=>x&&(x.text||"")).join("");
  if(r&&typeof r.text==="string") return r.text;
  return String(r||"");
}
/* One tap to turn on the free AI. Signing in opens Puter's pop-up, so it must follow a click. */
function openPuterConnect(then){
  S.afterPuter=then||null;
  $("#authBox").innerHTML=`<h2 id="authTitle">Turn on the free AI</h2>
    <p>Recipe ideas and dish fixes come from Google's Gemini through Puter, so there's no key and nothing to pay on this site.</p>
    <p>Sign in to a free Puter account once. Your AI use comes out of that account's free allowance, and it remembers you next time.</p>
    <button class="btn primary" data-act="puter-connect">Connect free AI</button>
    <button class="linkbtn" data-act="auth-close" style="align-self:center">Not now</button>`;
  $("#authModal").hidden=false; $("#authBox").querySelector(".btn").focus();
}
function parseJSON(t){
  t=String(t||"").trim().replace(/^```(?:json)?\s*/i,"").replace(/```\s*$/,"").trim();
  try{return JSON.parse(t);}catch(e){const m=t.match(/[\[{][\s\S]*[\]}]/);if(m)return JSON.parse(m[0]);throw {code:"bad_json"};}
}

