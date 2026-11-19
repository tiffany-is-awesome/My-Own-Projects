/* ---------- AI status badge: live / demo / offline ---------- */
function aiState(){
  if(!navigator.onLine) return "off";
  if(S.aiChecking) return "checking";
  if(!AI.ready) return "none";
  if(AI.mode==="puter"&&!S.puterConnected) return "signin";
  if(AI.mode==="server"&&!Cloud.user) return "signin";
  return "live";
}
function renderAiStatus(){
  const b=$("#aiStatus"), st=aiState();
  b.className="status"+(st==="live"?" live":st==="off"?" off":(st==="signin"||st==="none")?" demo":"");
  b.textContent={live:"AI · "+AI.name+" connected",signin:"AI · connect",none:"No AI",off:"Offline",checking:"AI · checking"}[st];
  b.title="What does this mean?";
}
function openAiInfo(){
  const st=aiState();
  const T={
    live:`<h2 id="authTitle">AI is connected</h2><p>${esc(AI.name)} adds extra recipe ideas (checked against your kitchen and reviewed before they're shown) and suggests fixes in Rescue My Dish. AI recipes aren't test-cooked or guaranteed. The main recipes come from the curated library either way.</p>`,
    signin:`<h2 id="authTitle">Connect the free AI</h2><p>Extra AI recipe ideas use ${esc(AI.name)}${AI.mode==="puter"?" through Puter. Connect once with a free Puter account; your use comes out of its free allowance":". Sign in to your Pantry → Plate account to use it"}.</p><p>Everything else works without it: your kitchen, freshness, the curated recipes, swaps and saved recipes.</p>${AI.mode==="puter"?`<button class="btn primary" data-act="puter-connect">Connect free AI</button>`:`<button class="btn primary" data-act="account">Sign in</button>`}`,
    none:`<h2 id="authTitle">AI isn't available right now</h2><p>Everything important still works: your kitchen, freshness tracking, the curated recipe library, swaps and saved recipes.</p><p>Only the extra AI recipe ideas and AI dish fixes are off; you'll get ready-made fixes instead.</p>`,
    off:`<h2 id="authTitle">You're offline</h2><p>Your pantry and cookbooks still work on this device. AI and account syncing pick up again as soon as you're back online.</p>`,
    checking:`<h2 id="authTitle">Connecting to the AI…</h2><p>This takes a few seconds. If it can't connect, the app switches to demo mode with sample recipes.</p>`
  };
  $("#authBox").innerHTML=T[st]+`<button class="${st==="signin"?"linkbtn":"btn primary"}" data-act="auth-close">${st==="signin"?"Not now":"Got it"}</button>`;
  $("#authModal").hidden=false; $("#authBox").querySelector("button").focus();
}

