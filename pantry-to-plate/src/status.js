/* ---------- AI status badge: live / demo / offline ---------- */
function aiState(){ if(!navigator.onLine) return "off"; if(AI.ready) return "live"; return S.aiChecking?"checking":"demo"; }
function renderAiStatus(){
  const b=$("#aiStatus"), st=aiState();
  b.className="status"+(st==="live"?" live":st==="demo"?" demo":st==="off"?" off":"");
  b.textContent={live:"AI · "+AI.name,demo:"Demo mode",off:"Offline",checking:"AI · connecting"}[st];
  b.title="What does this mean?";
}
function openAiInfo(){
  const st=aiState();
  const T={
    live:`<h2 id="authTitle">Live AI is on</h2><p>${esc(AI.name)} adds extra recipe ideas (checked against your kitchen before they're shown) and suggests fixes in Rescue My Dish. The main recipes come from a tested library either way.</p>${AI.mode==="server"&&!Cloud.user?`<p>Sign in to use it.</p><button class="btn" data-act="account">Sign in</button>`:""}${AI.mode==="puter"?`<p>It runs through Puter: no key needed. The first time, you sign in to a free Puter account.</p>`:""}`,
    demo:`<h2 id="authTitle">AI isn't connected right now</h2><p>Everything important still works: your kitchen, freshness tracking, the tested recipe library, swaps and saved recipes.</p><p>Only the extra AI recipe ideas and AI dish fixes are off; you'll get ready-made fixes instead.</p>`,
    off:`<h2 id="authTitle">You're offline</h2><p>Your pantry and cookbooks still work on this device. AI and account syncing pick up again as soon as you're back online.</p>`,
    checking:`<h2 id="authTitle">Connecting to the AI…</h2><p>This takes a few seconds. If it can't connect, the app switches to demo mode with sample recipes.</p>`
  };
  $("#authBox").innerHTML=T[st]+`<button class="btn primary" data-act="auth-close">Got it</button>`;
  $("#authModal").hidden=false; $("#authBox").querySelector("button").focus();
}

